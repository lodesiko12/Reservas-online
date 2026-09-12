-- =====================================================================
-- 0008_customer_phone_normalization.sql
-- Agrupa clientes por TELÉFONO NORMALIZADO, de modo que el mismo número
-- escrito con distinto formato (espacios, prefijo +34/0034, etc.) se
-- considere el MISMO cliente aunque el nombre venga escrito de otra forma.
--
-- Decisiones de producto:
--   * El nombre de la ficha NO se modifica una vez creada (se conserva el
--     de la primera reserva). Reservas posteriores solo rellenan el email
--     si estaba vacío.
--   * Prefijo por defecto para números nacionales sin prefijo: +34 (España).
-- =====================================================================

-- ---------------------------------------------------------------------
-- Normalizador de teléfono
--   "+34 600 000 000" / "600000000" / "600 00 00 00" / "0034600000000"
--   -> "+34600000000"
-- ---------------------------------------------------------------------
create or replace function public.normalize_phone(p text)
returns text
language plpgsql
immutable
as $$
declare
  s        text;
  has_plus boolean;
begin
  if p is null then return null; end if;
  -- Deja solo dígitos y el signo '+'
  s := regexp_replace(p, '[^0-9+]', '', 'g');
  -- Conserva el '+' solo si iba delante; elimina cualquier otro
  has_plus := left(s, 1) = '+';
  s := replace(s, '+', '');
  if s = '' then return null; end if;
  if has_plus then s := '+' || s; end if;

  if left(s, 4) = '0034' then
    s := '+34' || substr(s, 5);                       -- 0034... -> +34...
  elsif s !~ '^\+' and left(s, 2) = '34' and length(s) = 11 then
    s := '+' || s;                                    -- 34XXXXXXXXX -> +34...
  elsif s !~ '^\+' and length(s) = 9 then
    s := '+34' || s;                                  -- nacional 9 dígitos -> +34
  end if;

  return s;
end $$;

-- ---------------------------------------------------------------------
-- Columna normalizada + relleno inicial
-- ---------------------------------------------------------------------
alter table public.customers
  add column if not exists phone_norm text;

update public.customers
  set phone_norm = public.normalize_phone(phone)
  where phone_norm is distinct from public.normalize_phone(phone);

-- ---------------------------------------------------------------------
-- Fusión de clientes ya duplicados (mismo negocio + mismo teléfono
-- normalizado). Se conserva el más antiguo; sus reservas se reapuntan.
-- ---------------------------------------------------------------------
with grp as (
  select id,
         first_value(id) over (
           partition by business_id, phone_norm
           order by created_at, id
         ) as keep_id
  from public.customers
  where phone_norm is not null
),
dups as (
  select id, keep_id from grp where id <> keep_id
)
update public.bookings b
   set customer_id = d.keep_id
  from dups d
 where b.customer_id = d.id;

with grp as (
  select id,
         first_value(id) over (
           partition by business_id, phone_norm
           order by created_at, id
         ) as keep_id
  from public.customers
  where phone_norm is not null
),
dups as (
  select id from grp where id <> keep_id
)
delete from public.customers c using dups d where c.id = d.id;

-- Recalcula contadores de los clientes que sobreviven
do $$
declare r record;
begin
  for r in select id from public.customers loop
    perform public.recount_customer(r.id);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- Índice único por teléfono NORMALIZADO (sustituye al de teléfono crudo)
-- ---------------------------------------------------------------------
drop index if exists public.uq_customers_business_phone;
create unique index if not exists uq_customers_business_phone_norm
  on public.customers(business_id, phone_norm) where phone_norm is not null;

-- ---------------------------------------------------------------------
-- Mantiene phone_norm sincronizado en cualquier alta/edición de cliente
-- ---------------------------------------------------------------------
create or replace function public.trg_set_phone_norm()
returns trigger language plpgsql as $$
begin
  new.phone_norm := public.normalize_phone(new.phone);
  return new;
end $$;

drop trigger if exists trg_customers_phone_norm on public.customers;
create trigger trg_customers_phone_norm
  before insert or update of phone on public.customers
  for each row execute function public.trg_set_phone_norm();

-- =====================================================================
-- RPCs de creación de reserva: upsert por teléfono normalizado.
-- El nombre NO se sobrescribe; el email solo se rellena si faltaba.
-- (Firmas idénticas a las versiones previas: no cambia la Edge Function
--  ni las llamadas del panel.)
-- =====================================================================

-- ---- Citas -----------------------------------------------------------
create or replace function public.create_public_booking(
  p_business_id uuid,
  p_service_id  uuid,
  p_starts_at   timestamptz,
  p_name        text,
  p_last_name   text,
  p_phone       text,
  p_email       text,
  p_notes       text default null,
  p_channel     booking_channel default 'web'
) returns public.bookings
language plpgsql security definer set search_path = public
as $$
declare
  v_dur int; v_prof uuid; v_ends timestamptz; v_active boolean;
  v_tz text; v_cust uuid; v_locator text; v_row public.bookings; v_ok boolean;
