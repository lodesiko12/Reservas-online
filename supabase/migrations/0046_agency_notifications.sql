-- 0046_agency_notifications.sql
-- Avisos de la agencia: campana dentro de la app + notificaciones push al móvil (Web Push,
-- la app se instala como PWA y cada miembro activa los avisos). Sin email ni WhatsApp.
--
--   * agency_notifications: un aviso por persona. Los generan triggers (te asignan una tarea,
--     te mencionan en un comentario) y un cron diario (fecha límite cercana / vencida).
--   * agency_push_subscriptions: suscripciones Web Push de cada dispositivo del usuario.
--   * El envío del push lo hace la Edge Function agency-push (cron cada minuto: procesa los
--     avisos con push_sent_at null). Las claves VAPID viven en secretos de la función.

create table public.agency_notifications (
  id           uuid primary key default gen_random_uuid(),
  business_id  uuid not null references public.businesses(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  kind         text not null check (kind in ('asignada', 'mencion', 'vence_pronto', 'vence_hoy', 'atrasada')),
  title        text not null,
  body         text,
  team_id      uuid references public.agency_teams(id) on delete cascade,
  task_id      uuid references public.agency_tasks(id) on delete cascade,
  dedupe_key   text,
  read_at      timestamptz,
  push_sent_at timestamptz,
  created_at   timestamptz not null default now()
);
create index idx_agency_notifications_business on public.agency_notifications(business_id);
create index idx_agency_notifications_user on public.agency_notifications(user_id, created_at desc);
create index idx_agency_notifications_push on public.agency_notifications(created_at) where push_sent_at is null;
create unique index uq_agency_notifications_dedupe on public.agency_notifications(user_id, dedupe_key) where dedupe_key is not null;

alter table public.agency_notifications enable row level security;
create policy agency_notifications_select on public.agency_notifications for select to authenticated
  using (user_id = auth.uid() and public.agency_is_member(business_id));
create policy agency_notifications_update on public.agency_notifications for update to authenticated
  using (user_id = auth.uid() and public.agency_is_member(business_id))
  with check (user_id = auth.uid() and public.agency_is_member(business_id));
create policy agency_notifications_delete on public.agency_notifications for delete to authenticated
  using (user_id = auth.uid() and public.agency_is_member(business_id));
-- Sin insert: solo los triggers (security definer) y el cron crean avisos.
-- El usuario solo puede marcar como leído; no puede reescribir el contenido.
revoke update on public.agency_notifications from authenticated, anon;
grant update (read_at) on public.agency_notifications to authenticated;

alter publication supabase_realtime add table public.agency_notifications;

-- ---------------------------------------------------------------------
-- Suscripciones push
-- ---------------------------------------------------------------------
create table public.agency_push_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  endpoint   text not null unique,
  p256dh     text not null,
  auth       text not null,
  user_agent text,
  created_at timestamptz not null default now()
);
create index idx_agency_push_user on public.agency_push_subscriptions(user_id);

alter table public.agency_push_subscriptions enable row level security;
create policy agency_push_select on public.agency_push_subscriptions for select to authenticated
  using (user_id = auth.uid());
create policy agency_push_delete on public.agency_push_subscriptions for delete to authenticated
  using (user_id = auth.uid());
-- Alta/actualización por RPC: si el endpoint ya existía de otro usuario (móvil compartido o
-- cambio de cuenta), pasa a ser del usuario actual sin romper por RLS.
revoke insert, update on public.agency_push_subscriptions from authenticated, anon;

create or replace function public.agency_save_push_subscription(p_endpoint text, p_p256dh text, p_auth text, p_user_agent text)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'No autorizado'; end if;
  insert into public.agency_push_subscriptions (user_id, endpoint, p256dh, auth, user_agent)
  values (auth.uid(), p_endpoint, p_p256dh, p_auth, left(p_user_agent, 300))
  on conflict (endpoint) do update
    set user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth, user_agent = excluded.user_agent;
end;
$$;

-- ---------------------------------------------------------------------
-- Generadores de avisos
-- ---------------------------------------------------------------------
-- Te han asignado una tarea.
create or replace function public.agency_notify_assigned()
returns trigger language plpgsql security definer set search_path = public as $$
declare t record;
begin
  if new.user_id is not distinct from auth.uid() then return new; end if; -- te la asignaste tú
  select title, team_id, business_id, (select name from public.agency_teams where id = team_id) as team_name
    into t from public.agency_tasks where id = new.task_id;
  insert into public.agency_notifications (business_id, user_id, kind, title, body, team_id, task_id, dedupe_key)
  values (t.business_id, new.user_id, 'asignada', 'Te han asignado una tarea', t.title || ' · ' || coalesce(t.team_name, ''), t.team_id, new.task_id,
          'asignada:' || new.task_id || ':' || new.created_at::text)
  on conflict do nothing;
  return new;
