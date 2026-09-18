-- =====================================================================
-- 0021_google_calendar.sql
-- Sincronización con Google Calendar, con credenciales OAuth PROPIAS DE
-- CADA NEGOCIO (igual patrón que Resend/WhatsApp en business_integrations):
-- cada negocio crea su propio proyecto de Google Cloud y pega aquí su
-- Client ID/Secret; cada profesional del negocio conecta su cuenta de
-- Google individualmente.
--
-- Diseño:
--   * business_integrations gana google_client_id / google_client_secret.
--   * professional_google_accounts guarda los tokens OAuth POR PROFESIONAL
--     (secretos, solo accesibles vía service_role o RPCs SECURITY DEFINER).
--   * bookings.google_event_id: id del evento exportado a la agenda del
--     profesional (para poder actualizarlo/borrarlo después).
--   * blocks gana `source`: los bloqueos generados automáticamente al
--     importar huecos ocupados de Google se marcan 'google_calendar' para
--     poder limpiarlos/regenerarlos sin tocar los bloqueos manuales del staff.
-- =====================================================================

alter table public.business_integrations
  add column if not exists google_client_id     text,
  add column if not exists google_client_secret  text; -- SECRETO

alter table public.bookings
  add column if not exists google_event_id text;

alter table public.blocks
  add column if not exists source text not null default 'manual';
-- 'manual' (creado desde el panel) | 'google_calendar' (importado por sync)

create table public.professional_google_accounts (
  professional_id   uuid primary key references public.professionals(id) on delete cascade,
  google_email      text,               -- cuenta conectada, solo para mostrarla en el panel
  calendar_id       text not null default 'primary',
  access_token      text,               -- SECRETO, de corta duración
  refresh_token     text,               -- SECRETO
  token_expires_at  timestamptz,
  sync_enabled      boolean not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

alter table public.professional_google_accounts enable row level security;

-- Acceso directo a la tabla: solo super-admin (contiene tokens). El resto vía RPC.
create policy professional_google_accounts_admin on public.professional_google_accounts for all to authenticated
  using (public.is_super_admin()) with check (public.is_super_admin());

drop trigger if exists trg_pga_updated on public.professional_google_accounts;
create trigger trg_pga_updated before update on public.professional_google_accounts
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- Credenciales de Google del negocio (Client ID/Secret propios)
-- ---------------------------------------------------------------------
create or replace function public.get_google_credentials_status(p_business_id uuid)
returns table (google_client_id text, has_google_client_secret boolean)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not public.is_business_member(p_business_id) then raise exception 'No autorizado'; end if;
  return query
  select bi.google_client_id,
         coalesce(bi.google_client_secret is not null and length(bi.google_client_secret) > 0, false)
  from (select p_business_id as id) x
  left join public.business_integrations bi on bi.business_id = x.id;
end $$;

create or replace function public.set_google_credentials(
  p_business_id     uuid,
  p_client_id       text,
  p_client_secret   text default null
) returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not public.is_business_member(p_business_id) then raise exception 'No autorizado'; end if;
  insert into public.business_integrations as bi (business_id, google_client_id, google_client_secret)
  values (p_business_id, nullif(p_client_id, ''), nullif(p_client_secret, ''))
  on conflict (business_id) do update set
    google_client_id     = nullif(excluded.google_client_id, ''),
    google_client_secret = coalesce(nullif(excluded.google_client_secret, ''), bi.google_client_secret),
    updated_at            = now();
end $$;

-- ---------------------------------------------------------------------
-- Estado de conexión de un profesional (sin exponer tokens)
-- ---------------------------------------------------------------------
create or replace function public.get_professional_google_status(p_professional_id uuid)
returns table (connected boolean, google_email text, sync_enabled boolean)
language plpgsql stable security definer set search_path = public
as $$
declare v_biz uuid;
begin
  select business_id into v_biz from professionals where id = p_professional_id;
  if v_biz is null or not public.is_business_member(v_biz) then raise exception 'No autorizado'; end if;
  return query
  select (pga.professional_id is not null), pga.google_email, coalesce(pga.sync_enabled, true)
  from (select p_professional_id as id) x
  left join public.professional_google_accounts pga on pga.professional_id = x.id;
end $$;

create or replace function public.set_professional_google_sync(p_professional_id uuid, p_enabled boolean)
returns void
language plpgsql security definer set search_path = public
as $$
declare v_biz uuid;
begin
  select business_id into v_biz from professionals where id = p_professional_id;
  if v_biz is null or not public.is_business_member(v_biz) then raise exception 'No autorizado'; end if;
  update public.professional_google_accounts set sync_enabled = p_enabled, updated_at = now()
  where professional_id = p_professional_id;
end $$;

create or replace function public.disconnect_professional_google(p_professional_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare v_biz uuid;
begin
  select business_id into v_biz from professionals where id = p_professional_id;
  if v_biz is null or not public.is_business_member(v_biz) then raise exception 'No autorizado'; end if;
  delete from public.professional_google_accounts where professional_id = p_professional_id;
  delete from public.blocks where professional_id = p_professional_id and source = 'google_calendar';
end $$;

revoke execute on function public.get_google_credentials_status(uuid) from public, anon;
revoke execute on function public.set_google_credentials(uuid,text,text) from public, anon;
revoke execute on function public.get_professional_google_status(uuid) from public, anon;
revoke execute on function public.set_professional_google_sync(uuid,boolean) from public, anon;
revoke execute on function public.disconnect_professional_google(uuid) from public, anon;
grant execute on function public.get_google_credentials_status(uuid) to authenticated;
grant execute on function public.set_google_credentials(uuid,text,text) to authenticated;
grant execute on function public.get_professional_google_status(uuid) to authenticated;
grant execute on function public.set_professional_google_sync(uuid,boolean) to authenticated;
grant execute on function public.disconnect_professional_google(uuid) to authenticated;
