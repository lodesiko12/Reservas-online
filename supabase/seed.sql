-- =====================================================================
-- seed.sql  —  Datos de demostración
--
-- Crea:
--   * Super-admin           admin@reservas.test     / Admin1234!
--   * Staff barbería (owner) staff@barberia.test     / Barberia1234!
--   * Negocio "citas": Barbería El Corte (slug: barberia-demo)
--       - 2 profesionales con horario
--       - 4 servicios (uno con disponibilidad propia distinta)
--       - reservas de ejemplo (web/manual, futuras y pasadas, incl. no-show)
--
-- Reejecutable: limpia el negocio demo y sus usuarios antes de recrearlos.
-- =====================================================================

-- Limpieza idempotente ------------------------------------------------
delete from auth.users where email in ('admin@reservas.test','staff@barberia.test','staff@restaurante.test');
delete from public.businesses where slug in ('barberia-demo','restaurante-la-plaza');

do $$
declare
  v_admin uuid := gen_random_uuid();
  v_staff uuid := gen_random_uuid();
  v_biz   uuid;
  v_ana   uuid;
  v_luis  uuid;
  v_s_corte uuid;
  v_s_barba uuid;
  v_s_tinte uuid;
  v_s_afeit uuid;
  wd int;
  d int;
  v_slot timestamptz;
  base_date date;
  tz text := 'Europe/Madrid';
