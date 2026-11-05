-- =====================================================================
-- 0052_order_mode.sql
-- "Modo encargo" para negocios tipo `citas` (pastelerías, floristerías…): el cliente
-- no reserva un tiempo de servicio, encarga un producto (tamaño + sabor) y elige
-- cuándo recogerlo.
--
-- Todo es retrocompatible: `businesses.order_mode` vale false por defecto y los
-- ajustes nuevos (antelación mínima, capacidad diaria) solo se aplican si el negocio
-- tiene fila en `order_settings`. Los negocios actuales no cambian de comportamiento.
--
--   * businesses.order_mode        interruptor del modo
--   * order_settings               antelación mínima, capacidad diaria (total y por
--                                  tamaño), confirmación manual, antelación de cancelación
--   * services.size_key/size_label/option_group   cada servicio = tamaño × nivel de precio
--   * service_option_groups        niveles (Básicas, Clásicas…)
--   * service_options              sabores, con "no disponible esta semana"
--   * bookings.option_id/label     sabor elegido (snapshot del nombre)
--   * business_day_overrides       festivos: usan el horario de otro día o cierran
--   * get_available_slots          + día especial, antelación mínima y capacidad diaria
--                                  (solo canal web) y cuenta pendiente/listo como ocupado
--   * create_public_booking        + p_option_id, estado pendiente si hay confirmación manual
--   * get_public_business / get_public_services / get_booking_by_locator /
--     cancel_booking_by_locator    + campos de encargo; get_public_options (nueva)
-- =====================================================================

-- ---------------------------------------------------------------------
-- Esquema
-- ---------------------------------------------------------------------
alter table public.businesses add column if not exists order_mode boolean not null default false;

alter table public.services
  add column if not exists size_key      text,
  add column if not exists size_label    text,
  add column if not exists option_group  text;

alter table public.bookings
  add column if not exists option_id    uuid,
  add column if not exists option_label text;

