-- =====================================================================
-- 0015_waitlist_and_reviews.sql
-- Fase 3 (parte 1, sin Stripe): lista de espera con aviso por WhatsApp y
-- petición de reseña post-visita por email. La importación de clientes
-- (CSV) no necesita cambios de esquema: reutiliza el upsert por teléfono
-- normalizado ya existente en `customers`.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Lista de espera
-- ---------------------------------------------------------------------
do $$ begin
  create type public.waitlist_status as enum ('esperando', 'avisado', 'sentado', 'cancelado');
exception when duplicate_object then null; end $$;

create table if not exists public.waitlist (
  id                uuid primary key default gen_random_uuid(),
  business_id       uuid not null references public.businesses(id) on delete cascade,
  name              text not null,
  phone             text,
  party_size        int not null check (party_size > 0),
  notes             text,
  status            waitlist_status not null default 'esperando',
  notified_at       timestamptz,
  seated_booking_id uuid references public.bookings(id) on delete set null,
  created_at        timestamptz not null default now()
);
create index if not exists idx_waitlist_business on public.waitlist(business_id, status);

alter table public.waitlist enable row level security;
drop policy if exists waitlist_all on public.waitlist;
create policy waitlist_all on public.waitlist for all to authenticated
  using (public.is_business_member(business_id)) with check (public.is_business_member(business_id));

-- ---------------------------------------------------------------------
-- Reseñas post-visita: enlace configurable + plantilla de WhatsApp de la
-- lista de espera (mismo patrón que reminder_template_name/reminder_lang).
-- ---------------------------------------------------------------------
alter table public.businesses
  add column if not exists google_review_url text,
  add column if not exists waitlist_template_name text;

create table if not exists public.review_requests_log (
  id                  uuid primary key default gen_random_uuid(),
  booking_id          uuid not null references public.bookings(id) on delete cascade,
  business_id         uuid not null references public.businesses(id) on delete cascade,
  status              text not null default 'sent',
  provider_message_id text,
  error               text,
  sent_at             timestamptz not null default now(),
  unique (booking_id)
);
create index if not exists idx_review_log_business on public.review_requests_log(business_id);

alter table public.review_requests_log enable row level security;
drop policy if exists review_log_select on public.review_requests_log;
create policy review_log_select on public.review_requests_log for select to authenticated
  using (public.is_business_member(business_id));
