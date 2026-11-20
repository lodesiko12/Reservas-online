-- Demo comercial de clínica estética para capturas y web de Turnigo: "Aura Estética" (slug aura-estetica),
-- tipo citas con 5 profesionales.
--
-- NO es una migración: se ejecuta a mano (pedir confirmación, va a producción).
-- Bloque 1 (configuración): negocio + usuario + profesionales + horarios + servicios. Si el slug existe, no hace nada.
-- Bloque 2 (datos): 70 clientas ficticias (solo si hay < 30) y las citas de 4 semanas atrás → 2 adelante,
--   con cobros, cancelaciones y no-shows. Idempotente: borra y regenera las reservas DE ESTE NEGOCIO.
-- Todo son datos inventados: teléfonos 60020NNNN, emails @example.com (el negocio no tiene google_review_url
--   ni Resend propio, así que no sale ningún correo).
-- Acceso: gerencia@auraestetica.test / DemoAura1234! (rol owner).

do $setup$
declare
  v_slug text := 'aura-estetica';
  v_pw   text := crypt('DemoAura1234!', gen_salt('bf'));
  v_biz  uuid;
  v_uid  uuid := gen_random_uuid();
  p_laura uuid; p_sofia uuid; p_nerea uuid; p_carla uuid; p_irene uuid;
  wd int;
  v_svc uuid;
  r record;
begin
  if exists (select 1 from public.businesses where slug = v_slug) then
    raise notice 'El negocio % ya existe: se salta la configuración', v_slug;
    return;
  end if;

  insert into public.businesses (name, slug, type, primary_color, timezone, slot_interval_min, max_advance_days)
  values ('Aura Estética', v_slug, 'citas', '#B5667A', 'Europe/Madrid', 15, 60)
  returning id into v_biz;

  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change)
  values ('00000000-0000-0000-0000-000000000000', v_uid, 'authenticated', 'authenticated',
    'gerencia@auraestetica.test', v_pw, now(),
    '{"provider":"email","providers":["email"]}', jsonb_build_object('full_name', 'Gerencia Aura Estética'),
    now(), now(), '', '', '', '');
  insert into auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
  values (gen_random_uuid(), v_uid,
    jsonb_build_object('sub', v_uid::text, 'email', 'gerencia@auraestetica.test', 'email_verified', true),
    'email', v_uid::text, now(), now(), now());
  insert into public.business_users (business_id, user_id, role) values (v_biz, v_uid, 'owner');

  -- Horario del centro: L-V 9:30-14:00 y 16:00-20:30, sábado 10:00-14:00
  for wd in 1..5 loop
    insert into public.business_hours (business_id, weekday, open_time, close_time)
    values (v_biz, wd, '09:30', '14:00'), (v_biz, wd, '16:00', '20:30');
  end loop;
  insert into public.business_hours (business_id, weekday, open_time, close_time)
  values (v_biz, 6, '10:00', '14:00');

  -- Equipo
  insert into public.professionals (business_id, name, color) values (v_biz, 'Laura Vidal',  '#7C5CBF') returning id into p_laura;
  insert into public.professionals (business_id, name, color) values (v_biz, 'Sofía Marín',  '#E0728A') returning id into p_sofia;
  insert into public.professionals (business_id, name, color) values (v_biz, 'Nerea Campos', '#2FA4A9') returning id into p_nerea;
  insert into public.professionals (business_id, name, color) values (v_biz, 'Carla Ortega', '#E59A3B') returning id into p_carla;
  insert into public.professionals (business_id, name, color) values (v_biz, 'Irene Beltrán', '#5B8DEF') returning id into p_irene;

  -- Días de trabajo de cada profesional (mismas franjas que el centro)
  insert into public.professional_hours (professional_id, weekday, start_time, end_time)
  select p.id, h.weekday, h.open_time, h.close_time
  from (values (p_laura, array[2,4,5]), (p_sofia, array[1,2,3,4,5]), (p_nerea, array[1,3,5,6]),
               (p_carla, array[1,2,4,5,6]), (p_irene, array[2,3,4,5,6])) as p(id, days)
  join public.business_hours h on h.business_id = v_biz and h.weekday = any(p.days);

  -- Servicios (precios inventados)
  for r in select * from (values
    ('Valoración inicial gratuita',            20,  0,  0, array[p_laura, p_sofia]),
    ('Higiene facial profunda',                60,  5, 55, array[p_sofia]),
    ('Hydrafacial',                            60,  5, 85, array[p_sofia, p_laura]),
    ('Peeling químico',                        45,  5, 70, array[p_laura, p_sofia]),
    ('Relleno de labios (ácido hialurónico)',  45,  0, 220, array[p_laura]),
    ('Toxina botulínica (tercio superior)',    30,  0, 260, array[p_laura]),
    ('Bioestimulación con PRP',                60,  0, 180, array[p_laura]),
    ('Depilación láser · piernas completas',   45,  0, 79, array[p_nerea]),
    ('Depilación láser · axilas',              15,  0, 29, array[p_nerea]),
    ('Depilación láser · facial',              15,  0, 39, array[p_nerea]),
    ('Masaje relajante',                       60,  0, 60, array[p_carla]),
    ('Masaje descontracturante',               45,  0, 55, array[p_carla]),
    ('Drenaje linfático',                      60,  0, 65, array[p_carla]),
    ('Presoterapia + radiofrecuencia',         45,  5, 70, array[p_carla, p_nerea]),
    ('Manicura semipermanente',                45,  0, 30, array[p_irene]),
    ('Pedicura spa',                           60,  0, 38, array[p_irene]),
    ('Lifting de pestañas y tinte',            60,  0, 48, array[p_irene, p_sofia]),
    ('Microblading de cejas',                  120, 0, 250, array[p_irene, p_sofia])
  ) as t(name, dur, buf, price, pros)
  loop
    insert into public.services (business_id, name, duration_min, buffer_min, price, sort_order)
    values (v_biz, r.name, r.dur, r.buf, r.price, 0) returning id into v_svc;
    insert into public.service_professionals (service_id, professional_id)
    select v_svc, unnest(r.pros);
  end loop;

  raise notice 'Negocio % creado (id %)', v_slug, v_biz;
