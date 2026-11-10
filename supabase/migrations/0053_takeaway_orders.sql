-- =====================================================================
-- 0053_takeaway_orders.sql
-- "Pedidos online para llevar" en negocios tipo `restaurante` (restaurantes,
-- hamburgueserías, pizzerías…): además de reservar mesa, el cliente elige platos
-- de la carta (con extras), una hora de recogida y deja sus datos.
--
-- Todo es retrocompatible: `businesses.online_orders` vale false por defecto y los
-- negocios actuales no cambian de comportamiento. No se toca ningún enum ni la
-- tabla `bookings`: un pedido tiene varias líneas, no encaja en una reserva.
--
--   * businesses.online_orders       interruptor del módulo
--   * menu_categories / menu_items   carta (precio, alérgenos, "agotado hoy")
--   * menu_modifier_groups/_modifiers/menu_item_modifier_groups
--                                    extras ("Punto de la carne", "Añade bacon"…)
--                                    reutilizables entre productos
--   * takeaway_settings/_hours       tiempo de preparación, hueco por franja, pausa…
--   * orders / order_items           pedidos y sus líneas (con snapshot de precios)
--   * RPCs públicas                  get_public_menu, get_takeaway_slots/_days,
--                                    get_order_by_locator, cancel_order_by_locator
--   * create_public_order            solo service_role (la llama la Edge Function)
--   * get_public_business            + online_orders
--   * orders en supabase_realtime    el panel recibe los pedidos al instante
-- =====================================================================

alter table public.businesses add column if not exists online_orders boolean not null default false;