begin
  select is_active, timezone into v_active, v_tz from businesses where id = p_business_id;
  if not coalesce(v_active, false) then raise exception 'Negocio no disponible'; end if;

  select duration_min, professional_id into v_dur, v_prof
  from services where id = p_service_id and business_id = p_business_id and is_active;
  if not found then raise exception 'Servicio no válido'; end if;
  v_ends := p_starts_at + make_interval(mins => v_dur);

  -- Serializa la creación por negocio para evitar dobles reservas concurrentes.
  perform pg_advisory_xact_lock(hashtext(p_business_id::text));

  select exists (
    select 1 from public.get_available_slots(
      p_business_id, p_service_id, (p_starts_at at time zone v_tz)::date
    ) s where s.slot_start = p_starts_at
  ) into v_ok;
  if not v_ok then raise exception 'El horario seleccionado ya no está disponible'; end if;

  if public.normalize_phone(p_phone) is not null then
    insert into public.customers (business_id, full_name, last_name, phone, email)
    values (p_business_id, p_name, p_last_name, p_phone, p_email)
    on conflict (business_id, phone_norm) where phone_norm is not null do update
      set email      = coalesce(public.customers.email, excluded.email),
          updated_at = now()
    returning id into v_cust;
  else
    insert into public.customers (business_id, full_name, last_name, phone, email)
    values (p_business_id, p_name, p_last_name, p_phone, p_email)
    returning id into v_cust;
  end if;

  v_locator := public.generate_locator();

  insert into public.bookings (
    business_id, type, service_id, professional_id, starts_at, ends_at,
    customer_id, customer_name, customer_last_name, customer_phone, customer_email,
    locator, status, channel, notes
  ) values (
    p_business_id, 'citas', p_service_id, v_prof, p_starts_at, v_ends,
    v_cust, p_name, p_last_name, p_phone, p_email,
    v_locator, 'confirmada', p_channel, p_notes
  ) returning * into v_row;

  return v_row;
end $$;

-- ---- Restaurante -----------------------------------------------------
create or replace function public.create_public_dining_booking(
  p_business_id uuid,
  p_shift_id    uuid,
  p_starts_at   timestamptz,
  p_party_size  int,
  p_name        text,
  p_last_name   text,
  p_phone       text,
  p_email       text,
  p_notes       text default null,
  p_channel     booking_channel default 'web'
) returns public.bookings
language plpgsql security definer set search_path = public
as $$
declare
  v_active boolean; v_tz text; v_dur int; v_ends timestamptz;
  v_cust uuid; v_locator text; v_row public.bookings; v_ok boolean;
begin
  select is_active, timezone into v_active, v_tz from businesses where id = p_business_id;
  if not coalesce(v_active, false) then raise exception 'Negocio no disponible'; end if;
  if p_party_size is null or p_party_size < 1 then raise exception 'Número de comensales no válido'; end if;

  select booking_duration_min into v_dur
  from dining_shifts where id = p_shift_id and business_id = p_business_id and is_active;
  if not found then raise exception 'Franja no válida'; end if;
  v_ends := p_starts_at + make_interval(mins => v_dur);

  perform pg_advisory_xact_lock(hashtext(p_business_id::text));

  select exists (
    select 1 from public.get_available_dining_slots(
      p_business_id, (p_starts_at at time zone v_tz)::date, p_party_size
    ) s where s.slot_start = p_starts_at and s.shift_id = p_shift_id
  ) into v_ok;
  if not v_ok then raise exception 'No hay aforo para ese número de comensales en ese horario'; end if;

  if public.normalize_phone(p_phone) is not null then
    insert into public.customers (business_id, full_name, last_name, phone, email)
    values (p_business_id, p_name, p_last_name, p_phone, p_email)
    on conflict (business_id, phone_norm) where phone_norm is not null do update
      set email      = coalesce(public.customers.email, excluded.email),
          updated_at = now()
    returning id into v_cust;
  else
    insert into public.customers (business_id, full_name, last_name, phone, email)
    values (p_business_id, p_name, p_last_name, p_phone, p_email)
    returning id into v_cust;
  end if;

  v_locator := public.generate_locator();

  insert into public.bookings (
    business_id, type, dining_shift_id, party_size, starts_at, ends_at,
    customer_id, customer_name, customer_last_name, customer_phone, customer_email,
    locator, status, channel, notes
  ) values (
    p_business_id, 'restaurante', p_shift_id, p_party_size, p_starts_at, v_ends,
    v_cust, p_name, p_last_name, p_phone, p_email,
    v_locator, 'confirmada', p_channel, p_notes
  ) returning * into v_row;

  return v_row;
end $$;

-- ---------------------------------------------------------------------
-- Permisos (idénticos a los previos)
-- ---------------------------------------------------------------------
grant execute on function public.create_public_booking(uuid,uuid,timestamptz,text,text,text,text,text,booking_channel)
  to authenticated, service_role;
grant execute on function public.create_public_dining_booking(uuid,uuid,timestamptz,int,text,text,text,text,text,booking_channel)
  to authenticated, service_role;
revoke execute on function public.create_public_dining_booking(uuid,uuid,timestamptz,int,text,text,text,text,text,booking_channel)
  from public, anon;