begin
  -- ------------------- Usuarios de Auth -------------------
  insert into auth.users
    (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
     raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
     confirmation_token, recovery_token, email_change_token_new, email_change)
  values
    ('00000000-0000-0000-0000-000000000000', v_admin, 'authenticated', 'authenticated',
     'admin@reservas.test', crypt('Admin1234!', gen_salt('bf')), now(),
     '{"provider":"email","providers":["email"]}', '{"full_name":"Super Admin"}',
     now(), now(), '', '', '', ''),
    ('00000000-0000-0000-0000-000000000000', v_staff, 'authenticated', 'authenticated',
     'staff@barberia.test', crypt('Barberia1234!', gen_salt('bf')), now(),
     '{"provider":"email","providers":["email"]}', '{"full_name":"Dueño Barbería"}',
     now(), now(), '', '', '', '');

  insert into auth.identities
    (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
  values
    (gen_random_uuid(), v_admin,
     jsonb_build_object('sub', v_admin::text, 'email', 'admin@reservas.test'),
     'email', 'admin@reservas.test', now(), now(), now()),
    (gen_random_uuid(), v_staff,
     jsonb_build_object('sub', v_staff::text, 'email', 'staff@barberia.test'),
     'email', 'staff@barberia.test', now(), now(), now());

  -- El trigger handle_new_user ya creó las filas en profiles.
  update public.profiles set is_super_admin = true, full_name = 'Super Admin' where id = v_admin;

  -- ------------------- Negocio (tipo citas) -------------------
  insert into public.businesses (name, slug, type, primary_color, timezone, default_capacity, slot_interval_min)
  values ('Barbería El Corte', 'barberia-demo', 'citas', '#0f766e', tz, 1, 15)
  returning id into v_biz;

  insert into public.business_users (business_id, user_id, role) values (v_biz, v_staff, 'owner');

  -- Horario del negocio: L-V 09:00-20:00, Sáb 09:00-14:00
  for wd in 1..5 loop
    insert into public.business_hours (business_id, weekday, open_time, close_time)
    values (v_biz, wd, '09:00', '20:00');
  end loop;
  insert into public.business_hours (business_id, weekday, open_time, close_time)
  values (v_biz, 6, '09:00', '14:00');

  -- ------------------- Profesionales -------------------
  insert into public.professionals (business_id, name) values (v_biz, 'Ana')  returning id into v_ana;
  insert into public.professionals (business_id, name) values (v_biz, 'Luis') returning id into v_luis;

  -- Ana: L-V 09-14 y 16-20 ; Luis: L-V 10-20 ; Sáb ambos 09-14
  for wd in 1..5 loop
    insert into public.professional_hours (professional_id, weekday, start_time, end_time)
    values (v_ana, wd, '09:00', '14:00'), (v_ana, wd, '16:00', '20:00'),
           (v_luis, wd, '10:00', '20:00');
  end loop;
  insert into public.professional_hours (professional_id, weekday, start_time, end_time)
  values (v_ana, 6, '09:00', '14:00'), (v_luis, 6, '09:00', '14:00');

  -- ------------------- Servicios -------------------
  insert into public.services (business_id, name, duration_min, buffer_min, price, sort_order)
  values (v_biz, 'Corte de pelo', 30, 0, 15.00, 1) returning id into v_s_corte;
  insert into public.service_professionals (service_id, professional_id) values (v_s_corte, v_ana);

  insert into public.services (business_id, name, duration_min, buffer_min, price, sort_order)
  values (v_biz, 'Corte + barba', 45, 0, 22.00, 2) returning id into v_s_barba;
  insert into public.service_professionals (service_id, professional_id) values (v_s_barba, v_luis);

  insert into public.services (business_id, name, duration_min, buffer_min, price, sort_order)
  values (v_biz, 'Afeitado clásico', 30, 0, 12.00, 3) returning id into v_s_afeit;
  insert into public.service_professionals (service_id, professional_id) values (v_s_afeit, v_luis);

  -- Tinte: sin profesional (usa aforo del negocio) y con disponibilidad propia Mar-Jue 10-18
  insert into public.services (business_id, name, duration_min, buffer_min, price, sort_order)
  values (v_biz, 'Tinte', 90, 15, 40.00, 4) returning id into v_s_tinte;
  insert into public.service_availability (service_id, weekday, start_time, end_time)
  values (v_s_tinte, 2, '10:00', '18:00'), (v_s_tinte, 3, '10:00', '18:00'), (v_s_tinte, 4, '10:00', '18:00');

  -- ------------------- Reservas de ejemplo -------------------
  -- Futuras: se toma el primer hueco realmente disponible de cada servicio en
  -- los próximos 14 días (robusto sea cual sea el día en que se ejecute el seed).
  base_date := (now() at time zone tz)::date;

  v_slot := null;
  for d in 0..13 loop
    select s.slot_start into v_slot from public.get_available_slots(v_biz, v_s_corte, base_date + d) s order by s.slot_start limit 1;
    exit when v_slot is not null;
  end loop;
  if v_slot is not null then
    perform public.create_public_booking(v_biz, v_s_corte, v_slot, 'Marta', 'Gómez', '+34600111222', 'marta@example.com', 'Cliente habitual', 'web');
  end if;

  v_slot := null;
  for d in 0..13 loop
    select s.slot_start into v_slot from public.get_available_slots(v_biz, v_s_barba, base_date + d) s order by s.slot_start limit 1;
    exit when v_slot is not null;
  end loop;
  if v_slot is not null then
    perform public.create_public_booking(v_biz, v_s_barba, v_slot, 'Javier', 'Ruiz', '+34600333444', 'javier@example.com', null, 'web');
  end if;

  v_slot := null;
  for d in 0..13 loop
    select s.slot_start into v_slot from public.get_available_slots(v_biz, v_s_afeit, base_date + d) s order by s.slot_start limit 1;
    exit when v_slot is not null;
  end loop;
  if v_slot is not null then
    perform public.create_public_booking(v_biz, v_s_afeit, v_slot, 'Pedro', 'Núñez', '+34600555666', 'pedro@example.com', null, 'manual');
  end if;

  -- Pasadas para reportes (completada y no-show) — insertadas directamente
  insert into public.customers (business_id, full_name, last_name, phone, email)
  values (v_biz, 'Lucía', 'Ramos', '+34600777888', 'lucia@example.com')
  on conflict (business_id, phone) where phone is not null do nothing;

  insert into public.bookings
    (business_id, type, service_id, professional_id, starts_at, ends_at,
     customer_id, customer_name, customer_last_name, customer_phone, customer_email,
     locator, status, channel)
  select v_biz, 'citas', v_s_corte, v_ana,
     (date_trunc('day', now() at time zone tz) - interval '3 day' + time '10:00') at time zone tz,
     (date_trunc('day', now() at time zone tz) - interval '3 day' + time '10:30') at time zone tz,
     c.id, 'Lucía', 'Ramos', '+34600777888', 'lucia@example.com',
     public.generate_locator(), 'completada', 'web'
  from public.customers c where c.business_id = v_biz and c.phone = '+34600777888';

  insert into public.bookings
    (business_id, type, service_id, professional_id, starts_at, ends_at,
     customer_id, customer_name, customer_last_name, customer_phone, customer_email,
     locator, status, channel)
  select v_biz, 'citas', v_s_barba, v_luis,
     (date_trunc('day', now() at time zone tz) - interval '2 day' + time '17:00') at time zone tz,
     (date_trunc('day', now() at time zone tz) - interval '2 day' + time '17:45') at time zone tz,
     c.id, 'Lucía', 'Ramos', '+34600777888', 'lucia@example.com',
     public.generate_locator(), 'no_show', 'manual'
  from public.customers c where c.business_id = v_biz and c.phone = '+34600777888';

end $$;

-- =====================================================================
-- Negocio "restaurante": Restaurante La Plaza (slug: restaurante-la-plaza)
--   Staff (owner): staff@restaurante.test / Restaurante1234!
--   Franjas: Comida (13-16, aforo 40) y Cena (20-23:30, aforo 50)
-- =====================================================================
do $$
declare
  v_staff uuid := gen_random_uuid();
  v_biz uuid;
  v_comida uuid;
  v_cena uuid;
  v_slot timestamptz;
  v_shift uuid;
  d int;
  base_date date;
  tz text := 'Europe/Madrid';
begin
  insert into auth.users
    (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
     raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
     confirmation_token, recovery_token, email_change_token_new, email_change)
  values
    ('00000000-0000-0000-0000-000000000000', v_staff, 'authenticated', 'authenticated',
     'staff@restaurante.test', crypt('Restaurante1234!', gen_salt('bf')), now(),
     '{"provider":"email","providers":["email"]}', '{"full_name":"Dueño Restaurante"}',
     now(), now(), '', '', '', '');

  insert into auth.identities
    (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
  values
    (gen_random_uuid(), v_staff,
     jsonb_build_object('sub', v_staff::text, 'email', 'staff@restaurante.test'),
     'email', 'staff@restaurante.test', now(), now(), now());

  insert into public.businesses (name, slug, type, primary_color, timezone)
  values ('Restaurante La Plaza', 'restaurante-la-plaza', 'restaurante', '#b45309', tz)
  returning id into v_biz;

  insert into public.business_users (business_id, user_id, role) values (v_biz, v_staff, 'owner');

  insert into public.dining_shifts (business_id, name, start_time, end_time, max_covers, slot_interval_min, booking_duration_min, active_weekdays)
  values (v_biz, 'Comida', '13:00', '16:00', 40, 15, 90, '{2,3,4,5,6,0}') returning id into v_comida;
  insert into public.dining_shifts (business_id, name, start_time, end_time, max_covers, slot_interval_min, booking_duration_min, active_weekdays)
  values (v_biz, 'Cena', '20:00', '23:30', 50, 15, 120, '{4,5,6}') returning id into v_cena;

  base_date := (now() at time zone tz)::date;

  v_slot := null; v_shift := null;
  for d in 0..13 loop
    select s.slot_start, s.shift_id into v_slot, v_shift
    from public.get_available_dining_slots(v_biz, base_date + d, 4) s
    where s.shift_id = v_comida order by s.slot_start limit 1;
    exit when v_slot is not null;
  end loop;
  if v_slot is not null then
    perform public.create_public_dining_booking(v_biz, v_shift, v_slot, 4, 'Familia', 'Pérez', '+34611000111', 'perez@example.com', 'Trona para bebé', 'web');
  end if;

  v_slot := null; v_shift := null;
  for d in 0..13 loop
    select s.slot_start, s.shift_id into v_slot, v_shift
    from public.get_available_dining_slots(v_biz, base_date + d, 2) s
    where s.shift_id = v_cena order by s.slot_start limit 1;
    exit when v_slot is not null;
  end loop;
  if v_slot is not null then
    perform public.create_public_dining_booking(v_biz, v_shift, v_slot, 2, 'Ana', 'López', '+34611000222', 'analopez@example.com', null, 'manual');
  end if;
end $$;
