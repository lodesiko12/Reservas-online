-- =====================================================================
-- 0065_acceso_excepcional_y_reasignacion.sql
-- Complemento de 0063. La responsable del tratamiento (owner con cuenta de
-- profesional) debe poder atender derechos del paciente, requerimientos
-- judiciales o una inspeccion, y reasignar pacientes cuando la profesional
-- ya no esta:
--  1. Acceso excepcional: motivo obligatorio (>= 20 caracteres), dura 24 h,
--     queda registrado y lo ve la profesional responsable del paciente.
--  2. Reasignacion por una owner cuando la responsable ya no tiene cuenta
--     activa en el negocio.
--  3. search_path fijo en guard_customer_professional (aviso del linter).
-- =====================================================================

create table if not exists public.clinical_exceptional_access (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  reason      text not null check (char_length(btrim(reason)) >= 20),
  granted_at  timestamptz not null default now(),
  expires_at  timestamptz not null default now() + interval '24 hours'
);
create index if not exists clinical_exceptional_access_idx
  on public.clinical_exceptional_access (customer_id, user_id, expires_at);
alter table public.clinical_exceptional_access enable row level security;
-- Sin politicas de escritura: solo la RPC. Lectura: quien lo uso y la responsable del paciente.
create policy clinical_exceptional_access_select on public.clinical_exceptional_access
  for select to authenticated
  using (
    user_id = auth.uid()
    or exists (select 1 from public.customers cu
               where cu.id = clinical_exceptional_access.customer_id
                 and cu.professional_id is not null
                 and cu.professional_id = public.my_professional_id(cu.business_id))
  );

-- can_access_clinical: añade el acceso excepcional vigente.
create or replace function public.can_access_clinical(c uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.customers cu
    where cu.id = c
      and (
        (cu.professional_id is not null and (
          cu.professional_id = public.my_professional_id(cu.business_id)
          or exists (
            select 1 from public.clinical_coverages cc
            where cc.business_id = cu.business_id
              and cc.covered_professional_id = cu.professional_id
              and cc.covering_professional_id = public.my_professional_id(cu.business_id)
              and (now() at time zone 'Europe/Madrid')::date between cc.starts_on and cc.ends_on
          )
        ))
        or exists (
          select 1 from public.clinical_exceptional_access g
          where g.customer_id = cu.id and g.user_id = auth.uid() and g.expires_at > now()
        )
      )
  );
$$;

-- RPC: solicitar acceso excepcional (solo owner con cuenta de profesional vinculada).
create or replace function public.request_exceptional_clinical_access(p_customer uuid, p_reason text)
returns timestamptz language plpgsql security definer set search_path = public as $$
declare
  cu public.customers%rowtype;
  exp timestamptz := now() + interval '24 hours';
  who text;
begin
  select * into cu from public.customers where id = p_customer;
  if not found then raise exception 'Paciente no encontrado'; end if;
  if not exists (select 1 from public.business_users bu
                 where bu.business_id = cu.business_id and bu.user_id = auth.uid() and bu.role = 'owner')
     or public.my_professional_id(cu.business_id) is null then
    raise exception 'Solo la responsable del centro puede solicitar el acceso excepcional';
  end if;
  if char_length(btrim(coalesce(p_reason, ''))) < 20 then
    raise exception 'Indica el motivo (minimo 20 caracteres)';
  end if;
  insert into public.clinical_exceptional_access (business_id, customer_id, user_id, reason, expires_at)
  values (cu.business_id, p_customer, auth.uid(), btrim(p_reason), exp);
  select email into who from auth.users where id = auth.uid();
  insert into public.clinical_access_log (business_id, customer_id, user_id, action, detail)
  values (cu.business_id, p_customer, auth.uid(), 'acceso_excepcional', coalesce(who, '?') || ': ' || btrim(p_reason));
  return exp;
end $$;
revoke execute on function public.request_exceptional_clinical_access(uuid, text) from public, anon;
grant execute on function public.request_exceptional_clinical_access(uuid, text) to authenticated;

-- El log lo ven las owner y la profesional responsable del paciente (transparencia).
drop policy if exists clinical_access_log_select on public.clinical_access_log;
create policy clinical_access_log_select on public.clinical_access_log for select to authenticated
  using (
    exists (select 1 from public.business_users bu
            where bu.business_id = clinical_access_log.business_id
              and bu.user_id = auth.uid() and bu.role = 'owner')
    or exists (select 1 from public.customers cu
               where cu.id = clinical_access_log.customer_id
                 and cu.professional_id is not null
                 and cu.professional_id = public.my_professional_id(cu.business_id))
  );

-- Reasignacion: ademas de lo anterior, una owner puede reasignar un paciente cuando
-- la responsable ya no tiene cuenta activa en el negocio.
create or replace function public.assign_customer_professional(p_customer uuid, p_professional uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  cu public.customers%rowtype;
  me uuid;
  is_owner boolean;
  orphan boolean;
begin
  select * into cu from public.customers where id = p_customer;
  if not found then raise exception 'Paciente no encontrado'; end if;
  if not public.is_business_member(cu.business_id) then raise exception 'Sin acceso'; end if;
  if not exists (select 1 from public.professionals
                 where id = p_professional and business_id = cu.business_id) then
    raise exception 'Profesional no valida';
  end if;
  me := public.my_professional_id(cu.business_id);
  select exists (select 1 from public.business_users bu
                 where bu.business_id = cu.business_id and bu.user_id = auth.uid() and bu.role = 'owner')
    into is_owner;

  if cu.professional_id is null then
    if not (is_owner or (me is not null and p_professional = me)) then
      raise exception 'Solo puedes asignarte pacientes a ti misma';
    end if;
  else
    select not exists (
      select 1 from public.professionals p
      join public.business_users bu on bu.user_id = p.user_id and bu.business_id = p.business_id
      where p.id = cu.professional_id
    ) into orphan;
    if not (me is not distinct from cu.professional_id or (is_owner and orphan)) then
      raise exception 'Solo la profesional responsable puede traspasar este paciente';
    end if;
  end if;

  update public.customers set professional_id = p_professional where id = p_customer;
  insert into public.clinical_access_log (business_id, customer_id, user_id, action, detail)
  values (cu.business_id, p_customer, auth.uid(), 'asignar',
          coalesce(cu.professional_id::text, 'sin responsable') || ' -> ' || p_professional::text);
end $$;

-- Aviso del linter: search_path fijo.
alter function public.guard_customer_professional() set search_path = public;
