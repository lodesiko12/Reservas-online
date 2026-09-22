# Turnigo — SaaS de reservas online (multi-tenant)

Plataforma **multi-tenant** de reservas para negocios locales, con tres piezas:

1. **Widget embebible** — se inserta en la web del negocio vía `<script>` + iframe aislado, con branding por tenant. También funciona como página standalone (sirve tal cual como "enlace de reservas" en una ficha de Google Business Profile).
2. **Panel de negocio** — agenda, KPIs, clientes, servicios, bloqueos, reportes y configuración.
3. **Panel super-admin** — alta de negocios, usuarios de staff y activación de suscripciones (sin registro público).

Tipos de tenant (`business_type`):
- **`citas`** (clínicas, peluquerías…): reserva de un servicio con duración y, opcionalmente, un profesional.
- **`psicologo`**: igual que `citas` + ficha clínica de cliente (sesiones, informe con IA, recibo).
- **`restaurante`**: franjas de servicio (`dining_shifts`) con aforo, mesas físicas y plano de sala.

Todo el backend vive en **Supabase** (Postgres + Auth + RLS + Edge Functions + Storage). Frontends en **Cloudflare Workers** (push a `main` → deploy automático). Ver [`CLAUDE.md`](CLAUDE.md) para el flujo de trabajo y verificación.

---

## Arquitectura y decisiones

**Frontend: React + Vite + TypeScript + Tailwind** (modo oscuro con `darkMode: "class"`). El widget se compila como app independiente para que su bundle sea pequeño y embebible. Monorepo con npm workspaces: `packages/shared` (cliente Supabase tipado, helpers de fecha/timezone) consumido por ambas apps.

**El motor de disponibilidad vive en la base de datos** (`get_available_slots` / `get_available_dining_slots`, PL/pgSQL) y es la **única fuente de verdad**: horario del negocio ∩ disponibilidad del servicio ∩ horario del profesional − reservas − bloqueos. La creación de reserva **re-valida bajo un lock por negocio** (`pg_advisory_xact_lock`) para evitar dobles reservas; en restaurante, además, una constraint `EXCLUDE` impide físicamente dos reservas solapadas en la misma mesa.

**Aislamiento multi-tenant con RLS.** Cada tabla filtra por `business_id` mediante `is_business_member()`; el super-admin (`profiles.is_super_admin`) tiene visión global. Los clientes finales **no tienen cuenta**: el widget usa RPCs `SECURITY DEFINER` (lectura) y la Edge Function `create-booking` con `service_role` (escritura).

**Secretos por negocio** (Resend, WhatsApp, Google OAuth, Gemini) en `business_integrations`, con RLS que impide leerlos desde el navegador: el panel solo ve un estado "configurada ✓" vía RPCs `get_*_status`/`set_*`; solo las Edge Functions los leen con `service_role`. Los secrets globales de plataforma son un fallback opcional.

**Reglas online vs. staff**: antelación mín/máx, límites de comensales, stock online y pacing solo aplican a `p_channel='web'`; las reservas manuales del staff siempre ven el aforo completo.

---

## Estructura del proyecto

```
.
├── apps/
│   ├── widget/                 # Widget embebible (React/Vite) — public/embed.js carga el iframe
│   └── dashboard/              # Panel super-admin (src/admin) + panel de negocio (src/business)
├── packages/shared/            # Cliente Supabase tipado, tipos DB (database.types.ts), formato/timezone
├── supabase/
│   ├── migrations/             # Esquema + RLS + lógica (ver tabla abajo)
│   ├── seed.sql                # Datos demo
│   └── functions/              # Edge Functions (Deno); _shared/ = cors, email, whatsapp, google, gbpHours
│       ├── create-booking            # Público: crea reserva (citas o mesa) + email + export a Google
│       ├── send-confirmation-email   # Reenvía el email de confirmación
│       ├── whatsapp-reminders        # Cron horario: recordatorio 24h por WhatsApp
│       ├── request-reviews           # Cron horario: email de petición de reseña 1-3h post-visita
│       ├── notify-waitlist           # Panel: avisa por WhatsApp que hay mesa
│       ├── admin-create-business     # Super-admin: alta de negocio + staff
│       ├── admin-business-users      # Super-admin: añadir/quitar/cambiar rol de usuarios de un negocio
│       ├── google-oauth-start / google-oauth-callback / sync-google-event / sync-google-busy
│       │                             # Google Calendar por profesional (export de citas + import de ocupados cada 15 min)
│       ├── google-business-oauth-start / google-business-oauth-callback / sync-google-business-hours
│       │                             # Horario desde Google Business Profile (cron horario)
│       └── generate-client-ai-report # Psicólogo: informe de cliente con Gemini
└── memory/                     # Lecciones técnicas para el asistente (feedback-*.md)
```

