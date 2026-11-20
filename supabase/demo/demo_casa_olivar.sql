-- Demo comercial de restaurante para capturas y web de Turnigo: "Casa Olivar" (slug casa-olivar).
--
-- NO es una migración: se ejecuta a mano (pedir confirmación, va a producción).
-- Bloque 1 (configuración): crea negocio + usuario + zonas + mesas + combinaciones + franjas + carta
--   + horario de recogida. Si el slug ya existe, no hace nada.
-- Bloque 2 (datos): clientes ficticios (solo si hay < 30), reservas (14 días atrás → 10 adelante,
--   hoy y mañana casi llenos), lista de espera y pedidos para llevar. Idempotente: borra y regenera
--   las reservas, la lista de espera y los pedidos DE ESTE NEGOCIO; se puede relanzar antes de cada
--   captura para que "ahora" sea coherente (sentadas, pedidos preparando...).
-- Todo son datos inventados: teléfonos 60010NNNN, sin emails (no sale ningún correo).
-- Acceso: staff@casaolivar.test / DemoOlivar1234! (rol owner).

do $setup$
declare
  v_slug text := 'casa-olivar';
  v_pw   text := crypt('DemoOlivar1234!', gen_salt('bf'));
  v_biz  uuid;
  v_uid  uuid := gen_random_uuid();
  z_int uuid; z_ter uuid; z_bar uuid;
  s_com uuid; s_cen uuid;
  c_id uuid; c_name text; d int;
  cat uuid;
  it jsonb; c jsonb;
  ci int := 0; ii int;
  menu jsonb := $j$[
    {"cat":"Entrantes","items":[
      ["Croquetas caseras de jamón",9.50,"Ración de 8 unidades, bechamel melosa.",["Gluten","Lácteos","Huevos"]],
      ["Ensaladilla rusa con ventresca",8.90,"Con atún de almadraba y huevo cocido.",["Huevos","Pescado"]],
      ["Pulpo a la brasa con parmentier",17.50,"Patata trufada y pimentón de la Vera.",["Moluscos","Lácteos"]],
      ["Alcachofas confitadas con jamón",10.50,"Aceite de oliva virgen extra y escamas de sal.",[]],
      ["Tabla de ibéricos",18.00,"Jamón, lomo, chorizo y queso curado.",["Lácteos"]]]},
    {"cat":"Principales","items":[
      ["Arroz meloso de secreto ibérico",16.50,"Por persona, mínimo 2. Sofrito de verduras y setas.",["Apio","Sulfitos"]],
      ["Rabo de toro deshuesado",18.50,"Estofado a baja temperatura con parmentier.",["Apio","Sulfitos","Lácteos"]],
      ["Lubina al horno con verduras",19.00,"Lubina salvaje, verduras asadas y salsa vierge.",["Pescado"]],
      ["Hamburguesa Casa Olivar",14.50,"Ternera madurada, queso de oveja y cebolla caramelizada.",["Gluten","Lácteos","Huevos","Mostaza","Sésamo"]],
      ["Entrecot de ternera 300 g",22.00,"Con patatas panadera y pimientos del piquillo.",[]]]},
    {"cat":"Postres","items":[
      ["Tarta de queso cremosa",6.50,"Horneada al momento, con mermelada de frutos rojos.",["Lácteos","Huevos","Gluten"]],
      ["Torrija caramelizada",6.00,"Brioche, leche infusionada con canela y helado de vainilla.",["Gluten","Lácteos","Huevos"]],
      ["Brownie con helado de vainilla",6.50,"Chocolate 70 % y nueces.",["Gluten","Huevos","Lácteos","Frutos de cáscara"]]]},
    {"cat":"Bebidas","items":[
      ["Agua mineral 1 L",2.50,null,[]],
      ["Cerveza artesana",3.80,"Botella de 33 cl.",["Gluten"]],
      ["Vino tinto de la casa (copa)",3.50,"Crianza de la zona.",["Sulfitos"]],
      ["Refresco",2.80,null,[]]]}
  ]$j$::jsonb;
