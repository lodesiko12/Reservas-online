-- =====================================================================
-- 0009_dining_tables.sql
-- Mesas físicas para el tipo "restaurante" (capa 3 del motor de
-- disponibilidad) + duración variable según nº de comensales (capa 4).
--
-- Diseño:
--   * dining_zones / dining_tables son OPCIONALES por negocio: si un
--     negocio de tipo restaurante no tiene ninguna mesa cargada, el motor
--     sigue funcionando solo con el aforo agregado de la franja
--     (dining_shifts.max_covers), como hasta ahora. En cuanto el negocio
--     carga mesas, se exige además una mesa física libre (best-fit).
--   * dining_duration_rules permite duración distinta según el nº de
--     comensales dentro de una franja (p.ej. 2 pax -> 90 min, 7+ -> 150).
--     Si no hay regla que encaje, se usa dining_shifts.booking_duration_min.
--   * Se añade una constraint de exclusión sobre bookings para que
--     Postgres impida físicamente dos reservas solapadas en la misma mesa,
--     además de la revalidación bajo lock en el RPC de creación.
-- =====================================================================

create extension if not exists "btree_gist";

-- ---------------------------------------------------------------------
-- Zonas de sala (interior, terraza, barra...)
-- ---------------------------------------------------------------------
create table if not exists public.dining_zones (
  id                uuid primary key default gen_random_uuid(),
  business_id       uuid not null references public.businesses(id) on delete cascade,
  name              text not null,
  reservable_online boolean not null default true,
  sort_order        int not null default 0,
  is_active         boolean not null default true,
  created_at        timestamptz not null default now()
);
create index if not exists idx_dining_zones_business on public.dining_zones(business_id);

