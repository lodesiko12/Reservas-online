-- =====================================================================
-- 0028_fix_sync_google_busy_cron_secret.sql
-- Corrige un fallo real detectado en logs: el cron `sync-google-busy`
-- (Fase 5, migración 0022) seguía enviando el valor antiguo de
-- GOOGLE_SYNC_CRON_SECRET en su cabecera x-cron-secret, pero
-- sync-google-busy/index.ts comprueba
-- `Deno.env.get("CRON_SECRET") ?? Deno.env.get("GOOGLE_SYNC_CRON_SECRET")`
-- — desde que se configuró el CRON_SECRET genérico (Fase 7/8), ese es el
-- valor que se compara, y ya no coincide con lo que el cron enviaba.
-- Resultado: 401 en cada ejecución (cada 15 min) desde que se puso
-- CRON_SECRET. Sin impacto funcional hasta ahora porque ningún
-- profesional tiene Google Calendar conectado, pero había que corregirlo
-- antes de que alguno lo conecte.
--
-- IMPORTANTE — el secreto real NO está en este archivo, mismo patrón que
-- 0022/0025/0026: sustituye REPLACE_WITH_SECRET por el valor real de
-- CRON_SECRET si reejecutas esto en otro entorno.
-- =====================================================================

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
