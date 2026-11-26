-- 0070_slot_chaining.sql
-- Huecos encadenados (opt-in por negocio: businesses.slot_chaining).
--
-- La rejilla de huecos arranca al inicio de cada tramo y avanza cada slot_interval_min. Con citas de
-- 80 min y paso de 60 quedaban 40 min muertos (9:00-10:20 -> siguiente a las 11:00). Con el
-- encadenado, cada cita del profesional reinicia la rejilla en su hora de fin redondeada a la media
-- hora siguiente: 10:20 -> 10:30, 11:30, 12:30... Si la cita acaba en punto, nada cambia.
-- Sin el interruptor el resultado es idéntico al anterior.
--
-- Reescrita desde pg_get_functiondef de producción. Cambios: v_chain y los CTE anchors/ranges/slots.

alter table public.businesses
  add column if not exists slot_chaining boolean not null default false;

CREATE OR REPLACE FUNCTION public.get_available_slots(p_business_id uuid, p_service_id uuid, p_date date, p_professional_id uuid DEFAULT NULL::uuid, p_channel booking_channel DEFAULT 'web'::booking_channel)
 RETURNS TABLE(slot_start timestamp with time zone, slot_end timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_tz          text;
  v_active      boolean;
  v_capacity    int;
  v_step        int;
  v_max_advance int;
  v_chain       boolean;
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
  select timezone, is_active, default_capacity, slot_interval_min, max_advance_days, slot_chaining
    into v_tz, v_active, v_capacity, v_step, v_max_advance, v_chain
  from businesses where id = p_business_id;
  if not found or not v_active then return; end if;

  select duration_min, buffer_min, size_key into v_dur, v_buf, v_size
  from services
  where id = p_service_id and business_id = p_business_id and is_active;
  if not found then return; end if;

  select use_weekday into v_ov_wd
  from business_day_overrides where business_id = p_business_id and day = p_date;
  if found then
    if v_ov_wd is null then return; end if;
    v_dow := v_ov_wd;
  end if;

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
  -- Minuto del día (hora local) en que acaba cada cita, redondeado a la media hora siguiente.
  ends as (
    select (ceil(extract(epoch from ((b.ends_at at time zone v_tz) - p_date::timestamp)) / 1800.0) * 30)::int as m
    from bookings b
    where v_chain and v_prof is not null
      and b.professional_id = v_prof
      and b.status in ('confirmada','pendiente','listo','completada')
      and (b.ends_at at time zone v_tz) > p_date::timestamp
      and (b.starts_at at time zone v_tz) < (p_date + 1)::timestamp
  ),
  -- Puntos donde arranca la rejilla: inicio de cada tramo y, con encadenado, el fin de cada cita.
  anchors as (
    select eff.s as win_s, eff.e as win_e, eff.s as a from eff
    union
    select eff.s, eff.e, ends.m from eff join ends on ends.m > eff.s and ends.m < eff.e
  ),
  ranges as (
    select an.win_e, an.a,
           lead(an.a) over (partition by an.win_s, an.win_e order by an.a) as next_a
    from anchors an
  ),
  slots as (
    select distinct gs as start_min
    from ranges r
    cross join lateral generate_series(
      r.a, least(r.win_e - v_dur, coalesce(r.next_a - 1, r.win_e - v_dur)), v_step) gs
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
    and not exists (
      select 1 from crm_events ev
      where ev.business_id = p_business_id
        and ev.booking_id is null
        and ev.starts_at < c.slot_end and ev.ends_at > c.slot_start
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
end $function$;

-- Activar solo en el Centro de Psicología Ana Sánchez.
update public.businesses set slot_chaining = true where slug = 'centrodepsicologia-anasanchez';
