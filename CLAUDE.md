# Turnigo — instrucciones del proyecto

## Verificación de cambios: SIEMPRE contra Cloudflare, NUNCA localhost

La app está desplegada en Cloudflare Workers y **eso es lo único que el usuario considera
"la app funcionando"**. Un `npm run dev` en local no cuenta como verificación válida.

- Panel de administración (dashboard + superadmin): **https://turnigo-panel.lodesiko12.workers.dev/**
- Widget de reservas (cliente): **https://turnigo-widget.lodesiko12.workers.dev/?slug=<slug-del-negocio>**

**Despliegue**: Cloudflare Workers Builds está conectado por Git al repo
(`github.com/lodesiko12/Reservas-online`) — cualquier `git push` a `main` dispara el build y
deploy automáticamente en Cloudflare, tanto para `apps/dashboard` (worker `turnigo-panel`) como
para `apps/widget` (worker `turnigo-widget`). No hay que ejecutar `wrangler deploy` a mano.

Flujo de verificación tras cualquier cambio de código:
1. `npm run build` en el/los workspace(s) afectados para detectar errores de tipos.
2. Commit y `git push` a `main` (previa confirmación del usuario, como con cualquier push).
3. Esperar a que Cloudflare termine el build/deploy (unos minutos) antes de verificar — un
   `git push` no es instantáneo en producción.
4. Verificar el cambio abriendo la URL de Cloudflare de arriba en el navegador, **no**
   `localhost:5173` / `localhost:5174`. Esas URLs solo sirven para desarrollo rápido, no como
   prueba de que algo "funciona".

## Infra

- Backend: Supabase, proyecto `reservas-saas` (`project_id` / ref `fjpbruwczuovvynhlnzv`, región
  eu-west-1). URL `https://fjpbruwczuovvynhlnzv.supabase.co`.
- El widget y el dashboard comparten ese mismo proyecto Supabase (ver `.env.production` de cada app).
- Migraciones SQL en `supabase/migrations/`, aplicadas directamente al proyecto de producción de
  arriba (no hay entorno de staging separado). Nunca cambiar la firma de un RPC ya expuesto sin
  `drop function` de la firma vieja primero (si no, PostgREST deja una sobrecarga ambigua).
- Superadmin real: `lodesiko12@gmail.com` (coincide con la cuenta del usuario). No hay credenciales
  de prueba con contraseña conocida para este entorno — para probar flujos de superadmin, pedir al
  usuario que inicie sesión él mismo en el panel.

## Dónde se configuran los secretos de Edge Functions

Ya **no** están en Project Settings del dashboard de Supabase. Hay que ir al menú principal
(el de siempre, con Table Editor/SQL Editor/Database/Auth...) → **Edge Functions** → botón/pestaña
**"Manage secrets"** (arriba de la lista de funciones). Son secretos compartidos por **todas** las
funciones del proyecto. Esta sesión no tiene forma de configurarlos vía API/MCP — solo el usuario
puede hacerlo a mano.

## Google Calendar — 3 secretos de plataforma ya configurados (2026-09-20)

El código de sincronización con Google Calendar (`google-oauth-start`, `google-oauth-callback`,
`sync-google-event`, `sync-google-busy`) está desplegado y los 3 secretos de plataforma que
necesitaba (`GOOGLE_STATE_SECRET`, `DASHBOARD_URL`, `GOOGLE_SYNC_CRON_SECRET`) ya fueron
configurados por el usuario. **Pendiente de verificar el flujo completo end-to-end**: ningún negocio
tiene todavía su propio Client ID/Secret de Google Cloud configurado (paso previo distinto, por
negocio, ver abajo), así que "Conectar con Google Calendar" no se ha podido probar de principio a
fin todavía.

Cada negocio que quiera usar Google Calendar necesita su propio Client ID/Secret de un
proyecto de Google Cloud (gratis: Google Cloud Console → habilitar Calendar API → credencial OAuth
"Aplicación web"), pegado en `Configuración → Integraciones → Google Calendar` dentro del panel,
con la URI de redirección `https://fjpbruwczuovvynhlnzv.supabase.co/functions/v1/google-oauth-callback`
autorizada en ese proyecto de Google Cloud.

## Crons de recordatorio y reseña — falta configurar 1 secreto de Edge Functions

Migración `0025_reminder_review_cron.sql` (2026-09-20) programó dos cron jobs cada hora
(`whatsapp-reminders-hourly`, `request-reviews-hourly`) que llaman a las Edge Functions del mismo
nombre, que hasta entonces estaban desplegadas pero sin nada que las invocara periódicamente (a
diferencia de `sync-google-busy`, programado en la Fase 5). **Falta el secreto `CRON_SECRET`**: sin
él, ambas funciones responden 401 a la llamada del cron. El valor real está embebido en los propios
cron jobs de la base de datos (nunca se commitea al repo):
```sql
select command from cron.job where jobname='whatsapp-reminders-hourly';
```
Una vez copiado ese valor, configurarlo como secreto `CRON_SECRET` (mismo sitio que los 3 de Google
Calendar arriba).

Además, para que `request-reviews` envíe algo, cada negocio necesita rellenar su **"Enlace de
reseña"** en `Panel → Configuración → Reseñas` (vacío por defecto = no se envía nada para ese
negocio).

## Mensajes de email personalizables (Fase 7, 2026-09-20)

Cada negocio puede personalizar, desde `Panel → Configuración`, el párrafo de introducción del
email de confirmación (`businesses.confirmation_email_message`) y del email de petición de reseña
(`businesses.review_email_message`), con placeholders `{cliente}` `{negocio}` `{servicio}`
`{fecha}` `{hora}` (los dos últimos solo en confirmación). Si se deja vacío, se usa el texto por
defecto de siempre. La lógica de sustitución vive en `supabase/functions/_shared/email.ts`
(`applyPlaceholders`) — no es un motor de plantillas de propósito general, solo sustituye el
párrafo de introducción; el resto del diseño del email (cabecera de color, tarjeta del código
localizador...) sigue siendo fijo, decisión explícita para no arriesgar con HTML libre por negocio.

## Más contexto

Ver `README.md` (sección "## Pendientes" para la lista canónica de tareas pendientes) y
`memory/project-reservas-saas.md` para el historial de decisiones de arquitectura.
