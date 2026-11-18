-- 0059_consentimiento_confidencialidad.sql
-- Consentimiento de confidencialidad en las reservas (pensado para psicólogos):
--  * businesses: interruptor + texto + enlace opcional a la política (por negocio, apagado por defecto).
--  * bookings: constancia de la aceptación (cuándo, con qué texto y desde dónde: widget o panel).
--  * get_public_business: expone los tres campos del negocio al widget (cambia el tipo de retorno
--    -> drop + create, reescrito desde la definición vigente en producción).
-- Es aditivo: con consent_required = false (valor por defecto) nada cambia para ningún negocio.

alter table public.businesses
  add column if not exists consent_required boolean not null default false,
  add column if not exists consent_text     text,
  add column if not exists consent_url      text;

alter table public.bookings
  add column if not exists consent_accepted_at timestamptz,
  add column if not exists consent_text        text,
  add column if not exists consent_source      text;

alter table public.bookings
  drop constraint if exists bookings_consent_source_check;
alter table public.bookings
  add constraint bookings_consent_source_check check (consent_source is null or consent_source in ('widget', 'panel'));

drop function if exists public.get_public_business(text);
create function public.get_public_business(p_slug text)
returns table (
  id uuid, name text, type business_type, primary_color text, logo_url text,
  timezone text, slot_interval_min integer, order_mode boolean, online_orders boolean,
  consent_required boolean, consent_text text, consent_url text
)
language sql stable security definer set search_path = public
as $$
  select id, name, type, primary_color, logo_url, timezone, slot_interval_min, order_mode, online_orders,
         consent_required, consent_text, consent_url
  from businesses where slug = p_slug and is_active
$$;

revoke all on function public.get_public_business(text) from public;
grant execute on function public.get_public_business(text) to anon, authenticated, service_role;
