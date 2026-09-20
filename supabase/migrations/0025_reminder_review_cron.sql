-- =====================================================================
-- 0025_reminder_review_cron.sql
-- Programa (pg_cron + pg_net) los cron jobs de whatsapp-reminders
-- (recordatorio 24h antes) y request-reviews (petición de reseña
-- post-visita), que hasta ahora existían como Edge Functions desplegadas
-- pero sin nada que las llamara periódicamente (a diferencia de
-- sync-google-busy, programado en 0022).
--
-- IMPORTANTE — el secreto real NO está en este archivo (no se commitea a
-- un repo público), mismo patrón que 0022_google_busy_sync_cron.sql. Si
-- se re-ejecuta este archivo tal cual en otro entorno, sustituye
-- REPLACE_WITH_SECRET por un valor aleatorio y configura el MISMO valor
-- como secreto de Edge Function `CRON_SECRET` en el dashboard de
-- Supabase (Edge Functions → Manage secrets) — si no, las funciones
-- quedan sin protección por secreto.
-- =====================================================================

select cron.unschedule('whatsapp-reminders-hourly') where exists (select 1 from cron.job where jobname = 'whatsapp-reminders-hourly');
select cron.unschedule('request-reviews-hourly') where exists (select 1 from cron.job where jobname = 'request-reviews-hourly');

select cron.schedule(
  'whatsapp-reminders-hourly',
  '0 * * * *',
  $$
  select net.http_post(
    url := 'https://fjpbruwczuovvynhlnzv.supabase.co/functions/v1/whatsapp-reminders',
    headers := jsonb_build_object('Content-Type','application/json','x-cron-secret', 'REPLACE_WITH_SECRET'),
    body := '{}'::jsonb
  );
  $$
);

select cron.schedule(
  'request-reviews-hourly',
  '0 * * * *',
  $$
  select net.http_post(
    url := 'https://fjpbruwczuovvynhlnzv.supabase.co/functions/v1/request-reviews',
    headers := jsonb_build_object('Content-Type','application/json','x-cron-secret', 'REPLACE_WITH_SECRET'),
    body := '{}'::jsonb
  );
  $$
);
