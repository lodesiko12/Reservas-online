-- Días (dentro de un rango) con al menos un hueco disponible, para que el
-- widget pueda ocultar los días sin disponibilidad en el selector de fecha,
-- en vez de mostrar 21 días y que el cliente tenga que ir probando uno a uno.
-- Reutiliza get_available_slots / get_available_dining_slots (única fuente
-- de verdad del motor de disponibilidad) en vez de duplicar su lógica.

create or replace function public.get_available_days(
  p_business_id uuid,
  p_service_id uuid,
  p_date_from date,
  p_date_to date,
  p_professional_id uuid default null
)
returns table(day date)
language sql
stable security definer
set search_path to 'public'
as $function$
  select d::date as day
  from generate_series(p_date_from, p_date_to, interval '1 day') as d
  where exists (
    select 1 from public.get_available_slots(p_business_id, p_service_id, d::date, p_professional_id) limit 1
  )
$function$;

grant execute on function public.get_available_days(uuid, uuid, date, date, uuid) to anon, authenticated;

create or replace function public.get_available_dining_days(
  p_business_id uuid,
  p_date_from date,
  p_date_to date,
  p_party_size integer
)
returns table(day date)
language sql
stable security definer
set search_path to 'public'
as $function$
  select d::date as day
  from generate_series(p_date_from, p_date_to, interval '1 day') as d
  where exists (
    select 1 from public.get_available_dining_slots(p_business_id, d::date, p_party_size) limit 1
  )
$function$;

grant execute on function public.get_available_dining_days(uuid, date, date, integer) to anon, authenticated;
