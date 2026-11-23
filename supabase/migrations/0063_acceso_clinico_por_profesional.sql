-- =====================================================================
-- 0063_acceso_clinico_por_profesional.sql
-- RGPD (datos de salud, art. 9): las notas clinicas y los informes de IA
-- solo los ve la profesional responsable del paciente, o quien la cubra
-- con una cobertura vigente. Ni las owner ni el super-admin acceden por
-- el hecho de serlo. La ficha administrativa (agenda, telefono, citas)
-- sigue compartida.
--
--  1. professionals.user_id        -> vincula profesional con su cuenta
--  2. customers.professional_id    -> profesional responsable del paciente
--  3. clinical_coverages           -> coberturas temporales (la concede la cubierta)
--  4. clinical_access_log          -> registro de accesos a notas clinicas
--  5. RLS de client_sessions y client_ai_reports
-- Cuando el usuario confirme, el paso de datos (vinculos y asignacion
-- inicial) se ejecuta aparte: ver 0064 en el mismo directorio.
-- =====================================================================

-- 1. Vinculo profesional <-> cuenta -------------------------------------
alter table public.professionals
  add column if not exists user_id uuid references auth.users(id) on delete set null;
create unique index if not exists professionals_user_uniq
  on public.professionals (business_id, user_id) where user_id is not null;

-- 2. Responsable del paciente -------------------------------------------
alter table public.customers
  add column if not exists professional_id uuid references public.professionals(id) on delete set null;
create index if not exists customers_professional_idx on public.customers (professional_id);

-- 3. Coberturas ----------------------------------------------------------
create table if not exists public.clinical_coverages (
  id                       uuid primary key default gen_random_uuid(),
  business_id              uuid not null references public.businesses(id) on delete cascade,
  covered_professional_id  uuid not null references public.professionals(id) on delete cascade,
  covering_professional_id uuid not null references public.professionals(id) on delete cascade,
  starts_on                date not null,
  ends_on                  date not null,
  created_by               uuid references auth.users(id) on delete set null,
  created_at               timestamptz not null default now(),
  check (ends_on >= starts_on),
  check (covered_professional_id <> covering_professional_id)
);
create index if not exists clinical_coverages_covering_idx
  on public.clinical_coverages (covering_professional_id, starts_on, ends_on);
alter table public.clinical_coverages enable row level security;

