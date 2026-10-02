-- 0041_asesoria_schema.sql
-- Fase 1 del tipo de negocio "asesoria" (organizador de documentos por cliente):
-- clientes de la asesoría, contactos reconocidos, tipos de documento, documentos,
-- auditoría de accesos, bucket privado y RLS.
--
-- Modelo de acceso (adaptado a Turnigo, que usa business_id y los roles owner/staff):
--   * owner  = admin de la asesoría: ve y gestiona todo.
--   * staff  = gestor: solo ve/edita los clientes con manager_id = auth.uid() y sus
--              documentos, más los documentos "sin clasificar" (client_id null) del negocio.
--   * Sin escritura directa de documentos ni borrado de clientes desde el cliente web:
--     alta/lectura de archivos/borrado pasan por Edge Functions (service_role), que validan
--     el archivo, auditan el acceso y borran también el archivo de Storage.
--   * Los clientes finales de la asesoría NO tienen cuenta.

-- ---------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------
create or replace function public.is_business_owner(b uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select public.is_super_admin()
      or exists (
        select 1 from public.business_users bu
        where bu.business_id = b and bu.user_id = auth.uid() and bu.role = 'owner'
      );
$$;

-- NIF/CIF normalizado: mayúsculas, sin espacios, guiones ni puntos.
create or replace function public.adv_normalize_nif(t text)
returns text language sql immutable
as $$ select nullif(upper(regexp_replace(coalesce(t, ''), '[^A-Za-z0-9]', '', 'g')), '') $$;

-- Teléfono normalizado a solo dígitos con prefijo de país. Un móvil/fijo español de 9
-- dígitos recibe el 34; "00..." se interpreta como prefijo internacional.
create or replace function public.adv_normalize_phone(t text)
returns text language sql immutable
as $$
  select case
    when d = '' then null
    when d like '00%' then substr(d, 3)
    when length(d) = 9 and left(d, 1) in ('6', '7', '8', '9') then '34' || d
    else d
  end
  from (select regexp_replace(coalesce(t, ''), '\D', '', 'g') as d) x
$$;

-- ---------------------------------------------------------------------
-- Clientes de la asesoría
-- ---------------------------------------------------------------------
create table public.adv_clients (
  id           uuid primary key default gen_random_uuid(),
  business_id  uuid not null references public.businesses(id) on delete cascade,
  name         text not null check (length(btrim(name)) > 0),
  nif          text,
  client_kind  text not null default 'autonomo'
               check (client_kind in ('autonomo', 'sociedad', 'particular', 'otro')),
  manager_id   uuid references auth.users(id) on delete set null,
  notes        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create unique index uq_adv_clients_nif on public.adv_clients(business_id, nif) where nif is not null;
create index idx_adv_clients_business on public.adv_clients(business_id, name);
create index idx_adv_clients_manager on public.adv_clients(business_id, manager_id);

create or replace function public.adv_clients_normalize()
returns trigger language plpgsql as $$
begin
  new.name := btrim(new.name);
  new.nif := public.adv_normalize_nif(new.nif);
  return new;
end;
$$;
create trigger trg_adv_clients_normalize before insert or update on public.adv_clients
  for each row execute function public.adv_clients_normalize();
create trigger trg_adv_clients_updated before update on public.adv_clients
  for each row execute function public.set_updated_at();

-- Teléfonos y emails reconocidos de cada cliente (señal "remitente" para asignar documentos).
create table public.adv_client_contacts (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  client_id   uuid not null references public.adv_clients(id) on delete cascade,
  kind        text not null check (kind in ('phone', 'email')),
  value       text not null,
  label       text,
  created_at  timestamptz not null default now()
);
create unique index uq_adv_contacts_value on public.adv_client_contacts(business_id, kind, value);
create index idx_adv_contacts_client on public.adv_client_contacts(client_id);

create or replace function public.adv_contacts_normalize()
returns trigger language plpgsql as $$
begin
  if new.kind = 'phone' then
    new.value := public.adv_normalize_phone(new.value);
  else
    new.value := nullif(lower(btrim(new.value)), '');
  end if;
  if new.value is null then
    raise exception 'Contacto vacío o no válido';
  end if;
  if not exists (select 1 from public.adv_clients c where c.id = new.client_id and c.business_id = new.business_id) then
    raise exception 'El cliente no pertenece a esta asesoría';
  end if;
  return new;
end;
$$;
create trigger trg_adv_contacts_normalize before insert or update on public.adv_client_contacts
  for each row execute function public.adv_contacts_normalize();

-- ---------------------------------------------------------------------
-- Tipos de documento (editables por la asesoría; `code` identifica los 8 base)
-- ---------------------------------------------------------------------
create table public.adv_doc_types (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  code        text,
  name        text not null check (length(btrim(name)) > 0),
  is_active   boolean not null default true,
  position    int not null default 0,
  created_at  timestamptz not null default now()
);
create unique index uq_adv_doc_types_name on public.adv_doc_types(business_id, lower(name));
create unique index uq_adv_doc_types_code on public.adv_doc_types(business_id, code) where code is not null;

create or replace function public.adv_seed_doc_types(p_business_id uuid)
returns void
language sql security definer set search_path = public
as $$
  insert into public.adv_doc_types (business_id, code, name, position)
  values
    (p_business_id, 'factura_recibida',  'Factura recibida', 0),
    (p_business_id, 'factura_emitida',   'Factura emitida', 1),
    (p_business_id, 'nomina',            'Nómina', 2),
    (p_business_id, 'extracto_bancario', 'Extracto bancario', 3),
    (p_business_id, 'modelo_aeat',       'Modelo AEAT', 4),
    (p_business_id, 'dni',               'DNI / documento identificativo', 5),
    (p_business_id, 'contrato',          'Contrato', 6),
    (p_business_id, 'otros',             'Otros', 7)
  on conflict do nothing;
$$;
revoke all on function public.adv_seed_doc_types(uuid) from public, anon, authenticated;
grant execute on function public.adv_seed_doc_types(uuid) to service_role;

-- ---------------------------------------------------------------------
-- Documentos
-- ---------------------------------------------------------------------
create table public.adv_documents (
  id                uuid primary key default gen_random_uuid(),
  business_id       uuid not null references public.businesses(id) on delete cascade,
  client_id         uuid references public.adv_clients(id) on delete cascade,
  doc_type_id       uuid references public.adv_doc_types(id) on delete set null,
  source            text not null check (source in ('upload', 'whatsapp', 'email')),
  original_filename text not null,
  mime_type         text not null,
  size_bytes        bigint not null,
  storage_path      text not null,
  file_hash         text not null,
  -- pending (a la espera de IA) | auto | review | corrected | unclassified | failed
  status            text not null default 'pending'
                    check (status in ('pending', 'auto', 'review', 'corrected', 'unclassified', 'failed')),
  period_year       smallint check (period_year between 2000 and 2100),
  period_month      smallint check (period_month between 1 and 12),
  sender            text,
  sender_meta       jsonb not null default '{}'::jsonb,
  assignment_reason jsonb not null default '{}'::jsonb,
  duplicate_of      uuid references public.adv_documents(id) on delete set null,
  uploaded_by       uuid references auth.users(id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index idx_adv_documents_client on public.adv_documents(business_id, client_id, created_at desc);
create index idx_adv_documents_status on public.adv_documents(business_id, status, created_at desc);
create index idx_adv_documents_hash on public.adv_documents(business_id, file_hash);
create trigger trg_adv_documents_updated before update on public.adv_documents
  for each row execute function public.set_updated_at();

-- Defensa en profundidad del aislamiento entre asesorías: un documento no puede cambiar de
-- negocio ni de archivo, y solo puede asignarse a un cliente (o tipo) de su propio negocio.
create or replace function public.adv_documents_guard()
returns trigger language plpgsql as $$
begin
  if tg_op = 'UPDATE' and (
       new.business_id is distinct from old.business_id
    or new.storage_path is distinct from old.storage_path
    or new.file_hash is distinct from old.file_hash
    or new.source is distinct from old.source
  ) then
    raise exception 'Campos inmutables del documento';
  end if;
  if new.client_id is not null and not exists (
    select 1 from public.adv_clients c where c.id = new.client_id and c.business_id = new.business_id
  ) then
    raise exception 'El cliente no pertenece a esta asesoría';
  end if;
  if new.doc_type_id is not null and not exists (
    select 1 from public.adv_doc_types t where t.id = new.doc_type_id and t.business_id = new.business_id
  ) then
    raise exception 'El tipo de documento no pertenece a esta asesoría';
  end if;
  return new;
end;
$$;
create trigger trg_adv_documents_guard before insert or update on public.adv_documents
  for each row execute function public.adv_documents_guard();

-- ---------------------------------------------------------------------
-- Auditoría (quién accede a qué). Sin FK a documentos/clientes: el rastro debe
-- sobrevivir al borrado del documento.
-- ---------------------------------------------------------------------
create table public.adv_audit_log (
  id          bigint generated always as identity primary key,
  business_id uuid not null references public.businesses(id) on delete cascade,
  user_id     uuid,
  action      text not null,
  document_id uuid,
  client_id   uuid,
  detail      jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);
create index idx_adv_audit_business on public.adv_audit_log(business_id, created_at desc);

-- ---------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------
create or replace function public.adv_can_access_client(b uuid, c uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select public.is_business_owner(b)
      or exists (
        select 1 from public.adv_clients cl
        where cl.id = c and cl.business_id = b and cl.manager_id = auth.uid()
      );
$$;

revoke all on function public.is_business_owner(uuid) from public, anon;
revoke all on function public.adv_can_access_client(uuid, uuid) from public, anon;
grant execute on function public.is_business_owner(uuid) to authenticated;
grant execute on function public.adv_can_access_client(uuid, uuid) to authenticated;

alter table public.adv_clients enable row level security;
create policy adv_clients_select on public.adv_clients for select to authenticated
  using (public.is_business_owner(business_id) or (public.is_business_member(business_id) and manager_id = auth.uid()));
create policy adv_clients_insert on public.adv_clients for insert to authenticated
  with check (public.is_business_owner(business_id) or (public.is_business_member(business_id) and manager_id = auth.uid()));
create policy adv_clients_update on public.adv_clients for update to authenticated
  using (public.is_business_owner(business_id) or (public.is_business_member(business_id) and manager_id = auth.uid()))
  with check (public.is_business_owner(business_id) or (public.is_business_member(business_id) and manager_id = auth.uid()));
-- Sin política de delete: el borrado completo (cliente + archivos) va por la Edge Function adv-delete.

alter table public.adv_client_contacts enable row level security;
create policy adv_contacts_all on public.adv_client_contacts for all to authenticated
  using (public.adv_can_access_client(business_id, client_id))
  with check (public.adv_can_access_client(business_id, client_id));

alter table public.adv_doc_types enable row level security;
create policy adv_doc_types_select on public.adv_doc_types for select to authenticated
  using (public.is_business_member(business_id));
create policy adv_doc_types_write on public.adv_doc_types for all to authenticated
  using (public.is_business_owner(business_id)) with check (public.is_business_owner(business_id));

alter table public.adv_documents enable row level security;
create policy adv_documents_select on public.adv_documents for select to authenticated
  using (
    public.is_business_member(business_id)
    and (client_id is null or public.adv_can_access_client(business_id, client_id))
  );
create policy adv_documents_update on public.adv_documents for update to authenticated
  using (
    public.is_business_member(business_id)
    and (client_id is null or public.adv_can_access_client(business_id, client_id))
  )
  with check (
    public.is_business_member(business_id)
    and (client_id is null or public.adv_can_access_client(business_id, client_id))
  );
-- Sin insert/delete directos: ver Edge Functions adv-upload y adv-delete.

alter table public.adv_audit_log enable row level security;
create policy adv_audit_select on public.adv_audit_log for select to authenticated
  using (public.is_business_owner(business_id));
-- Escritura solo con service_role (Edge Functions).

-- ---------------------------------------------------------------------
-- Storage: bucket PRIVADO sin ninguna política para authenticated/anon. Solo las Edge
-- Functions (service_role) suben, firman URLs de corta duración y borran. Ruta:
-- {business_id}/{document_id}.{ext}
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'asesoria-docs', 'asesoria-docs', false, 15728640,
  array['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
on conflict (id) do nothing;