-- ---------------------------------------------------------------------
-- Carta
-- ---------------------------------------------------------------------
create table if not exists public.menu_categories (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name        text not null check (char_length(btrim(name)) between 1 and 80),
  sort_order  int  not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists idx_menu_categories_business on public.menu_categories(business_id);

create table if not exists public.menu_items (
  id           uuid primary key default gen_random_uuid(),
  business_id  uuid not null references public.businesses(id) on delete cascade,
  category_id  uuid not null references public.menu_categories(id) on delete restrict,
  name         text not null check (char_length(btrim(name)) between 1 and 120),
  description  text check (char_length(description) <= 400),
  price        numeric(8,2) not null check (price >= 0),
  allergens    text[] not null default '{}',
  is_available boolean not null default true,   -- false = "agotado hoy" (se ve, no se puede pedir)
  is_active    boolean not null default true,   -- false = oculto de la carta
  sort_order   int  not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists idx_menu_items_business on public.menu_items(business_id);
create index if not exists idx_menu_items_category on public.menu_items(category_id);

create table if not exists public.menu_modifier_groups (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name        text not null check (char_length(btrim(name)) between 1 and 80),
  min_choices int  not null default 0 check (min_choices >= 0),
  max_choices int  not null default 1 check (max_choices >= 1),
  sort_order  int  not null default 0,
  created_at  timestamptz not null default now(),
  check (max_choices >= min_choices)
);
create index if not exists idx_menu_modifier_groups_business on public.menu_modifier_groups(business_id);

create table if not exists public.menu_modifiers (
  id           uuid primary key default gen_random_uuid(),
  business_id  uuid not null references public.businesses(id) on delete cascade,
  group_id     uuid not null references public.menu_modifier_groups(id) on delete cascade,
  name         text not null check (char_length(btrim(name)) between 1 and 80),
  price_delta  numeric(8,2) not null default 0 check (price_delta >= 0),
  is_available boolean not null default true,
  sort_order   int  not null default 0,
  created_at   timestamptz not null default now()
);
create index if not exists idx_menu_modifiers_group on public.menu_modifiers(group_id);

create table if not exists public.menu_item_modifier_groups (
  item_id    uuid not null references public.menu_items(id) on delete cascade,
  group_id   uuid not null references public.menu_modifier_groups(id) on delete cascade,
  sort_order int  not null default 0,
  primary key (item_id, group_id)
);
create index if not exists idx_menu_item_modifier_groups_group on public.menu_item_modifier_groups(group_id);

-- ---------------------------------------------------------------------
-- Ajustes de los pedidos para llevar
-- ---------------------------------------------------------------------
create table if not exists public.takeaway_settings (
  business_id         uuid primary key references public.businesses(id) on delete cascade,
  accepting           boolean not null default true,        -- false = pausa temporal ("hoy no aceptamos pedidos")
  prep_minutes        int  not null default 20 check (prep_minutes >= 0),      -- margen mínimo hasta la recogida
  slot_interval_min   int  not null default 15 check (slot_interval_min in (5, 10, 15, 20, 30, 60)),
  max_orders_per_slot int  check (max_orders_per_slot > 0), -- null = sin límite
  max_advance_days    int  not null default 7 check (max_advance_days between 1 and 60),
  min_order_amount    numeric(8,2) not null default 0 check (min_order_amount >= 0),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- Horario de recogida (varias ventanas por día, p. ej. comida y cena).
create table if not exists public.takeaway_hours (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  weekday     int  not null check (weekday between 0 and 6),   -- 0 = domingo
  start_time  time not null,
  end_time    time not null,
  check (end_time > start_time)
);
create index if not exists idx_takeaway_hours_business on public.takeaway_hours(business_id, weekday);

-- ---------------------------------------------------------------------
-- Pedidos
-- ---------------------------------------------------------------------
create table if not exists public.orders (
  id                  uuid primary key default gen_random_uuid(),
  business_id         uuid not null references public.businesses(id) on delete cascade,
  locator             text not null unique,
  status              text not null default 'nuevo'
                        check (status in ('nuevo', 'preparando', 'listo', 'entregado', 'cancelado')),
  customer_id         uuid references public.customers(id) on delete set null,
  customer_name       text not null,
  customer_last_name  text,
  customer_phone      text not null,
  customer_email      text,
  notes               text,
  pickup_at           timestamptz not null,
  total               numeric(10,2) not null default 0 check (total >= 0),
  payment_method      text not null default 'local',            -- pago al recoger (Stripe, más adelante)
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index if not exists idx_orders_business_pickup on public.orders(business_id, pickup_at);
create index if not exists idx_orders_business_created on public.orders(business_id, created_at desc);

create table if not exists public.order_items (
  id          uuid primary key default gen_random_uuid(),
  order_id    uuid not null references public.orders(id) on delete cascade,
  item_id     uuid references public.menu_items(id) on delete set null,
  name        text not null,                                   -- snapshot: sobrevive a editar/borrar el plato
  quantity    int  not null check (quantity between 1 and 50),
  unit_price  numeric(8,2) not null check (unit_price >= 0),   -- precio base + extras
  modifiers   jsonb not null default '[]'::jsonb,              -- [{"name": "...", "price_delta": 1.5}]
  notes       text,
  line_total  numeric(10,2) not null check (line_total >= 0),
  sort_order  int  not null default 0
);
create index if not exists idx_order_items_order on public.order_items(order_id);

-- updated_at
drop trigger if exists trg_menu_categories_updated on public.menu_categories;
create trigger trg_menu_categories_updated before update on public.menu_categories
  for each row execute function public.set_updated_at();
drop trigger if exists trg_menu_items_updated on public.menu_items;
create trigger trg_menu_items_updated before update on public.menu_items
  for each row execute function public.set_updated_at();
drop trigger if exists trg_takeaway_settings_updated on public.takeaway_settings;
create trigger trg_takeaway_settings_updated before update on public.takeaway_settings
  for each row execute function public.set_updated_at();
drop trigger if exists trg_orders_updated on public.orders;
create trigger trg_orders_updated before update on public.orders
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- RLS: solo miembros del negocio (y super-admin vía is_business_member).
-- El widget accede únicamente por las RPCs SECURITY DEFINER de más abajo.
-- ---------------------------------------------------------------------
alter table public.menu_categories          enable row level security;
alter table public.menu_items               enable row level security;
alter table public.menu_modifier_groups     enable row level security;
alter table public.menu_modifiers           enable row level security;
alter table public.menu_item_modifier_groups enable row level security;
alter table public.takeaway_settings        enable row level security;
alter table public.takeaway_hours           enable row level security;
alter table public.orders                   enable row level security;
alter table public.order_items              enable row level security;

drop policy if exists menu_categories_all on public.menu_categories;
create policy menu_categories_all on public.menu_categories for all to authenticated
  using (public.is_business_member(business_id)) with check (public.is_business_member(business_id));
drop policy if exists menu_items_all on public.menu_items;
create policy menu_items_all on public.menu_items for all to authenticated
  using (public.is_business_member(business_id)) with check (public.is_business_member(business_id));
drop policy if exists menu_modifier_groups_all on public.menu_modifier_groups;
create policy menu_modifier_groups_all on public.menu_modifier_groups for all to authenticated
  using (public.is_business_member(business_id)) with check (public.is_business_member(business_id));
drop policy if exists menu_modifiers_all on public.menu_modifiers;
create policy menu_modifiers_all on public.menu_modifiers for all to authenticated
  using (public.is_business_member(business_id)) with check (public.is_business_member(business_id));
drop policy if exists menu_item_modifier_groups_all on public.menu_item_modifier_groups;
create policy menu_item_modifier_groups_all on public.menu_item_modifier_groups for all to authenticated
  using (exists (select 1 from public.menu_items i where i.id = item_id and public.is_business_member(i.business_id)))
  with check (
    exists (select 1 from public.menu_items i where i.id = item_id and public.is_business_member(i.business_id))
    and exists (select 1 from public.menu_modifier_groups g where g.id = group_id and public.is_business_member(g.business_id))
  );
drop policy if exists takeaway_settings_all on public.takeaway_settings;
create policy takeaway_settings_all on public.takeaway_settings for all to authenticated
  using (public.is_business_member(business_id)) with check (public.is_business_member(business_id));
drop policy if exists takeaway_hours_all on public.takeaway_hours;
create policy takeaway_hours_all on public.takeaway_hours for all to authenticated
  using (public.is_business_member(business_id)) with check (public.is_business_member(business_id));
drop policy if exists orders_all on public.orders;
create policy orders_all on public.orders for all to authenticated
  using (public.is_business_member(business_id)) with check (public.is_business_member(business_id));
drop policy if exists order_items_all on public.order_items;
create policy order_items_all on public.order_items for all to authenticated
  using (exists (select 1 from public.orders o where o.id = order_id and public.is_business_member(o.business_id)))
  with check (exists (select 1 from public.orders o where o.id = order_id and public.is_business_member(o.business_id)));

-- Realtime: el panel recibe los pedidos nuevos sin recargar.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'orders'
  ) then
    alter publication supabase_realtime add table public.orders;
  end if;
end $$;

-- ---------------------------------------------------------------------
-- Localizador de pedido (formato AB-XXXXXX, único entre reservas y pedidos
-- para que el enlace "Mi reserva" sirva para ambos).
-- ---------------------------------------------------------------------
create or replace function public.generate_order_locator()
returns text language plpgsql as $$
declare
  chars text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  code  text;
  i     int;
begin
  loop
    code := '';
    for i in 1..2 loop code := code || substr(chars, floor(random()*length(chars))::int + 1, 1); end loop;
    code := code || '-';
    for i in 1..6 loop code := code || substr(chars, floor(random()*length(chars))::int + 1, 1); end loop;
    exit when not exists (select 1 from public.orders where locator = code)
          and not exists (select 1 from public.bookings where locator = code);
  end loop;
  return code;
end $$;

-- ---------------------------------------------------------------------
-- Huecos de recogida de un día. Respeta: horario de recogida, margen de
-- preparación, antelación máxima, bloqueos del negocio y pedidos máximos por franja.
-- ---------------------------------------------------------------------
create or replace function public.get_takeaway_slots(p_business_id uuid, p_date date)
returns table (slot_start timestamptz)
language plpgsql stable security definer set search_path = public
as $$
declare
  v_tz   text;
  v_ok   boolean;
  v_acc  boolean;
  v_prep int;
  v_step int;
  v_max  int;
  v_adv  int;
begin
  select b.timezone, (b.is_active and b.online_orders) into v_tz, v_ok
  from businesses b where b.id = p_business_id;
  if not found or not v_ok then return; end if;

  select s.accepting, s.prep_minutes, s.slot_interval_min, s.max_orders_per_slot, s.max_advance_days
    into v_acc, v_prep, v_step, v_max, v_adv
  from takeaway_settings s where s.business_id = p_business_id;
  if not found or not v_acc then return; end if;

  return query
  with win as (
    select extract(epoch from h.start_time)::int / 60 as s,
           extract(epoch from h.end_time)::int / 60   as e
    from takeaway_hours h
    where h.business_id = p_business_id and h.weekday = extract(dow from p_date)::int
  ),
  cand as (
    select distinct (p_date::timestamp + make_interval(mins => gs)) at time zone v_tz as t
    from win cross join lateral generate_series(win.s, win.e - v_step, v_step) gs
  )
  select c.t
  from cand c
  where c.t >= now() + make_interval(mins => v_prep)
    and c.t <= now() + make_interval(days => v_adv)
    and not exists (
      select 1 from blocks bl
      where bl.business_id = p_business_id and bl.scope = 'business'
        and bl.starts_at <= c.t and bl.ends_at > c.t
    )
    and (v_max is null or (
      select count(*) from orders o
      where o.business_id = p_business_id and o.status <> 'cancelado' and o.pickup_at = c.t
    ) < v_max)
  order by c.t;
end $$;

-- Días del rango con al menos un hueco (para no mostrar fechas vacías).
create or replace function public.get_takeaway_days(p_business_id uuid, p_date_from date, p_date_to date)
returns table (day date)
language sql stable security definer set search_path = public
as $$
  select d::date
  from generate_series(p_date_from, p_date_to, interval '1 day') d
  where p_date_to - p_date_from <= 62
    and exists (select 1 from public.get_takeaway_slots(p_business_id, d::date))
$$;

-- ---------------------------------------------------------------------
-- Carta pública en una sola llamada (jsonb): ajustes + categorías > platos > extras.
-- Devuelve null si el negocio no existe, está inactivo o no tiene pedidos online.
-- ---------------------------------------------------------------------
create or replace function public.get_public_menu(p_business_id uuid)
returns jsonb
language sql stable security definer set search_path = public
as $$
  select case when b.id is null then null else jsonb_build_object(
    'accepting', coalesce(ts.accepting, false),
    'min_order_amount', coalesce(ts.min_order_amount, 0),
    'prep_minutes', coalesce(ts.prep_minutes, 0),
    'max_advance_days', coalesce(ts.max_advance_days, 7),
    'categories', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', c.id, 'name', c.name,
        'items', coalesce((
          select jsonb_agg(jsonb_build_object(
            'id', i.id, 'name', i.name, 'description', i.description, 'price', i.price,
            'allergens', to_jsonb(i.allergens), 'is_available', i.is_available,
            'groups', coalesce((
              select jsonb_agg(jsonb_build_object(
                'id', g.id, 'name', g.name, 'min_choices', g.min_choices, 'max_choices', g.max_choices,
                'modifiers', coalesce((
                  select jsonb_agg(jsonb_build_object(
                    'id', m.id, 'name', m.name, 'price_delta', m.price_delta, 'is_available', m.is_available
                  ) order by m.sort_order, m.name)
                  from menu_modifiers m where m.group_id = g.id
                ), '[]'::jsonb)
              ) order by l.sort_order, g.sort_order, g.name)
              from menu_item_modifier_groups l
              join menu_modifier_groups g on g.id = l.group_id
              where l.item_id = i.id
            ), '[]'::jsonb)
          ) order by i.sort_order, i.name)
          from menu_items i where i.category_id = c.id and i.is_active
        ), '[]'::jsonb)
      ) order by c.sort_order, c.name)
      from menu_categories c where c.business_id = p_business_id and c.is_active
    ), '[]'::jsonb)
  ) end
  from (select 1) d
  left join businesses b on b.id = p_business_id and b.is_active and b.online_orders
  left join takeaway_settings ts on ts.business_id = b.id
