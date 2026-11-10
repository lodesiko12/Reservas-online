-- =====================================================================
-- 0054_available_days_channel.sql
-- get_available_days / get_available_dining_days aceptan p_channel (por defecto
-- 'web') y lo propagan a get_available_slots / get_available_dining_slots.
--
-- Así el selector de día de la reserva manual del panel (canal 'manual') ofrece
-- exactamente los días en los que el staff puede reservar, con las mismas reglas
-- que sus huecos (sin antelación máxima/mínima, stock diario online ni mín/máx de
-- comensales pensados para la web). El widget no cambia: no pasa p_channel y sigue
-- usando 'web'.
--
-- Se elimina la firma antigua para no dejar dos sobrecargas ambiguas; las llamadas
-- por nombre de parámetro del widget siguen resolviendo a la nueva.
-- =====================================================================

drop function if exists public.get_available_days(uuid, uuid, date, date, uuid);
drop function if exists public.get_available_dining_days(uuid, date, date, integer);

create or replace function public.get_available_days(
  p_business_id uuid,
  p_service_id uuid,
  p_date_from date,
  p_date_to date,
  p_professional_id uuid default null,
  p_channel booking_channel default 'web'
)
returns table(day date)
language sql
stable security definer
set search_path to 'public'
as $function$
  select d::date as day
  from generate_series(p_date_from, p_date_to, interval '1 day') as d
  where exists (
    select 1 from public.get_available_slots(p_business_id, p_service_id, d::date, p_professional_id, p_channel) limit 1
  )
$function$;

create or replace function public.get_available_dining_days(
  p_business_id uuid,
  p_date_from date,
  p_date_to date,
  p_party_size integer,
  p_channel booking_channel default 'web'
)
returns table(day date)
language sql
stable security definer
set search_path to 'public'
as $function$
  select d::date as day
  from generate_series(p_date_from, p_date_to, interval '1 day') as d
  where exists (
    select 1 from public.get_available_dining_slots(p_business_id, d::date, p_party_size, p_channel) limit 1
  )
$function$;

-- Públicas a propósito (las usa el widget con la clave anon), igual que 0023.
revoke all on function public.get_available_days(uuid, uuid, date, date, uuid, booking_channel) from public;
revoke all on function public.get_available_dining_days(uuid, date, date, integer, booking_channel) from public;
grant execute on function public.get_available_days(uuid, uuid, date, date, uuid, booking_channel) to anon, authenticated;
grant execute on function public.get_available_dining_days(uuid, date, date, integer, booking_channel) to anon, authenticated;
