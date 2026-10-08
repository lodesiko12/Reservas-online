-- Clona un negocio de tipo restaurante (config + clientes + reservas + lista de espera) con otro
-- nombre/slug. No es una migración: se ejecuta a mano (pedir confirmación, va a producción).
-- Uso: cambiar v_src_slug / v_new_name / v_new_slug y ejecutar. Falla si el slug nuevo ya existe.
-- Las reservas conservan fechas, estados y mesas (mapeadas a las mesas nuevas); los localizadores
-- se regeneran (son únicos globales). Los recordatorios de WhatsApp se dejan desactivados.
do $$
declare
  v_src_slug text := 'restaurante-la-plaza';
  v_new_name text := 'Bassalo';
  v_new_slug text := 'bassalo';
  v_src uuid;
  v_new uuid := gen_random_uuid();
begin
  select id into v_src from businesses where slug = v_src_slug;
  if v_src is null then raise exception 'No existe el negocio origen %', v_src_slug; end if;
  if exists (select 1 from businesses where slug = v_new_slug) then
    raise exception 'Ya existe un negocio con slug %', v_new_slug;
  end if;

  insert into businesses (id, name, slug, type, is_active, primary_color, logo_url, timezone,
    whatsapp_phone, whatsapp_reminders_enabled, reminder_template_name, reminder_lang,
    default_capacity, slot_interval_min, google_review_url, waitlist_template_name,
    max_advance_days, confirmation_email_message, review_email_message)
  select v_new, v_new_name, v_new_slug, type, true, primary_color, logo_url, timezone,
    null, false, reminder_template_name, reminder_lang,
    default_capacity, slot_interval_min, google_review_url, waitlist_template_name,
    max_advance_days, confirmation_email_message, review_email_message
  from businesses where id = v_src;

  insert into business_hours (business_id, weekday, open_time, close_time)
  select v_new, weekday, open_time, close_time from business_hours where business_id = v_src;

  insert into dining_settings (business_id, min_lead_minutes, max_advance_days, min_party_online,
    max_party_online, require_manual_confirmation)
  select v_new, min_lead_minutes, max_advance_days, min_party_online, max_party_online,
    require_manual_confirmation
  from dining_settings where business_id = v_src;

  -- Mapas de ids viejo -> nuevo
  create temp table m_zone on commit drop as
    select id old_id, gen_random_uuid() new_id from dining_zones where business_id = v_src;
  create temp table m_table on commit drop as
    select id old_id, gen_random_uuid() new_id from dining_tables where business_id = v_src;
  create temp table m_combo on commit drop as
    select id old_id, gen_random_uuid() new_id from dining_table_combos where business_id = v_src;
  create temp table m_shift on commit drop as
    select id old_id, gen_random_uuid() new_id from dining_shifts where business_id = v_src;
  create temp table m_cust on commit drop as
    select id old_id, gen_random_uuid() new_id from customers where business_id = v_src;
  create temp table m_book on commit drop as
    select id old_id, gen_random_uuid() new_id from bookings where business_id = v_src;

  insert into dining_zones (id, business_id, name, reservable_online, sort_order, is_active)
  select m.new_id, v_new, z.name, z.reservable_online, z.sort_order, z.is_active
  from dining_zones z join m_zone m on m.old_id = z.id;

  insert into dining_tables (id, business_id, zone_id, name, cap_min, cap_max, priority, pos_x, pos_y,
    shape, is_active)
  select m.new_id, v_new, mz.new_id, t.name, t.cap_min, t.cap_max, t.priority, t.pos_x, t.pos_y,
    t.shape, t.is_active
  from dining_tables t join m_table m on m.old_id = t.id left join m_zone mz on mz.old_id = t.zone_id;

  insert into dining_table_combos (id, business_id, name, table_ids, cap_min, cap_max, priority, is_active)
  select m.new_id, v_new, c.name,
    (select array_agg(mt.new_id order by u.ord) from unnest(c.table_ids) with ordinality u(tid, ord)
       join m_table mt on mt.old_id = u.tid),
    c.cap_min, c.cap_max, c.priority, c.is_active
  from dining_table_combos c join m_combo m on m.old_id = c.id;

  insert into dining_shifts (id, business_id, name, start_time, end_time, max_covers, slot_interval_min,
    active_weekdays, is_active, booking_duration_min, last_call_time, pacing_enabled,
    max_covers_per_slot, max_bookings_per_slot, online_max_covers, allow_double_turn, cleanup_min)
  select m.new_id, v_new, s.name, s.start_time, s.end_time, s.max_covers, s.slot_interval_min,
    s.active_weekdays, s.is_active, s.booking_duration_min, s.last_call_time, s.pacing_enabled,
    s.max_covers_per_slot, s.max_bookings_per_slot, s.online_max_covers, s.allow_double_turn, s.cleanup_min
  from dining_shifts s join m_shift m on m.old_id = s.id;

  insert into customers (id, business_id, full_name, last_name, phone, email, notes, tags, nif,
    birth_date, profession, address, city, province, postal_code, created_at)
  select m.new_id, v_new, c.full_name, c.last_name, c.phone, c.email, c.notes, c.tags, c.nif,
    c.birth_date, c.profession, c.address, c.city, c.province, c.postal_code, c.created_at
  from customers c join m_cust m on m.old_id = c.id;

  insert into bookings (id, business_id, type, service_id, professional_id, dining_shift_id, party_size,
    starts_at, ends_at, customer_id, customer_name, customer_last_name, customer_phone, customer_email,
    locator, status, channel, notes, created_at, dining_table_id, table_combo_id)
  select m.new_id, v_new, b.type, null, null, ms.new_id, b.party_size,
    b.starts_at, b.ends_at, mc.new_id, b.customer_name, b.customer_last_name, b.customer_phone,
    b.customer_email,
    'BA-' || upper(substr(md5(m.new_id::text), 1, 6)), b.status, b.channel, b.notes, b.created_at,
    mt.new_id, mcb.new_id
  from bookings b join m_book m on m.old_id = b.id
  left join m_shift ms on ms.old_id = b.dining_shift_id
  left join m_cust mc on mc.old_id = b.customer_id
  left join m_table mt on mt.old_id = b.dining_table_id
  left join m_combo mcb on mcb.old_id = b.table_combo_id;

  -- El trigger de reservas recalcula contadores al insertar: los dejamos idénticos al origen.
  update customers c set bookings_count = s.bookings_count, no_show_count = s.no_show_count
  from m_cust m join customers s on s.id = m.old_id
  where c.id = m.new_id;

  insert into waitlist (business_id, name, phone, party_size, notes, status, notified_at,
    seated_booking_id, created_at, zone_id)
  select v_new, w.name, w.phone, w.party_size, w.notes, w.status, w.notified_at,
    mb.new_id, w.created_at, mz.new_id
  from waitlist w left join m_book mb on mb.old_id = w.seated_booking_id
  left join m_zone mz on mz.old_id = w.zone_id
  where w.business_id = v_src;

  -- Mismo acceso que el origen (en este caso staff@restaurante.test, owner)
  insert into business_users (business_id, user_id, role)
  select v_new, user_id, role from business_users where business_id = v_src;

  raise notice 'Negocio % creado con id %', v_new_slug, v_new;
end $$;