$$;

-- ---------------------------------------------------------------------
-- Crear pedido (solo service_role: la llama la Edge Function create-order).
-- Los precios SIEMPRE se calculan aquí desde la carta; el cliente solo manda
-- ids y cantidades. p_items = [{"item_id","quantity","modifier_ids":[],"notes"}]
-- ---------------------------------------------------------------------
create or replace function public.create_public_order(
  p_business_id uuid,
  p_pickup_at   timestamptz,
  p_items       jsonb,
  p_name        text,
  p_last_name   text,
  p_phone       text,
  p_email       text,
  p_notes       text default null
) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_tz      text;
  v_ok      boolean;
  v_acc     boolean;
  v_min     numeric;
  v_email   text := nullif(btrim(coalesce(p_email, '')), '');
  v_cust    uuid;
  v_locator text;
  v_order   public.orders;
  v_total   numeric(10,2) := 0;
  v_n       int := 0;
  it        jsonb;
  v_item    record;
  v_grp     record;
  v_qty     int;
  v_mods_in uuid[];
  v_unit    numeric(10,2);
  v_mods    jsonb;
  v_cnt     int;
begin
  select timezone, (is_active and online_orders) into v_tz, v_ok from businesses where id = p_business_id;
  if not found or not v_ok then raise exception 'Este negocio no admite pedidos online'; end if;

  select accepting, min_order_amount into v_acc, v_min from takeaway_settings where business_id = p_business_id;
  if not found or not v_acc then raise exception 'El negocio no está aceptando pedidos ahora mismo'; end if;

  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) not between 1 and 40 then
    raise exception 'Tu pedido está vacío o es demasiado grande';
  end if;

  perform pg_advisory_xact_lock(hashtext('order:' || p_business_id::text));

  if not exists (
    select 1 from public.get_takeaway_slots(p_business_id, (p_pickup_at at time zone v_tz)::date) s
    where s.slot_start = p_pickup_at
  ) then
    raise exception 'La hora de recogida elegida ya no está disponible';
  end if;

  if public.normalize_phone(p_phone) is not null then
    insert into public.customers (business_id, full_name, last_name, phone, email)
    values (p_business_id, p_name, p_last_name, p_phone, v_email)
    on conflict (business_id, phone_norm) where phone_norm is not null do update
      set email      = coalesce(public.customers.email, excluded.email),
          updated_at = now()
    returning id into v_cust;
  else
    insert into public.customers (business_id, full_name, last_name, phone, email)
    values (p_business_id, p_name, p_last_name, p_phone, v_email)
    returning id into v_cust;
  end if;

  v_locator := public.generate_order_locator();

  insert into public.orders (
    business_id, locator, status, customer_id, customer_name, customer_last_name,
    customer_phone, customer_email, notes, pickup_at, total
  ) values (
    p_business_id, v_locator, 'nuevo', v_cust, p_name, p_last_name,
    p_phone, v_email, nullif(btrim(coalesce(p_notes, '')), ''), p_pickup_at, 0
  ) returning * into v_order;

  for it in select * from jsonb_array_elements(p_items) loop
    v_n := v_n + 1;
    v_qty := (it ->> 'quantity')::int;
    if v_qty is null or v_qty not between 1 and 50 then raise exception 'Cantidad no válida en el pedido'; end if;

    select mi.id, mi.name, mi.price, mi.is_available into v_item
    from menu_items mi
    where mi.id = (it ->> 'item_id')::uuid and mi.business_id = p_business_id and mi.is_active;
    if not found then raise exception 'Un producto de tu pedido ya no está en la carta'; end if;
    if not v_item.is_available then raise exception '«%» está agotado ahora mismo', v_item.name; end if;

    select coalesce(array_agg(x::uuid), '{}'::uuid[]) into v_mods_in
    from jsonb_array_elements_text(coalesce(it -> 'modifier_ids', '[]'::jsonb)) x;

    -- Todos los extras elegidos deben existir, estar disponibles y pertenecer a un grupo del plato.
    select count(*) into v_cnt
    from menu_modifiers m
    join menu_item_modifier_groups l on l.group_id = m.group_id and l.item_id = v_item.id
    where m.id = any(v_mods_in) and m.business_id = p_business_id and m.is_available;
    if v_cnt <> coalesce(array_length(v_mods_in, 1), 0) then
      raise exception 'Una opción elegida para «%» ya no está disponible', v_item.name;
    end if;

    -- Mínimo/máximo de elecciones por grupo.
    for v_grp in
      select g.id, g.name, g.min_choices, g.max_choices
      from menu_item_modifier_groups l join menu_modifier_groups g on g.id = l.group_id
      where l.item_id = v_item.id
    loop
      select count(*) into v_cnt from menu_modifiers m where m.group_id = v_grp.id and m.id = any(v_mods_in);
      if v_cnt < v_grp.min_choices then
        raise exception 'Elige una opción en «%» para «%»', v_grp.name, v_item.name;
      end if;
      if v_cnt > v_grp.max_choices then
        raise exception 'Demasiadas opciones en «%» para «%»', v_grp.name, v_item.name;
      end if;
    end loop;

    select v_item.price + coalesce(sum(m.price_delta), 0),
           coalesce(jsonb_agg(jsonb_build_object('name', m.name, 'price_delta', m.price_delta) order by m.sort_order, m.name), '[]'::jsonb)
      into v_unit, v_mods
    from menu_modifiers m where m.id = any(v_mods_in);

    insert into public.order_items (order_id, item_id, name, quantity, unit_price, modifiers, notes, line_total, sort_order)
    values (
      v_order.id, v_item.id, v_item.name, v_qty, v_unit, v_mods,
      nullif(left(btrim(coalesce(it ->> 'notes', '')), 200), ''), v_unit * v_qty, v_n
    );
    v_total := v_total + v_unit * v_qty;
  end loop;

  if v_total < coalesce(v_min, 0) then
    raise exception 'El pedido mínimo es de % €', to_char(v_min, 'FM999990.00');
  end if;

  update public.orders set total = v_total where id = v_order.id returning * into v_order;

  return jsonb_build_object(
    'id', v_order.id, 'locator', v_order.locator, 'status', v_order.status,
    'pickup_at', v_order.pickup_at, 'total', v_order.total
  );
