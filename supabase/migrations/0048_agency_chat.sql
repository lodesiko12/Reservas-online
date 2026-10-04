-- 0048_agency_chat.sql
-- Chat de la agencia: un grupo GENERAL (toda la agrupación) y un grupo por equipo.
--   * No hay tabla de grupos: cada equipo (agency_teams) es un grupo y el General es team_id null.
--     Los equipos nuevos tienen chat automáticamente y los archivados lo ocultan en la UI.
--   * Mismas reglas de acceso que el resto: General lo leen/escriben todos los miembros activos;
--     el grupo de un equipo solo quien esté en él (la directiva ve todos, como en tareas).
--   * Cada uno solo puede escribir como sí mismo; puede borrar sus mensajes y la directiva
--     cualquiera (moderación). Los mensajes no se editan.
--   * agency_chat_reads guarda hasta dónde ha leído cada usuario en cada grupo (badges de no leídos).

create table public.agency_chat_messages (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  team_id     uuid references public.agency_teams(id) on delete cascade, -- null = General
  author_id   uuid default auth.uid() references auth.users(id) on delete set null,
  body        text not null check (length(btrim(body)) > 0 and length(body) <= 4000),
  created_at  timestamptz not null default now()
);
create index idx_agency_chat_business on public.agency_chat_messages(business_id);
create index idx_agency_chat_scope on public.agency_chat_messages(business_id, team_id, created_at desc);

create or replace function public.agency_chat_guard()
returns trigger language plpgsql set search_path = public as $$
begin
  if tg_op = 'UPDATE' then
    raise exception 'Los mensajes no se editan';
  end if;
  if new.team_id is not null and not exists (
    select 1 from public.agency_teams t where t.id = new.team_id and t.business_id = new.business_id
  ) then
    raise exception 'El equipo no pertenece a esta agencia';
  end if;
  -- Con un usuario autenticado el autor siempre es él; sin JWT (service_role / seed) se respeta el indicado.
  new.author_id := coalesce(auth.uid(), new.author_id);
  new.body := btrim(new.body);
  return new;
end;
$$;
create trigger trg_agency_chat_guard before insert or update on public.agency_chat_messages
  for each row execute function public.agency_chat_guard();

alter table public.agency_chat_messages enable row level security;
create policy agency_chat_select on public.agency_chat_messages for select to authenticated
  using (
    (team_id is null and public.agency_is_member(business_id))
    or (team_id is not null and public.agency_in_team(business_id, team_id))
  );
create policy agency_chat_insert on public.agency_chat_messages for insert to authenticated
  with check (
    author_id = auth.uid() and (
      (team_id is null and public.agency_is_member(business_id))
      or (team_id is not null and public.agency_in_team(business_id, team_id))
    )
  );
create policy agency_chat_delete on public.agency_chat_messages for delete to authenticated
  using (
    (author_id = auth.uid() or public.agency_is_directiva(business_id)) and (
      (team_id is null and public.agency_is_member(business_id))
      or (team_id is not null and public.agency_in_team(business_id, team_id))
    )
  );
-- Sin update: los mensajes no se editan.

alter publication supabase_realtime add table public.agency_chat_messages;

-- ---------------------------------------------------------------------
-- Última lectura por grupo (scope_id = team_id, o business_id para el General)
-- ---------------------------------------------------------------------
create table public.agency_chat_reads (
  user_id      uuid not null references auth.users(id) on delete cascade,
  business_id  uuid not null references public.businesses(id) on delete cascade,
  scope_id     uuid not null,
  last_read_at timestamptz not null default now(),
  primary key (user_id, scope_id)
);
create index idx_agency_chat_reads_business on public.agency_chat_reads(business_id);

alter table public.agency_chat_reads enable row level security;
create policy agency_chat_reads_all on public.agency_chat_reads for all to authenticated
  using (user_id = auth.uid() and public.agency_is_member(business_id))
  with check (user_id = auth.uid() and public.agency_is_member(business_id));

-- Mensajes sin leer por grupo para el usuario actual. security invoker: la RLS de los mensajes
-- ya limita a los grupos que puede ver. Si nunca abrió el grupo, solo cuenta lo posterior a su alta.
create or replace function public.agency_chat_unread(p_business_id uuid)
returns table (scope_id uuid, unread bigint)
language sql stable security invoker set search_path = public
as $$
  select coalesce(m.team_id, m.business_id) as scope_id, count(*) as unread
  from public.agency_chat_messages m
  join public.agency_members am on am.business_id = m.business_id and am.user_id = auth.uid()
  left join public.agency_chat_reads r on r.user_id = auth.uid() and r.scope_id = coalesce(m.team_id, m.business_id)
  where m.business_id = p_business_id
    and m.author_id is distinct from auth.uid()
    and m.created_at > coalesce(r.last_read_at, am.created_at)
  group by 1
$$;
revoke all on function public.agency_chat_unread(uuid) from public, anon;
grant execute on function public.agency_chat_unread(uuid) to authenticated;
revoke all on function public.agency_chat_guard() from public, anon, authenticated;
