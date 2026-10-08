---
name: project-reservas-saas
description: Turnigo — decisiones de arquitectura y estado que no se deducen del código; el detalle de features y pendientes está en README.md
metadata:
  type: project
---

Turnigo es un SaaS multi-tenant de reservas (Supabase + React) desplegado en Cloudflare Workers.
**No repetir aquí lo que ya está en `README.md` (funcionalidades, migraciones, pendientes) ni en
`CLAUDE.md` (flujo de trabajo, cuentas, secretos).** Este archivo solo guarda el porqué de
decisiones que el código no explica.

**Decisiones de diseño confirmadas con el usuario (no reabrir):**
- Credenciales de Google OAuth **por negocio**, no un Client ID único de plataforma.
- Mensajes de email: solo se personaliza el párrafo de introducción con placeholders, nunca
  asunto libre ni HTML libre (elegido explícitamente entre 3 opciones).
- Horario desde Google Business Profile: Google es la fuente de verdad, sin revisión manual.
- Ficha de psicólogo: modelo de "sesión" único con 4 campos (objetivo/notas/seguimiento/tareas),
  no notas y tareas sueltas (primera versión, descartada el mismo día).
- Etiquetas de cliente (VIP/Habitual…) eliminadas de la UI a petición del usuario; la columna
  `customers.tags` sigue en BD sin usar (no se hizo migración destructiva a propósito).
- Plano de sala = cuadrícula por zona, no croquis libre (para entregar antes).
- Reglas online (antelación, stock, pacing) nunca aplican al staff: "el jefe de sala sabe más que
  el algoritmo".
- Multi-local: el selector de negocio de `Layout.tsx` basta; API/webhooks no prioritarios.
- Agenda (2026-09-22): el color de la profesional es el fondo del bloque (no solo un borde fino);
  el estado se expresa con opacidad/tachado. El filtro de la leyenda es multi-selección con botón
  "Todas". A Nerea (Mimate) se le asignaron Manicura y Maquillaje para la demo porque no tenía
  ningún servicio.

**Cosas que ya se comprobaron y no hace falta volver a investigar:**
- `restaurante-la-plaza` apareció una vez con `is_active=false` sin causa conocida; se reactivó.
- `apps/dashboard/wrangler.jsonc` debe llamarse `turnigo-panel` (el worker real), no
  `turnigo-dashboard`.
- Tras aplicar una migración con RPCs nuevas hay que regenerar `packages/shared/src/database.types.ts`
  (`generate_typescript_types` del MCP) o `npm run build` falla.
- `ymdInTz`/`weekdayInTz` de `@reservas/shared` esperan un `Date`, no un string ISO.
- `supabase.functions.invoke` no expone el cuerpo del error: leerlo de `error.context.json()`.
- Franjas de Google Business Profile que cruzan medianoche se parten en dos filas de
  `business_hours` (`_shared/gbpHours.ts`, probado con 4 casos).
- supabase-js (auth-js) emite `SIGNED_IN` cada vez que la pestaña pasa de oculta a visible
  (`_recoverAndRefresh`); `AuthProvider` solo recarga el perfil si cambia el usuario.
- Scripts de reemplazo masivo de clases Tailwind (`text-slate-700` → `dark:…`) rompen los
  prefijos `hover:`/`focus:`; revisar esos casos a mano.

Lecciones técnicas reutilizables: [[feedback-supabase-rpc-overloads]],
[[feedback-sql-function-dot-star-side-effects]], [[feedback-postgrest-upsert-partial-index]],
[[feedback-edge-function-fetch-timeout]], [[feedback-cloudflare-deploy-verification]],
[[feedback-postgres-function-execute-grant]], [[feedback-no-native-browser-dialogs]].

**Auditoría de seguridad (2026-09-26)** — el usuario pidió una revisión amplia (rate limiting,
validación/sanitización de inputs, SQL injection, RLS, dependencias vulnerables). Diagnóstico
inicial: RLS ya estaba bien configurado en las 26 tablas (`is_business_member`/`is_super_admin`,
sin huecos) y no había SQL concatenado en ningún sitio (todo query builder o RPC con parámetros
nombrados) — esas dos partes del pedido estaban prácticamente resueltas de antes. El trabajo real
fue validación de inputs, rate limiting (no existía nada) y dependencias.

