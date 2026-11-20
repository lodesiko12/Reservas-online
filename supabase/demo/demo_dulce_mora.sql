-- Demo comercial de negocio de ENCARGOS (modo encargo) para capturas y web de Turnigo:
-- pastelería "Dulce Mora" (slug dulce-mora), tartas por tamaño y sabor con recogida en tienda.
--
-- NO es una migración: se ejecuta a mano (pedir confirmación, va a producción).
-- Bloque 1 (configuración): negocio + usuario + horario + reglas + tamaños/sabores. Si el slug existe, no hace nada.
-- Bloque 2 (datos): 55 clientes ficticios (solo si hay < 30) y ~150 encargos (3 semanas atrás → 10 días
--   adelante). Idempotente: borra y regenera las reservas DE ESTE NEGOCIO.
-- Todo son datos inventados: teléfonos 60030NNNN, sin emails.
-- Acceso: hola@dulcemora.test / DemoMora1234! (rol owner).
-- Mismo modelo que setup_cheesecake_ando.sql (services = tamaño × gama; service_options = sabores).

do $setup$
declare
  v_slug text := 'dulce-mora';
  v_pw   text := crypt('DemoMora1234!', gen_salt('bf'));
  v_biz  uuid;
  v_uid  uuid := gen_random_uuid();
  r record;
  ord int := 0;
begin
  if exists (select 1 from public.businesses where slug = v_slug) then
    raise notice 'El negocio % ya existe: se salta la configuración', v_slug;
    return;
  end if;

  insert into public.businesses (name, slug, type, primary_color, timezone, order_mode, default_capacity, slot_interval_min)
  values ('Dulce Mora', v_slug, 'citas', '#B24A78', 'Europe/Madrid', true, 3, 15)
  returning id into v_biz;

  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change)
  values ('00000000-0000-0000-0000-000000000000', v_uid, 'authenticated', 'authenticated',
    'hola@dulcemora.test', v_pw, now(),
    '{"provider":"email","providers":["email"]}', jsonb_build_object('full_name', 'Obrador Dulce Mora'),
    now(), now(), '', '', '', '');
  insert into auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
  values (gen_random_uuid(), v_uid,
    jsonb_build_object('sub', v_uid::text, 'email', 'hola@dulcemora.test', 'email_verified', true),
    'email', v_uid::text, now(), now(), now());
  insert into public.business_users (business_id, user_id, role) values (v_biz, v_uid, 'owner');

  -- Recogida en tienda: lunes cerrado; M-V 10:00-13:30 y 17:00-20:30; S 10:00-14:00; domingo cerrado
  insert into public.business_hours (business_id, weekday, open_time, close_time)
  select v_biz, d, t.o::time, t.c::time
  from generate_series(2, 5) d
  cross join (values ('10:00','13:30'), ('17:00','20:30')) as t(o, c);
  insert into public.business_hours (business_id, weekday, open_time, close_time)
  values (v_biz, 6, '10:00', '14:00');

  -- Reglas de los encargos: 48 h de antelación, máximo 8 al día, cancelar con 48 h, confirmación manual
  insert into public.order_settings (business_id, min_lead_hours, daily_max_total, require_confirmation, cancel_min_hours)
  values (v_biz, 48, 8, true, 48);

  insert into public.service_option_groups (business_id, group_key, label, sort_order) values
    (v_biz, 'clasicas', 'Clásicas', 0),
    (v_biz, 'premium', 'Premium', 1),
    (v_biz, 'personalizadas', 'Tartas personalizadas', 2);

  -- Tamaño × gama
  for r in select * from (values
    ('clasicas', 'Pequeña', 'pequena', 'Pequeña (6 u 8 raciones)', 22),
    ('clasicas', 'Mediana', 'mediana', 'Mediana (10 o 12 raciones)', 32),
    ('clasicas', 'Grande',  'grande',  'Grande (16 o 20 raciones)', 45),
    ('premium',  'Pequeña', 'pequena', 'Pequeña (6 u 8 raciones)', 28),
    ('premium',  'Mediana', 'mediana', 'Mediana (10 o 12 raciones)', 40),
    ('premium',  'Grande',  'grande',  'Grande (16 o 20 raciones)', 55),
    ('personalizadas', 'Pequeña', 'pequena', 'Pequeña (6 u 8 raciones)', 35),
    ('personalizadas', 'Mediana', 'mediana', 'Mediana (10 o 12 raciones)', 48),
    ('personalizadas', 'Grande',  'grande',  'Grande (16 o 20 raciones)', 65)
  ) as t(grp, sz, size_key, size_label, price)
  loop
    insert into public.services (business_id, name, duration_min, buffer_min, price, sort_order, size_key, size_label, option_group)
    values (v_biz, r.sz || ' · ' || case r.grp when 'clasicas' then 'Clásicas' when 'premium' then 'Premium' else 'Personalizadas' end,
            15, 0, r.price, ord, r.size_key, r.size_label, r.grp);
    ord := ord + 1;
  end loop;

  -- Sabores
  insert into public.service_options (business_id, option_group, name, sort_order)
  select v_biz, o.grp, o.name, o.ord
  from (values
    ('clasicas', 'Zanahoria con frosting de queso', 0),
    ('clasicas', 'Red velvet', 1),
    ('clasicas', 'Tarta de queso al horno', 2),
    ('clasicas', 'Sacher', 3),
    ('clasicas', 'Tres leches', 4),
    ('clasicas', 'Limón y merengue', 5),
    ('clasicas', 'Brownie con frambuesas', 6),
    ('premium', 'Pistacho y frambuesa', 0),
    ('premium', 'Chocolate y avellana', 1),
    ('premium', 'Mango y maracuyá', 2),
    ('premium', 'Caramelo salado y nueces', 3),
    ('premium', 'Tiramisú', 4),
    ('premium', 'Queso con frutos rojos', 5),
    ('personalizadas', 'Cumpleaños infantil', 0),
    ('personalizadas', 'Drip cake', 1),
    ('personalizadas', 'Fondant personalizado', 2),
    ('personalizadas', 'Foto comestible', 3),
    ('personalizadas', 'Tarta de boda (2 pisos)', 4)
  ) as o(grp, name, ord);

  raise notice 'Negocio % creado (id %)', v_slug, v_biz;
