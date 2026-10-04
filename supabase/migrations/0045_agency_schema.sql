-- 0045_agency_schema.sql
-- Tipo de negocio "agencia": equipos horizontales, tareas, comentarios, calendario y
-- documentos. Herramienta 100% interna con login (sin widget ni portal de clientes).
--
-- Modelo de acceso (Turnigo usa business_id; aquí "tenant" = businesses):
--   * agency_members.access_level = 'directiva' | 'miembro'. El CARGO ("Presidente",
--     "Responsable de pólvora"...) es texto informativo y editable (cargo); aparte,
--     directiva_role marca los 5 puestos estatutarios y solo presidente/secretario pueden dar
--     de alta usuarios (Edge Function agency-members).
--   * directiva ve y gestiona todos los equipos de su negocio. Un miembro solo lee y escribe
--     lo de los equipos a los que pertenece (agency_team_members). Todo reforzado aquí por RLS
--     mediante agency_in_team(); la UI solo es cosmética.
--   * Un usuario desactivado (is_active=false) pierde todo acceso de golpe: todos los helpers
--     lo exigen.
--   * Cualquier miembro de un equipo puede crear/editar/borrar tareas, comentarios y documentos
--     de ese equipo (equipos horizontales, sin jefe).
--   * Los eventos generales (team_id null) los ven todos, pero solo los gestiona la directiva.
--   * Tablas y bucket pensados para ampliar sin romper: comparsas, finanzas, actas, etc.
--     serán tablas nuevas con el mismo patrón (business_id + helpers).

