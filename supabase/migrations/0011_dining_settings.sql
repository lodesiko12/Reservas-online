-- =====================================================================
-- 0011_dining_settings.sql
-- Ajustes de negocio completos para el tipo "restaurante", personalizables
-- por cada negocio y editables en cualquier momento desde su panel:
--
--   * dining_settings   (1:1 por negocio): antelación mín/máx, mín/máx
--     comensales online, confirmación manual sí/no.
--   * dining_shifts     (nuevas columnas): última hora de reserva, stock
--     por franja (activable), stock online, doblar mesa sí/no + limpieza.
--   * dining_table_combos: combinaciones de mesas válidas para grupos
--     grandes (se definen a mano, no se calculan solas).
--   * bookings.table_combo_id: reserva asignada a una combinación en vez
--     de a una sola mesa.
--
-- Las "excepciones" (cierres puntuales que el propio restaurante gestiona)
-- ya existían: son la tabla `blocks` con scope='business', editable desde
-- el panel en Bloqueos. No requieren cambios de esquema.
-- =====================================================================

-- ---------------------------------------------------------------------
-- dining_settings: reglas generales del negocio (capa 5)
-- ---------------------------------------------------------------------
create table if not exists public.dining_settings (
  business_id               uuid primary key references public.businesses(id) on delete cascade,
  min_lead_minutes          int not null default 30 check (min_lead_minutes >= 0),
  max_advance_days          int not null default 60 check (max_advance_days > 0),
  min_party_online          int not null default 1 check (min_party_online > 0),
  max_party_online          int not null default 12 check (max_party_online >= min_party_online),
  require_manual_confirmation boolean not null default false,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);

alter table public.dining_settings enable row level security;
drop policy if exists dining_settings_all on public.dining_settings;
create policy dining_settings_all on public.dining_settings for all to authenticated
  using (public.is_business_member(business_id)) with check (public.is_business_member(business_id));

-- Lectura pública mínima (mín/máx comensales online) para que el widget
-- pueda filtrar el selector de comensales sin exponer nada sensible.
create or replace function public.get_public_dining_settings(p_business_id uuid)
returns table (min_party_online int, max_party_online int)
language sql stable security definer set search_path = public
as $$
  select coalesce(s.min_party_online, 1), coalesce(s.max_party_online, 12)
  from businesses b
  left join dining_settings s on s.business_id = b.id
  where b.id = p_business_id and b.is_active
$$;
grant execute on function public.get_public_dining_settings(uuid) to anon, authenticated;

-- ---------------------------------------------------------------------
-- dining_shifts: controles por franja (capas 1, 2 y 4)
-- ---------------------------------------------------------------------
alter table public.dining_shifts
  add column if not exists last_call_time      time,                          -- última hora de reserva (null = hasta el cierre)
  add column if not exists pacing_enabled      boolean not null default false, -- activa el stock por slot (si no, solo cuenta el aforo total)
  add column if not exists max_covers_per_slot int check (max_covers_per_slot > 0),
  add column if not exists max_bookings_per_slot int check (max_bookings_per_slot > 0),
  add column if not exists online_max_covers   int check (online_max_covers > 0), -- stock reservado para web; null = igual que el aforo total
  add column if not exists allow_double_turn   boolean not null default true,    -- reservas consecutivas (doblar) en la misma mesa
  add column if not exists cleanup_min         int not null default 0 check (cleanup_min >= 0);

-- ---------------------------------------------------------------------
-- dining_table_combos: combinaciones de mesas válidas (capa 3, grupos grandes)
-- ---------------------------------------------------------------------
create table if not exists public.dining_table_combos (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name        text,
  table_ids   uuid[] not null,
  cap_min     int not null check (cap_min > 0),
  cap_max     int not null check (cap_max >= cap_min),
  priority    int not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  check (array_length(table_ids, 1) >= 2)
);
create index if not exists idx_dining_table_combos_business on public.dining_table_combos(business_id);
create index if not exists idx_dining_table_combos_tables on public.dining_table_combos using gin (table_ids);

