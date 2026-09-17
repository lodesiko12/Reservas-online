-- =====================================================================
-- 0014_walkins_and_realtime.sql
-- Fase 2: walk-ins, ficha de cliente con notas/etiquetas, y Realtime para
-- el plano de sala en vivo.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Notas y etiquetas de cliente (VIP, habitual, alérgico, problemático...)
-- ---------------------------------------------------------------------
alter table public.customers
  add column if not exists notes text,
  add column if not exists tags text[] not null default '{}';

-- ---------------------------------------------------------------------
-- Asignación de mesa reutilizable (mesa individual best-fit, combinación,
-- u override manual). Devuelve como mucho una fila; ninguna fila = sin
-- mesas disponibles cuando el negocio gestiona mesas.
-- ---------------------------------------------------------------------
create or replace function public.dining_assign_table(
  p_business_id uuid,
  p_shift_id    uuid,
  p_party_size  int,
  p_starts_at   timestamptz,
  p_ends_at     timestamptz,
  p_channel     booking_channel,
  p_allow_double_turn boolean,
  p_cleanup_min int,
  p_tz          text,
  p_date        date,
  p_table_id    uuid default null
) returns table (table_id uuid, combo_id uuid)
language plpgsql stable security definer set search_path = public
as $$
declare
  v_uses_tables boolean; v_table_id uuid; v_combo_id uuid;
begin
  select exists(select 1 from dining_tables where business_id = p_business_id) into v_uses_tables;
  if not v_uses_tables then
    return query select null::uuid, null::uuid;
    return;
  end if;

  if p_table_id is not null then
    select t.id into v_table_id
    from dining_tables t
    where t.id = p_table_id and t.business_id = p_business_id and t.is_active
      and not public.dining_table_busy(t.id, p_shift_id, p_tz, p_date, p_starts_at, p_ends_at, p_allow_double_turn, p_cleanup_min);
    if v_table_id is null then raise exception 'La mesa indicada no está disponible en ese horario'; end if;
    return query select v_table_id, null::uuid;
    return;
  end if;

  select t.id into v_table_id
  from dining_tables t
  left join dining_zones z on z.id = t.zone_id
  where t.business_id = p_business_id and t.is_active
    and coalesce(z.is_active, true) and (p_channel <> 'web' or coalesce(z.reservable_online, true))
    and p_party_size between t.cap_min and t.cap_max
    and not public.dining_table_busy(t.id, p_shift_id, p_tz, p_date, p_starts_at, p_ends_at, p_allow_double_turn, p_cleanup_min)
  order by (t.cap_max - p_party_size) asc, t.priority desc, t.name asc
  limit 1;

  if v_table_id is null then
    select tc.id into v_combo_id
    from dining_table_combos tc
    where tc.business_id = p_business_id and tc.is_active
      and p_party_size between tc.cap_min and tc.cap_max
      and not exists (
        select 1 from unnest(tc.table_ids) tid
        where public.dining_table_busy(tid, p_shift_id, p_tz, p_date, p_starts_at, p_ends_at, p_allow_double_turn, p_cleanup_min)
      )
    order by (tc.cap_max - p_party_size) asc, tc.priority desc
    limit 1;
  end if;

  if v_table_id is null and v_combo_id is null then
    raise exception 'No hay mesas disponibles para ese horario';
  end if;
  return query select v_table_id, v_combo_id;
end $$;
revoke execute on function public.dining_assign_table(uuid,uuid,int,timestamptz,timestamptz,booking_channel,boolean,int,text,date,uuid)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- create_public_dining_booking ahora reutiliza dining_assign_table
-- (misma firma: CREATE OR REPLACE seguro, sin riesgo de sobrecarga).
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
  p_channel     booking_channel default 'web',
  p_table_id    uuid default null
) returns public.bookings
language plpgsql security definer set search_path = public
as $$
declare
  v_active boolean; v_tz text; v_dur int; v_ends timestamptz; v_date date;
  v_cust uuid; v_locator text; v_row public.bookings; v_ok boolean;
  v_allow_double_turn boolean; v_cleanup_min int; v_require_confirmation boolean;
  v_status booking_status; v_table_id uuid; v_combo_id uuid;
begin
  select is_active, timezone into v_active, v_tz from businesses where id = p_business_id;
  if not coalesce(v_active, false) then raise exception 'Negocio no disponible'; end if;
  if p_party_size is null or p_party_size < 1 then raise exception 'Número de comensales no válido'; end if;

  select allow_double_turn, cleanup_min into v_allow_double_turn, v_cleanup_min
  from dining_shifts where id = p_shift_id and business_id = p_business_id and is_active;
  if not found then raise exception 'Franja no válida'; end if;

  v_dur := public.dining_duration_for(p_shift_id, p_party_size);
  v_ends := p_starts_at + make_interval(mins => v_dur);
  v_date := (p_starts_at at time zone v_tz)::date;

  perform pg_advisory_xact_lock(hashtext(p_business_id::text));

  select exists (
    select 1 from public.get_available_dining_slots(
      p_business_id, v_date, p_party_size, p_channel
    ) s where s.slot_start = p_starts_at and s.shift_id = p_shift_id
  ) into v_ok;
  if not v_ok then raise exception 'No hay aforo para ese número de comensales en ese horario'; end if;

  select a.table_id, a.combo_id into v_table_id, v_combo_id
  from public.dining_assign_table(
    p_business_id, p_shift_id, p_party_size, p_starts_at, v_ends, p_channel,
    v_allow_double_turn, v_cleanup_min, v_tz, v_date, p_table_id
  ) a;

  select coalesce(require_manual_confirmation, false) into v_require_confirmation
  from dining_settings where business_id = p_business_id;
  v_status := case when coalesce(v_require_confirmation, false) and p_channel = 'web' then 'pendiente' else 'confirmada' end;

  if public.normalize_phone(p_phone) is not null then
    insert into public.customers (business_id, full_name, last_name, phone, email)
    values (p_business_id, p_name, p_last_name, p_phone, p_email)
    on conflict (business_id, phone_norm) where phone_norm is not null do update
      set email      = coalesce(public.customers.email, excluded.email),
          updated_at = now()
    returning id into v_cust;
  else
    insert into public.customers (business_id, full_name, last_name, phone, email)
    values (p_business_id, p_name, p_last_name, p_phone, p_email)
    returning id into v_cust;
  end if;

  v_locator := public.generate_locator();

  insert into public.bookings (
    business_id, type, dining_shift_id, dining_table_id, table_combo_id, party_size, starts_at, ends_at,
    customer_id, customer_name, customer_last_name, customer_phone, customer_email,
    locator, status, channel, notes
  ) values (
    p_business_id, 'restaurante', p_shift_id, v_table_id, v_combo_id, p_party_size, p_starts_at, v_ends,
    v_cust, p_name, p_last_name, p_phone, p_email,
    v_locator, v_status, p_channel, p_notes
  ) returning * into v_row;

  return v_row;
