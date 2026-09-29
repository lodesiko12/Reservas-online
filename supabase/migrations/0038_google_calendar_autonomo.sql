-- =====================================================================
-- 0038_google_calendar_autonomo.sql
-- Extiende Google Calendar (0021) a negocios tipo "autonomo": la conexión
-- es POR NEGOCIO (no hay profesionales), igual patrón que Business Profile
-- (0026). professional_google_accounts pasa a admitir también filas "de
-- negocio" (professional_id null, business_id relleno) junto a las "de
-- profesional" que ya existían. Solo se exporta (crm_events → Google); no
-- se importa disponibilidad ocupada porque autónomo no tiene widget de
-- reservas online que proteger con bloqueos.
-- =====================================================================

alter table public.crm_events
  add column if not exists google_event_id text;

alter table public.professional_google_accounts
  drop constraint professional_google_accounts_pkey,
  alter column professional_id drop not null,
  add column id uuid not null default gen_random_uuid(),
  add column business_id uuid references public.businesses(id) on delete cascade,
  add constraint professional_google_accounts_pkey primary key (id),
  add constraint pga_one_owner check ((professional_id is not null) <> (business_id is not null));

create unique index pga_professional_unique on public.professional_google_accounts(professional_id) where professional_id is not null;
create unique index pga_business_unique on public.professional_google_accounts(business_id) where business_id is not null;

-- ---------------------------------------------------------------------
-- Estado de conexión del negocio (sin exponer tokens) — mismo shape que
-- get_professional_google_status/set_professional_google_sync/disconnect_professional_google.
-- ---------------------------------------------------------------------
create or replace function public.get_business_google_status(p_business_id uuid)
returns table (connected boolean, google_email text, sync_enabled boolean)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not public.is_business_member(p_business_id) then raise exception 'No autorizado'; end if;
  return query
  select (pga.business_id is not null), pga.google_email, coalesce(pga.sync_enabled, true)
  from (select p_business_id as id) x
  left join public.professional_google_accounts pga on pga.business_id = x.id;
end $$;

create or replace function public.set_business_google_sync(p_business_id uuid, p_enabled boolean)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not public.is_business_member(p_business_id) then raise exception 'No autorizado'; end if;
  update public.professional_google_accounts set sync_enabled = p_enabled, updated_at = now()
  where business_id = p_business_id;
end $$;

create or replace function public.disconnect_business_google(p_business_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not public.is_business_member(p_business_id) then raise exception 'No autorizado'; end if;
  delete from public.professional_google_accounts where business_id = p_business_id;
end $$;

revoke execute on function public.get_business_google_status(uuid) from public, anon;
revoke execute on function public.set_business_google_sync(uuid,boolean) from public, anon;
revoke execute on function public.disconnect_business_google(uuid) from public, anon;
grant execute on function public.get_business_google_status(uuid) to authenticated;
grant execute on function public.set_business_google_sync(uuid,boolean) to authenticated;
grant execute on function public.disconnect_business_google(uuid) to authenticated;