create table if not exists public.order_settings (
  business_id          uuid primary key references public.businesses(id) on delete cascade,
  min_lead_hours       int check (min_lead_hours >= 0),      -- null = sin antelación mínima
  daily_max_total      int check (daily_max_total > 0),      -- null = sin límite diario
  daily_max_by_size    jsonb not null default '{}'::jsonb,   -- {"mediana": 4, "grande": 3}
  require_confirmation boolean not null default true,        -- los encargos web quedan 'pendiente'
  cancel_min_hours     int check (cancel_min_hours >= 0),    -- null = se puede cancelar hasta la recogida
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create table if not exists public.service_option_groups (
  business_id uuid not null references public.businesses(id) on delete cascade,
  group_key   text not null,
  label       text not null,
  sort_order  int  not null default 0,
  primary key (business_id, group_key)
);

create table if not exists public.service_options (
  id           uuid primary key default gen_random_uuid(),
  business_id  uuid not null references public.businesses(id) on delete cascade,
  option_group text not null,
  name         text not null,
  is_available boolean not null default true,
  sort_order   int  not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (business_id, option_group, name)
);
create index if not exists idx_service_options_business on public.service_options(business_id);

alter table public.bookings drop constraint if exists bookings_option_id_fkey;
alter table public.bookings
  add constraint bookings_option_id_fkey foreign key (option_id)
  references public.service_options(id) on delete set null;

create table if not exists public.business_day_overrides (
  business_id uuid not null references public.businesses(id) on delete cascade,
  day         date not null,
  use_weekday int check (use_weekday between 0 and 6),  -- null = cerrado ese día
  note        text,
  primary key (business_id, day)
);

drop trigger if exists trg_order_settings_updated on public.order_settings;
create trigger trg_order_settings_updated before update on public.order_settings
  for each row execute function public.set_updated_at();
drop trigger if exists trg_service_options_updated on public.service_options;
create trigger trg_service_options_updated before update on public.service_options
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- RLS: solo miembros del negocio (y super-admin vía is_business_member).
-- El widget accede únicamente por las RPCs SECURITY DEFINER de más abajo.
-- ---------------------------------------------------------------------
alter table public.order_settings        enable row level security;
alter table public.service_option_groups enable row level security;
alter table public.service_options       enable row level security;
alter table public.business_day_overrides enable row level security;

drop policy if exists order_settings_all on public.order_settings;
create policy order_settings_all on public.order_settings for all to authenticated
  using (public.is_business_member(business_id)) with check (public.is_business_member(business_id));
drop policy if exists service_option_groups_all on public.service_option_groups;
create policy service_option_groups_all on public.service_option_groups for all to authenticated
  using (public.is_business_member(business_id)) with check (public.is_business_member(business_id));
drop policy if exists service_options_all on public.service_options;
create policy service_options_all on public.service_options for all to authenticated
  using (public.is_business_member(business_id)) with check (public.is_business_member(business_id));
drop policy if exists business_day_overrides_all on public.business_day_overrides;
create policy business_day_overrides_all on public.business_day_overrides for all to authenticated
  using (public.is_business_member(business_id)) with check (public.is_business_member(business_id));

-- ---------------------------------------------------------------------
-- Motor de disponibilidad (reescrito desde la definición vigente en producción)
-- ---------------------------------------------------------------------
create or replace function public.get_available_slots(
  p_business_id      uuid,
  p_service_id       uuid,
  p_date             date,
  p_professional_id  uuid default null,
  p_channel          booking_channel default 'web'
) returns table (slot_start timestamptz, slot_end timestamptz)
language plpgsql stable security definer set search_path = public
as $$
declare
  v_tz          text;
  v_active      boolean;
  v_capacity    int;
  v_step        int;
  v_max_advance int;
  v_dur         int;
  v_buf         int;
  v_prof        uuid;
  v_dow         int := extract(dow from p_date)::int;
  v_has_svc     boolean;
  v_has_prof    boolean;
  v_has_any_prof boolean;
  v_size        text;
  v_ov_wd       int;
  v_min_lead    int;
  v_max_total   int;
  v_max_size    int;
begin
  select timezone, is_active, default_capacity, slot_interval_min, max_advance_days
    into v_tz, v_active, v_capacity, v_step, v_max_advance
  from businesses where id = p_business_id;
  if not found or not v_active then return; end if;

  select duration_min, buffer_min, size_key into v_dur, v_buf, v_size
  from services
  where id = p_service_id and business_id = p_business_id and is_active;
  if not found then return; end if;

  -- Día especial (festivo): usa el horario de otro día de la semana, o cierra.
  select use_weekday into v_ov_wd
  from business_day_overrides where business_id = p_business_id and day = p_date;
  if found then
    if v_ov_wd is null then return; end if;
    v_dow := v_ov_wd;
  end if;

  -- Reglas solo para el canal web (el staff nunca está sujeto a ellas).
  if p_channel = 'web' then
    select min_lead_hours, daily_max_total, nullif(daily_max_by_size ->> v_size, '')::int
      into v_min_lead, v_max_total, v_max_size
    from order_settings where business_id = p_business_id;

    if v_max_total is not null then
      if (select count(*) from bookings b
          where b.business_id = p_business_id
            and b.status in ('confirmada','pendiente','listo','completada')
            and (b.starts_at at time zone v_tz)::date = p_date) >= v_max_total then
        return;
      end if;
    end if;
    if v_max_size is not null and v_size is not null then
      if (select count(*) from bookings b
          join services sv on sv.id = b.service_id
          where b.business_id = p_business_id
            and sv.size_key = v_size
            and b.status in ('confirmada','pendiente','listo','completada')
            and (b.starts_at at time zone v_tz)::date = p_date) >= v_max_size then
        return;
      end if;
    end if;
  end if;

  -- Rama "cualquiera disponible": abanico por cada profesional asignado.
  if p_professional_id is null then
    select exists (select 1 from service_professionals where service_id = p_service_id) into v_has_any_prof;
    if v_has_any_prof then
      return query
      select gs.slot_start, gs.slot_end
      from service_professionals sp
      cross join lateral public.get_available_slots(p_business_id, p_service_id, p_date, sp.professional_id, p_channel) gs
      where sp.service_id = p_service_id
      group by gs.slot_start, gs.slot_end
      order by gs.slot_start;
      return;
    end if;
  end if;

  v_prof := p_professional_id;
  select exists (select 1 from service_availability where service_id = p_service_id) into v_has_svc;
  v_has_prof := v_prof is not null and exists (select 1 from professional_hours where professional_id = v_prof);

  return query
  with biz as (
    select extract(epoch from open_time)::int / 60  as s,
           extract(epoch from close_time)::int / 60 as e
    from business_hours where business_id = p_business_id and weekday = v_dow
  ),
  svc as (
    select extract(epoch from start_time)::int / 60 as s,
           extract(epoch from end_time)::int / 60   as e
    from service_availability where service_id = p_service_id and weekday = v_dow
    union all
    select s, e from biz where not v_has_svc
  ),
  prof as (
    select extract(epoch from start_time)::int / 60 as s,
           extract(epoch from end_time)::int / 60   as e
    from professional_hours where professional_id = v_prof and weekday = v_dow
    union all
    select s, e from biz where not v_has_prof
  ),
  eff1 as (
    select greatest(biz.s, svc.s) as s, least(biz.e, svc.e) as e
    from biz join svc on svc.s < biz.e and svc.e > biz.s
  ),
  eff as (
    select greatest(eff1.s, prof.s) as s, least(eff1.e, prof.e) as e
    from eff1 join prof on prof.s < eff1.e and prof.e > eff1.s
  ),
  slots as (
    select distinct gs as start_min
    from eff cross join lateral generate_series(eff.s, eff.e - v_dur, v_step) gs
  ),
  cand as (
    select (p_date::timestamp + make_interval(mins => start_min)) at time zone v_tz as slot_start,
           (p_date::timestamp + make_interval(mins => start_min + v_dur)) at time zone v_tz as slot_end
    from slots
  )
  select c.slot_start, c.slot_end
  from cand c
  where c.slot_start > now()
    and (p_channel <> 'web' or v_max_advance is null or c.slot_start <= now() + make_interval(days => v_max_advance))
    and (p_channel <> 'web' or v_min_lead is null or c.slot_start >= now() + make_interval(hours => v_min_lead))
    and not exists (
      select 1 from blocks bl
      where bl.business_id = p_business_id
        and bl.starts_at < c.slot_end and bl.ends_at > c.slot_start
        and (bl.scope = 'business'
             or (bl.scope = 'professional' and v_prof is not null and bl.professional_id = v_prof))
    )
    and (
      case
        when v_prof is not null then
          not exists (
            select 1 from bookings b
            where b.professional_id = v_prof
              and b.status in ('confirmada','pendiente','listo','completada')
              and b.starts_at < (c.slot_end + make_interval(mins => v_buf))
              and b.ends_at   > c.slot_start
          )
        else
          (select count(*) from bookings b
             where b.business_id = p_business_id
               and b.professional_id is null
               and b.status in ('confirmada','pendiente','listo','completada')
               and b.starts_at < (c.slot_end + make_interval(mins => v_buf))
               and b.ends_at   > c.slot_start
          ) < v_capacity
      end
    )
  order by c.slot_start;
end $$;

-- ---------------------------------------------------------------------
-- Creación de reserva: nueva firma (p_option_id) -> borrar la anterior para
-- no dejar overloads ambiguos. Las llamadas con parámetros nombrados que no
-- pasan p_option_id siguen funcionando (default null).
-- ---------------------------------------------------------------------
drop function if exists public.create_public_booking(uuid,uuid,timestamptz,text,text,text,text,text,booking_channel,uuid);

create or replace function public.create_public_booking(
  p_business_id      uuid,
  p_service_id       uuid,
  p_starts_at        timestamptz,
  p_name             text,
  p_last_name        text,
  p_phone            text,
  p_email            text,
  p_notes            text default null,
  p_channel          booking_channel default 'web',
  p_professional_id  uuid default null,
  p_option_id        uuid default null
) returns public.bookings
language plpgsql security definer set search_path = public
as $$
declare
  v_dur int; v_prof uuid; v_ends timestamptz; v_active boolean;
  v_tz text; v_cust uuid; v_locator text; v_row public.bookings; v_ok boolean;
  v_has_any_prof boolean; v_date date;
  v_order boolean; v_group text; v_opt_label text; v_status booking_status; v_confirm boolean;
  v_email text := nullif(btrim(coalesce(p_email, '')), '');
begin
  select is_active, timezone, order_mode into v_active, v_tz, v_order from businesses where id = p_business_id;
  if not coalesce(v_active, false) then raise exception 'Negocio no disponible'; end if;

  select duration_min, option_group into v_dur, v_group
  from services where id = p_service_id and business_id = p_business_id and is_active;
  if not found then raise exception 'Servicio no válido'; end if;
  v_ends := p_starts_at + make_interval(mins => v_dur);
  v_date := (p_starts_at at time zone v_tz)::date;

  if v_order then
    if p_option_id is null then raise exception 'Elige un sabor'; end if;
    select o.name into v_opt_label
    from service_options o
    where o.id = p_option_id and o.business_id = p_business_id
      and o.option_group is not distinct from v_group
      and (o.is_available or p_channel <> 'web');
    if not found then raise exception 'Ese sabor no está disponible'; end if;
  end if;

  perform pg_advisory_xact_lock(hashtext(p_business_id::text));

  select exists (select 1 from service_professionals where service_id = p_service_id) into v_has_any_prof;

  if p_professional_id is not null then
    if not exists (
      select 1 from service_professionals
      where service_id = p_service_id and professional_id = p_professional_id
    ) then
      raise exception 'Ese profesional no ofrece este servicio';
    end if;
    v_prof := p_professional_id;
  elsif v_has_any_prof then
    select sp.professional_id into v_prof
    from service_professionals sp
    join professionals pr on pr.id = sp.professional_id
    where sp.service_id = p_service_id
      and exists (
        select 1 from public.get_available_slots(p_business_id, p_service_id, v_date, sp.professional_id, p_channel) s
        where s.slot_start = p_starts_at
      )
    order by pr.name
    limit 1;
    if v_prof is null then raise exception 'El horario seleccionado ya no está disponible'; end if;
  else
    v_prof := null;
  end if;

  select exists (
    select 1 from public.get_available_slots(p_business_id, p_service_id, v_date, v_prof, p_channel) s
    where s.slot_start = p_starts_at
  ) into v_ok;
  if not v_ok then raise exception 'El horario seleccionado ya no está disponible'; end if;

  -- Estado: los encargos web quedan pendientes si el negocio exige confirmación manual.
  v_status := 'confirmada';
  if v_order and p_channel = 'web' then
    select require_confirmation into v_confirm from order_settings where business_id = p_business_id;
    if coalesce(v_confirm, true) then v_status := 'pendiente'; end if;
  end if;

  if public.normalize_phone(p_phone) is not null then
    insert into public.customers (business_id, full_name, last_name, phone, email)
    values (p_business_id, p_name, p_last_name, p_phone, v_email)
    on conflict (business_id, phone_norm) where phone_norm is not null do update
      set email      = coalesce(public.customers.email, excluded.email),
          updated_at = now()
    returning id into v_cust;
  else
    insert into public.customers (business_id, full_name, last_name, phone, email)
    values (p_business_id, p_name, p_last_name, p_phone, v_email)
    returning id into v_cust;
  end if;

  v_locator := public.generate_locator();

  insert into public.bookings (
    business_id, type, service_id, professional_id, starts_at, ends_at,
    customer_id, customer_name, customer_last_name, customer_phone, customer_email,
    locator, status, channel, notes, option_id, option_label
  ) values (
    p_business_id, 'citas', p_service_id, v_prof, p_starts_at, v_ends,
    v_cust, p_name, p_last_name, p_phone, v_email,
    v_locator, v_status, p_channel, p_notes,
    case when v_order then p_option_id end, v_opt_label
  ) returning * into v_row;

  return v_row;
end $$;

revoke all on function public.create_public_booking(uuid,uuid,timestamptz,text,text,text,text,text,booking_channel,uuid,uuid) from public, anon;
grant execute on function public.create_public_booking(uuid,uuid,timestamptz,text,text,text,text,text,booking_channel,uuid,uuid)
  to authenticated, service_role;

-- ---------------------------------------------------------------------
-- RPCs públicas del widget (cambia el tipo de retorno -> drop + create)
-- ---------------------------------------------------------------------
drop function if exists public.get_public_business(text);
create function public.get_public_business(p_slug text)
returns table (
  id uuid, name text, type business_type, primary_color text, logo_url text,
  timezone text, slot_interval_min int, order_mode boolean
)
language sql stable security definer set search_path = public
as $$
  select id, name, type, primary_color, logo_url, timezone, slot_interval_min, order_mode
  from businesses where slug = p_slug and is_active
$$;

drop function if exists public.get_public_services(uuid);
create function public.get_public_services(p_business_id uuid)
returns table (
  id uuid, name text, duration_min int, price numeric, professionals jsonb,
  size_key text, size_label text, option_group text
)
language sql stable security definer set search_path = public
as $$
  select s.id, s.name, s.duration_min, s.price,
    coalesce(
      (select jsonb_agg(jsonb_build_object('id', pr.id, 'name', pr.name, 'color', pr.color) order by pr.name)
       from service_professionals sp
       join professionals pr on pr.id = sp.professional_id and pr.is_active
       where sp.service_id = s.id),
      '[]'::jsonb
    ) as professionals,
    s.size_key, s.size_label, s.option_group
  from services s
  where s.business_id = p_business_id and s.is_active
    and exists (select 1 from businesses b where b.id = p_business_id and b.is_active)
  order by s.sort_order, s.name
$$;

create function public.get_public_options(p_business_id uuid)
returns table (
  id uuid, option_group text, group_label text, group_sort int,
  name text, is_available boolean, sort_order int
)
language sql stable security definer set search_path = public
as $$
  select o.id, o.option_group, coalesce(g.label, o.option_group), coalesce(g.sort_order, 0),
         o.name, o.is_available, o.sort_order
  from service_options o
  left join service_option_groups g on g.business_id = o.business_id and g.group_key = o.option_group
  where o.business_id = p_business_id
    and exists (select 1 from businesses b where b.id = p_business_id and b.is_active and b.order_mode)
  order by coalesce(g.sort_order, 0), o.sort_order, o.name
$$;

drop function if exists public.get_booking_by_locator(text);
create function public.get_booking_by_locator(p_locator text)
returns table (
  locator text, status booking_status, type business_type,
  starts_at timestamptz, ends_at timestamptz,
  business_name text, primary_color text, logo_url text, timezone text,
  service_name text, party_size int, customer_name text,
  option_label text, size_label text, order_mode boolean
)
language sql stable security definer set search_path = public
as $$
  select b.locator, b.status, b.type, b.starts_at, b.ends_at,
         bus.name, bus.primary_color, bus.logo_url, bus.timezone,
         s.name, b.party_size, b.customer_name,
         b.option_label, s.size_label, bus.order_mode
  from bookings b
  join businesses bus on bus.id = b.business_id
  left join services s on s.id = b.service_id
  where upper(b.locator) = upper(p_locator)
$$;

create or replace function public.cancel_booking_by_locator(p_locator text)
returns boolean
language plpgsql security definer set search_path = public
as $$
declare v_id uuid; v_starts timestamptz; v_status booking_status; v_biz uuid; v_min_h int;
begin
  select id, starts_at, status, business_id into v_id, v_starts, v_status, v_biz
  from bookings where upper(locator) = upper(p_locator);
  if not found then return false; end if;
  if v_status = 'cancelada' then return true; end if;
  if v_status = 'listo' then
    raise exception 'Tu encargo ya está preparado; contacta con el negocio para cancelarlo';
  end if;
  if v_starts <= now() then
    raise exception 'No se puede cancelar una reserva pasada o en curso';
  end if;
  select cancel_min_hours into v_min_h from order_settings where business_id = v_biz;
  if v_min_h is not null and v_starts < now() + make_interval(hours => v_min_h) then
    raise exception 'Ya no se puede cancelar online (mínimo % h de antelación); contacta con el negocio', v_min_h;
  end if;
  update bookings set status = 'cancelada' where id = v_id;
  return true;
end $$;

revoke all on function public.get_public_business(text), public.get_public_services(uuid),
  public.get_public_options(uuid), public.get_booking_by_locator(text), public.cancel_booking_by_locator(text)
  from public;
grant execute on function public.get_public_business(text), public.get_public_services(uuid),
  public.get_public_options(uuid), public.get_booking_by_locator(text), public.cancel_booking_by_locator(text)
  to anon, authenticated;
