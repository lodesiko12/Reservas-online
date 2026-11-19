-- Alta de "La Nueva Estrella" (pastelería, modo encargo). Idempotente.
-- Carta y precios INVENTADOS (ejemplo) para que el dueño los ajuste en Catálogo.
-- default_capacity = 2 (recogidas simultáneas por franja) es un valor de EJEMPLO.
-- Antelación mínima, capacidad diaria y política de cancelación quedan VACÍAS a propósito
-- (las decide el negocio en Configuración → Reglas de los encargos online).
begin;

insert into public.businesses (name, slug, type, primary_color, timezone, order_mode, default_capacity, slot_interval_min)
values ('La Nueva Estrella', 'la-nueva-estrella', 'citas', '#B8862B', 'Europe/Madrid', true, 2, 15)
on conflict (slug) do nothing;

do $$
declare bid uuid := (select id from public.businesses where slug = 'la-nueva-estrella');
begin
  -- Lunes cerrado; M-V 9:00-14:00 y 16:30-20:30; S-D 9:30-20:30.
  if not exists (select 1 from public.business_hours where business_id = bid) then
    insert into public.business_hours (business_id, weekday, open_time, close_time) values
      (bid, 2, '09:00', '14:00'), (bid, 2, '16:30', '20:30'),
      (bid, 3, '09:00', '14:00'), (bid, 3, '16:30', '20:30'),
      (bid, 4, '09:00', '14:00'), (bid, 4, '16:30', '20:30'),
      (bid, 5, '09:00', '14:00'), (bid, 5, '16:30', '20:30'),
      (bid, 6, '09:30', '20:30'),
      (bid, 0, '09:30', '20:30');
  end if;

  insert into public.order_settings (business_id, require_confirmation) values (bid, true)
  on conflict (business_id) do nothing;

  -- Niveles (grupos de producto)
  insert into public.service_option_groups (business_id, group_key, label, sort_order) values
    (bid, 'panettones', 'Panettones', 0),
    (bid, 'croissants', 'Surtidos de croissants', 1),
    (bid, 'pasteles', 'Cajas de pasteles', 2),
    (bid, 'tartas', 'Tartas personalizadas', 3)
  on conflict (business_id, group_key) do update set label = excluded.label, sort_order = excluded.sort_order;

  -- Servicios: producto x tamaño (Pequeño / Grande), 15 min de recogida
  insert into public.services (business_id, name, duration_min, buffer_min, price, sort_order, size_key, size_label, option_group)
  select bid, v.name, 15, 0, v.price, v.ord, v.size_key, v.size_label, v.grp
  from (values
    ('Pequeño · Panettones',              18, 0, 'pequeno', 'Pequeño', 'panettones'),
    ('Grande · Panettones',               28, 1, 'grande',  'Grande',  'panettones'),
    ('Pequeño · Surtidos de croissants',  12, 2, 'pequeno', 'Pequeño', 'croissants'),
    ('Grande · Surtidos de croissants',   22, 3, 'grande',  'Grande',  'croissants'),
    ('Pequeño · Cajas de pasteles',       14, 4, 'pequeno', 'Pequeño', 'pasteles'),
    ('Grande · Cajas de pasteles',        26, 5, 'grande',  'Grande',  'pasteles'),
    ('Pequeño · Tartas personalizadas',   30, 6, 'pequeno', 'Pequeño', 'tartas'),
    ('Grande · Tartas personalizadas',    45, 7, 'grande',  'Grande',  'tartas')
  ) as v(name, price, ord, size_key, size_label, grp)
  where not exists (
    select 1 from public.services s
    where s.business_id = bid and s.size_key = v.size_key and s.option_group = v.grp
  );

  -- Sabores / variedades
  insert into public.service_options (business_id, option_group, name, sort_order) values
    (bid, 'panettones', 'Clásico con frutas escarchadas', 0),
    (bid, 'panettones', 'Chocolate', 1),
    (bid, 'panettones', 'Pistacho', 2),
    (bid, 'panettones', 'Crema de Kinder', 3),
    (bid, 'panettones', 'Dulce de leche', 4),
    (bid, 'croissants', 'Surtido clásico (mantequilla)', 0),
    (bid, 'croissants', 'Surtido de rellenos dulces', 1),
    (bid, 'croissants', 'Surtido de pistacho', 2),
    (bid, 'croissants', 'Surtido salado (jamón y queso)', 3),
    (bid, 'pasteles', 'Surtido clásico', 0),
    (bid, 'pasteles', 'Surtido de chocolate', 1),
    (bid, 'pasteles', 'Surtido de frutas', 2),
    (bid, 'pasteles', 'Surtido mixto de la casa', 3),
    (bid, 'tartas', 'Tarta de chocolate', 0),
    (bid, 'tartas', 'Red velvet', 1),
    (bid, 'tartas', 'Tarta de zanahoria', 2),
    (bid, 'tartas', 'Tarta de queso', 3),
    (bid, 'tartas', 'Lemon pie', 4),
    (bid, 'tartas', 'Tarta de pistacho', 5)
  on conflict (business_id, option_group, name) do nothing;
end $$;

commit;