-- ---------------------------------------------------------------------
-- Mesas físicas
-- ---------------------------------------------------------------------
create table if not exists public.dining_tables (
  id           uuid primary key default gen_random_uuid(),
  business_id  uuid not null references public.businesses(id) on delete cascade,
  zone_id      uuid references public.dining_zones(id) on delete set null,
  name         text not null,                 -- p.ej. "Mesa 4"
  cap_min      int not null check (cap_min > 0),
  cap_max      int not null check (cap_max >= cap_min),
  priority     int not null default 0,         -- mayor = se prefiere primero en el best-fit
  pos_x        int,                            -- posición en el plano (Fase 2)
  pos_y        int,
  shape        text not null default 'square',
  is_active    boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists idx_dining_tables_business on public.dining_tables(business_id);
create index if not exists idx_dining_tables_zone on public.dining_tables(zone_id);

-- ---------------------------------------------------------------------
-- Duración de mesa según nº de comensales, por franja
-- ---------------------------------------------------------------------
create table if not exists public.dining_duration_rules (
  id              uuid primary key default gen_random_uuid(),
  dining_shift_id uuid not null references public.dining_shifts(id) on delete cascade,
  pax_min         int not null check (pax_min > 0),
  pax_max         int not null check (pax_max >= pax_min),
  duration_min    int not null check (duration_min > 0)
);
create index if not exists idx_dining_duration_rules_shift on public.dining_duration_rules(dining_shift_id);

-- ---------------------------------------------------------------------
-- bookings: mesa asignada (solo tipo restaurante)
-- ---------------------------------------------------------------------
alter table public.bookings
  add column if not exists dining_table_id uuid references public.dining_tables(id) on delete set null;
create index if not exists idx_bookings_table_time on public.bookings(dining_table_id, starts_at);

-- Impide dos reservas activas solapadas en la misma mesa (cinturón de
-- seguridad definitivo, además del lock+revalidación en el RPC).
alter table public.bookings drop constraint if exists bookings_table_no_overlap;
alter table public.bookings
  add constraint bookings_table_no_overlap
  exclude using gist (
    dining_table_id with =,
    tstzrange(starts_at, ends_at) with &&
  ) where (dining_table_id is not null and status in ('confirmada','completada'));

-- ---------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------
alter table public.dining_zones         enable row level security;
alter table public.dining_tables        enable row level security;
alter table public.dining_duration_rules enable row level security;

drop policy if exists dining_zones_all on public.dining_zones;
create policy dining_zones_all on public.dining_zones for all to authenticated
  using (public.is_business_member(business_id)) with check (public.is_business_member(business_id));

drop policy if exists dining_tables_all on public.dining_tables;
create policy dining_tables_all on public.dining_tables for all to authenticated
  using (public.is_business_member(business_id)) with check (public.is_business_member(business_id));

drop policy if exists dining_duration_rules_all on public.dining_duration_rules;
create policy dining_duration_rules_all on public.dining_duration_rules for all to authenticated
  using (exists (select 1 from public.dining_shifts s where s.id = dining_shift_id and public.is_business_member(s.business_id)))
  with check (exists (select 1 from public.dining_shifts s where s.id = dining_shift_id and public.is_business_member(s.business_id)));

-- ---------------------------------------------------------------------
-- Duración efectiva para una franja + nº de comensales
-- ---------------------------------------------------------------------
create or replace function public.dining_duration_for(p_shift_id uuid, p_party_size int)
returns int
language sql stable security definer set search_path = public
as $$
  select coalesce(
    (select r.duration_min from public.dining_duration_rules r
     where r.dining_shift_id = p_shift_id
       and p_party_size between r.pax_min and r.pax_max
     order by (r.pax_max - r.pax_min) asc
     limit 1),
    (select s.booking_duration_min from public.dining_shifts s where s.id = p_shift_id)
  );
$$;
grant execute on function public.dining_duration_for(uuid, int) to anon, authenticated;

-- ---------------------------------------------------------------------
-- Disponibilidad de restaurante (añade capa 3: mesa física libre)
-- ---------------------------------------------------------------------
create or replace function public.get_available_dining_slots(
  p_business_id uuid,
  p_date        date,
  p_party_size  int
) returns table (slot_start timestamptz, slot_end timestamptz, shift_id uuid, shift_name text)
language plpgsql stable security definer set search_path = public
as $$
declare
  v_tz         text;
  v_active     boolean;
  v_dow        int := extract(dow from p_date)::int;
  v_uses_tables boolean;
begin
  select timezone, is_active into v_tz, v_active from businesses where id = p_business_id;
  if not found or not v_active then return; end if;
  if p_party_size is null or p_party_size < 1 then return; end if;

  select exists(select 1 from dining_tables where business_id = p_business_id) into v_uses_tables;

  return query
  with sh as (
    select id, name,
           extract(epoch from start_time)::int / 60 as s,
           extract(epoch from end_time)::int / 60   as e,
           max_covers, slot_interval_min,
           public.dining_duration_for(id, p_party_size) as duration_min
    from dining_shifts
    where business_id = p_business_id and is_active
      and v_dow = any (active_weekdays)
  ),
  slots as (
    select sh.id as shift_id, sh.name as shift_name, sh.max_covers, sh.duration_min,
           gs as start_min
    from sh
    cross join lateral generate_series(sh.s, sh.e - sh.slot_interval_min, sh.slot_interval_min) gs
  ),
  cand as (
    select slots.shift_id, slots.shift_name, slots.max_covers,
           (p_date::timestamp + make_interval(mins => slots.start_min)) at time zone v_tz as slot_start,
           (p_date::timestamp + make_interval(mins => slots.start_min + slots.duration_min)) at time zone v_tz as slot_end
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
    and (
      not v_uses_tables
      or exists (
        select 1 from dining_tables t
        left join dining_zones z on z.id = t.zone_id
        where t.business_id = p_business_id and t.is_active
          and coalesce(z.is_active, true) and coalesce(z.reservable_online, true)
          and p_party_size between t.cap_min and t.cap_max
          and not exists (
            select 1 from bookings b2
            where b2.dining_table_id = t.id
              and b2.status in ('confirmada','completada')
              and b2.starts_at < c.slot_end and b2.ends_at > c.slot_start
          )
      )
    )
  order by c.slot_start;
end $$;

-- ---------------------------------------------------------------------
-- Creación transaccional de reserva de restaurante (añade asignación
-- best-fit de mesa, con override manual opcional vía p_table_id)
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
  v_active boolean; v_tz text; v_dur int; v_ends timestamptz;
  v_cust uuid; v_locator text; v_row public.bookings; v_ok boolean;
  v_uses_tables boolean; v_table_id uuid;
begin
  select is_active, timezone into v_active, v_tz from businesses where id = p_business_id;
  if not coalesce(v_active, false) then raise exception 'Negocio no disponible'; end if;
  if p_party_size is null or p_party_size < 1 then raise exception 'Número de comensales no válido'; end if;

  if not exists (select 1 from dining_shifts where id = p_shift_id and business_id = p_business_id and is_active) then
    raise exception 'Franja no válida';
  end if;
  v_dur := public.dining_duration_for(p_shift_id, p_party_size);
  v_ends := p_starts_at + make_interval(mins => v_dur);

  perform pg_advisory_xact_lock(hashtext(p_business_id::text));

  select exists (
    select 1 from public.get_available_dining_slots(
      p_business_id, (p_starts_at at time zone v_tz)::date, p_party_size
    ) s where s.slot_start = p_starts_at and s.shift_id = p_shift_id
  ) into v_ok;
  if not v_ok then raise exception 'No hay aforo para ese número de comensales en ese horario'; end if;

  select exists(select 1 from dining_tables where business_id = p_business_id) into v_uses_tables;

  if v_uses_tables then
    if p_table_id is not null then
      -- Override manual: el jefe de sala decide; solo se comprueba que la
      -- mesa exista, sea del negocio y esté físicamente libre en ese hueco.
      select t.id into v_table_id
      from dining_tables t
      where t.id = p_table_id and t.business_id = p_business_id and t.is_active
        and not exists (
          select 1 from bookings b2
          where b2.dining_table_id = t.id and b2.status in ('confirmada','completada')
            and b2.starts_at < v_ends and b2.ends_at > p_starts_at
        );
      if v_table_id is null then raise exception 'La mesa indicada no está disponible en ese horario'; end if;
    else
      -- Asignación automática best-fit: menor desperdicio de plazas,
      -- luego prioridad configurada, luego nombre.
      select t.id into v_table_id
      from dining_tables t
      left join dining_zones z on z.id = t.zone_id
      where t.business_id = p_business_id and t.is_active
        and coalesce(z.is_active, true) and coalesce(z.reservable_online, true)
        and p_party_size between t.cap_min and t.cap_max
        and not exists (
          select 1 from bookings b2
          where b2.dining_table_id = t.id and b2.status in ('confirmada','completada')
            and b2.starts_at < v_ends and b2.ends_at > p_starts_at
        )
      order by (t.cap_max - p_party_size) asc, t.priority desc, t.name asc
      limit 1;
      if v_table_id is null then raise exception 'No hay mesas disponibles para ese horario'; end if;
    end if;
  end if;

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
    business_id, type, dining_shift_id, dining_table_id, party_size, starts_at, ends_at,
    customer_id, customer_name, customer_last_name, customer_phone, customer_email,
    locator, status, channel, notes
  ) values (
    p_business_id, 'restaurante', p_shift_id, v_table_id, p_party_size, p_starts_at, v_ends,
    v_cust, p_name, p_last_name, p_phone, p_email,
    v_locator, 'confirmada', p_channel, p_notes
  ) returning * into v_row;

  return v_row;
end $$;

grant execute on function public.create_public_dining_booking(uuid,uuid,timestamptz,int,text,text,text,text,text,booking_channel,uuid)
  to authenticated, service_role;
revoke execute on function public.create_public_dining_booking(uuid,uuid,timestamptz,int,text,text,text,text,text,booking_channel,uuid)
  from public, anon;

-- ---------------------------------------------------------------------
-- Consulta de mesas para asignación/reasignación manual desde el panel
-- ---------------------------------------------------------------------
create or replace function public.get_dining_table_options(
  p_business_id uuid,
  p_starts_at   timestamptz,
  p_ends_at     timestamptz,
  p_party_size  int,
  p_exclude_booking_id uuid default null
) returns table (
  id uuid, name text, zone_name text, cap_min int, cap_max int,
  fits boolean, is_free boolean
)
language sql stable security definer set search_path = public
as $$
  select t.id, t.name, z.name as zone_name, t.cap_min, t.cap_max,
    p_party_size between t.cap_min and t.cap_max as fits,
    not exists (
      select 1 from bookings b
      where b.dining_table_id = t.id
        and b.status in ('confirmada','completada')
        and (p_exclude_booking_id is null or b.id <> p_exclude_booking_id)
        and b.starts_at < p_ends_at and b.ends_at > p_starts_at
    ) as is_free
  from dining_tables t
  left join dining_zones z on z.id = t.zone_id
  where t.business_id = p_business_id and t.is_active
  order by fits desc, t.priority desc, t.name;
$$;
grant execute on function public.get_dining_table_options(uuid, timestamptz, timestamptz, int, uuid) to authenticated;

-- ---------------------------------------------------------------------
-- Datos de ejemplo: zonas y mesas para el negocio demo "restaurante-la-plaza"
-- ---------------------------------------------------------------------
do $$
declare
  v_biz uuid;
  v_interior uuid;
  v_terraza uuid;
begin
  select id into v_biz from public.businesses where slug = 'restaurante-la-plaza';
  if v_biz is not null and not exists (select 1 from public.dining_tables where business_id = v_biz) then
    insert into public.dining_zones (business_id, name, reservable_online, sort_order)
      values (v_biz, 'Interior', true, 0) returning id into v_interior;
    insert into public.dining_zones (business_id, name, reservable_online, sort_order)
      values (v_biz, 'Terraza', true, 1) returning id into v_terraza;

    insert into public.dining_tables (business_id, zone_id, name, cap_min, cap_max, priority) values
      (v_biz, v_interior, 'Mesa 1', 1, 2, 0),
      (v_biz, v_interior, 'Mesa 2', 1, 2, 0),
      (v_biz, v_interior, 'Mesa 3', 2, 4, 0),
      (v_biz, v_interior, 'Mesa 4', 2, 4, 0),
      (v_biz, v_interior, 'Mesa 5', 4, 6, 1),
      (v_biz, v_interior, 'Mesa 6', 6, 8, 1),
      (v_biz, v_terraza,  'Mesa 7', 2, 4, 0),
      (v_biz, v_terraza,  'Mesa 8', 2, 4, 0),
      (v_biz, v_terraza,  'Mesa 9', 4, 6, 0),
      (v_biz, v_terraza,  'Mesa 10', 1, 2, 0);
  end if;
end $$;
