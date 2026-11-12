-- =====================================================================
-- 0057_whatsapp_inbox.sql
-- Buzón de WhatsApp en el panel: ver y contestar los mensajes que llegan al número
-- del negocio (Meta Cloud API).
--
-- Flujo:
--   Meta -> Edge Function `whatsapp-webhook` (sin JWT; valida X-Hub-Signature-256 con el
--   App Secret del negocio) -> whatsapp_ingest_message() -> tablas de abajo -> el panel
--   las recibe por Realtime. Para contestar, el panel llama a la Edge Function
--   `whatsapp-send` (con JWT del usuario), que usa el token del negocio.
--
-- Todo es retrocompatible: `businesses.whatsapp_inbox_enabled` vale false por defecto y
-- ningún negocio cambia de comportamiento hasta que lo active.
--
--   * businesses.whatsapp_inbox_enabled      interruptor del módulo
--   * business_integrations.whatsapp_app_secret / whatsapp_verify_token
--                                            SECRETOS (solo service_role + RPCs de abajo)
--   * whatsapp_conversations / whatsapp_messages
--   * whatsapp_ingest_message / whatsapp_update_message_status    solo service_role
--   * whatsapp_mark_read                      el staff marca una conversación como leída
--   * get_whatsapp_inbox_config / set_whatsapp_inbox_config       ajustes (sin devolver secretos)
--   * ambas tablas en supabase_realtime
-- =====================================================================

alter table public.businesses add column if not exists whatsapp_inbox_enabled boolean not null default false;

alter table public.business_integrations add column if not exists whatsapp_app_secret   text; -- SECRETO
alter table public.business_integrations add column if not exists whatsapp_verify_token text; -- se muestra al staff para pegarlo en Meta

-- Un mismo verify token no puede repetirse entre negocios (el webhook enruta el GET de verificación por él).
create unique index if not exists uq_business_integrations_wa_verify_token
  on public.business_integrations(whatsapp_verify_token) where whatsapp_verify_token is not null;
-- El webhook enruta cada mensaje por el phone_number_id destinatario.
create unique index if not exists uq_business_integrations_wa_phone_number_id
  on public.business_integrations(whatsapp_phone_number_id) where whatsapp_phone_number_id is not null;

-- ---------------------------------------------------------------------
-- Conversaciones y mensajes
-- ---------------------------------------------------------------------
create table if not exists public.whatsapp_conversations (
  id               uuid primary key default gen_random_uuid(),
  business_id      uuid not null references public.businesses(id) on delete cascade,
  wa_id            text not null check (wa_id ~ '^[0-9]{6,20}$'),  -- teléfono del contacto, solo dígitos
  contact_name     text,                                            -- nombre de perfil de WhatsApp
  customer_id      uuid references public.customers(id) on delete set null,
  last_message_at  timestamptz not null default now(),
  last_inbound_at  timestamptz,                                     -- para la ventana de 24 h de Meta
  last_preview     text,
  unread_count     int not null default 0 check (unread_count >= 0),
  is_archived      boolean not null default false,
  created_at       timestamptz not null default now(),
  unique (business_id, wa_id)
);
create index if not exists idx_wa_conv_business_last on public.whatsapp_conversations(business_id, last_message_at desc);

create table if not exists public.whatsapp_messages (
  id               uuid primary key default gen_random_uuid(),
  business_id      uuid not null references public.businesses(id) on delete cascade,
  conversation_id  uuid not null references public.whatsapp_conversations(id) on delete cascade,
  direction        text not null check (direction in ('in', 'out')),
  wa_message_id    text,                                            -- id de Meta (idempotencia)
  msg_type         text not null default 'text',                    -- text | image | audio | video | document | sticker | location | other
  body             text check (char_length(body) <= 4096),
  status           text not null default 'received'
                     check (status in ('received', 'sending', 'sent', 'delivered', 'read', 'failed')),
  error            text,
  sent_by          uuid references auth.users(id) on delete set null,
  created_at       timestamptz not null default now()
);
create unique index if not exists uq_wa_msg_wa_id on public.whatsapp_messages(business_id, wa_message_id) where wa_message_id is not null;
create index if not exists idx_wa_msg_conv on public.whatsapp_messages(conversation_id, created_at);

-- ---------------------------------------------------------------------
-- RLS: el staff del negocio solo LEE; toda escritura va por service_role (Edge Functions)
-- o por las RPCs de abajo. Datos sensibles (psicología): nada de acceso anónimo.
-- ---------------------------------------------------------------------
alter table public.whatsapp_conversations enable row level security;
alter table public.whatsapp_messages enable row level security;