-- ---------------------------------------------------------------------
-- Miembros de la agencia
-- ---------------------------------------------------------------------
create table public.agency_members (
  business_id    uuid not null references public.businesses(id) on delete cascade,
  user_id        uuid not null references auth.users(id) on delete cascade,
  full_name      text not null check (length(btrim(full_name)) > 0),
  access_level   text not null default 'miembro' check (access_level in ('directiva', 'miembro')),
  -- Puesto estatutario (solo directiva). Gobierna quién puede dar altas.
  directiva_role text check (directiva_role in ('presidente', 'vicepresidente1', 'vicepresidente2', 'secretario', 'tesorero')),
  -- Etiqueta libre y puramente informativa.
  cargo          text,
  is_active      boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  primary key (business_id, user_id),
  check (directiva_role is null or access_level = 'directiva')
);
create index idx_agency_members_business on public.agency_members(business_id);
create index idx_agency_members_user on public.agency_members(user_id);
create trigger trg_agency_members_updated before update on public.agency_members
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- Helpers de rol (security definer para no recursar en RLS)
-- ---------------------------------------------------------------------
create or replace function public.agency_is_member(b uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select public.is_super_admin()
      or exists (
        select 1 from public.agency_members m
        where m.business_id = b and m.user_id = auth.uid() and m.is_active
      );
$$;

create or replace function public.agency_is_directiva(b uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select public.is_super_admin()
      or exists (
        select 1 from public.agency_members m
        where m.business_id = b and m.user_id = auth.uid() and m.is_active and m.access_level = 'directiva'
      );
$$;

-- Presidente o secretario: pueden dar de alta usuarios.
create or replace function public.agency_can_manage_members(b uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select public.is_super_admin()
      or exists (
        select 1 from public.agency_members m
        where m.business_id = b and m.user_id = auth.uid() and m.is_active
          and m.access_level = 'directiva' and m.directiva_role in ('presidente', 'secretario')
      );
$$;

-- ---------------------------------------------------------------------
-- Equipos
-- ---------------------------------------------------------------------
create table public.agency_teams (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name        text not null check (length(btrim(name)) > 0),
  position    int not null default 0,
  is_archived boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create unique index uq_agency_teams_name on public.agency_teams(business_id, lower(name));
create index idx_agency_teams_business on public.agency_teams(business_id, position);
create trigger trg_agency_teams_updated before update on public.agency_teams
  for each row execute function public.set_updated_at();

create table public.agency_team_members (
  team_id     uuid not null references public.agency_teams(id) on delete cascade,
  user_id     uuid not null,
  business_id uuid not null references public.businesses(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (team_id, user_id),
  foreign key (business_id, user_id) references public.agency_members(business_id, user_id) on delete cascade
);
create index idx_agency_team_members_business on public.agency_team_members(business_id);
create index idx_agency_team_members_user on public.agency_team_members(user_id);

-- ¿Puede el usuario actual ver/escribir en el equipo t del negocio b?
-- Directiva: cualquier equipo del negocio. Miembro: solo los suyos. Siempre exige que el
-- equipo pertenezca realmente a b (no se puede colar un team_id de otro negocio).
create or replace function public.agency_in_team(b uuid, t uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.agency_teams tm where tm.id = t and tm.business_id = b)
     and (
       public.agency_is_directiva(b)
       or exists (
         select 1
         from public.agency_team_members x
         join public.agency_members m on m.business_id = x.business_id and m.user_id = x.user_id
         where x.team_id = t and x.business_id = b and x.user_id = auth.uid() and m.is_active
       )
     );
$$;

-- ---------------------------------------------------------------------
-- Tareas, asignados y comentarios
-- ---------------------------------------------------------------------
create table public.agency_tasks (
  id           uuid primary key default gen_random_uuid(),
  business_id  uuid not null references public.businesses(id) on delete cascade,
  team_id      uuid not null references public.agency_teams(id) on delete cascade,
  title        text not null check (length(btrim(title)) > 0),
  description  text,
  status       text not null default 'pendiente' check (status in ('pendiente', 'en_curso', 'hecha')),
  due_date     date,
  sort_order   double precision not null default 0,
  created_by   uuid default auth.uid() references auth.users(id) on delete set null,
  completed_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index idx_agency_tasks_business on public.agency_tasks(business_id, status, due_date);
create index idx_agency_tasks_team on public.agency_tasks(team_id, status, sort_order);
create trigger trg_agency_tasks_updated before update on public.agency_tasks
  for each row execute function public.set_updated_at();

create table public.agency_task_assignees (
  task_id     uuid not null references public.agency_tasks(id) on delete cascade,
  user_id     uuid not null,
  business_id uuid not null references public.businesses(id) on delete cascade,
  team_id     uuid not null references public.agency_teams(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (task_id, user_id),
  foreign key (business_id, user_id) references public.agency_members(business_id, user_id) on delete cascade
);
create index idx_agency_assignees_business on public.agency_task_assignees(business_id);
create index idx_agency_assignees_user on public.agency_task_assignees(user_id);
create index idx_agency_assignees_team on public.agency_task_assignees(team_id);

create table public.agency_task_comments (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  team_id     uuid not null references public.agency_teams(id) on delete cascade,
  task_id     uuid not null references public.agency_tasks(id) on delete cascade,
  author_id   uuid default auth.uid() references auth.users(id) on delete set null,
  body        text not null check (length(btrim(body)) > 0),
  mentions    uuid[] not null default '{}',
  created_at  timestamptz not null default now()
);
create index idx_agency_comments_business on public.agency_task_comments(business_id);
create index idx_agency_comments_task on public.agency_task_comments(task_id, created_at);

-- ---------------------------------------------------------------------
-- Calendario
-- ---------------------------------------------------------------------
create table public.agency_events (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  team_id     uuid references public.agency_teams(id) on delete cascade, -- null = evento general
  title       text not null check (length(btrim(title)) > 0),
  description text,
  starts_at   timestamptz not null,
  ends_at     timestamptz,
  all_day     boolean not null default false,
  created_by  uuid default auth.uid() references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  check (ends_at is null or ends_at >= starts_at)
);
create index idx_agency_events_business on public.agency_events(business_id, starts_at);
create index idx_agency_events_team on public.agency_events(team_id);
create trigger trg_agency_events_updated before update on public.agency_events
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- Documentos (metadatos; el archivo vive en el bucket privado agencia-docs)
-- ---------------------------------------------------------------------
create table public.agency_documents (
  id           uuid primary key default gen_random_uuid(),
  business_id  uuid not null references public.businesses(id) on delete cascade,
  team_id      uuid not null references public.agency_teams(id) on delete cascade,
  name         text not null check (length(btrim(name)) > 0),
  storage_path text not null unique,
  mime_type    text not null,
  size_bytes   bigint not null check (size_bytes >= 0),
  uploaded_by  uuid default auth.uid() references auth.users(id) on delete set null,
  created_at   timestamptz not null default now()
);
create index idx_agency_documents_business on public.agency_documents(business_id, created_at desc);
create index idx_agency_documents_team on public.agency_documents(team_id, created_at desc);

-- ---------------------------------------------------------------------
-- Triggers de integridad (defensa en profundidad bajo la RLS)
-- ---------------------------------------------------------------------
create or replace function public.agency_members_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE' then
    if new.business_id is distinct from old.business_id or new.user_id is distinct from old.user_id then
      raise exception 'Campos inmutables del miembro';
    end if;
    -- Nadie (salvo super-admin) puede quitarse a sí mismo la directiva ni desactivarse:
    -- evitaría quedarse sin directiva por accidente.
    if not public.is_super_admin() and old.user_id = auth.uid()
       and (new.access_level is distinct from old.access_level or new.is_active is distinct from old.is_active) then
      raise exception 'No puedes cambiar tu propio nivel de acceso ni desactivarte';
    end if;
  end if;
  if new.access_level <> 'directiva' then new.directiva_role := null; end if;
  new.full_name := btrim(new.full_name);
  new.cargo := nullif(btrim(coalesce(new.cargo, '')), '');
  return new;
end;
$$;
create trigger trg_agency_members_guard before insert or update on public.agency_members
  for each row execute function public.agency_members_guard();

create or replace function public.agency_teams_guard()
returns trigger language plpgsql as $$
begin
  if tg_op = 'UPDATE' and new.business_id is distinct from old.business_id then
    raise exception 'Un equipo no puede cambiar de agencia';
  end if;
  new.name := btrim(new.name);
  return new;
end;
$$;
create trigger trg_agency_teams_guard before insert or update on public.agency_teams
  for each row execute function public.agency_teams_guard();

create or replace function public.agency_team_members_guard()
returns trigger language plpgsql set search_path = public as $$
begin
  if not exists (select 1 from public.agency_teams t where t.id = new.team_id and t.business_id = new.business_id) then
    raise exception 'El equipo no pertenece a esta agencia';
  end if;
  return new;
end;
$$;
create trigger trg_agency_team_members_guard before insert or update on public.agency_team_members
  for each row execute function public.agency_team_members_guard();

create or replace function public.agency_tasks_guard()
returns trigger language plpgsql set search_path = public as $$
begin
  if tg_op = 'UPDATE' and (new.business_id is distinct from old.business_id or new.team_id is distinct from old.team_id) then
    raise exception 'Una tarea no puede cambiar de equipo ni de agencia';
  end if;
  if not exists (select 1 from public.agency_teams t where t.id = new.team_id and t.business_id = new.business_id) then
    raise exception 'El equipo no pertenece a esta agencia';
  end if;
  new.title := btrim(new.title);
  if new.status = 'hecha' and (tg_op = 'INSERT' or old.status <> 'hecha') then
    new.completed_at := now();
  elsif new.status <> 'hecha' then
    new.completed_at := null;
  end if;
  return new;
end;
$$;
create trigger trg_agency_tasks_guard before insert or update on public.agency_tasks
  for each row execute function public.agency_tasks_guard();

-- Los asignados deben pertenecer al equipo de la tarea. business_id/team_id se derivan de la
-- tarea (el cliente solo envía task_id + user_id).
create or replace function public.agency_assignees_guard()
returns trigger language plpgsql set search_path = public as $$
declare t record;
begin
  select business_id, team_id into t from public.agency_tasks where id = new.task_id;
  if not found then raise exception 'Tarea no encontrada'; end if;
  new.business_id := t.business_id;
  new.team_id := t.team_id;
  if not exists (
    select 1 from public.agency_team_members x
    where x.team_id = new.team_id and x.user_id = new.user_id and x.business_id = new.business_id
  ) then
    raise exception 'Solo se puede asignar a miembros del equipo';
  end if;
  return new;
end;
$$;
create trigger trg_agency_assignees_guard before insert on public.agency_task_assignees
  for each row execute function public.agency_assignees_guard();

-- Si alguien sale del equipo, deja de estar asignado a sus tareas.
create or replace function public.agency_team_member_removed()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  delete from public.agency_task_assignees where team_id = old.team_id and user_id = old.user_id;
  return old;
end;
$$;
create trigger trg_agency_team_member_removed after delete on public.agency_team_members
  for each row execute function public.agency_team_member_removed();

create or replace function public.agency_comments_guard()
returns trigger language plpgsql set search_path = public as $$
declare t record;
begin
  if tg_op = 'UPDATE' then
    if new.task_id is distinct from old.task_id or new.business_id is distinct from old.business_id
       or new.team_id is distinct from old.team_id or new.author_id is distinct from old.author_id then
      raise exception 'Campos inmutables del comentario';
    end if;
    return new;
  end if;
  select business_id, team_id into t from public.agency_tasks where id = new.task_id;
  if not found then raise exception 'Tarea no encontrada'; end if;
  new.business_id := t.business_id;
  new.team_id := t.team_id;
  new.author_id := auth.uid();
  new.body := btrim(new.body);
  -- Solo se pueden mencionar miembros del propio equipo.
  new.mentions := coalesce((
    select array_agg(distinct u) from unnest(new.mentions) u
    where exists (
      select 1 from public.agency_team_members x
      where x.team_id = new.team_id and x.user_id = u
    )
  ), '{}');
  return new;
end;
$$;
create trigger trg_agency_comments_guard before insert or update on public.agency_task_comments
  for each row execute function public.agency_comments_guard();

create or replace function public.agency_events_guard()
returns trigger language plpgsql set search_path = public as $$
begin
  if tg_op = 'UPDATE' and new.business_id is distinct from old.business_id then
    raise exception 'Un evento no puede cambiar de agencia';
  end if;
  if new.team_id is not null and not exists (
    select 1 from public.agency_teams t where t.id = new.team_id and t.business_id = new.business_id
  ) then
    raise exception 'El equipo no pertenece a esta agencia';
  end if;
  new.title := btrim(new.title);
  return new;
end;
$$;
create trigger trg_agency_events_guard before insert or update on public.agency_events
  for each row execute function public.agency_events_guard();

create or replace function public.agency_documents_guard()
returns trigger language plpgsql set search_path = public as $$
begin
  if tg_op = 'UPDATE' then
    raise exception 'Los documentos no se editan; se borran y se vuelven a subir';
  end if;
  if not exists (select 1 from public.agency_teams t where t.id = new.team_id and t.business_id = new.business_id) then
    raise exception 'El equipo no pertenece a esta agencia';
  end if;
  if new.storage_path not like new.business_id::text || '/' || new.team_id::text || '/%' then
    raise exception 'Ruta de archivo no válida';
  end if;
  return new;
end;
$$;
create trigger trg_agency_documents_guard before insert or update on public.agency_documents
  for each row execute function public.agency_documents_guard();

-- ---------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------
alter table public.agency_members enable row level security;
-- Todos los miembros activos ven el directorio de su agencia (nombre y cargo, para asignar y mencionar).
create policy agency_members_select on public.agency_members for select to authenticated
  using (public.agency_is_member(business_id));
-- La directiva edita cargo, nivel y estado. El alta (crea la cuenta de Auth) va por la Edge
-- Function agency-members, así que no hay política de insert/delete.
create policy agency_members_update on public.agency_members for update to authenticated
  using (public.agency_is_directiva(business_id)) with check (public.agency_is_directiva(business_id));

alter table public.agency_teams enable row level security;
create policy agency_teams_select on public.agency_teams for select to authenticated
  using (public.agency_in_team(business_id, id));
create policy agency_teams_insert on public.agency_teams for insert to authenticated
  with check (public.agency_is_directiva(business_id));
create policy agency_teams_update on public.agency_teams for update to authenticated
  using (public.agency_is_directiva(business_id)) with check (public.agency_is_directiva(business_id));
-- Sin delete: los equipos se archivan.

alter table public.agency_team_members enable row level security;
create policy agency_team_members_select on public.agency_team_members for select to authenticated
  using (public.agency_in_team(business_id, team_id));
create policy agency_team_members_insert on public.agency_team_members for insert to authenticated
  with check (public.agency_is_directiva(business_id));
create policy agency_team_members_delete on public.agency_team_members for delete to authenticated
  using (public.agency_is_directiva(business_id));

alter table public.agency_tasks enable row level security;
create policy agency_tasks_all on public.agency_tasks for all to authenticated
  using (public.agency_in_team(business_id, team_id))
  with check (public.agency_in_team(business_id, team_id));

alter table public.agency_task_assignees enable row level security;
create policy agency_assignees_all on public.agency_task_assignees for all to authenticated
  using (public.agency_in_team(business_id, team_id))
  with check (public.agency_in_team(business_id, team_id));

alter table public.agency_task_comments enable row level security;
create policy agency_comments_select on public.agency_task_comments for select to authenticated
  using (public.agency_in_team(business_id, team_id));
create policy agency_comments_insert on public.agency_task_comments for insert to authenticated
  with check (public.agency_in_team(business_id, team_id) and author_id = auth.uid());
-- Editar/borrar un comentario: su autor o la directiva.
create policy agency_comments_update on public.agency_task_comments for update to authenticated
  using (public.agency_in_team(business_id, team_id) and (author_id = auth.uid() or public.agency_is_directiva(business_id)))
  with check (public.agency_in_team(business_id, team_id));
create policy agency_comments_delete on public.agency_task_comments for delete to authenticated
  using (public.agency_in_team(business_id, team_id) and (author_id = auth.uid() or public.agency_is_directiva(business_id)));

alter table public.agency_events enable row level security;
create policy agency_events_select on public.agency_events for select to authenticated
  using (
    (team_id is null and public.agency_is_member(business_id))
    or (team_id is not null and public.agency_in_team(business_id, team_id))
  );
create policy agency_events_insert on public.agency_events for insert to authenticated
  with check (
    (team_id is null and public.agency_is_directiva(business_id))
    or (team_id is not null and public.agency_in_team(business_id, team_id))
  );
create policy agency_events_update on public.agency_events for update to authenticated
  using (
    (team_id is null and public.agency_is_directiva(business_id))
    or (team_id is not null and public.agency_in_team(business_id, team_id))
  )
  with check (
    (team_id is null and public.agency_is_directiva(business_id))
    or (team_id is not null and public.agency_in_team(business_id, team_id))
  );
create policy agency_events_delete on public.agency_events for delete to authenticated
  using (
    (team_id is null and public.agency_is_directiva(business_id))
    or (team_id is not null and public.agency_in_team(business_id, team_id))
  );

alter table public.agency_documents enable row level security;
create policy agency_documents_select on public.agency_documents for select to authenticated
  using (public.agency_in_team(business_id, team_id));
create policy agency_documents_insert on public.agency_documents for insert to authenticated
  with check (public.agency_in_team(business_id, team_id));
create policy agency_documents_delete on public.agency_documents for delete to authenticated
  using (public.agency_in_team(business_id, team_id));

-- ---------------------------------------------------------------------
-- Storage: bucket PRIVADO. Ruta {business_id}/{team_id}/{uuid}-{nombre}. Las políticas
-- comprueban pertenencia al equipo de la ruta; la descarga se hace con URL firmada.
-- ---------------------------------------------------------------------
create or replace function public.agency_storage_access(p_name text)
returns boolean
language plpgsql stable security definer set search_path = public
as $$
declare m text[];
begin
  m := regexp_match(p_name, '^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/');
  if m is null then return false; end if;
  return public.agency_in_team(m[1]::uuid, m[2]::uuid);
end;
$$;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'agencia-docs', 'agencia-docs', false, 20971520,
  array[
    'application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ]
)
on conflict (id) do nothing;

create policy agencia_docs_select on storage.objects for select to authenticated
  using (bucket_id = 'agencia-docs' and public.agency_storage_access(name));
create policy agencia_docs_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'agencia-docs' and public.agency_storage_access(name));
create policy agencia_docs_delete on storage.objects for delete to authenticated
  using (bucket_id = 'agencia-docs' and public.agency_storage_access(name));

-- ---------------------------------------------------------------------
-- Los 8 equipos por defecto al crear una agencia (por cualquier vía de alta)
-- ---------------------------------------------------------------------
create or replace function public.agency_seed_teams(p_business_id uuid)
returns void
language sql security definer set search_path = public
as $$
  insert into public.agency_teams (business_id, name, position)
  values
    (p_business_id, 'Protocolo mayor', 0),
    (p_business_id, 'Protocolo infantil', 1),
    (p_business_id, 'Pólvora', 2),
    (p_business_id, 'Embajadas', 3),
    (p_business_id, 'Embajadas infantiles', 4),
    (p_business_id, 'Organización y eventos', 5),
    (p_business_id, 'Desfiles', 6),
    (p_business_id, 'Presentaciones', 7)
  on conflict do nothing;
$$;

create or replace function public.agency_on_business_created()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.type = 'agencia' then
    perform public.agency_seed_teams(new.id);
  end if;
  return new;
end;
$$;
create trigger trg_agency_on_business_created after insert on public.businesses
  for each row execute function public.agency_on_business_created();

-- ---------------------------------------------------------------------
-- Emails del directorio (solo directiva): auth.users no es legible desde el cliente.
-- ---------------------------------------------------------------------
create or replace function public.agency_list_members_admin(p_business_id uuid)
returns table (user_id uuid, email text, last_sign_in_at timestamptz)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not public.agency_is_directiva(p_business_id) then
    raise exception 'No autorizado';
  end if;
  return query
    select m.user_id, u.email::text, u.last_sign_in_at
    from public.agency_members m
    join auth.users u on u.id = m.user_id
    where m.business_id = p_business_id;
end;
$$;

-- ---------------------------------------------------------------------
-- Grants: solo authenticated. Las funciones internas (seed, triggers) no se exponen.
-- ---------------------------------------------------------------------
revoke all on function public.agency_is_member(uuid) from public, anon;
revoke all on function public.agency_is_directiva(uuid) from public, anon;
revoke all on function public.agency_can_manage_members(uuid) from public, anon;
revoke all on function public.agency_in_team(uuid, uuid) from public, anon;
revoke all on function public.agency_storage_access(text) from public, anon;
revoke all on function public.agency_list_members_admin(uuid) from public, anon;
revoke all on function public.agency_seed_teams(uuid) from public, anon, authenticated;
revoke all on function public.agency_on_business_created() from public, anon, authenticated;
revoke all on function public.agency_team_member_removed() from public, anon, authenticated;
revoke all on function public.agency_members_guard() from public, anon, authenticated;
grant execute on function public.agency_is_member(uuid) to authenticated;
grant execute on function public.agency_is_directiva(uuid) to authenticated;
grant execute on function public.agency_can_manage_members(uuid) to authenticated;
grant execute on function public.agency_in_team(uuid, uuid) to authenticated;
grant execute on function public.agency_storage_access(text) to authenticated;
grant execute on function public.agency_list_members_admin(uuid) to authenticated;
grant execute on function public.agency_seed_teams(uuid) to service_role;
