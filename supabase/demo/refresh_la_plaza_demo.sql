-- Demo comercial de restaurante: "Restaurante La Plaza" (slug restaurante-la-plaza).
--
-- NO es una migración (no está en supabase/migrations): se ejecuta a mano, por el
-- SQL editor de Supabase o por el MCP, ANTES DE CADA REUNIÓN, para que hoy y mañana
-- salgan llenos. Es idempotente: borra las reservas y la lista de espera del negocio
-- y las regenera relativas a la fecha actual (14 días atrás → 7 días adelante).
--
-- Requiere que la configuración ya esté hecha (zonas, mesas, franjas, reglas de
-- duración y combinaciones). Los clientes ficticios solo se crean si hay < 30.
-- Todo son datos inventados: teléfonos 6000000NN, sin emails.

do $$
declare
  bid uuid;
  tz text := 'Europe/Madrid';
  firsts text[] := array['Lucía','Carlos','Marta','Javier','Elena','Pablo','Laura','Daniel','Sara','Adrián','Paula','Álvaro','Carmen','Sergio','Irene','Rubén','Nuria','Hugo','Alba','Diego','Claudia','Iván','Rocío','Mario'];
  lasts  text[] := array['García','Martínez','López','Sánchez','Pérez','Gómez','Ruiz','Hernández','Díaz','Moreno','Muñoz','Álvarez','Romero','Alonso','Gutiérrez','Navarro','Torres','Domínguez','Vázquez','Ramos','Gil','Serrano','Blanco','Molina'];
  notes_pool text[] := array['Celebración de cumpleaños','Alergia a frutos secos','Necesita trona','Prefiere terraza','Aniversario, mesa tranquila','Comida de empresa','Un celíaco en el grupo','Llegarán 10 min tarde'];
  d date; off int; sh record; tb record;
  target int; covers int; tries int;
  pax int; dur int; slot_min int; s timestamptz; e timestamptz;
  cust record; tid uuid; comboid uuid; ok boolean;
  st booking_status; ch booking_channel; r float; loc text;
  today date := (now() at time zone tz)::date;
  n_cust int;
