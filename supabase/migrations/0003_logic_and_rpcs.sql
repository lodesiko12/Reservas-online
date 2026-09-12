-- =====================================================================
-- 0003_logic_and_rpcs.sql
-- Lógica de negocio: triggers de mantenimiento, motor de disponibilidad
-- y RPCs públicas usadas por el widget (rol anon) y por los paneles.
-- =====================================================================

-- ---------------------------------------------------------------------
-- updated_at automático
-- ---------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;

do $$
declare t text;
begin
  foreach t in array array['professionals','services','dining_shifts','customers','bookings'] loop
    execute format('drop trigger if exists trg_set_updated_at on public.%I;', t);
    execute format('create trigger trg_set_updated_at before update on public.%I
                    for each row execute function public.set_updated_at();', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- Recuento de reservas / no-shows por cliente
-- ---------------------------------------------------------------------
create or replace function public.recount_customer(cid uuid)
returns void language sql as $$
  update public.customers c set
    bookings_count = (select count(*) from public.bookings b
                        where b.customer_id = c.id and b.status <> 'cancelada'),
    no_show_count  = (select count(*) from public.bookings b
                        where b.customer_id = c.id and b.status = 'no_show'),
    updated_at = now()
  where c.id = cid;
$$;

create or replace function public.trg_booking_customer_counts()
returns trigger language plpgsql as $$
begin
  if tg_op in ('INSERT','UPDATE') and new.customer_id is not null then
    perform public.recount_customer(new.customer_id);
  end if;
  if (tg_op = 'DELETE')
     or (tg_op = 'UPDATE' and old.customer_id is distinct from new.customer_id) then
    if old.customer_id is not null then perform public.recount_customer(old.customer_id); end if;
  end if;
  return null;
end $$;

drop trigger if exists trg_booking_counts on public.bookings;
create trigger trg_booking_counts
  after insert or update or delete on public.bookings
  for each row execute function public.trg_booking_customer_counts();

-- ---------------------------------------------------------------------
-- Generador de localizador único formato AB-XXXXXX (sin caracteres ambiguos)
-- ---------------------------------------------------------------------
create or replace function public.generate_locator()
returns text language plpgsql as $$
declare
  chars text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  code  text;
  i     int;
begin
  loop
    code := '';
    for i in 1..2 loop code := code || substr(chars, floor(random()*length(chars))::int + 1, 1); end loop;
    code := code || '-';
    for i in 1..6 loop code := code || substr(chars, floor(random()*length(chars))::int + 1, 1); end loop;
    exit when not exists (select 1 from public.bookings where locator = code);
  end loop;
  return code;
end $$;

-- =====================================================================
-- MOTOR DE DISPONIBILIDAD (tipo citas)
-- Cruza: horario del negocio ∩ disponibilidad del servicio ∩ horario del
-- profesional  −  reservas existentes  −  bloqueos.
-- Devuelve los inicios de hueco reservables para (negocio, servicio, fecha).
-- =====================================================================
create or replace function public.get_available_slots(
  p_business_id uuid,
  p_service_id  uuid,
  p_date        date
) returns table (slot_start timestamptz, slot_end timestamptz)
language plpgsql stable security definer set search_path = public
as $$
declare
  v_tz       text;
  v_active   boolean;
  v_capacity int;
  v_step     int;
  v_dur      int;
  v_buf      int;
  v_prof     uuid;
  v_dow      int := extract(dow from p_date)::int;
  v_has_svc  boolean;
  v_has_prof boolean;
begin
  select timezone, is_active, default_capacity, slot_interval_min
    into v_tz, v_active, v_capacity, v_step
  from businesses where id = p_business_id;
  if not found or not v_active then return; end if;

  select duration_min, buffer_min, professional_id
    into v_dur, v_buf, v_prof
  from services
  where id = p_service_id and business_id = p_business_id and is_active;
  if not found then return; end if;

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
              and b.status in ('confirmada','completada')
              and b.starts_at < (c.slot_end + make_interval(mins => v_buf))
              and b.ends_at   > c.slot_start
          )
        else
          (select count(*) from bookings b
             where b.business_id = p_business_id
               and b.professional_id is null
               and b.status in ('confirmada','completada')
               and b.starts_at < (c.slot_end + make_interval(mins => v_buf))
               and b.ends_at   > c.slot_start
          ) < v_capacity
      end
    )
  order by c.slot_start;
end $$;

-- =====================================================================
-- RPCs PÚBLICAS (branding + catálogo para el widget)
-- =====================================================================
create or replace function public.get_public_business(p_slug text)
returns table (
  id uuid, name text, type business_type, primary_color text,
  logo_url text, timezone text, slot_interval_min int
)
language sql stable security definer set search_path = public
as $$
  select id, name, type, primary_color, logo_url, timezone, slot_interval_min
  from businesses where slug = p_slug and is_active
$$;

