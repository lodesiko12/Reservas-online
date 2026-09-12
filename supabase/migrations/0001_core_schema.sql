-- =====================================================================
-- 0001_core_schema.sql
-- Esquema base del SaaS multi-tenant de reservas.
-- Convención de weekday: 0=Domingo .. 6=Sábado (coincide con EXTRACT(DOW)).
-- Todas las horas de negocio se guardan como `time` y se interpretan
-- en la timezone del negocio (businesses.timezone).
-- =====================================================================

create extension if not exists "pgcrypto";      -- gen_random_uuid()
create extension if not exists "pg_trgm";        -- búsquedas de clientes

-- ---------------------------------------------------------------------
-- Tipos
-- ---------------------------------------------------------------------
do $$ begin
  create type business_type       as enum ('citas', 'restaurante');
exception when duplicate_object then null; end $$;

do $$ begin
  create type booking_status      as enum ('confirmada', 'cancelada', 'completada', 'no_show');
exception when duplicate_object then null; end $$;

do $$ begin
  create type booking_channel     as enum ('web', 'manual');
exception when duplicate_object then null; end $$;

do $$ begin
  create type block_scope         as enum ('business', 'professional');
exception when duplicate_object then null; end $$;

do $$ begin
  create type business_user_role  as enum ('owner', 'staff');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------
-- profiles  (extensión de auth.users; marca el super-admin de la plataforma)
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id             uuid primary key references auth.users(id) on delete cascade,
  full_name      text,
  is_super_admin boolean not null default false,
  created_at     timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- businesses (tenants)
-- ---------------------------------------------------------------------
create table if not exists public.businesses (
  id                          uuid primary key default gen_random_uuid(),
  name                        text not null,
  slug                        text not null unique,
  type                        business_type not null,
  is_active                   boolean not null default true,
  primary_color               text not null default '#4f46e5',
  logo_url                    text,
  timezone                    text not null default 'Europe/Madrid',
  whatsapp_phone              text,
  whatsapp_reminders_enabled  boolean not null default false,
  reminder_template_name      text,
  reminder_lang               text not null default 'es',
  -- concurrencia por defecto para servicios de tipo "citas" sin profesional asignado
  default_capacity            int not null default 1 check (default_capacity > 0),
  slot_interval_min           int not null default 15 check (slot_interval_min > 0),
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now()
);
create index if not exists idx_businesses_active on public.businesses(is_active);

