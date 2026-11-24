-- 0068_business_notifications.sql
-- Notificaciones del negocio: cada reserva ONLINE (channel = 'web') genera un aviso para todo el
-- personal del negocio (sección «Notificaciones» del panel + push al móvil).
--
--   * Opt-in por negocio: businesses.online_booking_notifications (por defecto false).
--     Esta migración lo activa solo para Centro de Psicología Ana Sánchez.
--   * Texto del aviso: «Nueva reserva online - <Nombre> <dd/mm/aaaa hh:mm>» (hora del negocio).
--   * Las suscripciones push reutilizan agency_push_subscriptions (son por usuario/dispositivo,
--     las mismas que ya usa el buzón de WhatsApp). El envío lo hace la Edge Function business-push.

alter table public.businesses
  add column if not exists online_booking_notifications boolean not null default false;

create table public.business_notifications (
  id           uuid primary key default gen_random_uuid(),
  business_id  uuid not null references public.businesses(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  kind         text not null check (kind in ('reserva_online')),
  title        text not null,
  booking_id   uuid references public.bookings(id) on delete cascade,
  read_at      timestamptz,
  push_sent_at timestamptz,
  created_at   timestamptz not null default now()
);
create index idx_business_notifications_user on public.business_notifications(user_id, business_id, created_at desc);
create index idx_business_notifications_push on public.business_notifications(created_at) where push_sent_at is null;
create unique index uq_business_notifications_booking on public.business_notifications(user_id, booking_id) where booking_id is not null;

alter table public.business_notifications enable row level security;
create policy business_notifications_select on public.business_notifications for select to authenticated
  using (user_id = auth.uid() and public.is_business_member(business_id));
create policy business_notifications_update on public.business_notifications for update to authenticated
  using (user_id = auth.uid() and public.is_business_member(business_id))
  with check (user_id = auth.uid() and public.is_business_member(business_id));
create policy business_notifications_delete on public.business_notifications for delete to authenticated
  using (user_id = auth.uid() and public.is_business_member(business_id));
-- Sin insert: solo el trigger (security definer). El usuario solo puede marcar como leído.
revoke update on public.business_notifications from authenticated, anon;
grant update (read_at) on public.business_notifications to authenticated;

-- Generador: una fila por miembro del negocio cuando entra una reserva online.
create or replace function public.notify_online_booking()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_tz text; v_enabled boolean; v_title text;
begin
  if new.channel <> 'web' or new.status = 'cancelada' then return new; end if;
  select coalesce(timezone, 'Europe/Madrid'), online_booking_notifications into v_tz, v_enabled
    from public.businesses where id = new.business_id;
  if not coalesce(v_enabled, false) then return new; end if;
  v_title := 'Nueva reserva online - ' || trim(new.customer_name || ' ' || coalesce(new.customer_last_name, ''))
             || ' ' || to_char(new.starts_at at time zone v_tz, 'DD/MM/YYYY HH24:MI');
  insert into public.business_notifications (business_id, user_id, kind, title, booking_id)
  select new.business_id, bu.user_id, 'reserva_online', v_title, new.id
    from public.business_users bu where bu.business_id = new.business_id
  on conflict do nothing;
  return new;
end;
$$;
create trigger trg_notify_online_booking after insert on public.bookings
  for each row execute function public.notify_online_booking();

revoke all on function public.notify_online_booking() from public, anon, authenticated;

alter publication supabase_realtime add table public.business_notifications;

-- Activar en Centro de Psicología Ana Sánchez.
update public.businesses set online_booking_notifications = true where slug = 'centrodepsicologia-anasanchez';

-- Cron cada minuto que dispara business-push. Sustituye REPLACE_WITH_SECRET por el valor de
-- CRON_SECRET (mismo patrón que 0046; el valor real no va en el repo).
select cron.unschedule('business-push-minutely') where exists (select 1 from cron.job where jobname = 'business-push-minutely');
select cron.schedule(
  'business-push-minutely',
  '* * * * *',
  $$
  select net.http_post(
    url := 'https://fjpbruwczuovvynhlnzv.supabase.co/functions/v1/business-push',
    headers := jsonb_build_object('Content-Type','application/json','x-cron-secret', 'REPLACE_WITH_SECRET'),
    body := '{}'::jsonb
  );
  $$
);
