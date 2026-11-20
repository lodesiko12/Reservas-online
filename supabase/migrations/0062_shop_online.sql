-- =====================================================================
-- 0062 · Tienda online con envío a toda España (shop_mode)
--
-- Todo es ADITIVO y vive en tablas nuevas `shop_*`: no se toca `orders`,
-- `menu_*`, ningún enum ni ninguna RPC existente (los pedidos para llevar y el
-- modo encargo siguen exactamente igual).
--
--   * businesses.shop_mode            interruptor por negocio (por defecto false)
--   * shop_products                   catálogo con precio, peso y stock (null = sin control)
--   * shop_settings                   aceptar pedidos, pedido mínimo, envío gratis desde X
--   * shop_shipping_rates             tarifa por zona y tramo de peso
--   * shop_orders / shop_order_items  pedido con dirección, envío, pago (Stripe, fase 3) y seguimiento
--   * get_public_shop(slug)           catálogo + ajustes + tarifas para el widget (anon)
--   * create_shop_order(...)          SOLO service_role (la llamará la Edge Function):
--                                     recalcula precios, zona y envío en el servidor, reserva stock
--   * trigger de stock                devuelve el stock si un pedido pasa a 'cancelado'
-- =====================================================================

alter table public.businesses add column if not exists shop_mode boolean not null default false;