alter table public.dining_table_combos enable row level security;
drop policy if exists dining_table_combos_all on public.dining_table_combos;
create policy dining_table_combos_all on public.dining_table_combos for all to authenticated
  using (public.is_business_member(business_id)) with check (public.is_business_member(business_id));

-- ---------------------------------------------------------------------
-- bookings: mesa combinada asignada (alternativa a dining_table_id)
-- ---------------------------------------------------------------------
alter table public.bookings
  add column if not exists table_combo_id uuid references public.dining_table_combos(id) on delete set null;

-- ---------------------------------------------------------------------
-- ¿Está ocupada la mesa `p_table_id` en [p_start, p_end)?
-- Tiene en cuenta: reservas directas de esa mesa Y reservas de una
-- combinación que incluya esa mesa; si la franja no permite "doblar"
-- (allow_double_turn = false), la mesa se considera ocupada para TODO el
-- turno de ese día en cuanto tiene una reserva, no solo durante su franja
-- horaria exacta; si permite doblar, se aplica el tiempo de limpieza como
-- margen a ambos lados del hueco ocupado.
-- ---------------------------------------------------------------------
create or replace function public.dining_table_busy(
  p_table_id          uuid,
  p_shift_id          uuid,
  p_tz                text,
  p_date              date,
  p_start             timestamptz,
  p_end               timestamptz,
  p_allow_double_turn boolean,
  p_cleanup_min       int,
  p_exclude_booking_id uuid default null
) returns boolean
language sql stable security definer set search_path = public
as $$
  select case when not p_allow_double_turn then
    exists (
      select 1 from bookings b
      where b.status in ('confirmada','pendiente','completada')
        and (p_exclude_booking_id is null or b.id <> p_exclude_booking_id)
        and b.dining_shift_id = p_shift_id
        and (b.starts_at at time zone p_tz)::date = p_date
        and (b.dining_table_id = p_table_id
             or exists (select 1 from dining_table_combos c where c.id = b.table_combo_id and p_table_id = any (c.table_ids)))
    )
  else
    exists (
      select 1 from bookings b
      where b.status in ('confirmada','pendiente','completada')
        and (p_exclude_booking_id is null or b.id <> p_exclude_booking_id)
        and b.starts_at < p_end + make_interval(mins => p_cleanup_min)
        and b.ends_at + make_interval(mins => p_cleanup_min) > p_start
        and (b.dining_table_id = p_table_id
             or exists (select 1 from dining_table_combos c where c.id = b.table_combo_id and p_table_id = any (c.table_ids)))
    )
  end
$$;

-- ---------------------------------------------------------------------
-- Disponibilidad de restaurante — versión completa con todas las capas.
-- Se elimina la versión anterior (3 argumentos) porque se añade un
-- argumento nuevo: crear otra sobrecarga rompería la llamada desde
-- PostgREST cuando el cliente omite el parámetro por defecto.
-- ---------------------------------------------------------------------
drop function if exists public.get_available_dining_slots(uuid, date, int);

create or replace function public.get_available_dining_slots(
  p_business_id uuid,
  p_date        date,
  p_party_size  int,
  p_channel     booking_channel default 'web'
) returns table (slot_start timestamptz, slot_end timestamptz, shift_id uuid, shift_name text)
language plpgsql stable security definer set search_path = public
as $$
declare
  v_tz          text;
  v_active      boolean;
  v_dow         int := extract(dow from p_date)::int;
  v_uses_tables boolean;
  v_min_lead    int;
  v_max_days    int;
  v_min_party   int;
  v_max_party   int;
  v_is_web      boolean := (p_channel = 'web');