Decisiones confirmadas con el usuario (no reabrir):
- Priorizar 2 fallos de autorización reales encontrados en la auditoría (no pedidos explícitamente)
  antes que las 5 tareas genéricas: `send-confirmation-email` dejaba que cualquier staff de
  cualquier negocio reenviara la confirmación de una reserva ajena (sin comprobar pertenencia +
  `.ilike()` sin escapar); los 4 crons (`request-reviews`, `whatsapp-reminders`,
  `sync-google-business-hours`, `sync-google-busy`) quedaban abiertos si `CRON_SECRET`/
  `GOOGLE_SYNC_CRON_SECRET` llegaran a faltar (`if (secret && ...)` en vez de fail-closed).
- Rate limiting: **solo en Edge Functions**, no mover las RPC públicas de solo lectura del widget
  (`get_public_business`, `get_available_slots`...) detrás de una función — esas se llaman
  directamente desde el navegador vía `supabase.rpc()` y no hay dónde interceptarlas sin un refactor
  grande; el usuario aceptó dejarlas sin cubrir (menor riesgo al ser lectura).
- Salto de Vite 5→8 (cierra un aviso `esbuild` moderado) **pospuesto a propósito**: solo afecta al
  servidor de desarrollo local, nunca a lo que sirve Cloudflare en producción, y el salto de 3
  versiones mayores tenía riesgo real de romper la config de build sin beneficio en producción.

Qué se hizo (commits en orden, todos verificados en producción tras cada tanda):
1. `9886b59` — `send-confirmation-email` reescrito con el patrón dual-cliente (`asCaller` RLS +
   `service` solo para el secreto de Resend) en vez de service-role para todo; los 4 crons a
   fail-closed; `Clientes.tsx` escapa `%`/`_` antes de meterlos en un `.ilike()`.
2. `0ab8c01` + `0c53867` — validación estricta (zod) en `create-booking` y los dos formularios del
   widget; al probarla con un nombre `<script>` salió a la luz que `buildConfirmationEmail`/
   `buildReviewRequestEmail` interpolaban el nombre del cliente en el HTML del email sin escapar
   (ruta sin mensaje personalizado, la que usa la mayoría) — se corrigió en el mismo commit.
3. `842ee20` — infraestructura de rate limiting (migración `0032_rate_limiting.sql`: tabla
   `rate_limits` + función `rate_limit_hit()`, ventana fija, atómica, solo accesible por
   `service_role`) conectada a `create-booking` (8/10min por IP), `send-confirmation-email`
   (20/hora por usuario) y `generate-client-ai-report` (10/hora por usuario, cuesta una llamada
   real a Gemini).
4. `c29b4c0` — `react-router-dom` 6→7.18.4, `jspdf` 2→4.2.1 + `jspdf-autotable` 3→5.0.8 (la 3.x de
   autotable solo soporta jspdf `^2`, hubo que subir ambas juntas), `dompurify` parcheado vía
   `npm audit fix` sin `--force`. Verificado generando los dos PDF (`InformePdf.ts`/`ReciboPdf.ts`)
   desde la consola del navegador contra el build ya compilado, sin login (no hay forma de probarlo
   de otro modo sin credenciales).
5. `c1f3c4c` — validación extendida al resto del panel: `EditarTab.tsx` (ficha de cliente),
   `Seguimiento.tsx`/`HistorialTab.tsx` (notas de sesión clínica acotadas a 5000 caracteres),
   `PlanoSala.tsx` (lista de espera/walk-in), `Configuracion.tsx` (nombre del negocio, enlace de
   reseña validado como URL); de paso, `reviewUrl` pasó a escaparse en el `href` del email de
   petición de reseña.

Patrones establecidos para seguir el mismo estilo en el trabajo que falta:
- Validación vive duplicada a propósito en dos sitios que hay que mantener alineados:
  `packages/shared/src/validation.ts` (zod, usado por widget y dashboard) y
  `supabase/functions/_shared/validation.ts` (a mano, sin dependencias externas, usado por Edge
  Functions) — mismos límites de longitud en los dos.
- Rate limiting: `rateLimitHit(serviceClient, "nombreFuncion:ip|user:xxx", max, windowSeconds)` de
  `supabase/functions/_shared/rateLimit.ts`; devuelve 429 con `tooManyRequests(retryAfterSeconds)`.