-- ---------------------------------------------------------------------
-- Catálogo y ajustes
-- ---------------------------------------------------------------------
create table if not exists public.shop_products (
  id           uuid primary key default gen_random_uuid(),
  business_id  uuid not null references public.businesses(id) on delete cascade,
  name         text not null check (char_length(btrim(name)) between 1 and 120),
  description  text check (char_length(description) <= 600),
  category     text check (char_length(category) <= 60),
  price        numeric(8,2) not null check (price >= 0),            -- IVA incluido
  weight_g     int  not null default 0 check (weight_g >= 0),       -- para elegir tarifa de envío
  image_url    text,
  stock        int  check (stock >= 0),                             -- null = sin control de stock
  is_available boolean not null default true,                       -- false = "agotado" (se ve, no se compra)
  is_active    boolean not null default true,                       -- false = oculto
  sort_order   int  not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists idx_shop_products_business on public.shop_products(business_id);

create table if not exists public.shop_settings (
  business_id        uuid primary key references public.businesses(id) on delete cascade,
  accepting          boolean not null default true,                 -- false = pausa de la tienda
  min_order_amount   numeric(8,2) not null default 0 check (min_order_amount >= 0),
  free_shipping_from numeric(8,2) check (free_shipping_from >= 0),  -- null = nunca gratis; solo península
  max_qty_per_line   int not null default 20 check (max_qty_per_line between 1 and 100),
  shipping_note      text check (char_length(shipping_note) <= 400), -- p. ej. "Salidas lunes y martes"
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

-- Tarifa de envío: se aplica la fila de la zona con el menor max_weight_g que cubra el peso del pedido
-- (max_weight_g null = sin límite de peso). Sin fila para la zona/peso => no se envía ahí.
create table if not exists public.shop_shipping_rates (
  id            uuid primary key default gen_random_uuid(),
  business_id   uuid not null references public.businesses(id) on delete cascade,
  zone          text not null check (zone in ('peninsula', 'baleares', 'canarias', 'ceuta_melilla')),
  max_weight_g  int check (max_weight_g > 0),
  price         numeric(8,2) not null check (price >= 0),
  sort_order    int not null default 0
);
create index if not exists idx_shop_shipping_rates_business on public.shop_shipping_rates(business_id, zone);

-- ---------------------------------------------------------------------
-- Pedidos
-- ---------------------------------------------------------------------
create table if not exists public.shop_orders (
  id                 uuid primary key default gen_random_uuid(),
  business_id        uuid not null references public.businesses(id) on delete cascade,
  locator            text not null unique,
  status             text not null default 'pendiente_pago'
                       check (status in ('pendiente_pago', 'pagado', 'preparando', 'enviado', 'entregado', 'cancelado')),
  customer_id        uuid references public.customers(id) on delete set null,
  customer_name      text not null,
  customer_last_name text,
  customer_phone     text not null,
  customer_email     text not null,                                  -- obligatorio: recibo y seguimiento
  notes              text,
  -- dirección de envío
  ship_name          text not null,
  ship_address       text not null,
  ship_postal_code   text not null check (ship_postal_code ~ '^[0-9]{5}$'),
  ship_city          text not null,
  ship_province      text,
  ship_zone          text not null check (ship_zone in ('peninsula', 'baleares', 'canarias', 'ceuta_melilla')),
  -- importes
  subtotal           numeric(10,2) not null check (subtotal >= 0),
  shipping_cost      numeric(8,2)  not null default 0 check (shipping_cost >= 0),
  total              numeric(10,2) not null check (total >= 0),
  -- pago (se rellena en la fase 3)
  payment_method     text not null default 'stripe',
  stripe_session_id  text,
  paid_at            timestamptz,
  -- envío
  carrier            text,
  tracking_number    text,
  shipped_at         timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index if not exists idx_shop_orders_business_created on public.shop_orders(business_id, created_at desc);
create index if not exists idx_shop_orders_business_status on public.shop_orders(business_id, status);
create unique index if not exists idx_shop_orders_stripe_session on public.shop_orders(stripe_session_id) where stripe_session_id is not null;

create table if not exists public.shop_order_items (
  id          uuid primary key default gen_random_uuid(),
  order_id    uuid not null references public.shop_orders(id) on delete cascade,
  product_id  uuid references public.shop_products(id) on delete set null,
  name        text not null,                                         -- snapshot
  quantity    int  not null check (quantity between 1 and 100),
  unit_price  numeric(8,2) not null check (unit_price >= 0),
  weight_g    int  not null default 0,
  line_total  numeric(10,2) not null check (line_total >= 0),
  sort_order  int  not null default 0
);
create index if not exists idx_shop_order_items_order on public.shop_order_items(order_id);

drop trigger if exists trg_shop_products_updated on public.shop_products;
create trigger trg_shop_products_updated before update on public.shop_products
  for each row execute function public.set_updated_at();
drop trigger if exists trg_shop_settings_updated on public.shop_settings;
create trigger trg_shop_settings_updated before update on public.shop_settings
  for each row execute function public.set_updated_at();
drop trigger if exists trg_shop_orders_updated on public.shop_orders;
create trigger trg_shop_orders_updated before update on public.shop_orders
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- RLS: solo miembros del negocio. El widget entra por RPCs SECURITY DEFINER.
-- ---------------------------------------------------------------------
alter table public.shop_products       enable row level security;
alter table public.shop_settings       enable row level security;
alter table public.shop_shipping_rates enable row level security;
alter table public.shop_orders         enable row level security;
alter table public.shop_order_items    enable row level security;

drop policy if exists shop_products_all on public.shop_products;
create policy shop_products_all on public.shop_products for all to authenticated
  using (public.is_business_member(business_id)) with check (public.is_business_member(business_id));
drop policy if exists shop_settings_all on public.shop_settings;
create policy shop_settings_all on public.shop_settings for all to authenticated
  using (public.is_business_member(business_id)) with check (public.is_business_member(business_id));
drop policy if exists shop_shipping_rates_all on public.shop_shipping_rates;
create policy shop_shipping_rates_all on public.shop_shipping_rates for all to authenticated
  using (public.is_business_member(business_id)) with check (public.is_business_member(business_id));
drop policy if exists shop_orders_all on public.shop_orders;
create policy shop_orders_all on public.shop_orders for all to authenticated
  using (public.is_business_member(business_id)) with check (public.is_business_member(business_id));
drop policy if exists shop_order_items_all on public.shop_order_items;
create policy shop_order_items_all on public.shop_order_items for all to authenticated
  using (exists (select 1 from public.shop_orders o where o.id = order_id and public.is_business_member(o.business_id)))
  with check (exists (select 1 from public.shop_orders o where o.id = order_id and public.is_business_member(o.business_id)));

do $$
begin
  if not exists (
    select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'shop_orders'
  ) then
    alter publication supabase_realtime add table public.shop_orders;
  end if;
end $$;

-- ---------------------------------------------------------------------
-- Stock: al cancelar un pedido (cliente, staff o caducidad de pago) se devuelve.
-- ---------------------------------------------------------------------
create or replace function public.shop_restore_stock_on_cancel()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'cancelado' and old.status <> 'cancelado' then
    update public.shop_products p
       set stock = p.stock + i.quantity
      from public.shop_order_items i
     where i.order_id = new.id and i.product_id = p.id and p.stock is not null;
  end if;
  return new;
end $$;

drop trigger if exists trg_shop_orders_restore_stock on public.shop_orders;
create trigger trg_shop_orders_restore_stock after update of status on public.shop_orders
  for each row execute function public.shop_restore_stock_on_cancel();

revoke all on function public.shop_restore_stock_on_cancel() from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- Zona de envío según el código postal español.
-- ---------------------------------------------------------------------
create or replace function public.shop_zone_for_postal(p_postal text)
returns text language plpgsql immutable set search_path = public as $$
declare v_pre text := left(btrim(coalesce(p_postal, '')), 2);
begin
  if btrim(coalesce(p_postal, '')) !~ '^[0-9]{5}$' then
    raise exception 'El código postal no es válido';
  end if;
  if v_pre::int < 1 or v_pre::int > 52 then
    raise exception 'El código postal no es válido';
  end if;
  return case
    when v_pre = '07' then 'baleares'
    when v_pre in ('35', '38') then 'canarias'
    when v_pre in ('51', '52') then 'ceuta_melilla'
    else 'peninsula'
  end;
end $$;

revoke all on function public.shop_zone_for_postal(text) from public, anon, authenticated;
grant execute on function public.shop_zone_for_postal(text) to service_role;

-- ---------------------------------------------------------------------
-- Localizador propio de la tienda (TX-XXXXXX), único entre reservas, pedidos y tienda.
-- ---------------------------------------------------------------------
create or replace function public.generate_shop_locator()
returns text language plpgsql set search_path = public as $$
declare
  chars text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  code  text;
  i     int;
begin
  loop
    code := 'TX-';
    for i in 1..6 loop code := code || substr(chars, floor(random()*length(chars))::int + 1, 1); end loop;
    exit when not exists (select 1 from public.shop_orders where locator = code)
          and not exists (select 1 from public.orders where locator = code)
          and not exists (select 1 from public.bookings where locator = code);
  end loop;
  return code;
end $$;

revoke all on function public.generate_shop_locator() from public, anon, authenticated;
grant execute on function public.generate_shop_locator() to service_role;

-- ---------------------------------------------------------------------
-- Tienda pública en una sola llamada (jsonb). null si no existe / inactiva / sin shop_mode.
-- ---------------------------------------------------------------------
create or replace function public.get_public_shop(p_slug text)
returns jsonb
language sql stable security definer set search_path = public
as $$
  select case when b.id is null then null else jsonb_build_object(
    'business_id', b.id, 'name', b.name, 'primary_color', b.primary_color, 'logo_url', b.logo_url,
    'accepting', coalesce(s.accepting, false),
    'min_order_amount', coalesce(s.min_order_amount, 0),
    'free_shipping_from', s.free_shipping_from,
    'max_qty_per_line', coalesce(s.max_qty_per_line, 20),
    'shipping_note', s.shipping_note,
    'products', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', p.id, 'name', p.name, 'description', p.description, 'category', p.category,
        'price', p.price, 'image_url', p.image_url,
        'in_stock', p.is_available and (p.stock is null or p.stock > 0),
        'stock', p.stock
      ) order by p.sort_order, p.name)
      from shop_products p where p.business_id = b.id and p.is_active
    ), '[]'::jsonb),
    'rates', coalesce((
      select jsonb_agg(jsonb_build_object('zone', r.zone, 'max_weight_g', r.max_weight_g, 'price', r.price)
                       order by r.zone, r.max_weight_g nulls last)
      from shop_shipping_rates r where r.business_id = b.id
    ), '[]'::jsonb)
  ) end
  from (select 1) d
  left join businesses b on b.slug = p_slug and b.is_active and b.shop_mode
  left join shop_settings s on s.business_id = b.id
