-- =====================================================================
-- 0018_professional_selection_rpcs.sql
-- Adapta el motor de disponibilidad y las RPCs públicas al nuevo modelo
-- N:N servicios<->profesionales (0017), permitiendo elegir un profesional
-- concreto o "cualquiera disponible" entre los asignados al servicio.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Las firmas cambian (nuevo parámetro con default, o columnas de retorno
-- distintas): hay que borrar las versiones viejas explícitamente, si no
-- CREATE OR REPLACE fallaría (cambio de columnas) o dejaría un overload
-- ambiguo (nuevo parámetro opcional colisiona con la firma antigua).
-- ---------------------------------------------------------------------
drop function if exists public.get_available_slots(uuid, uuid, date);
drop function if exists public.get_public_services(uuid);
drop function if exists public.create_public_booking(uuid,uuid,timestamptz,text,text,text,text,text,booking_channel);

-- =====================================================================
-- MOTOR DE DISPONIBILIDAD (tipo citas)
-- Nuevo parámetro p_professional_id:
--   * informado  -> huecos de ESE profesional (igual que antes).
--   * null + el servicio tiene profesionales asignados -> unión de huecos
--     de TODOS los profesionales asignados (basta que uno esté libre).
--   * null + el servicio no tiene profesionales -> modo aforo (sin cambios).
-- =====================================================================
create or replace function public.get_available_slots(
  p_business_id      uuid,
  p_service_id       uuid,
  p_date             date,
  p_professional_id  uuid default null
) returns table (slot_start timestamptz, slot_end timestamptz)
language plpgsql stable security definer set search_path = public
as $$
declare
  v_tz          text;
  v_active      boolean;
  v_capacity    int;
  v_step        int;
  v_dur         int;
  v_buf         int;
  v_prof        uuid;
  v_dow         int := extract(dow from p_date)::int;
  v_has_svc     boolean;
  v_has_prof    boolean;
  v_has_any_prof boolean;
begin
  select timezone, is_active, default_capacity, slot_interval_min
    into v_tz, v_active, v_capacity, v_step
  from businesses where id = p_business_id;
  if not found or not v_active then return; end if;

  select duration_min, buffer_min into v_dur, v_buf
  from services
  where id = p_service_id and business_id = p_business_id and is_active;
  if not found then return; end if;

  -- Rama "cualquiera disponible": abanico por cada profesional asignado.
  if p_professional_id is null then
    select exists (select 1 from service_professionals where service_id = p_service_id) into v_has_any_prof;
    if v_has_any_prof then
      return query
      select gs.slot_start, gs.slot_end
      from service_professionals sp
      cross join lateral public.get_available_slots(p_business_id, p_service_id, p_date, sp.professional_id) gs
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
-- Catálogo público: cada servicio devuelve TODOS sus profesionales
-- asignados (antes era uno solo).
-- =====================================================================
create or replace function public.get_public_services(p_business_id uuid)
returns table (
  id uuid, name text, duration_min int, price numeric,
  professionals jsonb
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
    ) as professionals
  from services s
  where s.business_id = p_business_id and s.is_active
    and exists (select 1 from businesses b where b.id = p_business_id and b.is_active)
  order by s.sort_order, s.name
$$;

-- =====================================================================
-- CREACIÓN TRANSACCIONAL DE RESERVA (tipo citas)
-- Nuevo parámetro p_professional_id: profesional concreto elegido por el
-- cliente, o null para "cualquiera disponible" (se resuelve aquí bajo lock).
-- =====================================================================
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
  p_professional_id  uuid default null
) returns public.bookings
language plpgsql security definer set search_path = public
as $$
declare
  v_dur int; v_prof uuid; v_ends timestamptz; v_active boolean;
  v_tz text; v_cust uuid; v_locator text; v_row public.bookings; v_ok boolean;
  v_has_any_prof boolean; v_date date;
begin
  select is_active, timezone into v_active, v_tz from businesses where id = p_business_id;
  if not coalesce(v_active, false) then raise exception 'Negocio no disponible'; end if;

  select duration_min into v_dur
  from services where id = p_service_id and business_id = p_business_id and is_active;
  if not found then raise exception 'Servicio no válido'; end if;
  v_ends := p_starts_at + make_interval(mins => v_dur);
  v_date := (p_starts_at at time zone v_tz)::date;

  -- Serializa la creación por negocio para evitar dobles reservas concurrentes.
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
    -- "Cualquiera disponible": el primero (por nombre) que esté libre en ese hueco.
    select sp.professional_id into v_prof
    from service_professionals sp
    join professionals pr on pr.id = sp.professional_id
    where sp.service_id = p_service_id
      and exists (
        select 1 from public.get_available_slots(p_business_id, p_service_id, v_date, sp.professional_id) s
        where s.slot_start = p_starts_at
      )
    order by pr.name
    limit 1;
    if v_prof is null then raise exception 'El horario seleccionado ya no está disponible'; end if;
  else
    v_prof := null; -- modo aforo, sin profesionales asignados al servicio
  end if;

  select exists (
    select 1 from public.get_available_slots(p_business_id, p_service_id, v_date, v_prof) s
    where s.slot_start = p_starts_at
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
-- Permisos de ejecución (las firmas cambiaron, hay que otorgar de nuevo)
-- ---------------------------------------------------------------------
grant execute on function public.get_available_slots(uuid, uuid, date, uuid) to anon, authenticated;
grant execute on function public.get_public_services(uuid)                  to anon, authenticated;
grant execute on function public.create_public_booking(uuid,uuid,timestamptz,text,text,text,text,text,booking_channel,uuid)
  to authenticated, service_role;