end
$setup$;

do $data$
declare
  demo_slug text := 'aura-estetica';
  loc_prefix text := 'AU-';
  tz text := 'Europe/Madrid';
  bid uuid;
  firsts text[] := array['Lucía','Marta','Elena','Laura','Sara','Paula','Carmen','Irene','Nuria','Alba','Claudia','Rocío','Beatriz','Silvia','Patricia','Cristina','Natalia','Ainhoa','Andrea','Sandra','Raquel','Mónica','Eva','Julia','Noelia','Verónica','Miriam','Lorena','Inés','Teresa','Pilar','Alicia','Rebeca','Celia','Olga','Diana'];
  lasts  text[] := array['García','Martínez','López','Sánchez','Pérez','Gómez','Ruiz','Hernández','Díaz','Moreno','Muñoz','Álvarez','Romero','Alonso','Gutiérrez','Navarro','Torres','Domínguez','Vázquez','Ramos','Gil','Serrano','Blanco','Molina','Castro','Ortega','Rubio','Marín','Sanz','Iglesias','Medina','Cortés','Garrido','Vidal','Santos','Cano'];
  tag_pool text[] := array['Piel sensible','Prefiere tardes','Viene por Instagram','Bono láser 6 sesiones','Alergia al níquel','Prefiere mañanas'];
  note_pool text[] := array['Traer el consentimiento firmado','Retoque a los 15 días','Prueba de parche previa','Primera sesión del bono','Evitar el sol los días previos','Cliente nueva, llegar 10 min antes'];
  today date := (now() at time zone tz)::date;
  off int; day date; wd int; fill float;
  pr record; blk record; cust record;
  cur timestamp; blk_end timestamp;
  sv uuid; dur int; s timestamptz; e timestamptz;
  st booking_status; ch booking_channel; r float; loc text;
  paid timestamptz; pm text; n_cust int; n_all int;
