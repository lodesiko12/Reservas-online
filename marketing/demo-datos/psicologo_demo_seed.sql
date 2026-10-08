-- psicologo_demo_seed.sql
-- Negocio demo del tipo "psicologo": "Consulta Clara Montes" (slug consulta-demo-psicologia), para
-- capturar pantallas y hacer demos comerciales SIN tocar el negocio real de Ana Sánchez.
--
-- NO es una migración: se ejecuta a mano UNA vez (SQL editor de Supabase o MCP) y después se
-- ejecuta supabase/demo/refresh_psicologo_demo.sql para cargar las citas y sesiones.
--
-- Crea: negocio + usuario de prueba (psicologa@psicologo.test, contraseña de prueba en v_pw,
-- rol owner) + 1 profesional + 4 servicios con precio ficticio + horario L-V + 10 pacientes
-- ficticios (teléfonos 6000010NN, emails @ejemplo.com, NIF inventados).
-- Aborta si el slug ya existe. Para repetirlo: borrar el negocio (cascade) y el usuario
-- psicologa@psicologo.test desde el super-admin.
-- Mismo patrón que supabase/demo/agencia_demo_seed.sql.

do $$
declare
  v_slug  text := 'consulta-demo-psicologia';
  v_pw    text := crypt('Psicologa1234!', gen_salt('bf'));
  v_biz   uuid;
  v_uid   uuid := gen_random_uuid();
  v_prof  uuid;
  v_svc   uuid;
  r       record;
  d       int;
begin
  if exists (select 1 from public.businesses where slug = v_slug) then
    raise exception 'El negocio demo de psicólogo ya existe (%).', v_slug;
  end if;

  insert into public.businesses (name, slug, type, primary_color, timezone, slot_interval_min)
  values ('Consulta Clara Montes', v_slug, 'psicologo', '#0B6E6A', 'Europe/Madrid', 30)
  returning id into v_biz;

  -- Usuario de acceso (cuenta de prueba)
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change
  ) values (
    '00000000-0000-0000-0000-000000000000', v_uid, 'authenticated', 'authenticated',
    'psicologa@psicologo.test', v_pw, now(),
    '{"provider":"email","providers":["email"]}', jsonb_build_object('full_name', 'Clara Montes'), now(), now(),
    '', '', '', ''
  );
  insert into auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
  values (gen_random_uuid(), v_uid,
          jsonb_build_object('sub', v_uid::text, 'email', 'psicologa@psicologo.test', 'email_verified', true),
          'email', v_uid::text, now(), now(), now());
  insert into public.business_users (business_id, user_id, role) values (v_biz, v_uid, 'owner');

  -- Profesional
  insert into public.professionals (business_id, name, color)
  values (v_biz, 'Clara Montes', '#2563A8') returning id into v_prof;

  -- Horario del negocio y de la profesional: lunes a viernes, mañana y tarde
  for d in 1..5 loop
    insert into public.business_hours (business_id, weekday, open_time, close_time)
    values (v_biz, d, '09:00', '14:00'), (v_biz, d, '16:00', '20:00');
    insert into public.professional_hours (professional_id, weekday, start_time, end_time)
    values (v_prof, d, '09:00', '14:00'), (v_prof, d, '16:00', '20:00');
  end loop;

  -- Servicios (precios inventados, solo para la demo)
  for r in select * from (values
    ('Primera consulta',          60, 70, 1),
    ('Terapia individual',        50, 60, 2),
    ('Terapia de pareja',         75, 85, 3),
    ('Sesión online',             50, 55, 4)
  ) as t(name, dur, price, ord)
  loop
    insert into public.services (business_id, name, duration_min, price, sort_order)
    values (v_biz, r.name, r.dur, r.price, r.ord) returning id into v_svc;
    insert into public.service_professionals (service_id, professional_id) values (v_svc, v_prof);
  end loop;

  -- Pacientes ficticios (sin diagnósticos, solo datos de contacto)
  insert into public.customers (business_id, full_name, last_name, phone, email, nif)
  select v_biz, t.f, t.l, '6000010' || lpad(t.n::text, 2, '0'), 'paciente' || t.n || '@ejemplo.com', t.nif
  from (values
    (1, 'Marta',   'Ibáñez Soler',   '12345678Z'),
    (2, 'Daniel',  'Ferrer Pons',    null),
    (3, 'Lucía',   'Navarro Gil',    '23456789D'),
    (4, 'Andrés',  'Molina Ruiz',    null),
    (5, 'Irene',   'Castillo Vera',  '34567890V'),
    (6, 'Pablo',   'Serrano Mas',    null),
    (7, 'Elena',   'Prieto Lara',    null),
    (8, 'Sergio',  'Cano Blasco',    '45678901G'),
    (9, 'Nuria',   'Esteve Roig',    null),
    (10,'Hugo',    'Marín Calvo',    null)
  ) as t(n, f, l, nif);

  raise notice 'Negocio demo creado: % (id %). Ahora ejecuta refresh_psicologo_demo.sql', v_slug, v_biz;
end $$;