- Al desplegar una Edge Function con el MCP, los ficheros de `_shared` se pasan con el mismo nombre
  relativo que usa el `import` (p.ej. `"../_shared/cors.ts"`) y el entrypoint siempre se llama
  `"index.ts"` — así es como ya estaban desplegadas las funciones existentes (comprobado leyendo
  `entrypoint_path` de `list_edge_functions` antes de tocar nada).

Rate limiting de la auditoría: **completado** (2026-09-28) en las 5 Edge Functions que
faltaban (`notify-waitlist`, `google-oauth-start`, `google-business-oauth-start`,
`admin-business-users`, `admin-create-business`) — mismo patrón `rateLimitHit`/`tooManyRequests`
que las 3 ya cubiertas, límites 10-30/hora por usuario según sensibilidad. `notify-waitlist`
necesitó mover el rate-limit a después de crear el cliente `service` (antes solo tenía el
cliente `asUser`, y `rate_limit_hit` solo es ejecutable por `service_role`).

Trabajo de esta auditoría que queda sin hacer (detalle también en `README.md → Pendientes`):
validación en `Servicios.tsx`/`Mesas.tsx`/`Franjas.tsx`/`Bloqueos.tsx` (mayoría campos
numéricos, prioridad baja) y en `admin/Businesses.tsx`/`admin/BusinessDetail.tsx` (slug,
timezone, color).

---

## Mini-CRM de negocios "autonomo" (2026-09-28)

Cuarto tipo de negocio (electricistas, fontaneros...): pipeline kanban, agenda interna,
presupuestos y facturas informativas. Un único usuario por negocio. Detalle funcional completo
en `README.md → Funcionalidades → Autónomo`; aquí solo las decisiones y lo aprendido.

**Decisiones de arquitectura (no reabrir sin motivo fuerte):**
- Las tablas con numeración/efecto en el pipeline (`crm_budgets`, `crm_invoices` y sus líneas,
  `crm_document_counters`) son **de solo lectura por RLS** para el cliente; toda escritura pasa
  por RPC `security definer` que numera de forma atómica (upsert con lock de fila implícito) y
  revalida `is_business_member` explícitamente. El resto (etapas, tarjetas, notas, agenda,
  catálogo, perfil fiscal) es CRUD directo por RLS normal — incluido el drag&drop del pipeline,
  que nunca pasa por RPC para que nunca se bloquee (requisito explícito del usuario).
- El mapeo "evento del flujo → etapa del pipeline" (`crm_stage_events`) es configurable por
  negocio porque las etapas son editables; no hay etapas fijas en el código en ningún sitio.
- Agenda interna = tabla `crm_events` nueva, no reutiliza `bookings` (evita mezclar reserva
  pública con un caso de uso puramente interno).

**Verificado en producción, no repetir la prueba:**
- Aislamiento cross-tenant con SQL directo simulando dos usuarios (`set_config('request.jwt.claims', ...)`):
  RLS y los RPC bloquean correctamente lectura/escritura/ejecución sobre datos de otro negocio.
- Numeración correlativa sin huecos (`P-2026-001` → `002` en llamadas consecutivas).
- Flujo completo en vivo con un negocio de prueba (creado y borrado en cascada al terminar):
  pipeline con drag&drop, presupuesto con cálculo de IVA correcto, flujo conectado moviendo la
  tarjeta sola (enviado→Presupuestado, factura pagada→Pagado), factura con la leyenda legal,
  ficha de cliente con las 3 pestañas nuevas.

**Bug encontrado y corregido probando en vivo:** el módulo (construido por un agente delegado)
usaba `window.confirm()` nativo para ofrecer generar la factura justo tras aceptar un
presupuesto — no aparecía nada y la factura nunca se creaba. El propio código del proyecto ya
documentaba en `ui.tsx` que `confirm()` no es fiable en el navegador de pruebas; hay que revisar
que cualquier código nuevo (propio o de un agente) siga el patrón `Modal`/`ConfirmDialog`
existente y no usar `confirm()`/`alert()`/`prompt()` nativos en ningún sitio del panel.

Migraciones: `0033_business_type_autonomo.sql` a `0037_crm_rpc_grants_harden.sql`. La `0037`
fue necesaria porque Postgres concede `EXECUTE` a `PUBLIC` por defecto al crear una función;
solo se había revocado explícitamente para una de las doce RPC nuevas — lección aparte en
`memory/feedback-*.md` si hace falta repetir el patrón.