end $$;

-- ---------------------------------------------------------------------
-- Walk-in: cliente sin reserva que se sienta ahora mismo. Usa el mismo
-- motor de asignación (aforo + best-fit/combinación) que una reserva
-- normal, pero sin exigir que "ahora" caiga en un slot de la rejilla, y
-- queda directamente en estado 'sentada'.
-- ---------------------------------------------------------------------
create or replace function public.create_walkin_booking(
  p_business_id uuid,
  p_shift_id    uuid,
  p_party_size  int,
  p_name        text,
  p_phone       text default null,
  p_table_id    uuid default null,
  p_notes       text default null
) returns public.bookings
language plpgsql security definer set search_path = public
as $$
declare
  v_active boolean; v_tz text; v_dur int; v_starts timestamptz; v_ends timestamptz; v_date date;
  v_cust uuid; v_locator text; v_row public.bookings;
  v_allow_double_turn boolean; v_cleanup_min int; v_max_covers int;
  v_table_id uuid; v_combo_id uuid; v_booked int;
begin
  select is_active, timezone into v_active, v_tz from businesses where id = p_business_id;
  if not coalesce(v_active, false) then raise exception 'Negocio no disponible'; end if;
  if p_party_size is null or p_party_size < 1 then raise exception 'Número de comensales no válido'; end if;

  select allow_double_turn, cleanup_min, max_covers into v_allow_double_turn, v_cleanup_min, v_max_covers
  from dining_shifts where id = p_shift_id and business_id = p_business_id and is_active;
  if not found then raise exception 'No hay ningún turno de servicio activo ahora'; end if;

  v_starts := now();
  v_dur := public.dining_duration_for(p_shift_id, p_party_size);
  v_ends := v_starts + make_interval(mins => v_dur);
  v_date := (v_starts at time zone v_tz)::date;

  perform pg_advisory_xact_lock(hashtext(p_business_id::text));

  select coalesce(sum(b.party_size), 0) into v_booked
  from bookings b
  where b.dining_shift_id = p_shift_id
    and b.status in ('confirmada','pendiente','sentada','completada')
    and b.starts_at < v_ends and b.ends_at > v_starts;
  if v_booked + p_party_size > v_max_covers then
    raise exception 'No hay aforo suficiente ahora mismo';
  end if;

  select a.table_id, a.combo_id into v_table_id, v_combo_id
  from public.dining_assign_table(
    p_business_id, p_shift_id, p_party_size, v_starts, v_ends, 'walkin',
    v_allow_double_turn, v_cleanup_min, v_tz, v_date, p_table_id
  ) a;

  if public.normalize_phone(p_phone) is not null then
    insert into public.customers (business_id, full_name, phone)
    values (p_business_id, p_name, p_phone)
    on conflict (business_id, phone_norm) where phone_norm is not null do update
      set updated_at = now()
    returning id into v_cust;
  else
    insert into public.customers (business_id, full_name, phone)
    values (p_business_id, p_name, p_phone)
    returning id into v_cust;
  end if;

  v_locator := public.generate_locator();

  insert into public.bookings (
    business_id, type, dining_shift_id, dining_table_id, table_combo_id, party_size, starts_at, ends_at,
    customer_id, customer_name, customer_phone,
    locator, status, channel, notes
  ) values (
    p_business_id, 'restaurante', p_shift_id, v_table_id, v_combo_id, p_party_size, v_starts, v_ends,
    v_cust, p_name, p_phone,
    v_locator, 'sentada', 'walkin', p_notes
  ) returning * into v_row;

  return v_row;
end $$;
grant execute on function public.create_walkin_booking(uuid,uuid,int,text,text,uuid,text) to authenticated;
revoke execute on function public.create_walkin_booking(uuid,uuid,int,text,text,uuid,text) from public, anon;

-- ---------------------------------------------------------------------
-- Realtime: el plano de sala necesita ver los cambios de otros
-- dispositivos al instante. RLS ya filtra por negocio, así que activar
-- la tabla en la publicación no expone nada fuera de lo que ya permiten
-- las políticas existentes.
-- ---------------------------------------------------------------------
alter table public.bookings replica identity full;
do $$
begin
  if not exists (
    select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'bookings'
  ) then
    alter publication supabase_realtime add table public.bookings;
  end if;
end $$;