begin
  select timezone, is_active into v_tz, v_active from businesses where id = p_business_id;
  if not found or not v_active then return; end if;
  if p_party_size is null or p_party_size < 1 then return; end if;

  select coalesce(s.min_lead_minutes, 30), coalesce(s.max_advance_days, 60),
         coalesce(s.min_party_online, 1), coalesce(s.max_party_online, 12)
    into v_min_lead, v_max_days, v_min_party, v_max_party
  from (select 1) x
  left join dining_settings s on s.business_id = p_business_id;

  if v_is_web and (p_party_size < v_min_party or p_party_size > v_max_party) then return; end if;

  select exists(select 1 from dining_tables where business_id = p_business_id) into v_uses_tables;

  return query
  with sh as (
    select id, name,
           extract(epoch from start_time)::int / 60 as s,
           least(
             extract(epoch from end_time)::int / 60 - slot_interval_min,
             coalesce(extract(epoch from last_call_time)::int / 60, extract(epoch from end_time)::int / 60)
           ) as e,
           max_covers, slot_interval_min,
           public.dining_duration_for(id, p_party_size) as duration_min,
           pacing_enabled, max_covers_per_slot, max_bookings_per_slot, online_max_covers,
           allow_double_turn, cleanup_min
    from dining_shifts
    where business_id = p_business_id and is_active
      and v_dow = any (active_weekdays)
  ),
  slots as (
    select sh.*, gs as start_min
    from sh
    cross join lateral generate_series(sh.s, sh.e, sh.slot_interval_min) gs
  ),
  cand as (
    select slots.*,
           (p_date::timestamp + make_interval(mins => slots.start_min)) at time zone v_tz as slot_start,
           (p_date::timestamp + make_interval(mins => slots.start_min + slots.duration_min)) at time zone v_tz as slot_end
    from slots
  )
  select c.slot_start, c.slot_end, c.id, c.name
  from cand c
  where c.slot_start > now() + make_interval(mins => case when v_is_web then v_min_lead else 0 end)
    and (not v_is_web or c.slot_start <= now() + make_interval(days => v_max_days))
    and not exists (
      select 1 from blocks bl
      where bl.business_id = p_business_id and bl.scope = 'business'
        and bl.starts_at < c.slot_end and bl.ends_at > c.slot_start
    )
    and (
      coalesce((
        select sum(b.party_size) from bookings b
        where b.dining_shift_id = c.id
          and b.status in ('confirmada','pendiente','completada')
          and b.starts_at < c.slot_end and b.ends_at > c.slot_start
      ), 0) + p_party_size
    ) <= (case when v_is_web then coalesce(c.online_max_covers, c.max_covers) else c.max_covers end)
    and (
      not (v_is_web and c.pacing_enabled) or (
        (c.max_covers_per_slot is null or coalesce((
          select sum(b.party_size) from bookings b
          where b.dining_shift_id = c.id and b.starts_at = c.slot_start
            and b.status in ('confirmada','pendiente','completada')
        ), 0) + p_party_size <= c.max_covers_per_slot)
        and
        (c.max_bookings_per_slot is null or coalesce((
          select count(*) from bookings b
          where b.dining_shift_id = c.id and b.starts_at = c.slot_start
            and b.status in ('confirmada','pendiente','completada')
        ), 0) + 1 <= c.max_bookings_per_slot)
      )
    )
    and (
      not v_uses_tables
      or exists (
        select 1 from dining_tables t
        left join dining_zones z on z.id = t.zone_id
        where t.business_id = p_business_id and t.is_active
          and coalesce(z.is_active, true) and (not v_is_web or coalesce(z.reservable_online, true))
          and p_party_size between t.cap_min and t.cap_max
          and not public.dining_table_busy(t.id, c.id, v_tz, p_date, c.slot_start, c.slot_end, c.allow_double_turn, c.cleanup_min)
      )
      or exists (
        select 1 from dining_table_combos tc
        where tc.business_id = p_business_id and tc.is_active
          and p_party_size between tc.cap_min and tc.cap_max
          and not exists (
            select 1 from unnest(tc.table_ids) tid
            where public.dining_table_busy(tid, c.id, v_tz, p_date, c.slot_start, c.slot_end, c.allow_double_turn, c.cleanup_min)
          )
      )
    )
  order by c.slot_start;
end $$;

grant execute on function public.get_available_dining_slots(uuid, date, int, booking_channel) to anon, authenticated;

