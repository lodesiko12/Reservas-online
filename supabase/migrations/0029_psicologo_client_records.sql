-- =====================================================================
-- 0029_psicologo_client_records.sql
-- Ficha de cliente ampliada para negocios tipo `psicologo` (Fase 9):
-- notas de sesión, tareas/pautas, informes generados por IA (Gemini,
-- credencial propia por negocio) y un campo NIF/NIE opcional para el
-- recibo en PDF. Gateado en el frontend por business.type === 'psicologo'
-- (primera feature real con ese check); a nivel de base de datos estas
-- tablas no tienen restricción de tipo, mismo criterio que el resto del
-- esquema (p.ej. dining_settings no comprueba type='restaurante').
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. customers.nif — opcional, para el recibo en PDF.
-- ---------------------------------------------------------------------
alter table public.customers add column if not exists nif text;

-- ---------------------------------------------------------------------
-- 2. client_notes — notas de sesión (pestaña "Notas" + "Seguimiento").
--    booking_id se rellena cuando la nota viene de "Empezar cita" en
--    Seguimiento; queda null cuando se escribe suelta desde la ficha.
-- ---------------------------------------------------------------------
create table public.client_notes (
  id              uuid primary key default gen_random_uuid(),
  business_id     uuid not null references public.businesses(id) on delete cascade,
  customer_id     uuid not null references public.customers(id) on delete cascade,
  booking_id      uuid references public.bookings(id) on delete set null,
  author_user_id  uuid references auth.users(id) on delete set null,
  body            text not null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

alter table public.client_notes enable row level security;
create policy client_notes_all on public.client_notes for all to authenticated
  using (public.is_business_member(business_id)) with check (public.is_business_member(business_id));

create index client_notes_customer_idx on public.client_notes (customer_id, created_at desc);
create index client_notes_booking_idx on public.client_notes (booking_id) where booking_id is not null;

create trigger trg_client_notes_updated before update on public.client_notes
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- 3. client_tasks — tareas/pautas asignadas al cliente.
-- ---------------------------------------------------------------------
create table public.client_tasks (
  id            uuid primary key default gen_random_uuid(),
  business_id   uuid not null references public.businesses(id) on delete cascade,
  customer_id   uuid not null references public.customers(id) on delete cascade,
  title         text not null,
  description   text,
  status        text not null default 'pendiente' check (status in ('pendiente', 'completada')),
  due_date      date,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

alter table public.client_tasks enable row level security;
create policy client_tasks_all on public.client_tasks for all to authenticated
  using (public.is_business_member(business_id)) with check (public.is_business_member(business_id));

create index client_tasks_customer_idx on public.client_tasks (customer_id, created_at desc);

create trigger trg_client_tasks_updated before update on public.client_tasks
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- 4. client_ai_reports — informes generados por Gemini, persistidos
--    (inmutables: solo insert/select, sin trigger de updated_at).
-- ---------------------------------------------------------------------
create table public.client_ai_reports (
  id                    uuid primary key default gen_random_uuid(),
  business_id           uuid not null references public.businesses(id) on delete cascade,
  customer_id           uuid not null references public.customers(id) on delete cascade,
  generated_by_user_id  uuid references auth.users(id) on delete set null,
  model                 text not null default 'gemini-2.5-flash',
  content               text not null,
  notes_count           int not null default 0,
  tasks_count           int not null default 0,
  created_at            timestamptz not null default now()
);

alter table public.client_ai_reports enable row level security;
create policy client_ai_reports_all on public.client_ai_reports for all to authenticated
  using (public.is_business_member(business_id)) with check (public.is_business_member(business_id));

create index client_ai_reports_customer_idx on public.client_ai_reports (customer_id, created_at desc);

-- ---------------------------------------------------------------------
-- 5. business_integrations.gemini_api_key — SECRETO, columna aditiva.
--    RPCs nuevas y aisladas (no se toca get_business_integration /
--    set_business_integration, para no cambiar la firma de una RPC ya
--    expuesta) — mismo patrón que get_google_credentials_status /
--    set_google_credentials (0021).
-- ---------------------------------------------------------------------
alter table public.business_integrations add column if not exists gemini_api_key text;

create or replace function public.get_gemini_status(p_business_id uuid)
returns table (has_gemini_key boolean)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not public.is_business_member(p_business_id) then raise exception 'No autorizado'; end if;
  return query
  select coalesce(bi.gemini_api_key is not null and length(bi.gemini_api_key) > 0, false)
  from (select p_business_id as id) x
  left join public.business_integrations bi on bi.business_id = x.id;
end $$;

create or replace function public.set_gemini_key(p_business_id uuid, p_api_key text default null)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not public.is_business_member(p_business_id) then raise exception 'No autorizado'; end if;
  insert into public.business_integrations as bi (business_id, gemini_api_key)
  values (p_business_id, nullif(p_api_key, ''))
  on conflict (business_id) do update set
    gemini_api_key = coalesce(nullif(excluded.gemini_api_key, ''), bi.gemini_api_key),
    updated_at     = now();
end $$;

revoke execute on function public.get_gemini_status(uuid) from public, anon;
revoke execute on function public.set_gemini_key(uuid, text) from public, anon;
grant execute on function public.get_gemini_status(uuid) to authenticated;
grant execute on function public.set_gemini_key(uuid, text) to authenticated;