### Migraciones

| Archivo | Contenido |
|---|---|
| `0001_core_schema.sql` | Extensiones, enums y todas las tablas |
| `0002_rls_policies.sql` | Funciones de rol + políticas RLS + triggers de guarda (`guard_business_update`) |
| `0003_logic_and_rpcs.sql` | Motor de disponibilidad, localizador, RPCs públicas, creación transaccional |
| `0004_security_hardening.sql` | `search_path` fijo + revocar `create_public_booking` a anon |
| `0005_storage_logos.sql` | Bucket público `logos` |
| `0006_restaurant_logic.sql` | Motor de aforo de restaurante (`dining_shifts`, `get_available_dining_slots`, `create_public_dining_booking`) |
| `0007_business_integrations.sql` | Credenciales de email/WhatsApp por negocio (RLS + RPCs) |
| `0008_customer_phone_normalization.sql` | Clientes agrupados por teléfono normalizado (`phone_norm`, índice único parcial) |
| `0009_dining_tables.sql` (+`0009b`, `0009c`) | Zonas y mesas físicas, duración por nº de comensales, asignación best-fit + override manual |
| `0010_add_pendiente_status.sql` | Estado `pendiente` (confirmación manual) |
| `0011_dining_settings.sql` (+`0011b`) | `dining_settings` (antelación, comensales online, confirmación manual), pacing/stock online/doblar mesa/limpieza por franja, `dining_table_combos` |
| `0012` / `0013` | Estado `sentada`; canal `walkin` |
| `0014_walkins_and_realtime.sql` | `dining_assign_table` (motor de asignación reutilizable), `create_walkin_booking`, notas de cliente, Realtime en `bookings` |
| `0015_waitlist_and_reviews.sql` | Lista de espera, enlace de reseña y plantilla de WhatsApp por negocio, `review_requests_log` |
| `0016_import_customer_rpc.sql` | `import_customer`: upsert por teléfono normalizado (importación CSV y alta manual) |
| `0017` / `0018` / `0019` | Servicios↔profesionales N:N (`service_professionals`), `professionals.color`, selección de profesional en RPCs (0019 corrige una regresión de 0018 en el upsert de clientes) |
| `0020_max_advance_days.sql` | `businesses.max_advance_days` + `p_channel` en RPCs de citas |
| `0021` / `0022` | Google Calendar: `professional_google_accounts`, `bookings.google_event_id`, `blocks.source`; cron `sync-google-busy` cada 15 min |
| `0023_public_available_days.sql` | `get_available_days` / `get_available_dining_days` (el widget oculta días sin huecos) |
| `0024_email_custom_messages.sql` | `businesses.confirmation_email_message` / `review_email_message` |
| `0025_reminder_review_cron.sql` | Crons `whatsapp-reminders-hourly` y `request-reviews-hourly` |
| `0026_google_business_profile_hours_sync.sql` | `business_google_profile_accounts`, `replace_business_hours_from_sync` (solo `service_role`), cron `sync-google-business-hours-hourly` (minuto 5) |
| `0027_business_type_psicologo.sql` | Valor `psicologo` en `business_type` |
| `0028_fix_sync_google_busy_cron_secret.sql` | El cron de `sync-google-busy` pasa a usar `CRON_SECRET` |
| `0029` / `0030` | Psicólogo: `customers.nif`, `client_sessions` (una fila por sesión: objetivo, notas, seguimiento, tareas_pautas), `client_ai_reports`, `business_integrations.gemini_api_key` + RPCs `get_gemini_status`/`set_gemini_key` |

Los cron jobs se crean con el secreto como placeholder `REPLACE_WITH_SECRET`; en producción está el valor real embebido en `cron.job`.

---

