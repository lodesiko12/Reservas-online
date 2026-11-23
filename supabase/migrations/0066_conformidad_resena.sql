-- =====================================================================
-- 0066_conformidad_resena.sql
-- Conformidad aparte y opcional para recibir por correo la peticion de
-- resena (RGPD art. 6.1.a y LSSI art. 21). Con review_consent_required =
-- true el widget muestra una casilla propia sin marcar y el cron
-- request-reviews solo escribe a quien la marco. Con false (por defecto)
-- nada cambia para ningun negocio.
-- =====================================================================

alter table public.businesses
  add column if not exists review_consent_required boolean not null default false;

alter table public.bookings
  add column if not exists review_consent_at     timestamptz,
  add column if not exists review_consent_text   text,
  add column if not exists review_consent_source text;
alter table public.bookings
  drop constraint if exists bookings_review_consent_source_check;
alter table public.bookings
  add constraint bookings_review_consent_source_check
  check (review_consent_source is null or review_consent_source in ('widget', 'panel'));

drop function if exists public.get_public_business(text);
create function public.get_public_business(p_slug text)
returns table (
  id uuid, name text, type business_type, primary_color text, logo_url text,
  timezone text, slot_interval_min integer, order_mode boolean, online_orders boolean,
  consent_required boolean, consent_text text, consent_url text,
  review_consent_required boolean
)
language sql stable security definer set search_path = public
as $$
  select id, name, type, primary_color, logo_url, timezone, slot_interval_min, order_mode, online_orders,
         consent_required, consent_text, consent_url, review_consent_required
  from businesses where slug = p_slug and is_active
$$;

revoke all on function public.get_public_business(text) from public;
grant execute on function public.get_public_business(text) to anon, authenticated, service_role;

-- Centro de Ana: desde ahora la peticion de resena solo sale a quien la acepte.
update public.businesses set review_consent_required = true
 where slug = 'centrodepsicologia-anasanchez';
