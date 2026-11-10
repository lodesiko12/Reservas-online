-- Pecado Carnal (Tudela + Ejea) y Burguer Chin: restaurantes con pedidos para llevar y reservas de sala.
-- No es una migración: se ejecuta a mano (pide confirmación, va a producción). Idempotente.
--
-- Fuentes: Webs/Pecado Carnal/tools/menu_data.py y assets/js/widget-config.js (horarios), y
-- Webs/Burger Chin/propuestas/propuesta-2b-cobre-y-acero-vivo.html (carta de muestra, contacto).
--
-- A CONFIRMAR con los dueños (valores de ejemplo, no datos reales):
--  * Mesas: 6 de 2-4 pax y 2 de 4-6 en una sola zona "Sala" (no hay plano real).
--  * Alérgenos: no se cargan (hay un PDF; el panel permite editarlos plato a plato).
--  * Burguer Chin: horario provisional (la propuesta dice "pendiente de confirmar"); la carta es
--    solo la muestra de la web, faltan arroces y el resto de platos.
--  * takeaway: 40 min de preparación, franjas de 30 min, 15 pedidos por franja (copiado de Tudela).
--
-- El slug del negocio existente "pecadocarnal" debe pasar a "pecado-carnal-tudela" desde
-- Admin → Editar negocio (el trigger guard_business_update exige sesión real de super-admin).
begin;

-- ---------- helpers (temporales, mueren con la sesión) ----------
create or replace function pg_temp.pc_menu(bid uuid, menu jsonb) returns void language plpgsql as $f$
declare
  c jsonb; it jsonb; cid uuid; ci int := 0; ii int;
begin
  if exists (select 1 from public.orders where business_id = bid) then
    raise exception 'El negocio % ya tiene pedidos: no se recarga la carta', bid;
  end if;
  delete from public.menu_items where business_id = bid;
  delete from public.menu_categories where business_id = bid;
  for c in select * from jsonb_array_elements(menu) loop
    insert into public.menu_categories (business_id, name, sort_order)
    values (bid, c->>'cat', ci) returning id into cid;
    ii := 0;
    for it in select * from jsonb_array_elements(c->'items') loop
      insert into public.menu_items (business_id, category_id, name, description, price, sort_order)
      values (bid, cid, it->>0, nullif(it->>2, ''), (it->>1)::numeric, ii);
      ii := ii + 1;
    end loop;
    ci := ci + 1;
  end loop;
end $f$;

-- shifts: [{"name","start","end","last","days":[..]}]  ·  takeaway: [{"d","from","to"}]
create or replace function pg_temp.pc_service(bid uuid, hours jsonb, shifts jsonb, takeaway jsonb,
                                              min_order numeric) returns void language plpgsql as $f$
declare
  h jsonb; s jsonb; z uuid; n int;
begin
  -- Horario (business_hours) y franjas de recogida
  delete from public.business_hours where business_id = bid;
  for h in select * from jsonb_array_elements(hours) loop
    insert into public.business_hours (business_id, weekday, open_time, close_time)
    values (bid, (h->>'d')::int, (h->>'from')::time, (h->>'to')::time);
  end loop;

  delete from public.takeaway_hours where business_id = bid;
  for h in select * from jsonb_array_elements(takeaway) loop
    insert into public.takeaway_hours (business_id, weekday, start_time, end_time)
    values (bid, (h->>'d')::int, (h->>'from')::time, (h->>'to')::time);
  end loop;

  insert into public.takeaway_settings (business_id, accepting, prep_minutes, slot_interval_min,
    max_orders_per_slot, max_advance_days, min_order_amount)
  values (bid, true, 40, 30, 15, 7, min_order)
  on conflict (business_id) do nothing;

  -- Reservas de sala
  insert into public.dining_settings (business_id) values (bid) on conflict (business_id) do nothing;

  if not exists (select 1 from public.dining_zones where business_id = bid) then
    insert into public.dining_zones (business_id, name, reservable_online, sort_order)
    values (bid, 'Sala', true, 0) returning id into z;
    for n in 1..6 loop
      insert into public.dining_tables (business_id, zone_id, name, cap_min, cap_max, priority)
      values (bid, z, 'Mesa ' || n, 2, 4, n);
    end loop;
    for n in 7..8 loop
      insert into public.dining_tables (business_id, zone_id, name, cap_min, cap_max, priority)
      values (bid, z, 'Mesa ' || n, 4, 6, n);
    end loop;
  end if;

  delete from public.dining_shifts where business_id = bid;
  for s in select * from jsonb_array_elements(shifts) loop
    insert into public.dining_shifts (business_id, name, start_time, end_time, last_call_time,
      max_covers, slot_interval_min, active_weekdays)
    values (bid, s->>'name', (s->>'start')::time, (s->>'end')::time, (s->>'last')::time,
      36, 30, array(select jsonb_array_elements_text(s->'days')::int));
  end loop;
