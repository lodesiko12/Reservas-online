-- agencia_demo_seed.sql
-- Tenant de prueba del tipo "agencia": "Agrupación de Comparsas (demo)" (slug agrupacion-demo).
--   * 5 de directiva + 20 miembros (@agencia.test, contraseña de prueba común Agencia1234!)
--   * Los 8 equipos por defecto los crea el trigger al insertar el negocio.
--   * Miembros repartidos en equipos (varios en 2-3 equipos), tareas con asignados y fechas
--     (algunas atrasadas), comentarios con mención y eventos (generales y de equipo).
-- Idempotente a medias: si el slug ya existe aborta. Para repetirlo, borra antes el negocio
-- (cascade) y los usuarios *@agencia.test desde el super-admin.
-- Requiere la migración 0047 (autor de comentarios sin JWT).
-- Los documentos de muestra se suben desde la UI (necesitan un archivo real en Storage).
do $$
declare
  v_biz   uuid;
  v_pw    text := crypt('Agencia1234!', gen_salt('bf'));
  r       record;
  v_uid   uuid;
  v_task  uuid;
  v_team  uuid;
  n       int;
begin
  if exists (select 1 from public.businesses where slug = 'agrupacion-demo') then
    raise exception 'La agrupación demo ya existe';
  end if;

  insert into public.businesses (name, slug, type, primary_color, timezone)
  values ('Agrupación de Comparsas (demo)', 'agrupacion-demo', 'agencia', '#0B6E6A', 'Europe/Madrid')
  returning id into v_biz;

  -- Usuarios: email, nombre, nivel, puesto de directiva, cargo informativo
  for r in
    select * from (values
      ('presidente@agencia.test',      'Antonio Ruiz Llorca',    'directiva', 'presidente',      'Presidente'),
      ('vicepresidente1@agencia.test', 'María Payá Soler',       'directiva', 'vicepresidente1', 'Vicepresidenta 1ª'),
      ('vicepresidente2@agencia.test', 'José Úbeda Mira',        'directiva', 'vicepresidente2', 'Vicepresidente 2º'),
      ('secretario@agencia.test',      'Carmen Pastor Gisbert',  'directiva', 'secretario',      'Secretaria'),
      ('tesorero@agencia.test',        'Vicente Sempere Alcaraz','directiva', 'tesorero',        'Tesorero'),
      ('miembro01@agencia.test', 'Lucía Pérez Navarro',     'miembro', null, 'Responsable de protocolo mayor'),
      ('miembro02@agencia.test', 'Pablo Gómez Torres',      'miembro', null, null),
      ('miembro03@agencia.test', 'Marta Silvestre Ibáñez',  'miembro', null, 'Responsable de pólvora'),
      ('miembro04@agencia.test', 'David Climent Ferrer',    'miembro', null, null),
      ('miembro05@agencia.test', 'Elena Barceló Vidal',     'miembro', null, 'Coordinadora de embajadas infantiles'),
      ('miembro06@agencia.test', 'Sergio Molina Ródenas',   'miembro', null, null),
      ('miembro07@agencia.test', 'Noelia Beneyto Cortés',   'miembro', null, 'Responsable de desfiles'),
      ('miembro08@agencia.test', 'Álvaro Tormo Esteve',     'miembro', null, null),
      ('miembro09@agencia.test', 'Irene Cabrera Mas',       'miembro', null, null),
      ('miembro10@agencia.test', 'Adrián Sanchis Rico',     'miembro', null, 'Maestro de pólvora'),
      ('miembro11@agencia.test', 'Paula Montesinos Gil',    'miembro', null, null),
      ('miembro12@agencia.test', 'Hugo Valdés Pascual',     'miembro', null, null),
      ('miembro13@agencia.test', 'Sara Lledó Alemany',      'miembro', null, 'Responsable de presentaciones'),
      ('miembro14@agencia.test', 'Rubén Cano Ortiz',        'miembro', null, null),
      ('miembro15@agencia.test', 'Alba Rovira Bernabeu',    'miembro', null, null),
      ('miembro16@agencia.test', 'Javier Francés Domenech', 'miembro', null, null),
      ('miembro17@agencia.test', 'Nuria Escolano Pina',     'miembro', null, 'Responsable de protocolo infantil'),
      ('miembro18@agencia.test', 'Iván Carbonell Ripoll',   'miembro', null, null),
      ('miembro19@agencia.test', 'Cristina Santonja Mira',  'miembro', null, null),
      ('miembro20@agencia.test', 'Raúl Penadés Calatayud',  'miembro', null, 'Organizador de eventos')
    ) as t(email, full_name, level, role, cargo)
  loop
    v_uid := gen_random_uuid();
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, recovery_token, email_change_token_new, email_change
    ) values (
      '00000000-0000-0000-0000-000000000000', v_uid, 'authenticated', 'authenticated', r.email, v_pw, now(),
      '{"provider":"email","providers":["email"]}', jsonb_build_object('full_name', r.full_name), now(), now(),
      '', '', '', ''
    );
    insert into auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
    values (gen_random_uuid(), v_uid, jsonb_build_object('sub', v_uid::text, 'email', r.email, 'email_verified', true),
            'email', v_uid::text, now(), now(), now());
    insert into public.business_users (business_id, user_id, role) values (v_biz, v_uid, 'staff') on conflict do nothing;
    insert into public.agency_members (business_id, user_id, full_name, access_level, directiva_role, cargo)
    values (v_biz, v_uid, r.full_name, r.level, r.role, r.cargo);
  end loop;

  -- Equipos de cada miembro. Orden de equipos: 1 Protocolo mayor, 2 Protocolo infantil, 3 Pólvora,
  -- 4 Embajadas, 5 Embajadas infantiles, 6 Organización y eventos, 7 Desfiles, 8 Presentaciones.
  create temp table _teams on commit drop as
    select row_number() over (order by position) as idx, id from public.agency_teams where business_id = v_biz;

  for n in 1..20 loop
    select u.id into v_uid from auth.users u where u.email = 'miembro' || lpad(n::text, 2, '0') || '@agencia.test';
    insert into public.agency_team_members (team_id, user_id, business_id)
      select id, v_uid, v_biz from _teams where idx = ((n - 1) % 8) + 1 on conflict do nothing;
    if n % 3 = 0 then
      insert into public.agency_team_members (team_id, user_id, business_id)
        select id, v_uid, v_biz from _teams where idx = ((n + 3) % 8) + 1 on conflict do nothing;
    end if;
    if n in (10, 15, 20) then
      insert into public.agency_team_members (team_id, user_id, business_id)
        select id, v_uid, v_biz from _teams where idx = ((n + 5) % 8) + 1 on conflict do nothing;
    end if;
  end loop;
  -- Secretaria y tesorero también trabajan en equipos (el presidente y vicepresidentes, no: ven todo igualmente).
  insert into public.agency_team_members (team_id, user_id, business_id)
    select t.id, u.id, v_biz from _teams t, auth.users u
    where (u.email = 'secretario@agencia.test' and t.idx in (6, 8)) or (u.email = 'tesorero@agencia.test' and t.idx = 6)
    on conflict do nothing;

  -- Tareas: equipo (idx), título, estado, días hasta la fecha límite (null = sin fecha), descripción
  create temp table _tasks on commit drop as
    select row_number() over () as n, * from (values
      (1, 'Revisar el orden de entrada del desfile de gala', 'en_curso', 6,  'Confirmar con las comparsas el orden y los tiempos.'),
      (1, 'Actualizar el protocolo de recepción de autoridades', 'pendiente', 14, null),
      (1, 'Reservar palco para invitados', 'hecha', -5, null),
      (1, 'Confirmar la misa y el pasacalles del sábado', 'pendiente', -2, 'Hablar con el párroco.'),
      (2, 'Preparar el recorrido del desfile infantil', 'en_curso', 9, null),
      (2, 'Pedir autorización a los padres para el desfile', 'pendiente', 4, 'Hoja de autorización firmada.'),
      (2, 'Comprar chuches para el pasacalles', 'pendiente', 20, null),
      (3, 'Solicitar permisos de la pirotecnia al ayuntamiento', 'en_curso', 3, 'Entregar documentación en Policía Local.'),
      (3, 'Revisar el seguro de responsabilidad civil', 'pendiente', -4, null),
      (3, 'Preparar el listado de arcabuceros', 'hecha', -9, null),
      (3, 'Revisión de la pólvora y el almacén', 'pendiente', 12, 'Revisión con el maestro polvorista.'),
      (4, 'Redactar el texto de la embajada mora', 'en_curso', 8, 'Versión 2 con las correcciones del cronista.'),
      (4, 'Ensayo general de la embajada cristiana', 'pendiente', 15, null),
      (4, 'Contratar el sonido para las embajadas', 'pendiente', -1, null),
      (5, 'Elegir a los embajadores infantiles', 'en_curso', 10, null),
      (5, 'Adaptar el texto de la embajada para niños', 'pendiente', 18, null),
      (5, 'Confeccionar el vestuario infantil', 'pendiente', 25, null),
      (6, 'Organizar la cena de hermandad', 'en_curso', 11, 'Cerrar menú y precio con el restaurante.'),
      (6, 'Pedir presupuesto del escenario', 'pendiente', 2, null),
      (6, 'Montar el calendario de actos de las fiestas', 'hecha', -12, null),
      (6, 'Contactar con las peñas para la verbena', 'pendiente', -3, null),
      (6, 'Gestionar los permisos de vía pública', 'en_curso', 5, null),
      (7, 'Coordinar a las comparsas para el desfile del domingo', 'en_curso', 7, null),
      (7, 'Confirmar las bandas de música', 'pendiente', 13, 'Falta confirmar la banda invitada.'),
      (7, 'Repartir los dorsales de orden de desfile', 'pendiente', 16, null),
      (8, 'Diseñar el cartel de las fiestas', 'en_curso', 17, null),
      (8, 'Preparar la presentación de la capitanía', 'pendiente', 19, null),
      (8, 'Imprimir el programa de actos', 'pendiente', 22, null),
      (8, 'Fotógrafo para la presentación', 'hecha', -6, null),
      (8, 'Invitar a la prensa local', 'pendiente', null, null)
    ) as v(team_idx, title, status, due_off, descr);

  for r in select * from _tasks order by n loop
    select id into v_team from _teams where idx = r.team_idx;
    insert into public.agency_tasks (business_id, team_id, title, description, status, due_date, sort_order, created_by)
    values (v_biz, v_team, r.title, r.descr, r.status,
            case when r.due_off is null then null else (now() at time zone 'Europe/Madrid')::date + r.due_off end,
            r.n * 1000, (select user_id from public.agency_team_members where team_id = v_team order by user_id limit 1))
    returning id into v_task;
    -- Uno o dos asignados del equipo, rotando.
    insert into public.agency_task_assignees (task_id, user_id, business_id, team_id)
      select v_task, x.user_id, v_biz, v_team
      from (select user_id, row_number() over (order by user_id) as rn, count(*) over () as cnt
            from public.agency_team_members where team_id = v_team) x
      where x.rn = (r.n % x.cnt) + 1 or (r.n % 3 = 0 and x.rn = ((r.n + 1) % x.cnt) + 1);
  end loop;

  -- Comentarios con mención
  insert into public.agency_task_comments (business_id, team_id, task_id, author_id, body, mentions)
  select v_biz, t.team_id, t.id, a.user_id,
         'He hablado con ellos; ¿puedes confirmarlo tú, @' || b.full_name || '?', array[b.user_id]
  from (select * from public.agency_tasks where business_id = v_biz and title in
          ('Solicitar permisos de la pirotecnia al ayuntamiento', 'Organizar la cena de hermandad')) t
  join lateral (select user_id from public.agency_team_members where team_id = t.team_id order by user_id limit 1) a on true
  join lateral (select m.user_id, m.full_name from public.agency_team_members tm join public.agency_members m
                on m.user_id = tm.user_id and m.business_id = tm.business_id
                where tm.team_id = t.team_id order by tm.user_id desc limit 1) b on true;

  -- Eventos: generales (team null) y de equipo
  insert into public.agency_events (business_id, team_id, title, description, starts_at, ends_at, all_day)
  select v_biz, case when e.team_idx is null then null else (select id from _teams where idx = e.team_idx) end,
         e.title, e.descr,
         ((now() at time zone 'Europe/Madrid')::date + e.day_off + e.start_t) at time zone 'Europe/Madrid',
         case when e.dur is null then null else ((now() at time zone 'Europe/Madrid')::date + e.day_off + e.start_t + e.dur) at time zone 'Europe/Madrid' end,
         e.all_day
  from (values
    (null::int, 'Asamblea general de la agrupación', 'Orden del día en el grupo.', 10, time '20:30', interval '2 hours', false),
    (null::int, 'Cena de hermandad', 'Restaurante Los Arcos.', 24, time '21:30', interval '3 hours', false),
    (null::int, 'Entrada de bandas', null, 40, time '00:00', null::interval, true),
    (1, 'Reunión de protocolo con el ayuntamiento', null, 3, time '18:00', interval '1 hour', false),
    (3, 'Prueba de pólvora', 'Campo de tiro, traer EPI.', 7, time '10:00', interval '3 hours', false),
    (4, 'Ensayo de embajadas', null, 14, time '19:00', interval '2 hours', false),
    (5, 'Ensayo de embajadas infantiles', null, 16, time '17:30', interval '90 minutes', false),
    (6, 'Reunión de organización', 'Repasar presupuestos y permisos.', 5, time '20:00', interval '90 minutes', false),
    (7, 'Ensayo de desfile', null, 12, time '19:30', interval '2 hours', false),
    (8, 'Presentación del cartel', null, 21, time '20:00', interval '2 hours', false)
  ) as e(team_idx, title, descr, day_off, start_t, dur, all_day);

  -- Los avisos de la siembra no deben salir por push.
  update public.agency_notifications set push_sent_at = now() where business_id = v_biz;
end $$;