create or replace function public.get_public_services(p_business_id uuid)
returns table (
  id uuid, name text, duration_min int, price numeric,
  professional_id uuid, professional_name text
)
language sql stable security definer set search_path = public
as $$
  select s.id, s.name, s.duration_min, s.price, s.professional_id, p.name
  from services s
  left join professionals p on p.id = s.professional_id
  where s.business_id = p_business_id and s.is_active
    and exists (select 1 from businesses b where b.id = p_business_id and b.is_active)
  order by s.sort_order, s.name
$$;

-- =====================================================================
-- CONSULTA / CANCELACIÓN por localizador ("Mi reserva")
-- =====================================================================
create or replace function public.get_booking_by_locator(p_locator text)
returns table (
  locator text, status booking_status, type business_type,
  starts_at timestamptz, ends_at timestamptz,
  business_name text, primary_color text, logo_url text, timezone text,
  service_name text, party_size int, customer_name text
)
language sql stable security definer set search_path = public
as $$
  select b.locator, b.status, b.type, b.starts_at, b.ends_at,
         bus.name, bus.primary_color, bus.logo_url, bus.timezone,
         s.name, b.party_size, b.customer_name
  from bookings b
  join businesses bus on bus.id = b.business_id
  left join services s on s.id = b.service_id
  where upper(b.locator) = upper(p_locator)
$$;

create or replace function public.cancel_booking_by_locator(p_locator text)
returns boolean
language plpgsql security definer set search_path = public
as $$
declare v_id uuid; v_starts timestamptz; v_status booking_status;
begin
  select id, starts_at, status into v_id, v_starts, v_status
  from bookings where upper(locator) = upper(p_locator);
  if not found then return false; end if;
  if v_status = 'cancelada' then return true; end if;
  if v_starts <= now() then
    raise exception 'No se puede cancelar una reserva pasada o en curso';
  end if;
  update bookings set status = 'cancelada' where id = v_id;
  return true;
end $$;

-- =====================================================================
-- CREACIÓN TRANSACCIONAL DE RESERVA (tipo citas)
-- Re-valida disponibilidad bajo lock por negocio y hace upsert de cliente.
-- Se invoca desde la Edge Function `create-booking` (service_role) y desde
-- el panel para reservas manuales.
-- =====================================================================
create or replace function public.create_public_booking(
  p_business_id uuid,
  p_service_id  uuid,
  p_starts_at   timestamptz,
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
  v_dur int; v_prof uuid; v_ends timestamptz; v_active boolean;
  v_tz text; v_cust uuid; v_locator text; v_row public.bookings; v_ok boolean;
begin
  select is_active, timezone into v_active, v_tz from businesses where id = p_business_id;
  if not coalesce(v_active, false) then raise exception 'Negocio no disponible'; end if;

  select duration_min, professional_id into v_dur, v_prof
  from services where id = p_service_id and business_id = p_business_id and is_active;
  if not found then raise exception 'Servicio no válido'; end if;
  v_ends := p_starts_at + make_interval(mins => v_dur);

  -- Serializa la creación por negocio para evitar dobles reservas concurrentes.
  perform pg_advisory_xact_lock(hashtext(p_business_id::text));

  select exists (
    select 1 from public.get_available_slots(
      p_business_id, p_service_id, (p_starts_at at time zone v_tz)::date
    ) s where s.slot_start = p_starts_at
  ) into v_ok;
  if not v_ok then raise exception 'El horario seleccionado ya no está disponible'; end if;

  if p_phone is not null and length(trim(p_phone)) > 0 then
    insert into public.customers (business_id, full_name, last_name, phone, email)
    values (p_business_id, p_name, p_last_name, p_phone, p_email)
    on conflict (business_id, phone) where phone is not null do update
      set full_name = excluded.full_name,
          last_name = excluded.last_name,
          email     = coalesce(excluded.email, public.customers.email),
          updated_at = now()
    returning id into v_cust;
  else
    insert into public.customers (business_id, full_name, last_name, phone, email)
    values (p_business_id, p_name, p_last_name, null, p_email)
    returning id into v_cust;
  end if;

  v_locator := public.generate_locator();

  insert into public.bookings (
    business_id, type, service_id, professional_id, starts_at, ends_at,
    customer_id, customer_name, customer_last_name, customer_phone, customer_email,
    locator, status, channel, notes
  ) values (
    p_business_id, 'citas', p_service_id, v_prof, p_starts_at, v_ends,
    v_cust, p_name, p_last_name, p_phone, p_email,
    v_locator, 'confirmada', p_channel, p_notes
  ) returning * into v_row;

  return v_row;
end $$;

-- ---------------------------------------------------------------------
-- Permisos de ejecución
-- ---------------------------------------------------------------------
grant execute on function public.get_available_slots(uuid, uuid, date)      to anon, authenticated;
grant execute on function public.get_public_business(text)                  to anon, authenticated;
grant execute on function public.get_public_services(uuid)                  to anon, authenticated;
grant execute on function public.get_booking_by_locator(text)               to anon, authenticated;
grant execute on function public.cancel_booking_by_locator(text)            to anon, authenticated;
-- La creación de reservas NO se expone a anon: pasa por la Edge Function.
grant execute on function public.create_public_booking(uuid,uuid,timestamptz,text,text,text,text,text,booking_channel)
  to authenticated, service_role;
