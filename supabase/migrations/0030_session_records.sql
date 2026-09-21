-- =====================================================================
-- 0030_session_records.sql
-- Reemplaza client_notes + client_tasks (Fase 9, 0029) por un modelo de
-- "sesión" estructurado con 4 campos (Objetivo, Notas, Seguimiento,
-- Tareas/Pautas), tal como lo pidió el usuario tras ver la primera
-- versión: cada sesión (ligada opcionalmente a una reserva) es un único
-- registro con esos 4 campos, en vez de notas/tareas sueltas sin relación
-- entre sí. Ninguna de las dos tablas antiguas tenía datos reales (solo
-- datos de prueba ya limpiados), así que se eliminan directamente.
-- =====================================================================

drop table if exists public.client_notes;
drop table if exists public.client_tasks;

create table public.client_sessions (
  id             uuid primary key default gen_random_uuid(),
  business_id    uuid not null references public.businesses(id) on delete cascade,
  customer_id    uuid not null references public.customers(id) on delete cascade,
  booking_id     uuid references public.bookings(id) on delete set null,
  author_user_id uuid references auth.users(id) on delete set null,
  objetivo       text,
  notas          text,        -- notas sobre la cita
  seguimiento    text,        -- qué revisar en próximas sesiones
  tareas_pautas  text,        -- ejercicios o pautas para el cliente
  session_date   timestamptz not null default now(),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

alter table public.client_sessions enable row level security;
create policy client_sessions_all on public.client_sessions for all to authenticated
  using (public.is_business_member(business_id)) with check (public.is_business_member(business_id));

create index client_sessions_customer_idx on public.client_sessions (customer_id, session_date desc);
create index client_sessions_booking_idx on public.client_sessions (booking_id) where booking_id is not null;

create trigger trg_client_sessions_updated before update on public.client_sessions
  for each row execute function public.set_updated_at();

-- client_ai_reports: notes_count/tasks_count (por notas+tareas sueltas)
-- ya no tienen sentido con el modelo de sesión; se sustituyen por un
-- único sessions_count.
alter table public.client_ai_reports drop column if exists notes_count;
alter table public.client_ai_reports drop column if exists tasks_count;
alter table public.client_ai_reports add column if not exists sessions_count int not null default 0;
