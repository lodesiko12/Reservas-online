-- =====================================================================
-- 0019_fix_customer_upsert_regression.sql
-- Corrige una regresión introducida en 0018: al reescribir
-- create_public_booking para añadir p_professional_id se partió por error
-- de la versión de 0003 en vez de la de 0008, que ya había corregido el
-- upsert de clientes para usar el índice único real
-- (business_id, phone_norm) en vez de (business_id, phone) —este último
-- no tiene índice y provoca "no unique or exclusion constraint matching
-- the ON CONFLICT specification"— y que además preserva el nombre de la
-- ficha ya existente (decisión de producto documentada en 0008).
-- Detectado end-to-end en el widget en producción: cualquier reserva con
-- teléfono fallaba al crear/actualizar el cliente.
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

  -- Upsert de cliente por TELÉFONO NORMALIZADO (índice real uq_customers_business_phone_norm).
  -- El nombre de la ficha no se sobrescribe una vez creada; el email solo se rellena si faltaba.
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

grant execute on function public.create_public_booking(uuid,uuid,timestamptz,text,text,text,text,text,booking_channel,uuid)
  to authenticated, service_role;
