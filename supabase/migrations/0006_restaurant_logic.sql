-- =====================================================================
-- 0006_restaurant_logic.sql
-- Motor de reservas para tenants tipo "restaurante": franjas de servicio
-- (dining_shifts) con aforo de comensales (max_covers) y duración de mesa.
--
-- Capacidad = comensales simultáneos. Para un hueco candidato se suma el
-- party_size de las reservas que solapan [inicio, inicio+duración] en esa
-- franja; hay disponibilidad si (solapadas + solicitados) <= max_covers.
-- =====================================================================

-- Duración de la mesa por franja (minutos que ocupa una reserva).
alter table public.dining_shifts
  add column if not exists booking_duration_min int not null default 90
  check (booking_duration_min > 0);

-- ---------------------------------------------------------------------
-- Disponibilidad de restaurante
-- ---------------------------------------------------------------------
create or replace function public.get_available_dining_slots(
  p_business_id uuid,
  p_date        date,
  p_party_size  int
) returns table (slot_start timestamptz, slot_end timestamptz, shift_id uuid, shift_name text)
language plpgsql stable security definer set search_path = public
as $$
declare
  v_tz     text;
  v_active boolean;
  v_dow    int := extract(dow from p_date)::int;
begin
  select timezone, is_active into v_tz, v_active from businesses where id = p_business_id;
  if not found or not v_active then return; end if;
  if p_party_size is null or p_party_size < 1 then return; end if;

  return query
  with sh as (
    select id, name,
           extract(epoch from start_time)::int / 60 as s,
           extract(epoch from end_time)::int / 60   as e,
           max_covers, slot_interval_min, booking_duration_min
    from dining_shifts
    where business_id = p_business_id and is_active
      and v_dow = any (active_weekdays)
  ),
  slots as (
    select sh.id as shift_id, sh.name as shift_name, sh.max_covers, sh.booking_duration_min,
           gs as start_min
    from sh
    cross join lateral generate_series(sh.s, sh.e - sh.slot_interval_min, sh.slot_interval_min) gs
  ),
  cand as (
    select slots.shift_id, slots.shift_name, slots.max_covers,
           (p_date::timestamp + make_interval(mins => slots.start_min)) at time zone v_tz as slot_start,
           (p_date::timestamp + make_interval(mins => slots.start_min + slots.booking_duration_min)) at time zone v_tz as slot_end
    from slots
  )
  select c.slot_start, c.slot_end, c.shift_id, c.shift_name
  from cand c
  where c.slot_start > now()
    and not exists (
      select 1 from blocks bl
      where bl.business_id = p_business_id and bl.scope = 'business'
        and bl.starts_at < c.slot_end and bl.ends_at > c.slot_start
    )
    and (
      coalesce((
        select sum(b.party_size) from bookings b
        where b.dining_shift_id = c.shift_id
          and b.status in ('confirmada','completada')
          and b.starts_at < c.slot_end and b.ends_at > c.slot_start
      ), 0) + p_party_size
    ) <= c.max_covers
  order by c.slot_start;
end $$;

-- ---------------------------------------------------------------------
-- Creación transaccional de reserva de restaurante
-- ---------------------------------------------------------------------
create or replace function public.create_public_dining_booking(
  p_business_id uuid,
  p_shift_id    uuid,
  p_starts_at   timestamptz,
  p_party_size  int,
  p_name        text,
  p_last_name   text,
  p_phone       text,
  p_email       text,
  p_notes       text default null,
  p_channel     booking_channel default 'web'
) returns public.bookings
language plpgsql security definer set search_path = public
as $$
declare
  v_active boolean; v_tz text; v_dur int; v_ends timestamptz;
  v_cust uuid; v_locator text; v_row public.bookings; v_ok boolean;
begin
  select is_active, timezone into v_active, v_tz from businesses where id = p_business_id;
  if not coalesce(v_active, false) then raise exception 'Negocio no disponible'; end if;
  if p_party_size is null or p_party_size < 1 then raise exception 'Número de comensales no válido'; end if;

  select booking_duration_min into v_dur
  from dining_shifts where id = p_shift_id and business_id = p_business_id and is_active;
  if not found then raise exception 'Franja no válida'; end if;
  v_ends := p_starts_at + make_interval(mins => v_dur);

  perform pg_advisory_xact_lock(hashtext(p_business_id::text));

  select exists (
    select 1 from public.get_available_dining_slots(
      p_business_id, (p_starts_at at time zone v_tz)::date, p_party_size
    ) s where s.slot_start = p_starts_at and s.shift_id = p_shift_id
  ) into v_ok;
  if not v_ok then raise exception 'No hay aforo para ese número de comensales en ese horario'; end if;

  if p_phone is not null and length(trim(p_phone)) > 0 then
    insert into public.customers (business_id, full_name, last_name, phone, email)
    values (p_business_id, p_name, p_last_name, p_phone, p_email)
    on conflict (business_id, phone) where phone is not null do update
      set full_name = excluded.full_name, last_name = excluded.last_name,
          email = coalesce(excluded.email, public.customers.email), updated_at = now()
    returning id into v_cust;
  else
    insert into public.customers (business_id, full_name, last_name, phone, email)
    values (p_business_id, p_name, p_last_name, null, p_email) returning id into v_cust;
  end if;

  v_locator := public.generate_locator();

  insert into public.bookings (
    business_id, type, dining_shift_id, party_size, starts_at, ends_at,
    customer_id, customer_name, customer_last_name, customer_phone, customer_email,
    locator, status, channel, notes
  ) values (
    p_business_id, 'restaurante', p_shift_id, p_party_size, p_starts_at, v_ends,
    v_cust, p_name, p_last_name, p_phone, p_email,
    v_locator, 'confirmada', p_channel, p_notes
  ) returning * into v_row;

  return v_row;
end $$;

-- ---------------------------------------------------------------------
-- Permisos
-- ---------------------------------------------------------------------
grant execute on function public.get_available_dining_slots(uuid, date, int) to anon, authenticated;
grant execute on function public.create_public_dining_booking(uuid,uuid,timestamptz,int,text,text,text,text,text,booking_channel)
  to authenticated, service_role;
revoke execute on function public.create_public_dining_booking(uuid,uuid,timestamptz,int,text,text,text,text,text,booking_channel)
  from public, anon;