end
$setup$;

do $data$
declare
  demo_slug text := 'dulce-mora';
  loc_prefix text := 'DM-';
  tz text := 'Europe/Madrid';
  bid uuid;
  firsts text[] := array['Lucía','Carlos','Marta','Javier','Elena','Pablo','Laura','Daniel','Sara','Adrián','Paula','Álvaro','Carmen','Sergio','Irene','Rubén','Nuria','Hugo','Alba','Diego','Claudia','Iván','Rocío','Mario','Beatriz','Andrés','Silvia','Óscar','Patricia','Raúl','Cristina','Fernando','Natalia','Jorge','Ainhoa','Víctor'];
  lasts  text[] := array['García','Martínez','López','Sánchez','Pérez','Gómez','Ruiz','Hernández','Díaz','Moreno','Muñoz','Álvarez','Romero','Alonso','Gutiérrez','Navarro','Torres','Domínguez','Vázquez','Ramos','Gil','Serrano','Blanco','Molina','Castro','Ortega','Rubio','Marín','Sanz','Iglesias','Medina','Cortés','Garrido','Vidal','Santos','Cano'];
  dedic text[] := array['Dedicatoria: "Feliz cumpleaños, Lucía"','Dedicatoria: "Felicidades, abuela"','Dedicatoria: "¡Enhorabuena, campeón!"','Con velas y bengala','Sin frutos secos, por favor','Alergia a la lactosa: consultar opciones','Recogerá mi pareja','Aniversario: dedicatoria "Por muchos años más"','Decoración con flores naturales','Tema: dinosaurios'];
  today date := (now() at time zone tz)::date;
  off int; d date; wd int; n_day int; j int; tries int;
  slot_min int; s timestamptz; e timestamptz;
  sv record; opt record; cust record;
  st booking_status; ch booking_channel; r float; loc text;
  paid timestamptz; pm text; n_cust int;