$$;

revoke all on function public.get_public_shop(text) from public;
grant execute on function public.get_public_shop(text) to anon, authenticated;

-- ---------------------------------------------------------------------
-- Crear pedido de tienda (solo service_role: la llamará la Edge Function de la fase 3).
-- Precios, zona y envío SIEMPRE se calculan aquí. Reserva el stock en el acto; el pedido nace
-- 'pendiente_pago' y, si se cancela (o caduca el pago), el trigger devuelve el stock.
-- p_items = [{"product_id","quantity"}]
-- ---------------------------------------------------------------------
create or replace function public.create_shop_order(
  p_business_id  uuid,
  p_items        jsonb,
  p_name         text,
  p_last_name    text,
  p_phone        text,
  p_email        text,
  p_ship_name    text,
  p_address      text,
  p_postal_code  text,
  p_city         text,
  p_province     text default null,
  p_notes        text default null
) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_ok       boolean;
  v_acc      boolean;
  v_min      numeric;
  v_free     numeric;
  v_maxq     int;
  v_email    text := nullif(btrim(coalesce(p_email, '')), '');
  v_zone     text;
  v_cust     uuid;
  v_order    public.shop_orders;
  v_subtotal numeric(10,2) := 0;
  v_weight   int := 0;
  v_ship     numeric(8,2);
  v_n        int := 0;
  it         jsonb;
  v_prod     record;
  v_qty      int;
