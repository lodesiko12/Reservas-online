-- =====================================================================
-- 0007_business_integrations.sql
-- Credenciales de email (Resend) y WhatsApp (Cloud API) POR NEGOCIO.
-- Cada tenant envía desde su propio remitente/número.
--
-- Seguridad: los secretos (api key / token) NUNCA se exponen al navegador.
--   * RLS: solo super-admin puede leer/escribir la tabla directamente.
--   * El staff del negocio configura vía RPCs SECURITY DEFINER:
--       - set_business_integration(...)  -> escribe (upsert)
--       - get_business_integration(...)  -> devuelve estado SIN secretos
--   * Las Edge Functions leen los secretos con service_role (bypassa RLS).
-- =====================================================================

create table if not exists public.business_integrations (
  business_id              uuid primary key references public.businesses(id) on delete cascade,
  email_from               text,     -- remitente verificado del negocio, p.ej. "La Plaza <hola@laplaza.com>"
  resend_api_key           text,     -- SECRETO
  whatsapp_phone_number_id text,     -- id del número emisor en Meta
  whatsapp_token           text,     -- SECRETO (token permanente de Meta)
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

alter table public.business_integrations enable row level security;

-- Acceso directo a la tabla: solo super-admin (para soporte). El resto, vía RPC.
drop policy if exists integrations_admin on public.business_integrations;
create policy integrations_admin on public.business_integrations for all to authenticated
  using (public.is_super_admin()) with check (public.is_super_admin());

drop trigger if exists trg_integrations_updated on public.business_integrations;
create trigger trg_integrations_updated before update on public.business_integrations
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- Estado de integraciones para el panel (sin devolver secretos).
-- ---------------------------------------------------------------------
create or replace function public.get_business_integration(p_business_id uuid)
returns table (
  email_from               text,
  whatsapp_phone_number_id text,
  has_resend_key           boolean,
  has_whatsapp_token       boolean
)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not public.is_business_member(p_business_id) then
    raise exception 'No autorizado';
  end if;
  return query
  select bi.email_from,
         bi.whatsapp_phone_number_id,
         coalesce(bi.resend_api_key  is not null and length(bi.resend_api_key)  > 0, false),
         coalesce(bi.whatsapp_token  is not null and length(bi.whatsapp_token)  > 0, false)
  from (select p_business_id as id) x
  left join public.business_integrations bi on bi.business_id = x.id;
end $$;

-- ---------------------------------------------------------------------
-- Guardar integraciones. Los secretos solo se sobrescriben si se envía
-- un valor nuevo no vacío (así el panel puede reguardar sin conocerlos).
-- ---------------------------------------------------------------------
create or replace function public.set_business_integration(
  p_business_id              uuid,
  p_email_from               text,
  p_whatsapp_phone_number_id text,
  p_resend_api_key           text default null,
  p_whatsapp_token           text default null
) returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not public.is_business_member(p_business_id) then
    raise exception 'No autorizado';
  end if;

  insert into public.business_integrations as bi
    (business_id, email_from, whatsapp_phone_number_id, resend_api_key, whatsapp_token)
  values (
    p_business_id,
    nullif(p_email_from, ''),
    nullif(p_whatsapp_phone_number_id, ''),
    nullif(p_resend_api_key, ''),
    nullif(p_whatsapp_token, '')
  )
  on conflict (business_id) do update set
    email_from               = nullif(excluded.email_from, ''),
    whatsapp_phone_number_id = nullif(excluded.whatsapp_phone_number_id, ''),
    resend_api_key           = coalesce(nullif(excluded.resend_api_key, ''), bi.resend_api_key),
    whatsapp_token           = coalesce(nullif(excluded.whatsapp_token, ''), bi.whatsapp_token),
    updated_at               = now();
end $$;

-- Permisos: miembros autenticados usan las RPCs; nunca anon.
revoke execute on function public.get_business_integration(uuid) from public, anon;
revoke execute on function public.set_business_integration(uuid,text,text,text,text) from public, anon;
grant execute on function public.get_business_integration(uuid) to authenticated;
grant execute on function public.set_business_integration(uuid,text,text,text,text) to authenticated;