drop policy if exists wa_conv_select on public.whatsapp_conversations;
create policy wa_conv_select on public.whatsapp_conversations for select to authenticated
  using (public.is_business_member(business_id));
drop policy if exists wa_msg_select on public.whatsapp_messages;
create policy wa_msg_select on public.whatsapp_messages for select to authenticated
  using (public.is_business_member(business_id));

revoke insert, update, delete on public.whatsapp_conversations from authenticated, anon;
revoke insert, update, delete on public.whatsapp_messages from authenticated, anon;
revoke all on public.whatsapp_conversations from anon;
revoke all on public.whatsapp_messages from anon;

-- Realtime (el panel refresca la bandeja sin recargar)
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'whatsapp_conversations') then
    alter publication supabase_realtime add table public.whatsapp_conversations;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'whatsapp_messages') then
    alter publication supabase_realtime add table public.whatsapp_messages;
  end if;
end $$;

-- ---------------------------------------------------------------------
-- Entrada de un mensaje (la llama el webhook con service_role). Idempotente por
-- wa_message_id: Meta reintenta entregas. Enlaza con el cliente por teléfono
-- (últimos 9 dígitos) si hay una única coincidencia.
-- ---------------------------------------------------------------------
create or replace function public.whatsapp_ingest_message(
  p_business_id   uuid,
  p_wa_id         text,
  p_contact_name  text,
  p_wa_message_id text,
  p_msg_type      text,
  p_body          text,
  p_wa_timestamp  timestamptz default now()
) returns table (conversation_id uuid, inserted boolean, conversation_is_new boolean, unread_count int)
language plpgsql security definer set search_path = public
as $$
declare
  v_conv   uuid;
  v_new    boolean := false;
  v_ins    uuid;
  v_cust   uuid;
  v_tail   text := right(regexp_replace(p_wa_id, '\D', '', 'g'), 9);
  v_prev   text := left(coalesce(nullif(btrim(p_body), ''), '[' || coalesce(p_msg_type, 'mensaje') || ']'), 140);
  v_ts     timestamptz := coalesce(p_wa_timestamp, now());
begin
  select id into v_conv from public.whatsapp_conversations where business_id = p_business_id and wa_id = p_wa_id;
  if v_conv is null then
    -- cliente con ese teléfono, solo si es único
    select (array_agg(c.id))[1] into v_cust from public.customers c
     where c.business_id = p_business_id and c.phone is not null
       and right(regexp_replace(c.phone, '\D', '', 'g'), 9) = v_tail
    having count(*) = 1;
    insert into public.whatsapp_conversations (business_id, wa_id, contact_name, customer_id, last_message_at, last_inbound_at, last_preview)
    values (p_business_id, p_wa_id, nullif(left(p_contact_name, 120), ''), v_cust, v_ts, v_ts, v_prev)
    on conflict (business_id, wa_id) do nothing
    returning id into v_conv;
    if v_conv is null then
      select id into v_conv from public.whatsapp_conversations where business_id = p_business_id and wa_id = p_wa_id;
    else
      v_new := true;
    end if;
  end if;

  insert into public.whatsapp_messages (business_id, conversation_id, direction, wa_message_id, msg_type, body, status, created_at)
  values (p_business_id, v_conv, 'in', p_wa_message_id, coalesce(p_msg_type, 'text'), left(p_body, 4096), 'received', v_ts)
  on conflict (business_id, wa_message_id) where wa_message_id is not null do nothing
  returning id into v_ins;

  if v_ins is not null then
    update public.whatsapp_conversations c set
      last_message_at = greatest(c.last_message_at, v_ts),
      last_inbound_at = greatest(coalesce(c.last_inbound_at, v_ts), v_ts),
      last_preview    = v_prev,
      contact_name    = coalesce(nullif(left(p_contact_name, 120), ''), c.contact_name),
      unread_count    = c.unread_count + 1,
      is_archived     = false
    where c.id = v_conv;
  end if;

  return query select v_conv, (v_ins is not null), v_new, (select c.unread_count from public.whatsapp_conversations c where c.id = v_conv);
end $$;

-- Estado de entrega de un mensaje saliente (sent/delivered/read/failed) según Meta.
create or replace function public.whatsapp_update_message_status(
  p_wa_message_id text,
  p_status        text,
  p_error         text default null
) returns void
language plpgsql security definer set search_path = public
as $$
begin
  if p_status not in ('sent', 'delivered', 'read', 'failed') then return; end if;
  -- Los estados solo avanzan (Meta puede entregarlos desordenados): sending < sent < delivered < read.
  update public.whatsapp_messages m set
    status = p_status,
    error  = case when p_status = 'failed' then left(p_error, 500) else m.error end
  where m.wa_message_id = p_wa_message_id and m.direction = 'out'
    and (case m.status when 'sending' then 0 when 'sent' then 1 when 'delivered' then 2 when 'read' then 3 else -1 end)
      < (case p_status  when 'sent' then 1 when 'delivered' then 2 when 'read' then 3 else 99 end);
