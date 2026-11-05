-- Generado por gen_cheesecake_ando.mjs desde menu.ts. Idempotente.
-- Valores de EJEMPLO a confirmar con el dueño: default_capacity (recogidas simultáneas por franja) = 2.
-- Antelación mínima, capacidad diaria y política de cancelación quedan VACÍAS a propósito
-- (las decide el negocio en Configuración → Reglas de los encargos online).
begin;

insert into public.businesses (name, slug, type, primary_color, timezone, order_mode, default_capacity, slot_interval_min)
values ('cheesecake.ando', 'cheesecake-ando', 'citas', '#A5565F', 'Europe/Madrid', true, 2, 15)
on conflict (slug) do nothing;

do $$
declare bid uuid := (select id from public.businesses where slug = 'cheesecake-ando');
begin
  -- Horario de invierno: L cerrado; M-V 10:00-13:30 y 17:00-21:00; S-D 10:00-14:30.
  if not exists (select 1 from public.business_hours where business_id = bid) then
    insert into public.business_hours (business_id, weekday, open_time, close_time) values
      (bid, 2, '10:00', '13:30'), (bid, 2, '17:00', '21:00'),
      (bid, 3, '10:00', '13:30'), (bid, 3, '17:00', '21:00'),
      (bid, 4, '10:00', '13:30'), (bid, 4, '17:00', '21:00'),
      (bid, 5, '10:00', '13:30'), (bid, 5, '17:00', '21:00'),
      (bid, 6, '10:00', '14:30'),
      (bid, 0, '10:00', '14:30');
  end if;

  insert into public.order_settings (business_id, require_confirmation) values (bid, true)
  on conflict (business_id) do nothing;

  insert into public.service_option_groups (business_id, group_key, label, sort_order)
  values (bid, 'basicas', 'Básicas', 0)
  on conflict (business_id, group_key) do update set sort_order = excluded.sort_order;

  insert into public.service_option_groups (business_id, group_key, label, sort_order)
  values (bid, 'clasicas', 'Clásicas', 1)
  on conflict (business_id, group_key) do update set sort_order = excluded.sort_order;

  insert into public.service_option_groups (business_id, group_key, label, sort_order)
  values (bid, 'premium', 'Premium', 2)
  on conflict (business_id, group_key) do update set sort_order = excluded.sort_order;

  insert into public.service_option_groups (business_id, group_key, label, sort_order)
  values (bid, 'especiales', 'Tartas especiales', 3)
  on conflict (business_id, group_key) do update set sort_order = excluded.sort_order;

  insert into public.services (business_id, name, duration_min, buffer_min, price, sort_order, size_key, size_label, option_group)
  select bid, 'Mediana · Básicas', 15, 0, 28, 0, 'mediana', 'Mediana (8 o 10 raciones)', 'basicas'
  where not exists (select 1 from public.services s where s.business_id = bid and s.size_key = 'mediana' and s.option_group = 'basicas');

  insert into public.services (business_id, name, duration_min, buffer_min, price, sort_order, size_key, size_label, option_group)
  select bid, 'Grande · Básicas', 15, 0, 35, 1, 'grande', 'Grande (12 o 14 raciones)', 'basicas'
  where not exists (select 1 from public.services s where s.business_id = bid and s.size_key = 'grande' and s.option_group = 'basicas');

  insert into public.services (business_id, name, duration_min, buffer_min, price, sort_order, size_key, size_label, option_group)
  select bid, 'Mediana · Clásicas', 15, 0, 32, 2, 'mediana', 'Mediana (8 o 10 raciones)', 'clasicas'
  where not exists (select 1 from public.services s where s.business_id = bid and s.size_key = 'mediana' and s.option_group = 'clasicas');

  insert into public.services (business_id, name, duration_min, buffer_min, price, sort_order, size_key, size_label, option_group)
  select bid, 'Grande · Clásicas', 15, 0, 40, 3, 'grande', 'Grande (12 o 14 raciones)', 'clasicas'
  where not exists (select 1 from public.services s where s.business_id = bid and s.size_key = 'grande' and s.option_group = 'clasicas');

  insert into public.services (business_id, name, duration_min, buffer_min, price, sort_order, size_key, size_label, option_group)
  select bid, 'Mediana · Premium', 15, 0, 38, 4, 'mediana', 'Mediana (8 o 10 raciones)', 'premium'
  where not exists (select 1 from public.services s where s.business_id = bid and s.size_key = 'mediana' and s.option_group = 'premium');

  insert into public.services (business_id, name, duration_min, buffer_min, price, sort_order, size_key, size_label, option_group)
  select bid, 'Grande · Premium', 15, 0, 45, 5, 'grande', 'Grande (12 o 14 raciones)', 'premium'
  where not exists (select 1 from public.services s where s.business_id = bid and s.size_key = 'grande' and s.option_group = 'premium');

  insert into public.services (business_id, name, duration_min, buffer_min, price, sort_order, size_key, size_label, option_group)
  select bid, 'Mediana · Tartas especiales', 15, 0, 40, 6, 'mediana', 'Mediana (8 o 10 raciones)', 'especiales'
  where not exists (select 1 from public.services s where s.business_id = bid and s.size_key = 'mediana' and s.option_group = 'especiales');

  insert into public.services (business_id, name, duration_min, buffer_min, price, sort_order, size_key, size_label, option_group)
  select bid, 'Grande · Tartas especiales', 15, 0, 48, 7, 'grande', 'Grande (12 o 14 raciones)', 'especiales'
  where not exists (select 1 from public.services s where s.business_id = bid and s.size_key = 'grande' and s.option_group = 'especiales');

  insert into public.service_options (business_id, option_group, name, sort_order) values (bid, 'basicas', 'Magdalenas valencianas', 0) on conflict (business_id, option_group, name) do nothing;
  insert into public.service_options (business_id, option_group, name, sort_order) values (bid, 'basicas', 'Galleta Lotus', 1) on conflict (business_id, option_group, name) do nothing;
  insert into public.service_options (business_id, option_group, name, sort_order) values (bid, 'basicas', 'Cereales leche', 2) on conflict (business_id, option_group, name) do nothing;
  insert into public.service_options (business_id, option_group, name, sort_order) values (bid, 'clasicas', 'Mango', 0) on conflict (business_id, option_group, name) do nothing;
  insert into public.service_options (business_id, option_group, name, sort_order) values (bid, 'clasicas', 'Kit Kat y Kit Kat White', 1) on conflict (business_id, option_group, name) do nothing;
  insert into public.service_options (business_id, option_group, name, sort_order) values (bid, 'clasicas', 'Galletas napolitanas', 2) on conflict (business_id, option_group, name) do nothing;
  insert into public.service_options (business_id, option_group, name, sort_order) values (bid, 'clasicas', 'Galletas dinosaurio', 3) on conflict (business_id, option_group, name) do nothing;
  insert into public.service_options (business_id, option_group, name, sort_order) values (bid, 'clasicas', 'Galletas Simpsons y Cola Cao', 4) on conflict (business_id, option_group, name) do nothing;
  insert into public.service_options (business_id, option_group, name, sort_order) values (bid, 'clasicas', 'Weiks', 5) on conflict (business_id, option_group, name) do nothing;
  insert into public.service_options (business_id, option_group, name, sort_order) values (bid, 'clasicas', 'Galletas campurrianas', 6) on conflict (business_id, option_group, name) do nothing;
  insert into public.service_options (business_id, option_group, name, sort_order) values (bid, 'clasicas', 'Filipinos negros y filipinos blancos', 7) on conflict (business_id, option_group, name) do nothing;
  insert into public.service_options (business_id, option_group, name, sort_order) values (bid, 'clasicas', 'Cereales Chocoflakes', 8) on conflict (business_id, option_group, name) do nothing;
  insert into public.service_options (business_id, option_group, name, sort_order) values (bid, 'clasicas', 'Chips Ahoy', 9) on conflict (business_id, option_group, name) do nothing;
  insert into public.service_options (business_id, option_group, name, sort_order) values (bid, 'clasicas', 'Nutella y Nutella cookies & cream', 10) on conflict (business_id, option_group, name) do nothing;
  insert into public.service_options (business_id, option_group, name, sort_order) values (bid, 'clasicas', 'Nocilla', 11) on conflict (business_id, option_group, name) do nothing;
  insert into public.service_options (business_id, option_group, name, sort_order) values (bid, 'clasicas', 'Oreo y Oreo Golden', 12) on conflict (business_id, option_group, name) do nothing;
  insert into public.service_options (business_id, option_group, name, sort_order) values (bid, 'clasicas', 'Parmesano y arándanos', 13) on conflict (business_id, option_group, name) do nothing;
  insert into public.service_options (business_id, option_group, name, sort_order) values (bid, 'clasicas', 'Queso trufado', 14) on conflict (business_id, option_group, name) do nothing;
  insert into public.service_options (business_id, option_group, name, sort_order) values (bid, 'clasicas', 'Galletas María y Nocilla blanca', 15) on conflict (business_id, option_group, name) do nothing;
  insert into public.service_options (business_id, option_group, name, sort_order) values (bid, 'clasicas', 'Tosta Rica y Nocilla blanca', 16) on conflict (business_id, option_group, name) do nothing;
  insert into public.service_options (business_id, option_group, name, sort_order) values (bid, 'clasicas', 'Gofre y esencia de vainilla', 17) on conflict (business_id, option_group, name) do nothing;
  insert into public.service_options (business_id, option_group, name, sort_order) values (bid, 'clasicas', 'Dulce de leche y coco', 18) on conflict (business_id, option_group, name) do nothing;
  insert into public.service_options (business_id, option_group, name, sort_order) values (bid, 'clasicas', 'Dulce de leche y Tosta Rica', 19) on conflict (business_id, option_group, name) do nothing;
  insert into public.service_options (business_id, option_group, name, sort_order) values (bid, 'clasicas', 'Queso azul y miel', 20) on conflict (business_id, option_group, name) do nothing;
  insert into public.service_options (business_id, option_group, name, sort_order) values (bid, 'clasicas', 'Queso manchego y miel', 21) on conflict (business_id, option_group, name) do nothing;
  insert into public.service_options (business_id, option_group, name, sort_order) values (bid, 'clasicas', 'Queso gorgonzola y nueces', 22) on conflict (business_id, option_group, name) do nothing;
  insert into public.service_options (business_id, option_group, name, sort_order) values (bid, 'clasicas', 'Tradicional', 23) on conflict (business_id, option_group, name) do nothing;
  insert into public.service_options (business_id, option_group, name, sort_order) values (bid, 'clasicas', 'Tradicional con requesón', 24) on conflict (business_id, option_group, name) do nothing;
  insert into public.service_options (business_id, option_group, name, sort_order) values (bid, 'clasicas', 'Donuts', 25) on conflict (business_id, option_group, name) do nothing;
  insert into public.service_options (business_id, option_group, name, sort_order) values (bid, 'clasicas', 'Lotus, parmesano y bacon', 26) on conflict (business_id, option_group, name) do nothing;
  insert into public.service_options (business_id, option_group, name, sort_order) values (bid, 'premium', 'Kinder Bueno y Kinder Bueno White', 0) on conflict (business_id, option_group, name) do nothing;
  insert into public.service_options (business_id, option_group, name, sort_order) values (bid, 'premium', 'Happy Hippo', 1) on conflict (business_id, option_group, name) do nothing;
  insert into public.service_options (business_id, option_group, name, sort_order) values (bid, 'premium', 'Chocolate blanco', 2) on conflict (business_id, option_group, name) do nothing;
  insert into public.service_options (business_id, option_group, name, sort_order) values (bid, 'premium', 'Lotus y chocolate blanco', 3) on conflict (business_id, option_group, name) do nothing;
  insert into public.service_options (business_id, option_group, name, sort_order) values (bid, 'premium', 'Pistacho', 4) on conflict (business_id, option_group, name) do nothing;
  insert into public.service_options (business_id, option_group, name, sort_order) values (bid, 'premium', 'Pantera Rosa', 5) on conflict (business_id, option_group, name) do nothing;
  insert into public.service_options (business_id, option_group, name, sort_order) values (bid, 'premium', 'Cacahuete Eagle y miel', 6) on conflict (business_id, option_group, name) do nothing;
  insert into public.service_options (business_id, option_group, name, sort_order) values (bid, 'premium', 'Twix y caramelo salado', 7) on conflict (business_id, option_group, name) do nothing;
  insert into public.service_options (business_id, option_group, name, sort_order) values (bid, 'premium', 'Jungly blanco y dinosaurio', 8) on conflict (business_id, option_group, name) do nothing;
  insert into public.service_options (business_id, option_group, name, sort_order) values (bid, 'premium', 'Jungly negro y Nocilla', 9) on conflict (business_id, option_group, name) do nothing;
  insert into public.service_options (business_id, option_group, name, sort_order) values (bid, 'premium', 'Huesitos y huesitos blancos', 10) on conflict (business_id, option_group, name) do nothing;
  insert into public.service_options (business_id, option_group, name, sort_order) values (bid, 'premium', 'Chocobons', 11) on conflict (business_id, option_group, name) do nothing;
  insert into public.service_options (business_id, option_group, name, sort_order) values (bid, 'premium', 'Donettes', 12) on conflict (business_id, option_group, name) do nothing;
  insert into public.service_options (business_id, option_group, name, sort_order) values (bid, 'premium', 'Tiramisú', 13) on conflict (business_id, option_group, name) do nothing;
  insert into public.service_options (business_id, option_group, name, sort_order) values (bid, 'premium', 'Snickers', 14) on conflict (business_id, option_group, name) do nothing;
  insert into public.service_options (business_id, option_group, name, sort_order) values (bid, 'premium', 'Crumble cookies', 15) on conflict (business_id, option_group, name) do nothing;
  insert into public.service_options (business_id, option_group, name, sort_order) values (bid, 'premium', 'Arroz con leche', 16) on conflict (business_id, option_group, name) do nothing;
  insert into public.service_options (business_id, option_group, name, sort_order) values (bid, 'premium', 'Torrijas', 17) on conflict (business_id, option_group, name) do nothing;
  insert into public.service_options (business_id, option_group, name, sort_order) values (bid, 'premium', 'Natillas', 18) on conflict (business_id, option_group, name) do nothing;
  insert into public.service_options (business_id, option_group, name, sort_order) values (bid, 'especiales', 'Ferrero Rocher', 0) on conflict (business_id, option_group, name) do nothing;
  insert into public.service_options (business_id, option_group, name, sort_order) values (bid, 'especiales', 'Toblerone', 1) on conflict (business_id, option_group, name) do nothing;
  insert into public.service_options (business_id, option_group, name, sort_order) values (bid, 'especiales', 'Turrón blando de Jijona', 2) on conflict (business_id, option_group, name) do nothing;
  insert into public.service_options (business_id, option_group, name, sort_order) values (bid, 'especiales', 'Turrón de oro', 3) on conflict (business_id, option_group, name) do nothing;
  insert into public.service_options (business_id, option_group, name, sort_order) values (bid, 'especiales', 'Turrón de yema tostada', 4) on conflict (business_id, option_group, name) do nothing;
  insert into public.service_options (business_id, option_group, name, sort_order) values (bid, 'especiales', 'Panettone', 5) on conflict (business_id, option_group, name) do nothing;
  insert into public.service_options (business_id, option_group, name, sort_order) values (bid, 'especiales', 'Raffaello', 6) on conflict (business_id, option_group, name) do nothing;
end $$;

commit;