end $f$;

-- ---------- negocios ----------
-- Ejea y Burguer Chin (Tudela ya existe como "pecadocarnal")
insert into public.businesses (name, slug, type, primary_color, timezone, online_orders)
values ('Pecado Carnal Ejea', 'pecado-carnal-ejea', 'restaurante', '#DC3E44', 'Europe/Madrid', true)
on conflict (slug) do nothing;

insert into public.businesses (name, slug, type, primary_color, timezone, online_orders)
values ('Burguer Chin', 'burguer-chin', 'restaurante', '#A8501F', 'Europe/Madrid', true)
on conflict (slug) do nothing;

-- Tudela: el negocio existente (slug actual o ya renombrado)
update public.businesses
   set name = 'Pecado Carnal Tudela', primary_color = '#DC3E44', online_orders = true
 where slug in ('pecadocarnal', 'pecado-carnal-tudela');

do $$
declare
  v_tud uuid := (select id from public.businesses where slug in ('pecadocarnal', 'pecado-carnal-tudela') limit 1);
  v_eje uuid := (select id from public.businesses where slug = 'pecado-carnal-ejea');
  v_chin uuid := (select id from public.businesses where slug = 'burguer-chin');
  pc_menu jsonb := $j$[
    {"cat":"Entrantes","items":[
      ["Nachos caseros",10.5,"Con salsa cheddar, guacamole casero, pulled pork y jalapeños."],
      ["Delicias de pollo",8.5,"Tiras de pollo marinadas con especias sureñas y salsa barbacoa."],
      ["Tequeños de queso",7.5,"Palitos de hojaldre con queso blanco venezolano y salsa miel y mostaza."],
      ["Cheese bacon",8.5,"Patatas fritas con mucha salsa de queso cheddar y bacon bits."],
      ["Patatas trufadas",8.5,"Con cebolla caramelizada, salsa mayo-trufa y parmesano rallado."],
      ["Patatas clásicas",5.5,"Crujientes patatas fritas, simples pero irresistibles."],
      ["Aros de cebolla",7.5,"Rebozados en panko japonés, con nuestra salsa barbacoa."],
      ["Brioche de steak tartar",4.3,"Tartar de lomo bajo al estilo tradicional en mini brioche con mantequilla."]
    ]},
    {"cat":"Hamburguesas","items":[
      ["Especial del mes",13.9,"Cada mes una burger sorpresa con nuestra técnica smash. Pregunta y déjate sorprender."],
      ["Only Trufans",13.9,"Doble carne smash de vaca, doble cheddar, cebolla caramelizada, lascas de parmesano y mayo-trufa."],
      ["La Cabrichosa",13.9,"Doble smash de vaca, rulo de cabra, pimiento rojo caramelizado, beicon crujiente y cebolla frita."],
      ["La Ceci",13.9,"Doble smash de vaca, doble queso Gouda, sweet de cecina de León y salsa Emmy 2.0 en pan brioche."],
      ["La Emmylica",13.9,"Nuestra versión de la Emmy de Nueva York: pepinillo, cebolla caramelizada y salsa Emmy con toque picante."],
      ["La Baby",10.5,"Simple carne smash de vaca con cheddar, beicon ahumado crujiente y nuestra salsa más irresistible."],
      ["La Pecadora",13.5,"Doble smash de vaca, doble cheddar, beicon ahumado, lechuga, tomate y salsa de la casa."],
      ["La Batallón",13.5,"Doble smash, doble cheddar, beicon ahumado, cebolla smasheada, mostaza y mayo de ajo asado."],
      ["La Clásica",12.9,"Doble smash con doble cheddar, pepinillo, cebolla, ketchup y mostaza."],
      ["The Old Chicken",13.9,"Pollo marinado en especias, rebozado y frito, con mayo de ajo asado, cheddar, lechuga, tomate y beicon."],
      ["La Veggy",13.9,"Pan brioche de patata, salsa Burger, disco de Beyond Meat con cheddar, lechuga, pepinillo y cebolla."],
      ["Menú infantil",11.5,"Hamburguesa con queso derretido y ketchup, patatas, 4 nuggets y botellín de agua."]
    ]},
    {"cat":"Postres","items":[
      ["Tarta de Lotus",7.9,"Tarta de queso casera y galleta Lotus."],
      ["Tarta de pistacho",7.9,"Tarta de queso casera y 100% pistacho ibérico."],
      ["Tequeños de chocolate",6.3,"Palitos de hojaldre con chocolate y avellanas."]
    ]}
  ]$j$;
  chin_menu jsonb := $j$[
    {"cat":"Hamburguesas","items":[
      ["Prime",13,"Dry-Age 45 días, doble cheddar y salsa B-C 25."],
      ["Goat",13,""],
      ["Doble Goat",19.5,"400 g de carne, panceta curada y cebolla confitada en bourbon."],
      ["Hamburguesa de buey 250 g",9.5,""],
      ["Hamburguesa normal",4.5,""]
    ]},
    {"cat":"Tapas","items":[
      ["Croquetas de jamón ibérico",10,"Seis unidades de jamón ibérico."],
      ["Bacalao pil pil",16,"Para compartir."],
      ["Torreznos",10,""],
      ["Patatas bravas (media)",4.5,""]
    ]},
    {"cat":"Bocadillos","items":[
      ["Especial Chin",6,""],
      ["Chivito",6,""],
      ["Serranito",5,""],
      ["Cantábrico",4.5,""]
    ]},
    {"cat":"Postres","items":[
      ["Cheesecake de Lotus",6,"Cheesecake casera."],
      ["Cheesecake Dubai",7.6,"Queso con chocolate Dubai y pasta kataifi."],
      ["Cheesecake Happy Bom",6.5,"Cheesecake casera."],
      ["Cheesecake Mistery",6,"Cheesecake casera."],
      ["Tarta de queso al horno",6,""],
      ["Coulant de pistacho",7,""]
    ]}
  ]$j$;