## Variables de entorno

Copia `.env.example` a `.env`. Frontend (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_WIDGET_URL`) se expone al navegador; los valores de producción están en `apps/*/.env.production`.

Secrets de Edge Functions (Supabase → Edge Functions → Manage secrets; `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` los inyecta Supabase):

| Variable | Uso |
|---|---|
| `CRON_SECRET` | Cabecera `x-cron-secret` de todos los crons (`whatsapp-reminders`, `request-reviews`, `sync-google-busy`, `sync-google-business-hours`) |
| `GOOGLE_STATE_SECRET` | Firma HMAC del `state` de los flujos OAuth de Google |
| `DASHBOARD_URL` | Redirección al panel tras el callback de OAuth |
| `GOOGLE_SYNC_CRON_SECRET` | Legado (sustituido por `CRON_SECRET` en 0028) |
| `RESEND_API_KEY`, `EMAIL_FROM`, `WIDGET_URL` | Fallback global de email si el negocio no tiene su propia clave |
| `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_TEMPLATE_NAME`, `WHATSAPP_TEMPLATE_LANG` | Fallback global de WhatsApp |

---

## Puesta en marcha desde cero (otro proyecto Supabase)

```bash
npm install
supabase login && supabase link --project-ref TU_PROJECT_REF
supabase db push                                  # migraciones
supabase db execute --file supabase/seed.sql      # datos demo (opcional)
supabase functions deploy                         # todas las funciones
```
`create-booking`, los crons (`whatsapp-reminders`, `request-reviews`, `sync-google-busy`, `sync-google-business-hours`) y los callbacks OAuth (`google-oauth-callback`, `google-business-oauth-callback`) van con `--no-verify-jwt`: son endpoints públicos con su propia validación. Después, configurar los secrets de arriba y sustituir `REPLACE_WITH_SECRET` en los cron jobs (`cron.alter_job` o re-ejecutar el `cron.schedule` de las migraciones 0022/0025/0026/0028 con el valor real).

Marcar una cuenta como super-admin:
```sql
update public.profiles set is_super_admin = true where id = (select id from auth.users where email = 'tu@email.com');
```

### Local
```bash
npm run dev:dashboard   # http://localhost:5173
npm run dev:widget      # http://localhost:5174  (demo: /demo-host.html)
```
Solo para desarrollo; la verificación se hace contra Cloudflare (ver `CLAUDE.md`).

### Despliegue (Cloudflare Workers)
Workers Builds está conectado al repo `github.com/lodesiko12/Reservas-online`: cada push a `main` construye y despliega `turnigo-panel` (`apps/dashboard`) y `turnigo-widget` (`apps/widget`) según sus `wrangler.jsonc`. Las variables `VITE_*` se leen de `apps/*/.env.production`. Las Edge Functions no pasan por Cloudflare: se despliegan con el CLI/MCP de Supabase.

---

## Funcionalidades

### Comunes (todos los tipos)
- **Widget**: flujo de reserva por pasos, solo muestra días con huecos (`get_available_days`), branding por negocio (color + logo), "Mi reserva" por localizador (consulta/cancelación). Embebido: `<div id="reservas-widget" data-slug="…"></div><script src="https://turnigo-widget.lodesiko12.workers.dev/embed.js" async></script>` (iframe aislado, autoajuste de altura vía `postMessage`; `data-view="mi-reserva"` abre la consulta directamente).
- **Agenda** con vistas Día / Semana / Mes, edición al clic (estado, reprogramar, reasignar mesa), leyenda de colores por profesional. En citas solo se ofrece completada/cancelada/ausente.
- **Nueva reserva manual** (sin límites de antelación ni stock; selector de profesional o mesa).
- **Clientes**: ficha, alta manual, importación CSV (`import_customer`), notas privadas, eliminación (conserva el historial de reservas).
- **Reportes**: estadísticas históricas (últimos N días) + sección "Próximas reservas".
- **Bloqueos** (cierres puntuales, vacaciones) a nivel negocio/profesional.
- **Configuración**: horario (editor `WindowsEditor` con "copiar a todos los días" y "rellenar rápido" con hasta 2 franjas), branding, snippet del widget, antelación máxima (`max_advance_days`), integraciones (Resend, WhatsApp, Google), mensaje personalizado del email de confirmación y de reseña (placeholders `{cliente}` `{negocio}` `{servicio}` `{fecha}` `{hora}`; vacío = texto por defecto; solo se personaliza ese párrafo, el diseño del email es fijo), enlace de reseña, horario desde Google Business Profile.
- **Email de confirmación** (Resend) al reservar y reenvío manual. **Recordatorio WhatsApp 24h** (plantilla aprobada de Meta con 4 variables: cliente, negocio, fecha, hora) y **petición de reseña** 1-3h tras la visita (solo si el negocio tiene enlace de reseña). Ambos crons son idempotentes vía tablas de log.
- **Google Calendar** por profesional: cada negocio pone su Client ID/Secret de Google Cloud (Calendar API habilitada, URI de redirección `https://fjpbruwczuovvynhlnzv.supabase.co/functions/v1/google-oauth-callback`); cada profesional conecta su cuenta desde su ficha. Exporta citas como eventos y importa ocupados de Google como `blocks` cada 15 min. Estado: desplegado, sin ningún negocio que lo haya configurado todavía.
- **Horario desde Google Business Profile**: sobrescribe `business_hours` cada hora desde la ficha de Google, sin revisión manual, mientras esté activado. Reutiliza el mismo Client ID/Secret de Calendar (hay que habilitar las APIs "Business Information" y "Account Management" y autorizar la URI `…/functions/v1/google-business-oauth-callback`). v1 solo soporta una ficha por cuenta conectada. Estado: inerte hasta que un negocio consiga la aprobación "Basic API Access" de Google (ver Pendientes).
- **Panel super-admin**: listado con KPIs de plataforma; por negocio: dashboard, editar (nombre, slug, tipo, color, timezone, suscripción, aforo/granularidad), usuarios (varios logins por negocio, Edge Function `admin-business-users`), integraciones, desactivar (soft) o borrar definitivamente (confirmación escribiendo el nombre). Cambiar `type`/`slug`/`is_active` solo es posible desde aquí (trigger `guard_business_update`).
- **UI**: sidebar plegable y fijo (`localStorage` `turnigo:sidebar-collapsed`), modo oscuro/claro (`turnigo:theme`, fallback al sistema), responsive (drawer en <1024px, tablas con scroll horizontal).

### Citas
- Servicios con duración, precio, disponibilidad propia y profesionales asignados (N:N). Color por profesional (paleta automática, editable). Si un servicio tiene >1 profesional, el widget y la reserva manual ofrecen elegir uno o "cualquiera disponible".

### Psicólogo
Todo gateado por `business.type === 'psicologo'` en panel y Edge Function.
- Ficha de cliente con pestañas **Historial** (sesiones `client_sessions`: objetivo, notas, seguimiento, tareas/pautas; la más reciente primero), **Editar**, **Informe** (resumen generado por Gemini a partir de todas las sesiones, persistido en `client_ai_reports`; reintento automático ×3 ante 503/429/timeout) y **Recibo** (PDF no fiscal con `jspdf`, 100% en navegador, usa `customers.nif`).
- Sección **Seguimiento** en el sidebar: cita en curso y siguiente; "Empezar cita" abre el formulario de sesión ligado a la reserva.
- Clave de Gemini **por negocio** (`Configuración → Informes con IA`): el tier gratuito limita por clave (~10 req/min), y no se mezclan datos clínicos de distintos tenants bajo una clave.

### Restaurante
- **Franjas y aforo** por franja: horario, granularidad, aforo total, duración por defecto y por nº de comensales, última hora de reserva, pacing por slot (opcional), stock online, doblar mesa, tiempo de limpieza.
- **Mesas y zonas**: zonas (`reservable_online`), mesas con capacidad mín/máx y prioridad, combinaciones manuales para grupos grandes. Asignación best-fit automática (menor desperdicio → prioridad → nombre; cae a combinación si ninguna mesa individual encaja) con override manual. Sin mesas cargadas, el motor funciona solo con aforo agregado.
- **Reglas de reserva**: antelación mín/máx, mín/máx comensales online, confirmación manual (reservas web quedan `pendiente` hasta confirmarlas).
- **Plano de sala** en tiempo real (Supabase Realtime sobre `bookings`): estado por mesa, sentar / no-show / liberar, **walk-ins** (`create_walkin_booking`, mismo motor de asignación), **lista de espera** con aviso por WhatsApp (`notify-waitlist`) y "Sentar".
- Estados de reserva: confirmada / pendiente / sentada / completada / ausente / cancelada.

---

## Seguridad y RLS

- RLS activado en todas las tablas; acceso de negocio vía `is_business_member(business_id)`, global solo super-admin.
- RPCs públicas (`get_public_business`, `get_public_services`, `get_available_slots`, `get_available_days`, `get_booking_by_locator`, `cancel_booking_by_locator`, y equivalentes `dining`) son `SECURITY DEFINER` para `anon` — el linter de Supabase las marca; es intencionado.
- `create_public_booking`/`create_public_dining_booking` no son ejecutables por `anon`: el widget pasa siempre por `create-booking`.
- `replace_business_hours_from_sync` solo es ejecutable por `service_role`.
- Hardening opcional en Supabase: *Leaked Password Protection* y mover `pg_trgm` fuera de `public`.

---

## Datos de demostración

`seed.sql` crea *Restaurante La Plaza* (`restaurante-la-plaza`, `staff@restaurante.test` / `Restaurante1234!`, con zonas Interior/Terraza y 10 mesas) y *Barbería El Corte* (`barberia-demo`, `staff@barberia.test` / `Barberia1234!`) más un super-admin `admin@reservas.test` / `Admin1234!`.

En producción **solo existe el restaurante**: la barbería y `admin@reservas.test` se borraron. El único super-admin es la cuenta real del dueño. Para probar citas/psicólogo se usa un negocio real (ver `CLAUDE.md`).

---

## Pendientes

Lista única. Si retomas el proyecto, empieza por aquí.

### Bloqueados por algo externo

| Pendiente | Bloqueado por | Al desbloquear |
|---|---|---|
| **Huella bancaria y prepago (Stripe)** | El negocio necesita cuenta de Stripe (vale test) | `SetupIntent` (huella) / `PaymentIntent` (prepago) + aviso legal de política de cancelación antes de confirmar |
| **Resumen de reseñas con IA** | Aprobación "Basic API Access" de Google Business Profile API | Leer reseñas vía GBP API, resumir, mostrar en Reportes |
| **Horario desde Google Business Profile operativo** (código desplegado, inerte) | Misma aprobación de Google: ficha verificada 60+ días, web propia enlazada, solicitante owner/manager; sin plazo | Conectar en `Configuración → Horario en Google Business Profile` y comprobar la siguiente pasada del cron (minuto 5) |
| **Google Calendar operativo de punta a punta** | Ningún negocio ha puesto aún su Client ID/Secret en `Configuración → Integraciones` | Conectar un profesional → exportar cita → ver ocupados importados |
| **Ver una generación exitosa del Informe de IA** | Gemini devolviendo 503/429 en todos los intentos hasta ahora (capacidad de Google) | Confirmar contenido generado + fila en `client_ai_reports` + visualización en la pestaña Informe |

### Decisión pendiente del usuario
- **Pasar Supabase a plan Pro** ($25/mes): el plan Free pausa el proyecto tras 7 días sin actividad; los crons probablemente lo evitan pero sin garantía, y ya hay negocios reales dependiendo de la plataforma.

### Sin priorizar (el usuario dijo que no hace falta todavía)
- API pública / webhooks por negocio.
- Dashboard agregado multi-local (el selector de negocio de `Layout.tsx` ya cubre varios negocios por usuario).
- Página de "ayuda de configuración" en el panel que resuma pasos y costes de cada integración para negocios nuevos (idea, no pedida).

### Mejoras menores
- Probar en vivo añadir/quitar/cambiar rol en la pestaña "Usuarios" del super-admin (solo se ha verificado el listado).
- Selector de ubicación de Google Business Profile para cuentas con varias fichas.
- Editor visual de posiciones de mesa (drag & drop; `dining_tables.pos_x/pos_y` existen sin usar).
- Reasignación manual de mesa para reservas con combinación (`table_combo_id`), bloqueada a propósito.
- Drag & drop en la rejilla semanal/mensual de la Agenda.
- Multi-idioma del widget; más proveedores de email/SMS.
