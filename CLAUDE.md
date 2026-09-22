# Turnigo — instrucciones del proyecto

Qué es el proyecto, qué hace cada feature y la lista de pendientes están en `README.md`
(sección "Funcionalidades" y "Pendientes"). Este archivo solo contiene reglas de trabajo y datos
que no se deducen del código.

## Verificar SIEMPRE contra Cloudflare, nunca localhost

Solo cuenta como "funciona" lo que se ve en producción:

- Panel (negocio + superadmin): https://turnigo-panel.lodesiko12.workers.dev/
- Widget: https://turnigo-widget.lodesiko12.workers.dev/?slug=<slug>

Flujo tras cualquier cambio de código:
1. `npm run build` en los workspaces afectados.
2. Commit y **pedir confirmación antes de `git push` a `main`** (siempre, aunque el usuario suela
   decir "hazlo ya"). El push dispara Cloudflare Workers Builds (`turnigo-panel` y `turnigo-widget`,
   deploys separados que no siempre acaban a la vez). Nunca `wrangler deploy` a mano.
3. Esperar el deploy (minutos) con la tool `Monitor`: `curl` a la URL, extraer el hash del bundle
   (`grep -o 'assets/index-[a-zA-Z0-9]*\.js'`) y comparar con el anterior. Sin `sleep` en primer plano.
4. Verificar el flujo completo en el navegador contra las URLs de arriba (completar una reserva real,
   no solo ver que aparece un botón). Borrar cualquier dato de prueba justo después.

## Backend (Supabase) — reglas

- Proyecto `reservas-saas`, ref `fjpbruwczuovvynhlnzv`, `https://fjpbruwczuovvynhlnzv.supabase.co`,
  plan **Free** (riesgo de pausado por inactividad; recomendado Pro, el usuario no lo ha decidido).
- No hay staging: las migraciones de `supabase/migrations/` se aplican directamente a producción.
  **Pedir confirmación antes de cualquier migración o cambio en la BD**, sin excepción por
  "es aditivo/bajo riesgo". Se pueden agrupar varias migraciones ya presentadas en una sola
  confirmación si el usuario lo pide así.
- Edge Functions: se despliegan con `deploy_edge_function` del MCP de Supabase (Cloudflare solo
  cubre las dos apps). Generar el payload leyendo el archivo real de disco, nunca retipeándolo.
- Secretos de Edge Functions: solo el usuario puede ponerlos, en Supabase → menú principal →
  **Edge Functions → Manage secrets** (ya no están en Project Settings). Los ya configurados:
  `CRON_SECRET`, `GOOGLE_STATE_SECRET`, `DASHBOARD_URL`, `GOOGLE_SYNC_CRON_SECRET`. El valor real de
  `CRON_SECRET` está embebido en los cron jobs:
  `select command from cron.job where jobname='whatsapp-reminders-hourly';`
- Esta sesión sí puede usar `pg_cron`/`pg_net` por SQL directo.
- Lecciones técnicas de Postgres/Supabase ya aprendidas (leer antes de tocar RPCs o probar funciones
  por SQL): `memory/feedback-*.md` — firma de RPC, reescribir desde `pg_get_functiondef`, upsert con
  índice parcial, `select (fn()).*`, timeout en `fetch` de Edge Functions.
- El trigger `guard_business_update` exige sesión real de super-admin para cambiar `type`/`slug`/
  `is_active` de un negocio. No intentar saltarlo por SQL (`DISABLE TRIGGER`, spoof de
  `request.jwt.claims`): está bloqueado por el clasificador de seguridad. Usar la UI
  (`Admin → Editar negocio`).
- Antes de añadir un valor a un enum compartido (`business_type`, `booking_status`...), auditar
  con agentes Explore toda comparación literal en SQL y TS; hay datos reales en producción.
- Gemini (`generate-client-ai-report`): modelo en la constante `MODEL`
  (`gemini-3.6-flash`; `gemini-2.5-flash` ya no existe para claves nuevas). Devuelve 503/429 con
  frecuencia — el panel reintenta 3 veces. Si Google lo retira, el 404 indica el modelo sustituto.

## Cuentas para probar

- Super-admin real: `lodesiko12@gmail.com` (la cuenta del usuario). Credenciales en la memoria
  local del asistente, nunca en el repo.
- Negocio demo restaurante: `restaurante-la-plaza` (`staff@restaurante.test` / `Restaurante1234!`).
- `barberia-demo` y `admin@reservas.test` **ya no existen** en producción (`seed.sql` los recrearía).
- Para citas/psicólogo se usa un negocio **real** del usuario, *Ana Sánchez Psicóloga*
  (`ana-sanchez-psicologa`, `type='psicologo'`): crear solo datos de prueba propios y borrarlos al
  terminar; no tocar clientes/reservas reales.

## Cómo prefiere trabajar el usuario

- Pide tandas de 3-5 cambios y espera que se hagan todos en la sesión, con commits por tanda.
- Si pide "otra forma de hacer X", quiere opciones en el chat antes de tocar código.
- Suele probar lo entregado y pedir un ajuste fino después: es la misma feature, mismo flujo.
- Da credenciales reales en el chat y pide guardarlas: van a la memoria local, nunca al repo.