end;
$$;
create trigger trg_agency_notify_assigned after insert on public.agency_task_assignees
  for each row execute function public.agency_notify_assigned();

-- Te mencionan en un comentario.
create or replace function public.agency_notify_mentions()
returns trigger language plpgsql security definer set search_path = public as $$
declare t record; v_author text; u uuid;
begin
  select title into t from public.agency_tasks where id = new.task_id;
  select full_name into v_author from public.agency_members where business_id = new.business_id and user_id = new.author_id;
  foreach u in array new.mentions loop
    continue when u is not distinct from new.author_id;
    insert into public.agency_notifications (business_id, user_id, kind, title, body, team_id, task_id, dedupe_key)
    values (new.business_id, u, 'mencion', coalesce(v_author, 'Alguien') || ' te ha mencionado', t.title || ': ' || left(new.body, 140), new.team_id, new.task_id,
            'mencion:' || new.id)
    on conflict do nothing;
  end loop;
  return new;
end;
$$;
create trigger trg_agency_notify_mentions after insert on public.agency_task_comments
  for each row execute function public.agency_notify_mentions();

-- Fechas límite: mañana (vence_pronto), hoy (vence_hoy) y ayer sin terminar (atrasada).
-- Una sola vez por tarea y fecha gracias a dedupe_key. Pensada para un cron diario por la mañana.
create or replace function public.agency_generate_deadline_notifications()
returns int
language plpgsql security definer set search_path = public
as $$
declare v_today date := (now() at time zone 'Europe/Madrid')::date; v_n int;
begin
  with src as (
    select t.business_id, a.user_id, t.team_id, t.id as task_id, t.title, t.due_date,
           case when t.due_date = v_today + 1 then 'vence_pronto'
                when t.due_date = v_today     then 'vence_hoy'
                else 'atrasada' end as kind
    from public.agency_tasks t
    join public.agency_task_assignees a on a.task_id = t.id
    join public.agency_members m on m.business_id = a.business_id and m.user_id = a.user_id and m.is_active
    where t.status <> 'hecha' and t.due_date in (v_today + 1, v_today, v_today - 1)
  )
  insert into public.agency_notifications (business_id, user_id, kind, title, body, team_id, task_id, dedupe_key)
  select business_id, user_id, kind,
         case kind when 'vence_pronto' then 'Una tarea vence mañana'
                   when 'vence_hoy' then 'Una tarea vence hoy'
                   else 'Tienes una tarea atrasada' end,
         title, team_id, task_id, kind || ':' || task_id || ':' || due_date
  from src
  on conflict do nothing;
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

-- ---------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------
revoke all on function public.agency_save_push_subscription(text, text, text, text) from public, anon;
grant execute on function public.agency_save_push_subscription(text, text, text, text) to authenticated;
revoke all on function public.agency_notify_assigned() from public, anon, authenticated;
revoke all on function public.agency_notify_mentions() from public, anon, authenticated;
revoke all on function public.agency_generate_deadline_notifications() from public, anon, authenticated;
grant execute on function public.agency_generate_deadline_notifications() to service_role;

-- ---------------------------------------------------------------------
-- Crons. El secreto real NO va en el repo (mismo patrón que 0022/0025/0028): sustituye
-- REPLACE_WITH_SECRET por el valor de CRON_SECRET si reejecutas esto en otro entorno.
-- ---------------------------------------------------------------------
select cron.unschedule('agency-deadlines-daily') where exists (select 1 from cron.job where jobname = 'agency-deadlines-daily');
select cron.schedule('agency-deadlines-daily', '0 6 * * *', $$ select public.agency_generate_deadline_notifications(); $$);

select cron.unschedule('agency-push-minutely') where exists (select 1 from cron.job where jobname = 'agency-push-minutely');
select cron.schedule(
  'agency-push-minutely',
  '* * * * *',
  $$
  select net.http_post(
    url := 'https://fjpbruwczuovvynhlnzv.supabase.co/functions/v1/agency-push',
    headers := jsonb_build_object('Content-Type','application/json','x-cron-secret', 'REPLACE_WITH_SECRET'),
    body := '{}'::jsonb
  );
  $$
);