begin
  if v_tud is null or v_eje is null or v_chin is null then
    raise exception 'Falta algún negocio (tud=%, eje=%, chin=%)', v_tud, v_eje, v_chin;
  end if;

  perform pg_temp.pc_menu(v_tud, pc_menu);
  perform pg_temp.pc_menu(v_eje, pc_menu);
  perform pg_temp.pc_menu(v_chin, chin_menu);

  -- Tudela: jueves a domingo 20:00-23:30
  perform pg_temp.pc_service(v_tud,
    '[{"d":4,"from":"20:00","to":"23:30"},{"d":5,"from":"20:00","to":"23:30"},{"d":6,"from":"20:00","to":"23:30"},{"d":0,"from":"20:00","to":"23:30"}]',
    '[{"name":"Cena","start":"20:00","end":"23:30","last":"23:00","days":[4,5,6,0]}]',
    '[{"d":4,"from":"20:00","to":"23:00"},{"d":5,"from":"20:00","to":"23:00"},{"d":6,"from":"20:00","to":"23:00"},{"d":0,"from":"20:00","to":"23:00"}]',
    20);

  -- Ejea: viernes 20:30-23:30, sábado 20:00-00:00, domingo 20:00-23:30
  perform pg_temp.pc_service(v_eje,
    '[{"d":5,"from":"20:30","to":"23:30"},{"d":6,"from":"20:00","to":"23:59"},{"d":0,"from":"20:00","to":"23:30"}]',
    '[{"name":"Cena viernes","start":"20:30","end":"23:30","last":"23:00","days":[5]},
      {"name":"Cena sábado","start":"20:00","end":"23:59","last":"23:30","days":[6]},
      {"name":"Cena domingo","start":"20:00","end":"23:30","last":"23:00","days":[0]}]',
    '[{"d":5,"from":"20:30","to":"23:00"},{"d":6,"from":"20:00","to":"23:30"},{"d":0,"from":"20:00","to":"23:00"}]',
    20);

  -- Burguer Chin: horario PROVISIONAL (martes a domingo, comida y cena) hasta que lo confirmen
  perform pg_temp.pc_service(v_chin,
    '[{"d":2,"from":"13:00","to":"16:00"},{"d":3,"from":"13:00","to":"16:00"},{"d":4,"from":"13:00","to":"16:00"},{"d":5,"from":"13:00","to":"16:00"},{"d":6,"from":"13:00","to":"16:00"},{"d":0,"from":"13:00","to":"16:00"},
      {"d":2,"from":"20:00","to":"23:30"},{"d":3,"from":"20:00","to":"23:30"},{"d":4,"from":"20:00","to":"23:30"},{"d":5,"from":"20:00","to":"23:30"},{"d":6,"from":"20:00","to":"23:30"},{"d":0,"from":"20:00","to":"23:30"}]',
    '[{"name":"Comida","start":"13:00","end":"16:00","last":"15:30","days":[2,3,4,5,6,0]},
      {"name":"Cena","start":"20:00","end":"23:30","last":"23:00","days":[2,3,4,5,6,0]}]',
    '[{"d":2,"from":"13:00","to":"15:30"},{"d":3,"from":"13:00","to":"15:30"},{"d":4,"from":"13:00","to":"15:30"},{"d":5,"from":"13:00","to":"15:30"},{"d":6,"from":"13:00","to":"15:30"},{"d":0,"from":"13:00","to":"15:30"},
      {"d":2,"from":"20:00","to":"23:00"},{"d":3,"from":"20:00","to":"23:00"},{"d":4,"from":"20:00","to":"23:00"},{"d":5,"from":"20:00","to":"23:00"},{"d":6,"from":"20:00","to":"23:00"},{"d":0,"from":"20:00","to":"23:00"}]',
    0);
end $$;

commit;