begin
  select id into bid from public.businesses where slug = demo_slug;
  if bid is null then raise exception 'No existe el negocio %', demo_slug; end if;
  perform setseed(0.29);

  delete from public.bookings where business_id = bid;

  select count(*) into n_cust from public.customers where business_id = bid;
  if n_cust < 30 then
    delete from public.customers where business_id = bid;
    insert into public.customers (business_id, full_name, last_name, phone, tags, notes)
    select bid,
           firsts[(g.n * 7 % 36) + 1],
           lasts[(g.n * 5 % 36) + 1] || ' ' || lasts[(g.n * 11 % 36) + 1],
           '60030' || lpad(g.n::text, 4, '0'),
           case when g.n % 8 = 0 then array['Celíaca en la familia'] when g.n % 10 = 0 then array['Cliente de empresa'] else '{}'::text[] end,
           case when g.n % 8 = 0 then 'Preguntar siempre por opción sin gluten' end
    from generate_series(1, 55) as g(n);
  end if;

  for off in -21..10 loop
    d := today + off;
    wd := extract(dow from d)::int;
    continue when wd in (0, 1);
    n_day := case
      when wd = 6 and off <= 0 then 6 + floor(random() * 3)::int
      when wd = 6 then 3 + floor(random() * 4)::int
      when off <= 0 then 3 + floor(random() * 3)::int
      when off = 1 then 2
      else greatest(1, 4 - floor(off / 4.0)::int + floor(random() * 2)::int) end;

    for j in 1..n_day loop
      tries := 0;
      loop
        tries := tries + 1;
        -- hora de recogida entre las franjas abiertas ese día, cada 15 min
        if wd = 6 then
          slot_min := 10 * 60 + 15 * floor(random() * 15)::int;           -- 10:00-13:30
        elsif random() < .5 then
          slot_min := 10 * 60 + 15 * floor(random() * 14)::int;           -- 10:00-13:15
        else
          slot_min := 17 * 60 + 15 * floor(random() * 14)::int;           -- 17:00-20:15
        end if;
        s := (d + make_interval(mins => slot_min)) at time zone tz;
        exit when tries > 30 or (select count(*) from public.bookings b
                                 where b.business_id = bid and b.starts_at = s and b.status <> 'cancelada') < 3;
      end loop;
      e := s + interval '15 minutes';

      select * into sv from public.services where business_id = bid and is_active
        order by random() * (case size_key when 'mediana' then 2.2 when 'grande' then 1.0 else 0.8 end) desc limit 1;
      select * into opt from public.service_options where business_id = bid and option_group = sv.option_group
        order by random() limit 1;
      select * into cust from public.customers where business_id = bid order by random() limit 1;

      r := random();
      paid := null; pm := null;
      if e < now() then
        st := case when r < .07 then 'cancelada' when r < .10 then 'no_show' else 'completada' end;
        if st = 'completada' then
          paid := s + interval '3 minutes';
          r := random();
          pm := case when r < .35 then 'bizum' when r < .75 then 'efectivo' else null end;
        end if;
      elsif s <= now() + interval '3 hours' then
        st := 'listo';
      elsif off <= 2 then
        st := 'confirmada';
      else
        st := case when r < .30 then 'pendiente' when r < .34 then 'cancelada' else 'confirmada' end;
      end if;
      ch := case when random() < .70 then 'web' else 'manual' end;

      loop
        loc := loc_prefix || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));
        exit when not exists (select 1 from public.bookings where locator = loc);
      end loop;

      insert into public.bookings (business_id, type, service_id, option_id, option_label, starts_at, ends_at,
        customer_id, customer_name, customer_last_name, customer_phone, locator, status, channel, notes,
        paid_at, payment_method, created_at)
      values (bid, 'citas', sv.id, opt.id, opt.name, s, e, cust.id, cust.full_name, cust.last_name, cust.phone,
        loc, st, ch, case when random() < .55 then dedic[1 + floor(random() * 10)::int] end,
        paid, pm, least(now() - interval '5 minutes', s - make_interval(days => 2 + floor(random() * 12)::int, hours => floor(random() * 10)::int)));
    end loop;
  end loop;

  update public.customers set tags = array_append(tags, 'Cliente habitual')
    where business_id = bid and bookings_count >= 4 and not ('Cliente habitual' = any(tags));
end
$data$;
