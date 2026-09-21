-- =====================================================================
-- 0026_google_business_profile_hours_sync.sql
-- Sincronización AUTOMÁTICA (sin revisión manual) del horario general de
-- apertura del negocio (business_hours) desde su ficha de Google Business
-- Profile (GBP). Un solo sentido: Google → Turnigo. Reutiliza el mismo
-- Client ID/Secret ya guardado para Google Calendar (business_integrations,
-- 0021) — un mismo proyecto de Google Cloud puede pedir varios scopes — así
-- que no hace falta ninguna credencial nueva, solo habilitar las APIs
-- "Business Information" y "Account Management" en ese mismo proyecto y
-- conseguir la aprobación manual de Google ("Basic API Access").
--
-- Diseño (mismo patrón que professional_google_accounts en 0021, pero a
-- nivel de NEGOCIO, no de profesional, porque la ficha de GBP es del
-- negocio):
--   * business_google_profile_accounts guarda los tokens OAuth y la
--     ubicación (location) de GBP resuelta tras conectar.
--   * replace_business_hours_from_sync(): borra+inserta business_hours de
--     un negocio en una sola transacción — a diferencia del editor manual
--     de Configuración (dos llamadas sueltas desde el navegador), esto lo
--     ejecuta un cron desatendido y un fallo a mitad de camino no debe
--     dejar al negocio "cerrado toda la semana". Por eso es una función
--     SQL, no dos operaciones desde la Edge Function.
--   * Esa función SOLO la puede ejecutar `service_role` (no
--     `authenticated`): es la única función de todo el proyecto que rompe
--     el patrón `grant to authenticated`, precisamente porque no debe ser
--     invocable por un usuario normal para reescribir el horario de
--     cualquier negocio.
--   * v1 solo soporta negocios con una única ubicación de GBP bajo la
--     cuenta de Google conectada (ver `last_sync_status`); con 0 o 2+
--     ubicaciones la conexión queda guardada pero sin sincronizar.
-- =====================================================================

create table public.business_google_profile_accounts (
  business_id         uuid primary key references public.businesses(id) on delete cascade,
  google_email        text,               -- cuenta conectada, solo para mostrarla en el panel
  gbp_account_name    text,               -- resource name de Account Mgmt API, p.ej. 'accounts/123456789'
  gbp_location_name   text,               -- resource name de la ubicación, p.ej. 'accounts/123/locations/456' (null hasta resolverse a una sola)
  gbp_location_title  text,               -- nombre visible de la ficha, solo para mostrarlo en el panel
  access_token        text,               -- SECRETO, de corta duración
  refresh_token       text,               -- SECRETO
  token_expires_at    timestamptz,
  sync_enabled        boolean not null default true,
  last_synced_at      timestamptz,
  last_sync_status    text not null default 'pending', -- 'pending'|'ok'|'ok_with_warnings'|'error'|'no_locations'|'multiple_locations'
  last_sync_error     text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

alter table public.business_google_profile_accounts enable row level security;

-- Acceso directo a la tabla: solo super-admin (contiene tokens). El resto vía RPC.
create policy business_google_profile_accounts_admin on public.business_google_profile_accounts for all to authenticated
  using (public.is_super_admin()) with check (public.is_super_admin());

create trigger trg_bgpa_updated before update on public.business_google_profile_accounts
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- Reemplazo atómico de business_hours (solo invocable por service_role,
-- nunca por un usuario autenticado normal).
-- ---------------------------------------------------------------------
create or replace function public.replace_business_hours_from_sync(
  p_business_id uuid,
  p_rows        jsonb   -- [{ "weekday": int, "open_time": "HH:MM", "close_time": "HH:MM" }, ...]
) returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not exists (select 1 from public.businesses where id = p_business_id) then
    raise exception 'Negocio no encontrado';
  end if;

  delete from public.business_hours where business_id = p_business_id;

  insert into public.business_hours (business_id, weekday, open_time, close_time)
  select p_business_id, r.weekday, r.open_time, r.close_time
  from jsonb_to_recordset(p_rows) as r(weekday int, open_time time, close_time time)
  where r.close_time > r.open_time;  -- defensa extra; el mapeador de la Edge Function ya filtra esto
end $$;

revoke all on function public.replace_business_hours_from_sync(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.replace_business_hours_from_sync(uuid, jsonb) to service_role;

-- ---------------------------------------------------------------------
-- Estado de conexión del negocio (sin exponer tokens)
-- ---------------------------------------------------------------------
create or replace function public.get_business_google_profile_status(p_business_id uuid)
returns table (
  connected boolean, google_email text, location_title text, sync_enabled boolean,
  last_synced_at timestamptz, last_sync_status text, last_sync_error text
)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not public.is_business_member(p_business_id) then raise exception 'No autorizado'; end if;
  return query
  select (bgpa.business_id is not null), bgpa.google_email, bgpa.gbp_location_title,
         coalesce(bgpa.sync_enabled, true), bgpa.last_synced_at,
         coalesce(bgpa.last_sync_status, 'pending'), bgpa.last_sync_error
  from (select p_business_id as id) x
  left join public.business_google_profile_accounts bgpa on bgpa.business_id = x.id;
end $$;

create or replace function public.set_business_google_profile_sync(p_business_id uuid, p_enabled boolean)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not public.is_business_member(p_business_id) then raise exception 'No autorizado'; end if;
  update public.business_google_profile_accounts set sync_enabled = p_enabled, updated_at = now()
  where business_id = p_business_id;
end $$;

create or replace function public.disconnect_business_google_profile(p_business_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not public.is_business_member(p_business_id) then raise exception 'No autorizado'; end if;
  delete from public.business_google_profile_accounts where business_id = p_business_id;
  -- No se borran las filas de business_hours ya sincronizadas: desconectar
  -- solo detiene futuras sincronizaciones, el último horario queda como
  -- horario manual normal (editable desde "Horario de apertura").
end $$;

revoke execute on function public.get_business_google_profile_status(uuid) from public, anon;
revoke execute on function public.set_business_google_profile_sync(uuid,boolean) from public, anon;
revoke execute on function public.disconnect_business_google_profile(uuid) from public, anon;
grant execute on function public.get_business_google_profile_status(uuid) to authenticated;
grant execute on function public.set_business_google_profile_sync(uuid,boolean) to authenticated;
grant execute on function public.disconnect_business_google_profile(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- Cron: sincroniza cada hora (minuto 5, desfasado de los otros crons
-- horarios que van al minuto 0). Reutiliza el mismo CRON_SECRET ya
-- configurado para whatsapp-reminders-hourly/request-reviews-hourly — no
-- hace falta ningún secreto nuevo.
--
-- IMPORTANTE — el secreto real NO está en este archivo (no se commitea a
-- un repo público), mismo patrón que 0022/0025. Si se re-ejecuta este
-- archivo tal cual en otro entorno, sustituye REPLACE_WITH_SECRET por el
-- valor real de CRON_SECRET.
-- ---------------------------------------------------------------------
select cron.unschedule('sync-google-business-hours-hourly') where exists (select 1 from cron.job where jobname = 'sync-google-business-hours-hourly');

select cron.schedule(
  'sync-google-business-hours-hourly',
  '5 * * * *',
  $$
  select net.http_post(
    url := 'https://fjpbruwczuovvynhlnzv.supabase.co/functions/v1/sync-google-business-hours',
    headers := jsonb_build_object('Content-Type','application/json','x-cron-secret', 'REPLACE_WITH_SECRET'),
    body := '{}'::jsonb
  );
  $$
);