end $$;

revoke all on function public.create_public_order(uuid, timestamptz, jsonb, text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.create_public_order(uuid, timestamptz, jsonb, text, text, text, text, text) to service_role;

-- ---------------------------------------------------------------------
-- Consultar / cancelar un pedido por localizador (el cliente, anónimo)
-- ---------------------------------------------------------------------
create or replace function public.get_order_by_locator(p_locator text)
returns jsonb
language sql stable security definer set search_path = public
as $$
  select jsonb_build_object(
    'locator', o.locator, 'status', o.status, 'pickup_at', o.pickup_at, 'total', o.total,
    'customer_name', o.customer_name, 'notes', o.notes,
    'business_name', b.name, 'primary_color', b.primary_color, 'logo_url', b.logo_url, 'timezone', b.timezone,
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'name', i.name, 'quantity', i.quantity, 'line_total', i.line_total,
        'modifiers', i.modifiers, 'notes', i.notes
      ) order by i.sort_order)
      from order_items i where i.order_id = o.id
    ), '[]'::jsonb)
  )
  from orders o join businesses b on b.id = o.business_id
  where upper(o.locator) = upper(btrim(p_locator))
$$;

create or replace function public.cancel_order_by_locator(p_locator text)
returns boolean
language plpgsql security definer set search_path = public
as $$
declare v_id uuid; v_status text;
begin
  select id, status into v_id, v_status from orders where upper(locator) = upper(btrim(p_locator));
  if not found then return false; end if;
  if v_status = 'cancelado' then return true; end if;
  if v_status <> 'nuevo' then
    raise exception 'Tu pedido ya está en marcha; llama al local si necesitas cancelarlo';
  end if;
  update orders set status = 'cancelado' where id = v_id;
  return true;