end $$;

-- El staff marca una conversación como leída.
create or replace function public.whatsapp_mark_read(p_conversation_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare v_biz uuid;
begin
  select business_id into v_biz from public.whatsapp_conversations where id = p_conversation_id;
  if v_biz is null or not public.is_business_member(v_biz) then raise exception 'No autorizado'; end if;
  update public.whatsapp_conversations set unread_count = 0 where id = p_conversation_id and unread_count <> 0;
end $$;

-- El staff archiva / desarchiva una conversación.
create or replace function public.whatsapp_set_archived(p_conversation_id uuid, p_archived boolean)
returns void
language plpgsql security definer set search_path = public
as $$
declare v_biz uuid;
begin
  select business_id into v_biz from public.whatsapp_conversations where id = p_conversation_id;
  if v_biz is null or not public.is_business_member(v_biz) then raise exception 'No autorizado'; end if;
  update public.whatsapp_conversations set is_archived = p_archived where id = p_conversation_id;
end $$;

-- ---------------------------------------------------------------------
-- Ajustes del buzón para el panel (sin devolver el App Secret ni el token).
-- ---------------------------------------------------------------------
create or replace function public.get_whatsapp_inbox_config(p_business_id uuid)
returns table (enabled boolean, has_app_secret boolean, has_token boolean, phone_number_id text, verify_token text)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not public.is_business_member(p_business_id) then raise exception 'No autorizado'; end if;
  return query
  select b.whatsapp_inbox_enabled,
         coalesce(bi.whatsapp_app_secret is not null and length(bi.whatsapp_app_secret) > 0, false),
         coalesce(bi.whatsapp_token is not null and length(bi.whatsapp_token) > 0, false),
         bi.whatsapp_phone_number_id,
         bi.whatsapp_verify_token
  from public.businesses b
  left join public.business_integrations bi on bi.business_id = b.id
  where b.id = p_business_id;
end $$;

-- Guarda el interruptor y el App Secret (solo se sobrescribe si llega uno nuevo). Genera el
-- verify token la primera vez. El phone_number_id y el token de acceso se siguen guardando con
-- set_business_integration (ya existente).
create or replace function public.set_whatsapp_inbox_config(
  p_business_id uuid,
  p_enabled     boolean,
  p_app_secret  text default null
) returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not public.is_business_member(p_business_id) then raise exception 'No autorizado'; end if;
  update public.businesses set whatsapp_inbox_enabled = p_enabled where id = p_business_id;
  insert into public.business_integrations as bi (business_id, whatsapp_app_secret, whatsapp_verify_token)
  values (p_business_id, nullif(btrim(p_app_secret), ''), replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''))
  on conflict (business_id) do update set
    whatsapp_app_secret   = coalesce(nullif(btrim(p_app_secret), ''), bi.whatsapp_app_secret),
    whatsapp_verify_token = coalesce(bi.whatsapp_verify_token, excluded.whatsapp_verify_token);
end $$;

-- Permisos: nunca anon ni PUBLIC. Las dos funciones de entrada, solo service_role.
revoke execute on function public.whatsapp_ingest_message(uuid,text,text,text,text,text,timestamptz) from public, anon, authenticated;
revoke execute on function public.whatsapp_update_message_status(text,text,text) from public, anon, authenticated;
grant  execute on function public.whatsapp_ingest_message(uuid,text,text,text,text,text,timestamptz) to service_role;
grant  execute on function public.whatsapp_update_message_status(text,text,text) to service_role;

revoke execute on function public.whatsapp_mark_read(uuid) from public, anon;
revoke execute on function public.whatsapp_set_archived(uuid,boolean) from public, anon;
revoke execute on function public.get_whatsapp_inbox_config(uuid) from public, anon;
revoke execute on function public.set_whatsapp_inbox_config(uuid,boolean,text) from public, anon;
grant  execute on function public.whatsapp_mark_read(uuid) to authenticated;
grant  execute on function public.whatsapp_set_archived(uuid,boolean) to authenticated;
grant  execute on function public.get_whatsapp_inbox_config(uuid) to authenticated;
grant  execute on function public.set_whatsapp_inbox_config(uuid,boolean,text) to authenticated;