-- 4. Registro de accesos -------------------------------------------------
create table if not exists public.clinical_access_log (
  id          bigint generated always as identity primary key,
  business_id uuid not null references public.businesses(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  user_id     uuid references auth.users(id) on delete set null,
  action      text not null,          -- 'ver_historial','ver_informe','generar_informe','asignar','cobertura'
  detail      text,
  at          timestamptz not null default now()
);
create index if not exists clinical_access_log_customer_idx on public.clinical_access_log (customer_id, at desc);
alter table public.clinical_access_log enable row level security;

-- Helpers ----------------------------------------------------------------
-- Profesional vinculada a la cuenta que llama, dentro de un negocio.
create or replace function public.my_professional_id(b uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select p.id from public.professionals p
  where p.business_id = b and p.user_id = auth.uid() limit 1;
$$;

-- ¿Puede la cuenta que llama leer/escribir las notas clinicas de este paciente?
-- (responsable, o cubre a la responsable hoy). Sin excepcion para owner ni super-admin.
create or replace function public.can_access_clinical(c uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.customers cu
    where cu.id = c
      and cu.professional_id is not null
      and (
        cu.professional_id = public.my_professional_id(cu.business_id)
        or exists (
          select 1 from public.clinical_coverages cc
          where cc.business_id = cu.business_id
            and cc.covered_professional_id = cu.professional_id
            and cc.covering_professional_id = public.my_professional_id(cu.business_id)
            and (now() at time zone 'Europe/Madrid')::date between cc.starts_on and cc.ends_on
        )
      )
  );
$$;
revoke execute on function public.my_professional_id(uuid) from public, anon;
revoke execute on function public.can_access_clinical(uuid) from public, anon;
grant execute on function public.my_professional_id(uuid) to authenticated;
grant execute on function public.can_access_clinical(uuid) to authenticated;

-- 5. RLS clinica ---------------------------------------------------------
drop policy if exists client_sessions_all on public.client_sessions;
create policy client_sessions_clinical on public.client_sessions for all to authenticated
  using (public.can_access_clinical(customer_id))
  with check (public.can_access_clinical(customer_id));

drop policy if exists client_ai_reports_all on public.client_ai_reports;
create policy client_ai_reports_clinical on public.client_ai_reports for all to authenticated
  using (public.can_access_clinical(customer_id))
  with check (public.can_access_clinical(customer_id));

-- Coberturas: las ve quien cubre, quien es cubierta y las owner (solo metadatos).
create policy clinical_coverages_select on public.clinical_coverages for select to authenticated
  using (
    covered_professional_id = public.my_professional_id(business_id)
    or covering_professional_id = public.my_professional_id(business_id)
    or exists (select 1 from public.business_users bu
               where bu.business_id = clinical_coverages.business_id
                 and bu.user_id = auth.uid() and bu.role = 'owner')
  );
-- Las escribe solo la RPC (security definer).

-- El log lo ven solo las owner (auditoria) y se escribe por RPC.
create policy clinical_access_log_select on public.clinical_access_log for select to authenticated
  using (exists (select 1 from public.business_users bu
                 where bu.business_id = clinical_access_log.business_id
                   and bu.user_id = auth.uid() and bu.role = 'owner'));

-- RPC: asignar o traspasar responsable --------------------------------------
-- Sin responsable: cualquier profesional vinculada se lo asigna a si misma; una owner
-- puede asignarlo a cualquiera (no ve notas por ello). Con responsable: solo la
-- propia responsable puede traspasarlo (nadie puede "robar" un paciente asignado).
create or replace function public.assign_customer_professional(p_customer uuid, p_professional uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  cu public.customers%rowtype;
  me uuid;
  is_owner boolean;
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
    if me is distinct from cu.professional_id then
      raise exception 'Solo la profesional responsable puede traspasar este paciente';
    end if;
  end if;

  update public.customers set professional_id = p_professional where id = p_customer;
  insert into public.clinical_access_log (business_id, customer_id, user_id, action, detail)
  values (cu.business_id, p_customer, auth.uid(), 'asignar',
          coalesce(cu.professional_id::text, 'sin responsable') || ' -> ' || p_professional::text);
end $$;

-- Impide cambiar professional_id por UPDATE directo (solo vale la RPC).
create or replace function public.guard_customer_professional()
returns trigger language plpgsql as $$
begin
  if new.professional_id is distinct from old.professional_id
     and current_user not in ('postgres', 'supabase_admin', 'service_role') then
    -- La RPC es security definer (owner postgres), asi que current_user='postgres' pasa.
    raise exception 'El responsable solo se cambia con assign_customer_professional';
  end if;
  return new;
end $$;
drop trigger if exists trg_guard_customer_professional on public.customers;
create trigger trg_guard_customer_professional before update on public.customers
  for each row execute function public.guard_customer_professional();

-- RPC: conceder cobertura -----------------------------------------------------
-- La concede la profesional cubierta. Una owner puede concederla SOLO si la que cubre
-- no es ella misma (evita que se la de a si misma para leer notas ajenas).
create or replace function public.grant_clinical_coverage(
  p_business uuid, p_covered uuid, p_covering uuid, p_from date, p_to date)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  me uuid; is_owner boolean; new_id uuid;
begin
  if not public.is_business_member(p_business) then raise exception 'Sin acceso'; end if;
  me := public.my_professional_id(p_business);
  select exists (select 1 from public.business_users bu
                 where bu.business_id = p_business and bu.user_id = auth.uid() and bu.role = 'owner')
    into is_owner;
  if not exists (select 1 from public.professionals where id = p_covered and business_id = p_business)
     or not exists (select 1 from public.professionals where id = p_covering and business_id = p_business) then
    raise exception 'Profesional no valida';
  end if;
  if not (me = p_covered or (is_owner and me is distinct from p_covering)) then
    raise exception 'Solo la profesional cubierta puede conceder la cobertura';
  end if;
  if p_to < p_from then raise exception 'Fechas no validas'; end if;
  insert into public.clinical_coverages
    (business_id, covered_professional_id, covering_professional_id, starts_on, ends_on, created_by)
  values (p_business, p_covered, p_covering, p_from, p_to, auth.uid())
  returning id into new_id;
  insert into public.clinical_access_log (business_id, user_id, action, detail)
  values (p_business, auth.uid(), 'cobertura',
          p_covering::text || ' cubre a ' || p_covered::text || ' ' || p_from || '..' || p_to);
  return new_id;
end $$;

create or replace function public.revoke_clinical_coverage(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare cc public.clinical_coverages%rowtype; me uuid;
begin
  select * into cc from public.clinical_coverages where id = p_id;
  if not found then return; end if;
  me := public.my_professional_id(cc.business_id);
  if me is distinct from cc.covered_professional_id then
    raise exception 'Solo la profesional cubierta puede revocarla';
  end if;
  delete from public.clinical_coverages where id = p_id;
  insert into public.clinical_access_log (business_id, user_id, action, detail)
  values (cc.business_id, auth.uid(), 'cobertura', 'revocada ' || p_id::text);
end $$;

-- RPC: registrar un acceso (la llama el panel al abrir Historial / Informe) -----
create or replace function public.log_clinical_access(p_customer uuid, p_action text)
returns void language plpgsql security definer set search_path = public as $$
declare b uuid;
begin
  if not public.can_access_clinical(p_customer) then return; end if;
  select business_id into b from public.customers where id = p_customer;
  insert into public.clinical_access_log (business_id, customer_id, user_id, action)
  values (b, p_customer, auth.uid(), left(p_action, 40));
end $$;

revoke execute on function public.assign_customer_professional(uuid, uuid) from public, anon;
revoke execute on function public.grant_clinical_coverage(uuid, uuid, uuid, date, date) from public, anon;
revoke execute on function public.revoke_clinical_coverage(uuid) from public, anon;
revoke execute on function public.log_clinical_access(uuid, text) from public, anon;
grant execute on function public.assign_customer_professional(uuid, uuid) to authenticated;
grant execute on function public.grant_clinical_coverage(uuid, uuid, uuid, date, date) to authenticated;
grant execute on function public.revoke_clinical_coverage(uuid) to authenticated;
grant execute on function public.log_clinical_access(uuid, text) to authenticated;