begin
  if exists (select 1 from public.businesses where slug = v_slug) then
    raise notice 'El negocio % ya existe: se salta la configuración', v_slug;
    return;
  end if;

  insert into public.businesses (name, slug, type, primary_color, timezone, slot_interval_min,
    max_advance_days, online_orders)
  values ('Casa Olivar', v_slug, 'restaurante', '#8A3B2B', 'Europe/Madrid', 15, 60, true)
  returning id into v_biz;

  -- Usuario de acceso (cuenta de prueba)
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change)
  values ('00000000-0000-0000-0000-000000000000', v_uid, 'authenticated', 'authenticated',
    'staff@casaolivar.test', v_pw, now(),
    '{"provider":"email","providers":["email"]}', jsonb_build_object('full_name', 'Equipo Casa Olivar'),
    now(), now(), '', '', '', '');
  insert into auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
  values (gen_random_uuid(), v_uid,
    jsonb_build_object('sub', v_uid::text, 'email', 'staff@casaolivar.test', 'email_verified', true),
    'email', v_uid::text, now(), now(), now());
  insert into public.business_users (business_id, user_id, role) values (v_biz, v_uid, 'owner');

  -- Horario del negocio: cerrado los lunes. Comida mar-dom, cena mar-sáb.
  for d in 2..6 loop
    insert into public.business_hours (business_id, weekday, open_time, close_time)
    values (v_biz, d, '13:00', '16:30'), (v_biz, d, '20:30', '23:30');
  end loop;
  insert into public.business_hours (business_id, weekday, open_time, close_time)
  values (v_biz, 0, '13:00', '16:30');

  insert into public.dining_settings (business_id, min_lead_minutes, max_advance_days, min_party_online,
    max_party_online, require_manual_confirmation)
  values (v_biz, 60, 60, 1, 10, false)
  on conflict (business_id) do nothing;

  -- Zonas y mesas (14)
  insert into public.dining_zones (business_id, name, reservable_online, sort_order)
  values (v_biz, 'Interior', true, 0) returning id into z_int;
  insert into public.dining_zones (business_id, name, reservable_online, sort_order)
  values (v_biz, 'Terraza', true, 1) returning id into z_ter;
  insert into public.dining_zones (business_id, name, reservable_online, sort_order)
  values (v_biz, 'Barra', false, 2) returning id into z_bar;

  insert into public.dining_tables (business_id, zone_id, name, cap_min, cap_max, priority) values
    (v_biz, z_int, 'Mesa 1', 2, 2, 1), (v_biz, z_int, 'Mesa 2', 2, 2, 2),
    (v_biz, z_int, 'Mesa 3', 2, 4, 3), (v_biz, z_int, 'Mesa 4', 2, 4, 4),
    (v_biz, z_int, 'Mesa 5', 4, 6, 5), (v_biz, z_int, 'Mesa 6', 4, 6, 6),
    (v_biz, z_ter, 'Terraza 1', 2, 2, 7), (v_biz, z_ter, 'Terraza 2', 2, 2, 8),
    (v_biz, z_ter, 'Terraza 3', 2, 4, 9), (v_biz, z_ter, 'Terraza 4', 2, 4, 10),
    (v_biz, z_ter, 'Terraza 5', 4, 6, 11),
    (v_biz, z_bar, 'Barra 1', 1, 2, 12), (v_biz, z_bar, 'Barra 2', 1, 2, 13), (v_biz, z_bar, 'Barra 3', 1, 2, 14);

  -- Combinaciones para grupos grandes
  insert into public.dining_table_combos (business_id, name, table_ids, cap_min, cap_max, priority)
  select v_biz, 'Mesa 5+6', array_agg(id order by name), 7, 10, 1
  from public.dining_tables where business_id = v_biz and name in ('Mesa 5', 'Mesa 6');
  insert into public.dining_table_combos (business_id, name, table_ids, cap_min, cap_max, priority)
  select v_biz, 'Terraza 3+4', array_agg(id order by name), 5, 8, 2
  from public.dining_tables where business_id = v_biz and name in ('Terraza 3', 'Terraza 4');

  -- Franjas: Comida (mar-dom) y Cena (mar-sáb)
  insert into public.dining_shifts (business_id, name, start_time, end_time, last_call_time, max_covers,
    slot_interval_min, active_weekdays, booking_duration_min, pacing_enabled, max_covers_per_slot,
    max_bookings_per_slot, online_max_covers, allow_double_turn, cleanup_min)
  values (v_biz, 'Comida', '13:00', '16:30', '15:30', 56, 15, array[0,2,3,4,5,6], 90, true, 16, 5, 40, false, 10)
  returning id into s_com;
  insert into public.dining_shifts (business_id, name, start_time, end_time, last_call_time, max_covers,
    slot_interval_min, active_weekdays, booking_duration_min, pacing_enabled, max_covers_per_slot,
    max_bookings_per_slot, online_max_covers, allow_double_turn, cleanup_min)
  values (v_biz, 'Cena', '20:30', '23:30', '22:30', 60, 15, array[2,3,4,5,6], 90, true, 16, 5, 44, false, 10)
  returning id into s_cen;

  insert into public.dining_duration_rules (dining_shift_id, pax_min, pax_max, duration_min)
  select s, r.a, r.b, r.m
  from unnest(array[s_com, s_cen]) s
  cross join (values (1, 2, 75), (3, 4, 90), (5, 6, 105), (7, 20, 120)) as r(a, b, m);

  -- Pedidos para llevar: horario de recogida y ajustes
  insert into public.takeaway_hours (business_id, weekday, start_time, end_time)
  select v_biz, w, '13:00', '15:30' from unnest(array[0,2,3,4,5,6]) w;
  insert into public.takeaway_hours (business_id, weekday, start_time, end_time)
  select v_biz, w, '20:00', '22:30' from unnest(array[2,3,4,5,6]) w;
  insert into public.takeaway_settings (business_id, accepting, prep_minutes, slot_interval_min,
    max_orders_per_slot, max_advance_days, min_order_amount)
  values (v_biz, true, 30, 30, 8, 7, 12)
  on conflict (business_id) do nothing;

  -- Carta
  for c in select * from jsonb_array_elements(menu) loop
    insert into public.menu_categories (business_id, name, sort_order)
    values (v_biz, c->>'cat', ci) returning id into cat;
    ii := 0;
    for it in select * from jsonb_array_elements(c->'items') loop
      insert into public.menu_items (business_id, category_id, name, description, price, allergens, sort_order)
      values (v_biz, cat, it->>0, it->>2, (it->>1)::numeric,
        array(select jsonb_array_elements_text(it->3)), ii);
      ii := ii + 1;
    end loop;
    ci := ci + 1;
  end loop;

  raise notice 'Negocio % creado (id %)', v_slug, v_biz;