begin
  select id into bid from public.businesses where slug = demo_slug;
  if bid is null then raise exception 'No existe el negocio %', demo_slug; end if;
  perform setseed(0.51);

  delete from public.bookings where business_id = bid;

  select count(*) into n_cust from public.customers where business_id = bid;
  if n_cust < 30 then
    delete from public.customers where business_id = bid;
    insert into public.customers (business_id, full_name, last_name, phone, email, tags, notes)
    select bid,
           firsts[(g.n * 7 % 36) + 1],
           lasts[(g.n * 5 % 36) + 1] || ' ' || lasts[(g.n * 11 % 36) + 1],
           '60020' || lpad(g.n::text, 4, '0'),
           'clienta' || g.n || '@example.com',
           case when g.n % 4 = 0 then array[tag_pool[(g.n % 6) + 1]] else '{}'::text[] end,
           case when g.n % 11 = 0 then 'Piel reactiva: usar productos suaves' end
    from generate_series(1, 70) as g(n);
  end if;
  select count(*) into n_all from public.customers where business_id = bid;

  for off in -28..14 loop
    day := today + off;
    wd := extract(dow from day)::int;
    continue when wd = 0;
    fill := case when off = 0 then 0.93 when off < 0 then 0.80 else greatest(0.30, 0.88 - off * 0.04) end;

    for pr in select p.id from public.professionals p
              where p.business_id = bid and p.is_active
                and exists (select 1 from public.professional_hours ph where ph.professional_id = p.id and ph.weekday = wd)
              order by p.name loop
      for blk in select start_time, end_time from public.professional_hours
                 where professional_id = pr.id and weekday = wd order by start_time loop
        cur := day + blk.start_time;
        blk_end := day + blk.end_time;
        while cur < blk_end loop
          if random() > fill then
            cur := cur + make_interval(mins => 15 * (1 + floor(random() * 3)::int));
            continue;
          end if;

          select s2.id, s2.duration_min into sv, dur
          from public.services s2 join public.service_professionals sp on sp.service_id = s2.id
          where sp.professional_id = pr.id and s2.is_active
          order by random() limit 1;

          if cur + make_interval(mins => dur) > blk_end then
            cur := cur + interval '15 minutes';
            continue;
          end if;

          s := cur at time zone tz;
          e := s + make_interval(mins => dur);

          select * into cust from public.customers where business_id = bid
            order by created_at, id limit 1 offset floor(power(random(), 1.6) * n_all)::int;
          if exists (select 1 from public.bookings b where b.customer_id = cust.id and b.status <> 'cancelada'
                     and tstzrange(b.starts_at, b.ends_at) && tstzrange(s, e)) then
            cur := cur + interval '15 minutes';
            continue;
          end if;

          r := random();
          paid := null; pm := null;
          if e < now() then
            st := case when r < .05 then 'no_show' when r < .11 then 'cancelada' else 'completada' end;
            if st = 'completada' and not (off = 0 and random() < .4) then
              paid := e + interval '5 minutes';
              r := random();
              pm := case when r < .30 then 'bizum' when r < .50 then 'efectivo' else null end;
            end if;
          else
            st := case when r < .05 then 'cancelada' else 'confirmada' end;
          end if;
          r := random();
          ch := case when r < .55 then 'web' when r < .95 then 'manual' else 'walkin' end;
          if ch = 'walkin' and s > now() then ch := 'manual'; end if;

          loop
            loc := loc_prefix || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));
            exit when not exists (select 1 from public.bookings where locator = loc);
          end loop;

          insert into public.bookings (business_id, type, service_id, professional_id, starts_at, ends_at, customer_id,
            customer_name, customer_last_name, customer_phone, customer_email, locator, status, channel, notes,
            paid_at, payment_method, created_at)
          values (bid, 'citas', sv, pr.id, s, e, cust.id, cust.full_name, cust.last_name, cust.phone, cust.email,
            loc, st, ch, case when random() < .08 then note_pool[1 + floor(random() * 6)::int] end,
            paid, pm, least(now() - interval '5 minutes', s - make_interval(hours => 3 + floor(random() * 300)::int)));

          cur := cur + make_interval(mins => dur + case when random() < .35 then 15 else 0 end);
        end loop;
      end loop;
    end loop;
  end loop;

  update public.customers set tags = array_append(tags, 'VIP')
    where business_id = bid and bookings_count >= 8 and not ('VIP' = any(tags));
  update public.customers set tags = array_append(tags, 'No-show reincidente')
    where business_id = bid and no_show_count >= 2 and not ('No-show reincidente' = any(tags));
end
$data$;