end $$;

-- ---------------------------------------------------------------------
-- get_public_business: + online_orders (cambia el tipo de retorno -> drop + create)
-- ---------------------------------------------------------------------
drop function if exists public.get_public_business(text);
create function public.get_public_business(p_slug text)
returns table (
  id uuid, name text, type business_type, primary_color text, logo_url text,
  timezone text, slot_interval_min int, order_mode boolean, online_orders boolean
)
language sql stable security definer set search_path = public
as $$
  select id, name, type, primary_color, logo_url, timezone, slot_interval_min, order_mode, online_orders
  from businesses where slug = p_slug and is_active
$$;

-- Nuevas RPCs: nada para PUBLIC; lectura pública solo para anon/authenticated.
revoke all on function public.generate_order_locator() from public, anon, authenticated;
grant execute on function public.generate_order_locator() to service_role;

revoke all on function public.get_takeaway_slots(uuid, date), public.get_takeaway_days(uuid, date, date),
  public.get_public_menu(uuid), public.get_order_by_locator(text), public.cancel_order_by_locator(text),
  public.get_public_business(text)
  from public;
grant execute on function public.get_takeaway_slots(uuid, date), public.get_takeaway_days(uuid, date, date),
  public.get_public_menu(uuid), public.get_order_by_locator(text), public.cancel_order_by_locator(text),
  public.get_public_business(text)
  to anon, authenticated;