end
$setup$;

do $data$
declare
  demo_slug text := 'casa-olivar';
  loc_prefix text := 'CO-';
  tz text := 'Europe/Madrid';
  bid uuid;
  firsts text[] := array['Lucía','Carlos','Marta','Javier','Elena','Pablo','Laura','Daniel','Sara','Adrián','Paula','Álvaro','Carmen','Sergio','Irene','Rubén','Nuria','Hugo','Alba','Diego','Claudia','Iván','Rocío','Mario','Beatriz','Andrés','Silvia','Óscar','Patricia','Raúl','Cristina','Fernando','Natalia','Jorge','Ainhoa','Víctor'];
  lasts  text[] := array['García','Martínez','López','Sánchez','Pérez','Gómez','Ruiz','Hernández','Díaz','Moreno','Muñoz','Álvarez','Romero','Alonso','Gutiérrez','Navarro','Torres','Domínguez','Vázquez','Ramos','Gil','Serrano','Blanco','Molina','Castro','Ortega','Rubio','Marín','Sanz','Iglesias','Medina','Cortés','Garrido','Vidal','Santos','Cano'];
  notes_pool text[] := array['Celebración de cumpleaños','Alergia a frutos secos','Necesita trona','Prefiere terraza','Aniversario, mesa tranquila','Comida de empresa','Un celíaco en el grupo','Llegarán 10 min tarde'];
  d date; off int; sh record; tb record; it record;
  target int; covers int; tries int;
  pax int; dur int; slot_min int; s timestamptz; e timestamptz;
  cust record; tid uuid; comboid uuid; ok boolean;
  st booking_status; ch booking_channel; r float; loc text;
  today date := (now() at time zone tz)::date;
  n_cust int;
  base timestamptz := date_trunc('hour', now()) + interval '30 minutes' * floor(extract(minute from now()) / 30);
  i int; k int; n_items int; qty int; tot numeric; pick timestamptz; ost text; oid uuid;
  offs int[] := array[-150, -90, -30, 0, 30, 60, 120, 180];