begin
  select id into bid from businesses where slug = 'restaurante-la-plaza';
  if bid is null then raise exception 'No existe el negocio restaurante-la-plaza'; end if;
  perform setseed(0.42);

  delete from waitlist where business_id = bid;
  delete from bookings where business_id = bid;

  -- Clientes ficticios (solo la primera vez)
  select count(*) into n_cust from customers where business_id = bid;
  if n_cust < 30 then
    delete from customers where business_id = bid;
    insert into customers(business_id, full_name, last_name, phone, tags, notes)
    select bid,
           firsts[(i*7 % 24) + 1],
           lasts[(i*5 % 24) + 1] || ' ' || lasts[(i*11 % 24) + 1],
           '60000' || lpad(i::text, 4, '0'),
           case when i % 9 = 0 then array['Celíaco']
                when i % 11 = 0 then array['Alergia frutos secos']
                when i % 13 = 0 then array['Cumpleaños en octubre']
                else '{}'::text[] end,
           case when i % 9 = 0 then 'Sin gluten, avisar a cocina' end
    from generate_series(1, 55) i;
  end if;

  for off in -14..7 loop
    d := today + off;
    for sh in select * from dining_shifts where business_id = bid and is_active and extract(dow from d)::int = any(active_weekdays) order by start_time loop
      target := case
        when off in (0, 1) then round(sh.max_covers * (0.86 + random()*0.09))
        when off < 0 then round(sh.max_covers * (0.55 + random()*0.30))
        else round(sh.max_covers * greatest(0.15, 0.55 - (off-1) * 0.06 + random()*0.1))
      end;
      covers := 0; tries := 0;
      while covers < target and tries < 400 loop
        tries := tries + 1;
        r := random();
        pax := case when r < .05 then 1 when r < .45 then 2 when r < .55 then 3 when r < .85 then 4 when r < .89 then 5
                    when r < .95 then 6 when r < .98 then 8 else 10 end;
        select duration_min into dur from dining_duration_rules where dining_shift_id = sh.id and pax between pax_min and pax_max limit 1;
        dur := coalesce(dur, sh.booking_duration_min);
        -- slot aleatorio entre inicio y última reserva (cada 15 min)
        slot_min := (extract(epoch from sh.start_time)/60)::int
                    + 15 * floor(random() * (((extract(epoch from coalesce(sh.last_call_time, sh.end_time - interval '30 min'))/60)::int - (extract(epoch from sh.start_time)/60)::int) / 15 + 1))::int;
        s := ((d + make_interval(mins => slot_min)) at time zone tz);
        e := s + make_interval(mins => dur);

        tid := null; comboid := null; ok := false;
        -- mesa individual que encaje, la más ajustada libre
        for tb in select t.id, t.zone_id from dining_tables t
                  where t.business_id = bid and t.is_active and pax between t.cap_min and t.cap_max
                  order by (t.cap_max - pax), random() loop
          if not exists (
            select 1 from bookings b
            where b.business_id = bid and b.status <> 'cancelada'
              and tstzrange(b.starts_at, b.ends_at + make_interval(mins => sh.cleanup_min)) && tstzrange(s, e)
              and (b.dining_table_id = tb.id
                   or exists (select 1 from dining_table_combos c where c.id = b.table_combo_id and tb.id = any(c.table_ids)))
          ) then tid := tb.id; ok := true; exit; end if;
        end loop;
        -- grupos grandes: combinación de mesas
        if not ok and pax >= 7 then
          for tb in select c.id, c.table_ids from dining_table_combos c where c.business_id = bid and c.is_active and pax between c.cap_min and c.cap_max loop
            if not exists (
              select 1 from bookings b
              where b.business_id = bid and b.status <> 'cancelada'
                and tstzrange(b.starts_at, b.ends_at + make_interval(mins => sh.cleanup_min)) && tstzrange(s, e)
                and (b.dining_table_id = any(tb.table_ids)
                     or exists (select 1 from dining_table_combos c2 where c2.id = b.table_combo_id and c2.table_ids && tb.table_ids))
            ) then comboid := tb.id; ok := true; exit; end if;
          end loop;
        end if;
        continue when not ok;

        -- estado según el momento
        r := random();
        if e < now() then
          st := case when r < .06 then 'no_show' when r < .12 then 'cancelada' else 'completada' end;
        elsif s <= now() then
          st := 'sentada';
        else
          st := case when r < .04 then 'cancelada' else 'confirmada' end;
        end if;
        r := random();
        ch := case when r < .60 then 'web' when r < .85 then 'manual' else 'walkin' end;
        if ch = 'walkin' and s > now() then ch := 'manual'; end if;

        -- cliente: los no-show se concentran en unos pocos (coherencia del historial)
        if st = 'no_show' then
          select * into cust from customers where business_id = bid order by md5(id::text) limit 1 offset floor(random()*5)::int;
        else
          select * into cust from customers where business_id = bid order by random() limit 1;
        end if;

        loop
          loc := 'LP-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));
          exit when not exists (select 1 from bookings where locator = loc);
        end loop;

        insert into bookings(business_id, type, dining_shift_id, party_size, starts_at, ends_at, customer_id,
                             customer_name, customer_last_name, customer_phone, locator, status, channel, notes,
                             dining_table_id, table_combo_id, created_at)
        values (bid, 'restaurante', sh.id, pax, s, e, cust.id, cust.full_name, cust.last_name, cust.phone, loc, st, ch,
                case when random() < .12 then notes_pool[1 + floor(random()*8)::int] end,
                tid, comboid,
                least(now() - interval '5 minutes', s - make_interval(hours => 2 + floor(random()*220)::int)));
        covers := covers + pax;
      end loop;
    end loop;
  end loop;

  -- Etiquetas de historial derivadas de los datos generados
  update customers set tags = array_append(tags, 'VIP') where business_id = bid and bookings_count >= 10 and not ('VIP' = any(tags));
  update customers set tags = array_append(tags, 'No-show reincidente') where business_id = bid and no_show_count >= 2 and not ('No-show reincidente' = any(tags));

  -- Lista de espera de hoy
  insert into waitlist(business_id, name, phone, party_size, notes, status, created_at) values
    (bid, 'Familia Herrero', '600000901', 4, 'Esperan mesa en terraza', 'esperando', now() - interval '18 minutes'),
    (bid, 'Beatriz Cano',    '600000902', 2, null,                        'esperando', now() - interval '9 minutes'),
    (bid, 'Grupo Ortega',    '600000903', 6, 'Cumpleaños',                'avisado',   now() - interval '35 minutes');
end $$;