-- ---------------------------------------------------------------------
-- Creación transaccional de reserva de restaurante — misma firma que
-- antes (no hace falta ningún parámetro nuevo): usa los ajustes del
-- negocio/franja y asigna mesa individual, combinación, o ninguna si el
-- negocio no gestiona mesas.
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
  v_uses_tables boolean; v_table_id uuid; v_combo_id uuid;
  v_allow_double_turn boolean; v_cleanup_min int; v_require_confirmation boolean;
  v_status booking_status;
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

  select exists(select 1 from dining_tables where business_id = p_business_id) into v_uses_tables;

  if v_uses_tables then
    if p_table_id is not null then
      -- Override manual: el jefe de sala decide; solo se comprueba que la
      -- mesa exista, sea del negocio y esté físicamente libre.
      select t.id into v_table_id
      from dining_tables t
      where t.id = p_table_id and t.business_id = p_business_id and t.is_active
        and not public.dining_table_busy(t.id, p_shift_id, v_tz, v_date, p_starts_at, v_ends, v_allow_double_turn, v_cleanup_min);
      if v_table_id is null then raise exception 'La mesa indicada no está disponible en ese horario'; end if;
    else
      -- 1) Mesa individual best-fit
      select t.id into v_table_id
      from dining_tables t
      left join dining_zones z on z.id = t.zone_id
      where t.business_id = p_business_id and t.is_active
        and coalesce(z.is_active, true) and (p_channel <> 'web' or coalesce(z.reservable_online, true))
        and p_party_size between t.cap_min and t.cap_max
        and not public.dining_table_busy(t.id, p_shift_id, v_tz, v_date, p_starts_at, v_ends, v_allow_double_turn, v_cleanup_min)
      order by (t.cap_max - p_party_size) asc, t.priority desc, t.name asc
      limit 1;

      -- 2) Si no cabe en ninguna mesa suelta, probar combinaciones configuradas
      if v_table_id is null then
        select tc.id into v_combo_id
        from dining_table_combos tc
        where tc.business_id = p_business_id and tc.is_active
          and p_party_size between tc.cap_min and tc.cap_max
          and not exists (
            select 1 from unnest(tc.table_ids) tid
            where public.dining_table_busy(tid, p_shift_id, v_tz, v_date, p_starts_at, v_ends, v_allow_double_turn, v_cleanup_min)
          )
        order by (tc.cap_max - p_party_size) asc, tc.priority desc
        limit 1;
      end if;

      if v_table_id is null and v_combo_id is null then
        raise exception 'No hay mesas disponibles para ese horario';
      end if;
    end if;
  end if;

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
-- Opciones de mesa para asignación/reasignación manual desde el panel.
-- Se elimina la versión anterior (5 argumentos) porque ahora necesita el
-- turno para aplicar correctamente doblar-mesa/limpieza.
-- ---------------------------------------------------------------------
drop function if exists public.get_dining_table_options(uuid, timestamptz, timestamptz, int, uuid);

create or replace function public.get_dining_table_options(
  p_business_id uuid,
  p_shift_id    uuid,
  p_starts_at   timestamptz,
  p_ends_at     timestamptz,
  p_party_size  int,
  p_exclude_booking_id uuid default null
) returns table (
  id uuid, name text, zone_name text, cap_min int, cap_max int,
  fits boolean, is_free boolean
)
language plpgsql stable security definer set search_path = public
as $$
declare
  v_tz text; v_allow_double_turn boolean; v_cleanup_min int; v_date date;
begin
  select timezone into v_tz from businesses where id = p_business_id;
  select allow_double_turn, cleanup_min into v_allow_double_turn, v_cleanup_min
  from dining_shifts where id = p_shift_id;
  v_date := (p_starts_at at time zone coalesce(v_tz, 'Europe/Madrid'))::date;

  return query
  select t.id, t.name, z.name as zone_name, t.cap_min, t.cap_max,
    p_party_size between t.cap_min and t.cap_max as fits,
    not public.dining_table_busy(
      t.id, p_shift_id, coalesce(v_tz, 'Europe/Madrid'), v_date, p_starts_at, p_ends_at,
      coalesce(v_allow_double_turn, true), coalesce(v_cleanup_min, 0), p_exclude_booking_id
    ) as is_free
  from dining_tables t
  left join dining_zones z on z.id = t.zone_id
  where t.business_id = p_business_id and t.is_active
  order by fits desc, t.priority desc, t.name;
end $$;
grant execute on function public.get_dining_table_options(uuid, uuid, timestamptz, timestamptz, int, uuid) to authenticated;
