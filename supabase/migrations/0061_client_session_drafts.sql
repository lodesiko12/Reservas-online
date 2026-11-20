-- Borradores de notas de sesión (psicología): se guardan mientras la profesional escribe,
-- para no perder nada si se apaga la pantalla, cambia de pestaña o recarga.
-- Un borrador por (cita, autor); se borra al guardar la sesión definitiva.
create table public.client_session_drafts (
  booking_id     uuid not null references public.bookings(id) on delete cascade,
  author_user_id uuid not null references auth.users(id) on delete cascade,
  business_id    uuid not null references public.businesses(id) on delete cascade,
  objetivo       text not null default '',
  notas          text not null default '',
  seguimiento    text not null default '',
  tareas_pautas  text not null default '',
  updated_at     timestamptz not null default now(),
  primary key (booking_id, author_user_id)
);

create index client_session_drafts_business_idx on public.client_session_drafts (business_id);

alter table public.client_session_drafts enable row level security;

-- Solo el autor ve y toca su borrador, y solo si sigue siendo miembro del negocio.
create policy client_session_drafts_own on public.client_session_drafts
  for all to authenticated
  using (author_user_id = auth.uid() and public.is_business_member(business_id))
  with check (author_user_id = auth.uid() and public.is_business_member(business_id));