-- ---------------------------------------------------------------------
-- business_users (staff con acceso al panel del negocio)
-- ---------------------------------------------------------------------
create table if not exists public.business_users (
  id           uuid primary key default gen_random_uuid(),
  business_id  uuid not null references public.businesses(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  role         business_user_role not null default 'staff',
  created_at   timestamptz not null default now(),
  unique (business_id, user_id)
);
create index if not exists idx_business_users_user on public.business_users(user_id);
create index if not exists idx_business_users_business on public.business_users(business_id);

-- ---------------------------------------------------------------------
-- professionals (solo tipo citas)
-- ---------------------------------------------------------------------
create table if not exists public.professionals (
  id           uuid primary key default gen_random_uuid(),
  business_id  uuid not null references public.businesses(id) on delete cascade,
  name         text not null,
  is_active    boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists idx_professionals_business on public.professionals(business_id);

-- Horario de trabajo del profesional (varias franjas por día permitidas)
create table if not exists public.professional_hours (
  id              uuid primary key default gen_random_uuid(),
  professional_id uuid not null references public.professionals(id) on delete cascade,
  weekday         int not null check (weekday between 0 and 6),
  start_time      time not null,
  end_time        time not null,
  check (end_time > start_time)
);
create index if not exists idx_prof_hours_prof on public.professional_hours(professional_id);

-- ---------------------------------------------------------------------
-- services (solo tipo citas)
-- ---------------------------------------------------------------------
create table if not exists public.services (
  id              uuid primary key default gen_random_uuid(),
  business_id     uuid not null references public.businesses(id) on delete cascade,
  name            text not null,
  duration_min    int not null check (duration_min > 0),
  buffer_min      int not null default 0 check (buffer_min >= 0),
  professional_id uuid references public.professionals(id) on delete set null,
  price           numeric(10,2),
  is_active       boolean not null default true,
  sort_order      int not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists idx_services_business on public.services(business_id);

-- Disponibilidad propia del servicio (días/franjas en que se puede reservar).
-- Si un servicio no tiene ninguna fila aquí, se asume disponible en todo el
-- horario de apertura del negocio.
create table if not exists public.service_availability (
  id          uuid primary key default gen_random_uuid(),
  service_id  uuid not null references public.services(id) on delete cascade,
  weekday     int not null check (weekday between 0 and 6),
  start_time  time not null,
  end_time    time not null,
  check (end_time > start_time)
);
create index if not exists idx_service_avail_service on public.service_availability(service_id);

-- ---------------------------------------------------------------------
-- business_hours (horario general de apertura del negocio)
-- ---------------------------------------------------------------------
create table if not exists public.business_hours (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  weekday     int not null check (weekday between 0 and 6),
  open_time   time not null,
  close_time  time not null,
  check (close_time > open_time)
);
create index if not exists idx_business_hours_business on public.business_hours(business_id);

-- ---------------------------------------------------------------------
-- dining_shifts (solo tipo restaurante): franjas de servicio con aforo
-- ---------------------------------------------------------------------
create table if not exists public.dining_shifts (
  id               uuid primary key default gen_random_uuid(),
  business_id      uuid not null references public.businesses(id) on delete cascade,
  name             text not null,                 -- p.ej. "Comida", "Cena"
  start_time       time not null,
  end_time         time not null,
  max_covers       int not null check (max_covers > 0),   -- aforo (comensales) por franja
  slot_interval_min int not null default 15 check (slot_interval_min > 0),
  active_weekdays  int[] not null default '{0,1,2,3,4,5,6}',
  is_active        boolean not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  check (end_time > start_time)
);
create index if not exists idx_dining_shifts_business on public.dining_shifts(business_id);

-- ---------------------------------------------------------------------
-- customers (histórico por negocio)
-- ---------------------------------------------------------------------
create table if not exists public.customers (
  id             uuid primary key default gen_random_uuid(),
  business_id    uuid not null references public.businesses(id) on delete cascade,
  full_name      text not null,
  last_name      text,
  phone          text,
  email          text,
  bookings_count int not null default 0,
  no_show_count  int not null default 0,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create unique index if not exists uq_customers_business_phone
  on public.customers(business_id, phone) where phone is not null;
create index if not exists idx_customers_business on public.customers(business_id);
create index if not exists idx_customers_name_trgm on public.customers using gin (full_name gin_trgm_ops);

-- ---------------------------------------------------------------------
-- bookings
-- ---------------------------------------------------------------------
create table if not exists public.bookings (
  id              uuid primary key default gen_random_uuid(),
  business_id     uuid not null references public.businesses(id) on delete cascade,
  type            business_type not null,
  -- citas:
  service_id      uuid references public.services(id) on delete set null,
  professional_id uuid references public.professionals(id) on delete set null,
  -- restaurante:
  dining_shift_id uuid references public.dining_shifts(id) on delete set null,
  party_size      int check (party_size > 0),
  -- comunes:
  starts_at       timestamptz not null,
  ends_at         timestamptz not null,
  customer_id     uuid references public.customers(id) on delete set null,
  customer_name   text not null,
  customer_last_name text,
  customer_phone  text,
  customer_email  text,
  locator         text not null unique,
  status          booking_status not null default 'confirmada',
  channel         booking_channel not null default 'web',
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  check (ends_at > starts_at)
);
create index if not exists idx_bookings_business_time on public.bookings(business_id, starts_at);
create index if not exists idx_bookings_professional_time on public.bookings(professional_id, starts_at);
create index if not exists idx_bookings_shift_time on public.bookings(dining_shift_id, starts_at);
create index if not exists idx_bookings_status on public.bookings(status);
create index if not exists idx_bookings_customer on public.bookings(customer_id);

-- ---------------------------------------------------------------------
-- blocks (bloqueos de agenda)
-- ---------------------------------------------------------------------
create table if not exists public.blocks (
  id               uuid primary key default gen_random_uuid(),
  business_id      uuid not null references public.businesses(id) on delete cascade,
  scope            block_scope not null default 'business',
  professional_id  uuid references public.professionals(id) on delete cascade,
  starts_at        timestamptz not null,
  ends_at          timestamptz not null,
  reason           text,
  cancels_affected boolean not null default false,
  created_at       timestamptz not null default now(),
  check (ends_at > starts_at)
);
create index if not exists idx_blocks_business_time on public.blocks(business_id, starts_at);

-- ---------------------------------------------------------------------
-- whatsapp_reminders_log (evita envíos duplicados)
-- ---------------------------------------------------------------------
create table if not exists public.whatsapp_reminders_log (
  id                  uuid primary key default gen_random_uuid(),
  booking_id          uuid not null references public.bookings(id) on delete cascade,
  business_id         uuid not null references public.businesses(id) on delete cascade,
  reminder_kind       text not null default '24h',
  status              text not null default 'sent',   -- sent | failed
  provider_message_id text,
  error               text,
  sent_at             timestamptz not null default now(),
  unique (booking_id, reminder_kind)
);
create index if not exists idx_wa_log_business on public.whatsapp_reminders_log(business_id);