begin
  select (is_active and shop_mode) into v_ok from businesses where id = p_business_id;
  if not found or not v_ok then raise exception 'Este negocio no tiene tienda online'; end if;

  select accepting, min_order_amount, free_shipping_from, max_qty_per_line
    into v_acc, v_min, v_free, v_maxq
  from shop_settings where business_id = p_business_id;
  if not found or not v_acc then raise exception 'La tienda no está aceptando pedidos ahora mismo'; end if;

  if v_email is null or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Necesitamos un email válido para enviarte el recibo';
  end if;
  if char_length(btrim(coalesce(p_ship_name, ''))) = 0 or char_length(btrim(coalesce(p_address, ''))) = 0
     or char_length(btrim(coalesce(p_city, ''))) = 0 then
    raise exception 'Faltan datos de la dirección de envío';
  end if;

  v_zone := public.shop_zone_for_postal(p_postal_code);

  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) not between 1 and 40 then
    raise exception 'Tu pedido está vacío o es demasiado grande';
  end if;

  perform pg_advisory_xact_lock(hashtext('shoporder:' || p_business_id::text));

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

  insert into public.shop_orders (
    business_id, locator, status, customer_id, customer_name, customer_last_name, customer_phone,
    customer_email, notes, ship_name, ship_address, ship_postal_code, ship_city, ship_province,
    ship_zone, subtotal, shipping_cost, total
  ) values (
    p_business_id, public.generate_shop_locator(), 'pendiente_pago', v_cust, p_name, p_last_name, p_phone,
    v_email, nullif(btrim(coalesce(p_notes, '')), ''), btrim(p_ship_name), btrim(p_address),
    btrim(p_postal_code), btrim(p_city), nullif(btrim(coalesce(p_province, '')), ''),
    v_zone, 0, 0, 0
  ) returning * into v_order;

  for it in select * from jsonb_array_elements(p_items) loop
    v_n := v_n + 1;
    v_qty := (it ->> 'quantity')::int;
    if v_qty is null or v_qty not between 1 and v_maxq then
      raise exception 'Cantidad no válida (máximo % por producto)', v_maxq;
    end if;

    select p.id, p.name, p.price, p.weight_g, p.is_available, p.stock into v_prod
    from shop_products p
    where p.id = (it ->> 'product_id')::uuid and p.business_id = p_business_id and p.is_active
    for update;
    if not found then raise exception 'Un producto de tu pedido ya no está en la tienda'; end if;
    if not v_prod.is_available then raise exception '«%» está agotado', v_prod.name; end if;
    if v_prod.stock is not null then
      if v_prod.stock < v_qty then
        raise exception 'Solo quedan % unidades de «%»', v_prod.stock, v_prod.name;
      end if;
      update shop_products set stock = stock - v_qty where id = v_prod.id;
    end if;

    insert into public.shop_order_items (order_id, product_id, name, quantity, unit_price, weight_g, line_total, sort_order)
    values (v_order.id, v_prod.id, v_prod.name, v_qty, v_prod.price, v_prod.weight_g, v_prod.price * v_qty, v_n);

    v_subtotal := v_subtotal + v_prod.price * v_qty;
    v_weight   := v_weight + v_prod.weight_g * v_qty;
  end loop;

  if v_subtotal < coalesce(v_min, 0) then
    raise exception 'El pedido mínimo es de % €', to_char(v_min, 'FM999990.00');
  end if;

  -- Envío: gratis (solo península) por importe, o la tarifa de la zona que cubra el peso.
  if v_zone = 'peninsula' and v_free is not null and v_subtotal >= v_free then
    v_ship := 0;
  else
    select r.price into v_ship
    from shop_shipping_rates r
    where r.business_id = p_business_id and r.zone = v_zone
      and (r.max_weight_g is null or r.max_weight_g >= v_weight)
    order by r.max_weight_g nulls last
    limit 1;
    if not found then raise exception 'De momento no enviamos a esa zona con ese peso'; end if;
  end if;

  update public.shop_orders
     set subtotal = v_subtotal, shipping_cost = v_ship, total = v_subtotal + v_ship
   where id = v_order.id returning * into v_order;

  return jsonb_build_object(
    'id', v_order.id, 'locator', v_order.locator, 'status', v_order.status,
    'subtotal', v_order.subtotal, 'shipping_cost', v_order.shipping_cost, 'total', v_order.total,
    'zone', v_order.ship_zone
  );
end $$;

revoke all on function public.create_shop_order(uuid, jsonb, text, text, text, text, text, text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.create_shop_order(uuid, jsonb, text, text, text, text, text, text, text, text, text, text) to service_role;
