-- =====================================================================
-- 0022_google_busy_sync_cron.sql
-- Job programado que llama a la Edge Function sync-google-busy cada 15
-- minutos para importar los huecos ocupados de Google Calendar de cada
-- profesional conectado.
--
-- IMPORTANTE — el secreto real NO está en este archivo (no se commitea a
-- un repo público). En el entorno de producción, esta migración se aplicó
-- con el valor real embebido directamente en el comando (pg_cron no
-- permite leer variables de entorno de Postgres en este plan gestionado).
-- Si se re-ejecuta este archivo tal cual en otro entorno, sustituye
-- REPLACE_WITH_SECRET por un valor aleatorio y configura el MISMO valor
-- como secreto de Edge Function `GOOGLE_SYNC_CRON_SECRET` en el dashboard
-- de Supabase (Project Settings → Edge Functions → Secrets) — si no, la
-- función queda sin proteger (nadie la ataca con esto expuesto porque no
-- hace nada mientras no haya profesionales conectados, pero conviene
-- cerrarla cuanto antes).
-- =====================================================================

create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

select cron.unschedule('sync-google-busy') where exists (select 1 from cron.job where jobname = 'sync-google-busy');

select cron.schedule(
  'sync-google-busy',
  '*/15 * * * *',
  $$
  select net.http_post(
    url := 'https://fjpbruwczuovvynhlnzv.supabase.co/functions/v1/sync-google-busy',
    headers := jsonb_build_object('Content-Type','application/json','x-cron-secret', 'REPLACE_WITH_SECRET'),
    body := '{}'::jsonb
  );
  $$
);
