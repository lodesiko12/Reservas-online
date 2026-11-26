-- 0071_manual_booking_free_time.sql
-- «Otra hora» en Nueva cita: el personal puede crear una cita fuera de la rejilla de huecos
-- (fuera de horario, hora partida, solapada...). El panel avisa y pide confirmación antes.
-- Solo miembros del negocio; la reserva online sigue pasando por create_public_booking.

create or replace function public.create_manual_booking_free_time(
  p_business_id uuid, p_service_id uuid, p_starts_at timestamptz, p_name text, p_last_name text,
  p_phone text, p_email text, p_notes text default null, p_professional_id uuid default null
)
returns public.bookings
language plpgsql security definer set search_path = public
as $$
declare
  v_dur int; v_cust uuid; v_row public.bookings;
  v_email text := nullif(btrim(coalesce(p_email, '')), '');
begin
  if auth.uid() is null or not coalesce(public.is_business_member(p_business_id), false) then
    raise exception 'No autorizado';
  end if;
  if not exists (select 1 from businesses where id = p_business_id and is_active and not coalesce(order_mode, false)) then
    raise exception 'Negocio no disponible';
  end if;
  if nullif(btrim(coalesce(p_name, '')), '') is null then raise exception 'Falta el nombre'; end if;
  if p_starts_at is null then raise exception 'Falta la fecha y hora'; end if;

  select duration_min into v_dur
  from services where id = p_service_id and business_id = p_business_id and is_active;
  if not found then raise exception 'Servicio no válido'; end if;

  if p_professional_id is not null then
    if not exists (
      select 1 from service_professionals sp join professionals pr on pr.id = sp.professional_id
      where sp.service_id = p_service_id and sp.professional_id = p_professional_id and pr.business_id = p_business_id
    ) then
      raise exception 'Ese profesional no ofrece este servicio';
    end if;
  elsif exists (select 1 from service_professionals where service_id = p_service_id) then
    raise exception 'Elige un profesional';
  end if;

  perform pg_advisory_xact_lock(hashtext(p_business_id::text));

  if public.normalize_phone(p_phone) is not null then
    insert into public.customers (business_id, full_name, last_name, phone, email)
    values (p_business_id, p_name, p_last_name, p_phone, v_email)
    on conflict (business_id, phone_norm) where phone_norm is not null do update
      set email = coalesce(public.customers.email, excluded.email), updated_at = now()
    returning id into v_cust;
  else
    insert into public.customers (business_id, full_name, last_name, phone, email)
    values (p_business_id, p_name, p_last_name, p_phone, v_email)
    returning id into v_cust;
  end if;

  insert into public.bookings (
    business_id, type, service_id, professional_id, starts_at, ends_at,
    customer_id, customer_name, customer_last_name, customer_phone, customer_email,
    locator, status, channel, notes
  ) values (
    p_business_id, 'citas', p_service_id, p_professional_id, p_starts_at, p_starts_at + make_interval(mins => v_dur),
    v_cust, p_name, p_last_name, p_phone, v_email,
    public.generate_locator(), 'confirmada', 'manual', p_notes
  ) returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.create_manual_booking_free_time(uuid, uuid, timestamptz, text, text, text, text, text, uuid) from public, anon;
grant execute on function public.create_manual_booking_free_time(uuid, uuid, timestamptz, text, text, text, text, text, uuid) to authenticated;