begin
  select id into bid from public.businesses where slug = demo_slug;
  if bid is null then raise exception 'No existe el negocio %', demo_slug; end if;
  perform setseed(0.37);

  delete from public.waitlist where business_id = bid;
  delete from public.bookings where business_id = bid;
  delete from public.order_items where order_id in (select id from public.orders where business_id = bid);
  delete from public.orders where business_id = bid;

  -- Clientes ficticios (solo la primera vez)
  select count(*) into n_cust from public.customers where business_id = bid;
  if n_cust < 30 then
    delete from public.customers where business_id = bid;
    insert into public.customers (business_id, full_name, last_name, phone, tags, notes)
    select bid,
           firsts[(g.n * 7 % 36) + 1],
           lasts[(g.n * 5 % 36) + 1] || ' ' || lasts[(g.n * 11 % 36) + 1],
           '60010' || lpad(g.n::text, 4, '0'),
           case when g.n % 9 = 0 then array['Celíaco']
                when g.n % 11 = 0 then array['Alergia frutos secos']
                when g.n % 13 = 0 then array['Cumpleaños en diciembre']
                else '{}'::text[] end,
           case when g.n % 9 = 0 then 'Sin gluten, avisar a cocina' end
    from generate_series(1, 70) as g(n);
  end if;

  for off in -14..10 loop
    d := today + off;
    for sh in select * from public.dining_shifts
              where business_id = bid and is_active and extract(dow from d)::int = any(active_weekdays)
              order by start_time loop
      target := case
        when off in (0, 1) then round(sh.max_covers * (0.86 + random() * 0.09))
        when off < 0 then round(sh.max_covers * (0.55 + random() * 0.30))
        else round(sh.max_covers * greatest(0.15, 0.62 - (off - 1) * 0.05 + random() * 0.1))
      end;
      covers := 0; tries := 0;
      while covers < target and tries < 400 loop
        tries := tries + 1;
        r := random();
        pax := case when r < .05 then 1 when r < .45 then 2 when r < .55 then 3 when r < .85 then 4 when r < .89 then 5
                    when r < .95 then 6 when r < .98 then 8 else 10 end;
        select duration_min into dur from public.dining_duration_rules
          where dining_shift_id = sh.id and pax between pax_min and pax_max limit 1;
        dur := coalesce(dur, sh.booking_duration_min);
        slot_min := (extract(epoch from sh.start_time) / 60)::int
                    + 15 * floor(random() * (((extract(epoch from coalesce(sh.last_call_time, sh.end_time - interval '30 min')) / 60)::int
                                              - (extract(epoch from sh.start_time) / 60)::int) / 15 + 1))::int;
        s := ((d + make_interval(mins => slot_min)) at time zone tz);
        e := s + make_interval(mins => dur);

        tid := null; comboid := null; ok := false;
        for tb in select t.id, t.zone_id from public.dining_tables t
                  join public.dining_zones z on z.id = t.zone_id
                  where t.business_id = bid and t.is_active and pax between t.cap_min and t.cap_max
                  order by (t.cap_max - pax), random() loop
          if not exists (
            select 1 from public.bookings b
            where b.business_id = bid and b.status <> 'cancelada'
              and tstzrange(b.starts_at, b.ends_at + make_interval(mins => sh.cleanup_min)) && tstzrange(s, e)
              and (b.dining_table_id = tb.id
                   or exists (select 1 from public.dining_table_combos c where c.id = b.table_combo_id and tb.id = any(c.table_ids)))
          ) then tid := tb.id; ok := true; exit; end if;
        end loop;
        if not ok and pax >= 5 then
          for tb in select c.id, c.table_ids from public.dining_table_combos c
                    where c.business_id = bid and c.is_active and pax between c.cap_min and c.cap_max loop
            if not exists (
              select 1 from public.bookings b
              where b.business_id = bid and b.status <> 'cancelada'
                and tstzrange(b.starts_at, b.ends_at + make_interval(mins => sh.cleanup_min)) && tstzrange(s, e)
                and (b.dining_table_id = any(tb.table_ids)
                     or exists (select 1 from public.dining_table_combos c2 where c2.id = b.table_combo_id and c2.table_ids && tb.table_ids))
            ) then comboid := tb.id; ok := true; exit; end if;
          end loop;
        end if;
        continue when not ok;

        r := random();
        if e < now() then
          st := case when r < .05 then 'no_show' when r < .10 then 'cancelada' else 'completada' end;
        elsif s <= now() then
          st := 'sentada';
        else
          st := case when r < .04 then 'cancelada' else 'confirmada' end;
        end if;
        r := random();
        ch := case when r < .62 then 'web' when r < .86 then 'manual' else 'walkin' end;
        if ch = 'walkin' and s > now() then ch := 'manual'; end if;

        if st = 'no_show' then
          select * into cust from public.customers where business_id = bid order by md5(id::text) limit 1 offset floor(random() * 5)::int;
        else
          select * into cust from public.customers where business_id = bid order by random() limit 1;
        end if;

        loop
          loc := loc_prefix || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));
          exit when not exists (select 1 from public.bookings where locator = loc);
        end loop;

        insert into public.bookings (business_id, type, dining_shift_id, party_size, starts_at, ends_at, customer_id,
                             customer_name, customer_last_name, customer_phone, locator, status, channel, notes,
                             dining_table_id, table_combo_id, created_at)
        values (bid, 'restaurante', sh.id, pax, s, e, cust.id, cust.full_name, cust.last_name, cust.phone, loc, st, ch,
                case when random() < .12 then notes_pool[1 + floor(random() * 8)::int] end,
                tid, comboid,
                least(now() - interval '5 minutes', s - make_interval(hours => 2 + floor(random() * 220)::int)));
        covers := covers + pax;
      end loop;
    end loop;
  end loop;

  update public.customers set tags = array_append(tags, 'VIP')
    where business_id = bid and bookings_count >= 6 and not ('VIP' = any(tags));
  update public.customers set tags = array_append(tags, 'No-show reincidente')
    where business_id = bid and no_show_count >= 2 and not ('No-show reincidente' = any(tags));

  -- Lista de espera de hoy
  insert into public.waitlist (business_id, name, phone, party_size, notes, status, zone_id, created_at) values
    (bid, 'Familia Navarro', '600109901', 4, null,         'esperando', (select id from public.dining_zones where business_id = bid and name = 'Terraza'),  now() - interval '18 minutes'),
    (bid, 'Beatriz Cano',    '600109902', 2, null,         'esperando', null,                                                                               now() - interval '9 minutes'),
    (bid, 'Grupo Ortega',    '600109903', 6, 'Cumpleaños', 'avisado',   (select id from public.dining_zones where business_id = bid and name = 'Interior'), now() - interval '35 minutes');

  -- Pedidos para llevar: 8 de hoy (alrededor de la hora actual), 4 de mañana/pasado y el resto histórico
  for i in 1..44 loop
    if i <= 8 then
      pick := base + make_interval(mins => offs[i]);
    elsif i <= 12 then
      pick := ((today + (1 + (i % 2)) + make_interval(mins => case when i % 2 = 0 then 13 * 60 + 30 else 20 * 60 + 30 end)) at time zone tz);
    else
      off := -(1 + floor(random() * 11))::int;
      d := today + off;
      if extract(dow from d) = 1 then d := d - 1; end if;
      pick := ((d + make_interval(mins => case when random() < .45
                  then 13 * 60 + 30 + 30 * floor(random() * 4)::int
                  else 20 * 60 + 30 + 30 * floor(random() * 3)::int end)) at time zone tz);
    end if;

    ost := case
      when pick < now() - interval '45 minutes' then case when random() < .08 then 'cancelado' else 'entregado' end
      when pick < now() + interval '10 minutes' then 'listo'
      when pick < now() + interval '40 minutes' then 'preparando'
      else 'nuevo' end;

    select * into cust from public.customers where business_id = bid order by random() limit 1;
    loop
      loc := 'CO-P' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 5));
      exit when not exists (select 1 from public.orders where locator = loc);
    end loop;

    insert into public.orders (business_id, locator, status, customer_id, customer_name, customer_last_name,
                               customer_phone, notes, pickup_at, total, created_at)
    values (bid, loc, ost, cust.id, cust.full_name, cust.last_name, cust.phone,
            case when random() < .15 then 'Sin cebolla, por favor' end, pick, 0,
            least(now() - interval '2 minutes', pick - make_interval(mins => 45 + floor(random() * 240)::int)))
    returning id into oid;

    tot := 0;
    n_items := 1 + floor(random() * 4)::int;
    for k in 1..n_items loop
      select id, name, price into it from public.menu_items where business_id = bid order by random() limit 1;
      qty := 1 + floor(random() * 2)::int;
      insert into public.order_items (order_id, item_id, name, quantity, unit_price, line_total, sort_order)
      values (oid, it.id, it.name, qty, it.price, qty * it.price, k);
      tot := tot + qty * it.price;
    end loop;
    update public.orders set total = tot where id = oid;
  end loop;
end
$data$;
