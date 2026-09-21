# Turnigo — SaaS de reservas online (multi-tenant)

Plataforma **multi-tenant** de reservas para negocios locales, con tres piezas:

1. **Widget embebible** — se inserta en la web que el negocio ya tiene, vía un `<script>` + iframe aislado, con branding por tenant.
2. **Panel de negocio** — agenda, KPIs, clientes, servicios, bloqueos, reportes y configuración.
3. **Panel super-admin** — alta de negocios, credenciales de staff y activación de suscripciones (sin registro público).

Dos tipos de tenant:
- **`citas`** (clínicas, peluquerías, dentistas…): reserva de un servicio con duración y, opcionalmente, un profesional.
- **`restaurante`** (mesas/comensales): franjas de servicio (`dining_shifts`) con aforo de comensales y duración de mesa.

Todo el backend vive en **Supabase** (Postgres + Auth + RLS + Edge Functions + Storage). No hay servidor adicional.

> **Desplegado en producción en Cloudflare Workers** (Workers Builds conectado por Git — cada push a
> `main` despliega solo): panel `https://turnigo-panel.lodesiko12.workers.dev/` y widget
> `https://turnigo-widget.lodesiko12.workers.dev/?slug=<slug>`. Ver [`CLAUDE.md`](CLAUDE.md) para el
> flujo de verificación (siempre contra estas URLs, nunca solo `localhost`) y los secretos de Edge
> Functions pendientes de configurar.

---

## Índice
- [Arquitectura y decisiones](#arquitectura-y-decisiones)
- [Estructura del proyecto](#estructura-del-proyecto)
- [Variables de entorno](#variables-de-entorno)
- [Puesta en marcha](#puesta-en-marcha)
- [Ejecutar en local](#ejecutar-en-local)
- [Crear el primer negocio (super-admin)](#crear-el-primer-negocio-super-admin)
- [Embeber el widget en una web externa](#embeber-el-widget-en-una-web-externa)
- [Email de confirmación (Resend)](#email-de-confirmación-resend)
- [Recordatorios de WhatsApp (Meta Cloud API)](#recordatorios-de-whatsapp-meta-cloud-api)
- [Seguridad y RLS](#seguridad-y-rls)
- [Datos de demostración](#datos-de-demostración)
- [Estado y roadmap](#estado-y-roadmap)
- [Pendientes](#pendientes)

---

## Arquitectura y decisiones

**Frontend: React + Vite + TypeScript.** Elegido porque el panel es un dashboard con calendario, gráficos (recharts), formularios complejos y estado de servidor (react-query). Vite da un dev-server rápido y builds ligeros; el widget se compila como app independiente para que su bundle sea pequeño y embebible. Tailwind CSS para una estética SaaS consistente y rápida de iterar.

**El motor de disponibilidad vive en la base de datos** (`get_available_slots`, PL/pgSQL). Es la **única fuente de verdad**: cruza horario del negocio ∩ disponibilidad propia del servicio ∩ horario del profesional − reservas existentes − bloqueos. Así el widget, el panel (reserva manual) y cualquier futuro cliente ven exactamente la misma disponibilidad, y la creación de reserva la **re-valida bajo un lock por negocio** para evitar dobles reservas concurrentes.

**Aislamiento multi-tenant con RLS.** Cada tabla de negocio filtra por `business_id` mediante `is_business_member()`. El super-admin (`profiles.is_super_admin`) tiene visión global. Los clientes finales **no tienen cuenta**: reservan a través de RPCs `SECURITY DEFINER` (lectura) y una Edge Function con `service_role` (escritura), nunca tocando tablas directamente.

**Monorepo con npm workspaces**: código compartido (cliente Supabase tipado, helpers de fecha/timezone) en `packages/shared`, consumido por ambas apps.

---

## Estructura del proyecto

```
.
├── apps/
│   ├── widget/                 # Widget embebible (React/Vite)
│   │   ├── public/embed.js     # Cargador <script> para incrustar el iframe
│   │   ├── public/demo-host.html  # Página de ejemplo que embebe el widget
│   │   └── src/                # Flujo de reserva + "Mi reserva"
│   └── dashboard/              # Panel super-admin + panel de negocio
│       └── src/
│           ├── admin/          # Super-admin (negocios, alta de tenants)
│           ├── business/       # Panel de negocio (agenda, KPIs, etc.)
│           ├── components/     # Layout, UI reutilizable
│           └── lib/            # supabase, auth, utilidades
├── packages/
│   └── shared/                 # Cliente Supabase tipado, tipos DB, formato/timezone
├── supabase/
│   ├── migrations/             # Esquema + RLS + lógica (0001..0005)
│   ├── functions/              # Edge Functions (Deno)
│   │   ├── _shared/            # CORS + email + helpers de Google Calendar (compartido)
│   │   ├── create-booking/         # Público: crea reserva + envía email + exporta a Google
│   │   ├── send-confirmation-email/# Reenvía email de confirmación
│   │   ├── whatsapp-reminders/     # Cron: recordatorios 24h
│   │   ├── notify-waitlist/        # Panel: avisa por WhatsApp que hay mesa
│   │   ├── request-reviews/        # Cron: pide reseña 1-3h post-visita
│   │   ├── admin-create-business/  # Super-admin: alta de negocio + staff
│   │   ├── google-oauth-start/     # Autenticado: URL de consentimiento de Google (state firmado)
│   │   ├── google-oauth-callback/  # Público: redirect_uri de Google, guarda tokens
│   │   ├── sync-google-event/      # Autenticado: exporta una reserva a Google Calendar
│   │   └── sync-google-busy/       # Cron: importa huecos ocupados de Google como `blocks`
│   └── seed.sql                # Datos demo (negocio "citas" completo)
├── .env.example
└── README.md
```

### Migraciones

| Archivo | Contenido |
|---|---|
| `0001_core_schema.sql` | Extensiones, enums y todas las tablas |
| `0002_rls_policies.sql` | Funciones de rol + políticas RLS + triggers de guarda |
| `0003_logic_and_rpcs.sql` | Motor de disponibilidad, localizador, RPCs públicas, creación transaccional |
| `0004_security_hardening.sql` | `search_path` fijo + revocar `create_public_booking` a anon |
| `0005_storage_logos.sql` | Bucket público `logos` + políticas de escritura por miembro |
| `0006_restaurant_logic.sql` | Motor de aforo de restaurante (`dining_shifts`, disponibilidad y creación de reserva de mesa) |
| `0007_business_integrations.sql` | Credenciales de email/WhatsApp **por negocio** (secretos protegidos con RLS + RPCs) |
| `0008_customer_phone_normalization.sql` | Agrupa clientes por teléfono normalizado (evita fichas duplicadas) |
| `0009_dining_tables.sql` | Mesas físicas y zonas de sala (`dining_zones`, `dining_tables`), duración según nº de comensales (`dining_duration_rules`) y asignación automática best-fit + override manual en `create_public_dining_booking` |
| `0009b_harden_dining_duration_grant.sql` | Endurece permisos de `dining_duration_for` (helper interno, sin acceso público) |
| `0009c_drop_old_dining_booking_overload.sql` | Elimina una sobrecarga fantasma de `create_public_dining_booking` (ver nota de sobrecargas de RPC más abajo) |
| `0010_add_pendiente_status.sql` | Nuevo estado `pendiente` en `booking_status` (confirmación manual) |
| `0011_dining_settings.sql` | Ajustes de restaurante 100% personalizables por negocio: `dining_settings` (antelación mín/máx, mín/máx comensales online, confirmación manual), nuevas columnas en `dining_shifts` (última hora de reserva, stock por slot activable, stock online, doblar mesa, limpieza), `dining_table_combos` (combinaciones de mesas para grupos grandes) |
| `0011b_harden_new_function_grants.sql` | Endurece permisos de `dining_table_busy` y `get_dining_table_options` |
| `0012_add_sentada_status.sql` | Nuevo estado `sentada` en `booking_status` (cliente en la mesa) |
| `0013_add_walkin_channel.sql` | Nuevo canal `walkin` en `booking_channel` |
| `0014_walkins_and_realtime.sql` | Notas/etiquetas de cliente, motor de asignación de mesa reutilizable (`dining_assign_table`), `create_walkin_booking` (walk-ins con el mismo motor de aforo/best-fit) y Realtime activado en `bookings` para el plano de sala |
| `0015_waitlist_and_reviews.sql` | Lista de espera (`waitlist`), enlace de reseña y plantilla de WhatsApp por negocio, `review_requests_log` |
| `0016_import_customer_rpc.sql` | `import_customer`: upsert seguro por teléfono normalizado para la importación CSV desde el panel (PostgREST no puede hacer `ON CONFLICT` sobre el índice parcial) |
| `0017_service_professionals.sql` | Relación **muchos-a-muchos** servicios↔profesionales (tabla `service_professionals`, sustituye a `services.professional_id`) + `professionals.color` (paleta automática por negocio) |
| `0018_professional_selection_rpcs.sql` | `get_available_slots`/`create_public_booking`/`get_public_services` adaptados al modelo N:N: el cliente puede elegir un profesional concreto o "cualquiera disponible" (unión de huecos vía `lateral`) |
| `0019_fix_customer_upsert_regression.sql` | Corrige una regresión de la 0018 (había vuelto a usar el índice `(business_id, phone)`, inexistente, en vez de `(business_id, phone_norm)`) |
| `0020_max_advance_days.sql` | `businesses.max_advance_days`: antelación máxima de reserva online para negocios **citas** (mismo patrón que `dining_settings.max_advance_days`); nuevo parámetro `p_channel` en `get_available_slots`/`create_public_booking` para que el límite no aplique a reservas manuales del staff |
| `0021_google_calendar.sql` | `professional_google_accounts` (tokens OAuth por profesional) + `business_integrations.google_client_id/secret` + `bookings.google_event_id` + `blocks.source`; RPCs de conexión/estado |
| `0022_google_busy_sync_cron.sql` | Programa (`pg_cron`+`pg_net`) la llamada cada 15 min a `sync-google-busy` |
| `0023_public_available_days.sql` | RPCs `get_available_days`/`get_available_dining_days`: el widget oculta del selector los días sin ningún hueco disponible |
| `0024_email_custom_messages.sql` | `businesses.confirmation_email_message` / `review_email_message`: párrafo de introducción personalizable por negocio para el email de confirmación y el de petición de reseña (placeholders `{cliente}` `{negocio}` `{servicio}` `{fecha}` `{hora}`), con fallback al texto por defecto si se deja vacío |
| `0025_reminder_review_cron.sql` | Programa (`pg_cron`+`pg_net`) los crons `whatsapp-reminders-hourly` y `request-reviews-hourly`, que hasta entonces existían como Edge Functions desplegadas sin nada que las llamara periódicamente |
| `0026_google_business_profile_hours_sync.sql` | `business_google_profile_accounts` (tokens OAuth por negocio + ubicación de Google Business Profile resuelta) + RPC `replace_business_hours_from_sync` (solo `service_role`, reescribe `business_hours` atómicamente) + RPCs de estado/toggle/disconnect; cron `sync-google-business-hours-hourly` que sobrescribe automáticamente el horario de apertura desde Google, sin revisión manual |
| `0027_business_type_psicologo.sql` | Añade `'psicologo'` al enum `business_type` — nueva categoría de negocio, idéntica a `citas` en comportamiento (motor de disponibilidad, RPCs, widget) hasta la Fase 9 |
| `0028_fix_sync_google_busy_cron_secret.sql` | Corrige el cron `sync-google-busy` (Fase 5), que había quedado respondiendo 401 en cada ejecución tras configurarse `CRON_SECRET` porque seguía usando el valor antiguo de `GOOGLE_SYNC_CRON_SECRET` |
| `0029_psicologo_client_records.sql` | `customers.nif`; ficha de cliente ampliada para negocios **psicólogo**: `client_notes` (notas de sesión, opcionalmente ligadas a una reserva), `client_tasks` (tareas/pautas), `client_ai_reports` (informes generados por Gemini, persistidos); `business_integrations.gemini_api_key` (secreto, RLS igual que Resend/WhatsApp) + RPCs `get_gemini_status`/`set_gemini_key` |

---

## Variables de entorno

Copia `.env.example` a `.env`.

### Frontend (se exponen al navegador)
| Variable | Descripción |
|---|---|
| `VITE_SUPABASE_URL` | URL del proyecto Supabase |
| `VITE_SUPABASE_ANON_KEY` | Clave **publishable/anon** (nunca la `service_role`) |
| `VITE_WIDGET_URL` | URL pública del widget (para el snippet y enlaces "Mi reserva"). Local: `http://localhost:5174` |

### Secrets de Edge Functions (en Supabase, **no** en el navegador)
`SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` los inyecta Supabase automáticamente. El resto se definen con `supabase secrets set`:

| Variable | Usada por | Descripción |
|---|---|---|
| `RESEND_API_KEY` | create-booking, send-confirmation-email | API key de Resend |
| `EMAIL_FROM` | idem | Remitente verificado, p.ej. `Reservas <reservas@tudominio.com>` |
| `WIDGET_URL` | idem | URL pública del widget (para el enlace de gestión en el email) |
| `WHATSAPP_TOKEN` | whatsapp-reminders | Token permanente de la app de WhatsApp en Meta |
| `WHATSAPP_PHONE_NUMBER_ID` | idem | ID del número emisor verificado |
| `WHATSAPP_TEMPLATE_NAME` | idem | Plantilla aprobada por defecto (por negocio se puede sobreescribir) |
| `WHATSAPP_TEMPLATE_LANG` | idem | Código de idioma, p.ej. `es` |
| `CRON_SECRET` | whatsapp-reminders | Secreto para proteger el endpoint del cron |

---

## Puesta en marcha

> El proyecto de referencia **ya está desplegado en vivo** en Supabase con las migraciones, funciones y datos demo aplicados. Los pasos siguientes reproducen ese estado desde cero en tu propio proyecto.

### 1. Requisitos
- Node.js ≥ 18
- [Supabase CLI](https://supabase.com/docs/guides/local-development) (`npm i -g supabase`)
- Una cuenta de Supabase (crear proyecto es gratis)

### 2. Instalar dependencias
```bash
npm install
```

### 3. Enlazar el proyecto Supabase
```bash
supabase login
supabase link --project-ref TU_PROJECT_REF
```

### 4. Aplicar migraciones y datos demo
```bash
supabase db push                          # aplica supabase/migrations/*
supabase db execute --file supabase/seed.sql   # datos demo (opcional)
```

### 5. Desplegar las Edge Functions
```bash
supabase functions deploy create-booking          --no-verify-jwt
supabase functions deploy whatsapp-reminders       --no-verify-jwt
supabase functions deploy send-confirmation-email
supabase functions deploy admin-create-business
```
> `create-booking` y `whatsapp-reminders` van con `--no-verify-jwt` porque son endpoints públicos/cron con su propia validación (re-chequeo de disponibilidad y `CRON_SECRET` respectivamente).

### 6. Configurar los secrets
```bash
supabase secrets set RESEND_API_KEY=... EMAIL_FROM="Reservas <reservas@tudominio.com>" \
  WIDGET_URL=https://reservas.tudominio.com \
  WHATSAPP_TOKEN=... WHATSAPP_PHONE_NUMBER_ID=... \
  WHATSAPP_TEMPLATE_NAME=recordatorio_cita WHATSAPP_TEMPLATE_LANG=es \
  CRON_SECRET=$(openssl rand -hex 32)
```

### 7. Programar los cron de recordatorios y reseñas
En el dashboard de Supabase → **Database → Cron** (extensión `pg_cron`), o con SQL:
```sql
select cron.schedule(
  'whatsapp-reminders-hourly', '0 * * * *',
  $$ select net.http_post(
       url    := 'https://TU_PROJECT_REF.functions.supabase.co/whatsapp-reminders',
       headers:= jsonb_build_object('x-cron-secret', 'EL_MISMO_CRON_SECRET')
     ); $$
);

select cron.schedule(
  'request-reviews-hourly', '0 * * * *',
  $$ select net.http_post(
       url    := 'https://TU_PROJECT_REF.functions.supabase.co/request-reviews',
       headers:= jsonb_build_object('x-cron-secret', 'EL_MISMO_CRON_SECRET')
     ); $$
);
```
`request-reviews` solo envía si el negocio tiene configurado un enlace de reseña (`Panel → Configuración → Reseñas`); si no, no hace nada para ese negocio.

---

## Ejecutar en local

```bash
npm run dev:dashboard   # panel en http://localhost:5173
npm run dev:widget      # widget en http://localhost:5174
```

Página de ejemplo que embebe el widget: `http://localhost:5174/demo-host.html`.

---

## Desplegar online (Netlify)

El backend (Supabase) ya está online; solo hay que publicar los dos frontends. Se crean **dos sitios** en [Netlify](https://netlify.com) (gratis) conectados al mismo repo de GitHub. El SPA-fallback ya está resuelto con los archivos `public/_redirects` de cada app (y `vercel.json` si prefieres Vercel).

**Sitio 1 — Widget** (públicalo primero):
- *Base directory*: (vacío, raíz del repo)
- *Build command*: `npm run build:widget`
- *Publish directory*: `apps/widget/dist`
- *Environment variables*:
  - `VITE_SUPABASE_URL` = tu URL de Supabase
  - `VITE_SUPABASE_ANON_KEY` = tu clave publishable/anon
- Al desplegar te da una URL, p.ej. `https://reservas-widget.netlify.app`. **Anótala.**

**Sitio 2 — Panel (dashboard)**:
- *Build command*: `npm run build:dashboard`
- *Publish directory*: `apps/dashboard/dist`
- *Environment variables*: las dos anteriores **más**
  - `VITE_WIDGET_URL` = la URL del widget del paso anterior

**Después de desplegar** (opcional, para que el enlace "Mi reserva" de los emails apunte al widget online):
```bash
supabase secrets set WIDGET_URL=https://reservas-widget.netlify.app
```

> No hace falta tocar CORS: las funciones y RPCs ya aceptan peticiones cross-origin, así que el widget funciona embebido en cualquier dominio.
> Alternativas equivalentes: **Cloudflare Pages** (usa los mismos `_redirects`) o **Vercel** (usa los `vercel.json`, con *Root Directory* = `apps/widget` / `apps/dashboard`).

---

## Panel super-admin

Además de crear negocios, el super-admin puede, para cada tenant (desde **Negocios → Gestionar**):
- **Dashboard por negocio**: reservas totales, altas de los últimos 30 días, clientes, % por web, ausentismo, gráfico de reservas creadas (14 días) y última actividad — para ver cómo funciona cada negocio de un vistazo. El listado muestra además KPIs globales de la plataforma.
- **Editar negocio**: nombre, slug (con aviso de que rompe los widgets insertados), color, timezone, activación de la suscripción y (en citas) aforo/granularidad. El tipo no se puede cambiar.
- **Integraciones**: configurar el email (Resend) y WhatsApp (Meta) de ese negocio. Usa las mismas RPCs seguras que el panel del negocio, así que los secretos nunca se muestran (solo estado "configurada ✓").

## Crear el primer negocio (super-admin)

1. Entra al panel (`/`) con la cuenta de super-admin.
2. **Negocios → + Nuevo negocio**. Rellena nombre, slug, tipo, color y las **credenciales del staff** (email + contraseña). El slug se autogenera.
3. Al crear, se da de alta el negocio, el usuario de staff (confirmado) y su vínculo `owner`, más un horario por defecto L–V 9:00–18:00.
4. El staff ya puede entrar en el mismo panel con su email/contraseña y verá **su** negocio (aislado por RLS).
5. Desde **Configuración** el staff ajusta horario, servicios, branding y copia el snippet del widget.

> Para marcar una cuenta como super-admin manualmente:
> ```sql
> update public.profiles set is_super_admin = true where id = (select id from auth.users where email = 'tu@email.com');
> ```

---

## Embeber el widget en una web externa

El negocio pega **una sola vez** este bloque donde quiera el formulario:

```html
<div id="reservas-widget" data-slug="barberia-demo"></div>
<script src="https://reservas.tudominio.com/embed.js" async></script>
```

- `data-slug`: el slug del negocio.
- El widget se carga en un **iframe aislado** (no hereda ni rompe el CSS del sitio) y **se autoajusta en altura** de forma responsive vía `postMessage`.
- Opcional: `data-view="mi-reserva"` abre directamente la consulta por localizador.
- El widget aplica el `color_primario` y el `logo_url` del negocio automáticamente.

---

## Email de confirmación (Resend)

Se usa [Resend](https://resend.com) por su integración trivial con Edge Functions (una llamada `fetch`).

**Configuración por negocio (recomendado):** cada negocio pone sus propias credenciales en **Panel → Configuración → Integraciones**:
- *Remitente (From)* verificado en su cuenta de Resend (p.ej. `Mi Negocio <hola@midominio.com>`).
- *Resend API key* propia.

Así cada negocio envía **desde su propio dominio/cuenta**. Las claves se guardan en `business_integrations` con RLS estricta: **nunca se devuelven al navegador** (el panel solo muestra un estado "configurada ✓"); solo las Edge Functions las leen con `service_role`.

**Fallback global (opcional):** si un negocio no configura su clave, se usan los secrets globales `RESEND_API_KEY` / `EMAIL_FROM` (útil para pruebas). Si no hay ninguna, la reserva se crea igualmente y el email se omite (no bloquea el flujo).

Pasos: crea cuenta en Resend, verifica el dominio (o usa `onboarding@resend.dev` para pruebas), y pega la API key + From en el panel del negocio.

---

## Recordatorios de WhatsApp (Meta Cloud API)

La función `whatsapp-reminders` busca cada hora las reservas **confirmadas** cuyo inicio cae en la ventana **[ahora+23h, ahora+25h]**, de negocios con recordatorios activados, que aún no tengan registro de envío, y envía una **plantilla aprobada**. Cada envío se registra en `whatsapp_reminders_log` (con restricción única por reserva+tipo) para no duplicar.

**Cada negocio envía desde su propio número.** El *Phone number ID* y el *token permanente* de Meta se configuran por negocio en **Panel → Configuración → Integraciones** (guardados con RLS estricta, nunca expuestos al navegador). Si un negocio no los configura, se usan los secrets globales `WHATSAPP_TOKEN` / `WHATSAPP_PHONE_NUMBER_ID` como *fallback*; si no hay ninguno, ese negocio se omite. La plantilla e idioma también se fijan por negocio (con `WHATSAPP_TEMPLATE_NAME` / `WHATSAPP_TEMPLATE_LANG` de fallback).

### Qué debes configurar en Meta (por tu parte)
1. Crea una app en [Meta for Developers](https://developers.facebook.com/) y añade el producto **WhatsApp**.
2. **Verifica un número emisor** y anota su `PHONE_NUMBER_ID`.
3. Genera un **token permanente** (System User token con permisos `whatsapp_business_messaging`).
4. Crea y **envía a aprobación una plantilla** de recordatorio con 4 variables en el cuerpo, en este orden:
   - `{{1}}` nombre del cliente · `{{2}}` nombre del negocio · `{{3}}` fecha · `{{4}}` hora
   - Ejemplo: *"Hola {{1}}, te recordamos tu cita en {{2}} el {{3}} a las {{4}}. ¡Te esperamos!"*
5. Define los secrets `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_TEMPLATE_NAME`, `WHATSAPP_TEMPLATE_LANG`.
6. En el panel del negocio → **Configuración**, activa los recordatorios e indica el teléfono/plantilla (la plantilla por negocio sobreescribe la de por defecto).

> Nada de esto está hardcodeado: todo se lee de variables de entorno y de la configuración del negocio.

---

## Seguridad y RLS

- **RLS activado** en todas las tablas. Acceso de negocio vía `is_business_member(business_id)`; visión global solo para super-admin.
- Las **RPCs públicas** (`get_public_business`, `get_public_services`, `get_available_slots`, `get_booking_by_locator`, `cancel_booking_by_locator`) son `SECURITY DEFINER` y **están pensadas** para ser llamadas por el rol `anon` desde el widget. El linter de Supabase las marca como avisos: es intencionado.
- `create_public_booking` **no** es ejecutable por `anon` (revocado): las reservas del widget pasan siempre por la Edge Function `create-booking` (service_role).
- Un trigger impide que un miembro no super-admin cambie `is_active`, `type` o `slug` de su negocio.
- **Hardening opcional** que puedes activar en el panel de Supabase: *Leaked Password Protection* (Auth) y mover `pg_trgm` fuera de `public`.

---

## Datos de demostración

Tras aplicar `seed.sql`:

| Rol | Email | Contraseña |
|---|---|---|
| Staff (Restaurante) | `staff@restaurante.test` | `Restaurante1234!` |

> **Super-admin**: en el proyecto de producción el único super-admin es la cuenta real del dueño
> (`lodesiko12@gmail.com`); `seed.sql` intenta crear también un `admin@reservas.test` pero esa cuenta
> **no existe** en la base de datos en vivo (no se re-ejecutó ese seed ahí). No hay credenciales de
> prueba con contraseña conocida para super-admin en producción — para probar algo que requiera ese
> rol, pídele al dueño que inicie sesión él mismo.

> **⚠ El negocio demo `barberia-demo` ("Barbería El Corte") ya no existe**: se borró definitivamente
> el 2026-09-19 (probando la función de borrado de negocios). `staff@barberia.test` ya no tiene
> negocio vinculado. Para verificar cambios de tipo **citas** en vivo sin negocio demo, dos opciones:
> pedir al usuario credenciales de un negocio real suyo (así se hizo el 2026-09-19, con *Ana Sánchez
> Psicóloga*, `slug: ana-sanchez-psicologa` — extremar el cuidado de no tocar datos reales y borrar
> cualquier dato de prueba de inmediato), o recrear `barberia-demo` re-ejecutando `seed.sql`.

- Negocio demo **tipo restaurante**: *Restaurante La Plaza* (`slug: restaurante-la-plaza`) con dos franjas — *Comida* (13–16, aforo 40) y *Cena* (20–23:30, aforo 50) — y reservas de mesa de ejemplo. Widget: `http://localhost:5174/?slug=restaurante-la-plaza`.

Flujo completo probado: **widget → reserva → email → panel (agenda/estado) → bloqueo con cancelación → reportes**.

---

## Estado y roadmap

**Fase 1 (completada):** cimientos + tipo **citas** de punta a punta — esquema + RLS, motor de disponibilidad, widget embebible (reserva + "Mi reserva"), Edge Functions (reserva/email/WhatsApp/alta), panel de negocio completo (resumen, agenda, reserva manual, clientes, servicios, bloqueos, reportes, configuración) y panel super-admin.

**Fase 2 (completada):** tipo **restaurante** de punta a punta — motor de aforo por franjas/comensales (`get_available_dining_slots` + `create_public_dining_booking`), flujo del widget (comensales → día → hora agrupada por franja), la Edge Function `create-booking` gestiona ambos tipos, y el panel adapta su navegación (página **Franjas y aforo**, reserva manual de mesa, agenda y KPIs por tipo). Datos demo del restaurante incluidos.

**Agenda:** vista **Día** (lista) y **Semana** (rejilla de calendario con eje horario, columnas por día, bloques por reserva coloreados por estado y edición al clic).

**Mesas físicas y asignación automática (completado):** siguiendo el modelo de TheFork Manager, el tipo restaurante ahora tiene, además del aforo agregado por franja (`max_covers`, capa 2), un nivel físico de mesas (capa 3):
- **Zonas y mesas** (`Panel → Mesas y zonas`): zonas de sala (interior, terraza…) con `reservable_online`, y mesas con capacidad mín/máx, prioridad y zona.
- **Duración según nº de comensales** (`Panel → Franjas y aforo → Editar franja`): reglas opcionales tipo "7–12 pax → 150 min" por franja; si ninguna encaja se usa la duración por defecto.
- **Asignación best-fit automática**: al crear una reserva (web o manual) se elige la mesa libre con menor desperdicio de plazas, luego por prioridad configurada, luego por nombre.
- **Override manual**: en "Nueva reserva" el staff puede elegir mesa en vez de automático; desde la Agenda puede reasignar la mesa de una reserva existente en cualquier momento.
- **Sin mesas cargadas = comportamiento anterior**: si un negocio de tipo restaurante no tiene ninguna mesa en `dining_tables`, el motor sigue funcionando solo con el aforo agregado (retrocompatible).
- Doble cinturón de seguridad ante reservas concurrentes: `pg_advisory_xact_lock` + revalidación en el RPC, y una constraint `EXCLUDE` en Postgres que impide físicamente dos reservas solapadas en la misma mesa.
- Datos de ejemplo cargados para *Restaurante La Plaza*: zonas Interior/Terraza con 10 mesas.

**Restaurante 100% configurable por negocio (completado):** todo el motor de reservas de restaurante es ajustable desde el panel y editable en cualquier momento, sin tocar código:
- **Franjas y aforo** (`Panel → Franjas y aforo → Editar franja`): horario, granularidad de slots, aforo total, duración por defecto y por nº de comensales, **última hora de reserva**, **stock por slot** (activable: máx. comensales y máx. reservas por slot — para negocios que solo quieren aforo total, se deja desactivado), **stock online** (mesas reservadas para teléfono/walk-in), **doblar mesa** (activable/desactivable) y **tiempo de limpieza** entre reservas de una misma mesa.
- **Mesas y zonas** (`Panel → Mesas y zonas`): zonas, mesas físicas y ahora también **combinaciones de mesas** para grupos grandes (se definen a mano, p.ej. "Mesa 5 + Mesa 6").
- **Reglas de reserva** (`Panel → Configuración → Reglas de reserva`): antelación mínima y máxima, mín/máx comensales para reservas online, y **confirmación manual** activable (por defecto la reserva se confirma al instante; si se activa, las reservas web quedan en estado `pendiente` hasta que el negocio las confirma desde la Agenda). Estos límites y la antelación **no aplican a las reservas manuales del staff**, que siempre ven el aforo completo.
- **Excepciones** (cierres puntuales, vacaciones, horario especial): ya se gestionaban con `Bloqueos`, editable por el propio negocio; no requirió cambios.
- El widget respeta el rango de comensales online (oculta los tamaños de grupo fuera de rango) y muestra el mensaje correcto según si la reserva quedó confirmada o pendiente de confirmación.

**Fase 2 — Plano de sala en vivo (completada):**
- **Plano de sala** (`Panel → Plano de sala`, solo restaurante): cuadrícula de mesas en tiempo real (Supabase Realtime sobre `bookings`), coloreada por estado — libre / reservada pronto / debería llegar / retrasada / sentada / a punto de terminar. Acciones directas: sentar, marcar no-show, liberar mesa. Se actualiza sola aunque el cambio lo haga otro dispositivo.
- **Walk-ins**: botón "+ Walk-in" en cualquier mesa libre; usa el mismo motor de asignación/aforo que una reserva normal (`create_walkin_booking` reutiliza `dining_assign_table`, compartido con `create_public_dining_booking`), sin exigir que "ahora" caiga en un slot de la rejilla, y la reserva queda directamente en estado `sentada`.
- **Estado "sentada"**: nuevo estado del ciclo de vida junto a confirmada/pendiente/completada/no-show/cancelada.
- **Ficha de cliente con notas y etiquetas** (`Panel → Clientes`): etiquetas rápidas (VIP, Habitual, Alérgico, Prensa, Problemático) y notas privadas editables, visibles también en el listado.
- Recordatorio WhatsApp 24h e informes básicos ya estaban cubiertos desde la Fase 1.

**Fase 3 — sin Stripe (completada):** doble turno con limpieza y combinaciones de mesas ya se adelantaron a la Fase 1. De lo que quedaba:
- **Lista de espera** (`Panel → Plano de sala → Lista de espera`): alta con nombre/teléfono/comensales, botón **Avisar** (envía plantilla de WhatsApp "mesa lista" vía la Edge Function `notify-waitlist`, con las mismas credenciales por negocio que los recordatorios) y botón **Sentar** (crea la reserva con el motor de walk-ins). Plantilla configurable por negocio en Configuración.
- **Importación de clientes por CSV** (`Panel → Clientes → Importar CSV`): parser propio (soporta comillas/comas), reconoce columnas Nombre/Apellidos/Teléfono/Email/Notas, y hace upsert seguro por teléfono normalizado vía el RPC `import_customer` (el upsert de PostgREST no soporta el índice único parcial de `customers`).
- **Petición de reseña post-visita**: cron `request-reviews` (mismo patrón que `whatsapp-reminders`) que envía un email 1–3h después de que termine una reserva no cancelada, solo si el negocio configuró un enlace de reseña en `Panel → Configuración → Reseñas`. Idempotente vía `review_requests_log`.
- **Huella bancaria y prepago con Stripe**: pendiente — requiere que el negocio tenga cuenta de Stripe (el usuario indicó no tenerla aún); se retoma cuando haya claves de API, aunque sean de test.

**Fase 4 — Diferenciación (revisada con el usuario, sin cambios de código):**
- **Mesas combinables automáticas** y **límites por origen** (online vs. teléfono/walk-in): ya estaban hechos desde las Fases 1 y 3 (`dining_assign_table` prueba combinaciones automáticamente; `online_max_covers`/pacing separan stock online del total).
- **Multi-local**: ya cubierto por el selector de negocio (`Layout.tsx`) para usuarios con varios negocios, cada uno aislado por RLS. El usuario confirmó que no hace falta un dashboard agregado por ahora.
- **API/webhooks**: no es prioritario todavía; no se ha construido.
- **Resumen de reseñas con IA**: pendiente, igual que Stripe — requiere que el negocio tenga acceso a la API de Google Business Profile (y una API de IA para resumir), de los que el usuario no dispone aún.

**Fase 5 — Profesionales N:N, borrado de negocios, horarios rápidos, antelación máxima, clientes manuales y Google Calendar (completada, 2026-09-18):**
- **Profesionales↔servicios muchos-a-muchos** (antes 1-a-1): tabla `service_professionals`; un servicio puede tener varios profesionales y viceversa. Checkboxes en ambos sentidos (`Panel → Servicios y profesionales`).
- **Color por profesional**: se asigna automáticamente al crear (paleta fija) y es editable. Se usa como borde de las citas en la **Agenda** (con leyenda) y como punto de color en el widget y en las tablas del panel.
- **Selector de profesional en el widget**: si el servicio elegido tiene más de un profesional asignado, el cliente elige uno concreto o "Cualquiera disponible" (el backend asigna el primero libre bajo el mismo lock transaccional). Con 0 o 1 profesional no se muestra el paso (comportamiento idéntico a antes).
- **Borrado de negocios (super-admin)**: además de Activar/Desactivar (soft-delete, ya existía), ahora hay un borrado **definitivo** con confirmación escrita (hay que teclear el nombre exacto del negocio). Usa el `DELETE` directo permitido por la RLS `businesses_delete` + los `on delete cascade` ya presentes en el esquema.
- **Horarios más rápidos de rellenar**: el editor de franjas (`WindowsEditor`, antes duplicado en 3 sitios) ahora es un componente compartido (`apps/dashboard/src/components/WindowsEditor.tsx`) con botón "copiar esta franja a todos los días" por fila y un panel de relleno rápido (marcar días activos + una franja común, sustituye el horario). Se usa en horario de apertura del negocio, horario de cada profesional y disponibilidad propia de cada servicio.
- **Antelación máxima de reserva** (tipo citas): `businesses.max_advance_days`, configurable en `Configuración → Reservas`. Solo limita el canal web; las reservas manuales del staff no tienen límite (mismo patrón que ya existía para restaurante).
- **Alta manual de clientes**: botón "+ Nuevo cliente" en `Panel → Clientes`, reutiliza la RPC `import_customer` ya existente (misma que usa la importación CSV).
- **Sincronización con Google Calendar** (credenciales OAuth propias por negocio, igual patrón que Resend/WhatsApp): cada negocio pega su Client ID/Secret de Google Cloud en `Configuración → Integraciones`; cada profesional conecta su propia cuenta desde su ficha en `Servicios`. Exporta las citas como eventos (`sync-google-event`, invocada desde `create-booking` y desde la Agenda al cambiar estado/reprogramar/eliminar) e importa los huecos ocupados de Google como `blocks` cada 15 min (`sync-google-busy`, cron vía `pg_cron`+`pg_net`). **Código desplegado pero inerte**: faltan 3 secretos de Edge Functions por configurar manualmente en el dashboard de Supabase — ver [`CLAUDE.md`](CLAUDE.md).
- Bug real encontrado y corregido en esta fase: la migración 0018 había revertido sin querer una corrección de la 0008 en el upsert de clientes (ver 0019 en la tabla de migraciones).

**Fase 6 — ronda de ajustes sobre la Fase 5, misma sesión larga (completada, 2026-09-19):**
- **Usuarios múltiples por negocio (super-admin)**: pestaña "Usuarios" en `Admin → Negocio → Gestionar`, con Edge Function `admin-business-users` para añadir/quitar/cambiar el rol de varios usuarios con acceso al mismo negocio (útil si hay varios profesionales con cuenta propia). No verificado en vivo por esta sesión (requiere sesión de super-admin real).
- **Selector de profesional en "Nueva reserva" manual**: el staff ahora puede elegir profesional (o "cualquiera disponible") al crear una reserva a mano, igual que en el widget.
- **Vista "Mes" en la Agenda**, además de Día/Semana.
- **Reportes → "Próximas reservas"**: sección nueva que muestra las reservas futuras (incluidas las manuales); las estadísticas de arriba siguen siendo solo históricas ("últimos N días").
- **"Rellenar rápido" de horarios admite una segunda franja** (para negocios que cierran a mediodía).
- **Estados de cita simplificados**: en negocios tipo citas, la Agenda solo ofrece marcar completada/cancelada/ausente (antes también mostraba conceptos de restaurante). "No-show" pasa a llamarse "Ausente" en toda la UI.
- **Clientes**: se pueden eliminar (icono en la lista o botón en la ficha; el historial de reservas se conserva). Se quitaron las etiquetas (VIP/Habitual/...) de toda la interfaz.
- El negocio demo `barberia-demo` se borró definitivamente durante esta fase (probando la función de borrado) — ver "Datos de demostración" más abajo.

**Fase 7 — Mensajes de email personalizables y crons de recordatorio/reseña programados (completada, 2026-09-20):**
- **Mensaje personalizado en emails** (migración `0024`): cada negocio puede escribir, desde `Panel → Configuración`, el párrafo de introducción del email de **confirmación de reserva** (nueva sección "Email de confirmación") y del email de **petición de reseña** (dentro de la sección "Reseñas"), con placeholders `{cliente}` `{negocio}` `{servicio}` `{fecha}` `{hora}` (los dos últimos solo aplican a confirmación). Si se deja vacío, se usa el texto por defecto de siempre — el resto del diseño del email (cabecera de color, tarjeta del código localizador, botón de reseña) no es editable, por decisión explícita para no arriesgar con HTML libre. Aplica también al reenvío manual del email (`send-confirmation-email`). Verificado en vivo contra Cloudflare guardando y limpiando un mensaje de prueba en un negocio real.
- **Crons de `whatsapp-reminders` y `request-reviews` programados** (migración `0025`, `whatsapp-reminders-hourly` / `request-reviews-hourly`, cada hora): hasta esta fase ambas Edge Functions estaban desplegadas pero nada las llamaba periódicamente (solo `sync-google-busy` se había programado en la Fase 5). **Pendiente de que el usuario configure el secreto `CRON_SECRET`** en Supabase (Edge Functions → Manage secrets) para que las funciones acepten las llamadas del cron — sin él, responden 401. El valor exacto ya está embebido en ambos cron jobs; se puede recuperar con `select command from cron.job where jobname='whatsapp-reminders-hourly'`.
- **Los 3 secretos de Google Calendar** (`GOOGLE_STATE_SECRET`, `DASHBOARD_URL`, `GOOGLE_SYNC_CRON_SECRET`) fueron configurados por el usuario en esta misma sesión. Sigue sin verificarse el flujo completo end-to-end porque ningún negocio tiene todavía su propio Client ID/Secret de Google Cloud configurado (paso que le corresponde a cada negocio, ver más abajo).

**Fase 8 — Sincronización automática del horario desde Google Business Profile (2026-09-21):**
- El horario general de apertura (`business_hours`) se puede enlazar a la ficha de Google Business Profile del negocio: una vez conectado, se sobrescribe automáticamente cada hora con lo que diga Google, **sin revisión manual** (decisión explícita del usuario — Google es la fuente de verdad mientras la sincronización esté activada).
- Migración `0026_google_business_profile_hours_sync.sql`: tabla `business_google_profile_accounts` (mismo patrón que `professional_google_accounts` de Calendar, pero a nivel de negocio, no de profesional), función `replace_business_hours_from_sync` (borra+inserta `business_hours` en una sola transacción, invocable **solo** por `service_role` — nunca por un usuario autenticado, para que nadie pueda reescribir el horario de un negocio ajeno), RPCs de estado/toggle/disconnect, y el cron `sync-google-business-hours-hourly` (minuto 5 de cada hora, desfasado de los otros crons horarios).
- Nuevas Edge Functions `google-business-oauth-start`/`google-business-oauth-callback`/`sync-google-business-hours`, siguiendo el mismo patrón OAuth ya usado para Calendar (`supabase/functions/_shared/google.ts` ganó helpers aditivos: `signBusinessState`/`verifyBusinessState` y wrappers de las Business Profile APIs). **Reutiliza el mismo Client ID/Secret de Google Cloud que Calendar** (un mismo proyecto puede pedir varios scopes) — no hace falta ningún secreto nuevo.
- UI en `Panel → Configuración → Horario en Google Business Profile` (`GoogleBusinessProfileSection.tsx`), justo debajo del editor manual de horario.
- **Código desplegado pero inerte**, igual que pasó con Calendar en la Fase 5: Google exige aprobación manual "Basic API Access" por proyecto de Google Cloud antes de que la Business Profile API funcione — mismo bloqueo que ya frenaba el pendiente "Resumen de reseñas con IA". Ver `CLAUDE.md` para el detalle.
- **v1 solo soporta negocios con una única ficha de Google Business Profile** bajo la cuenta de Google conectada; con 0 o 2+ fichas, la conexión queda guardada pero sin sincronizar (sin selector de ubicación en esta versión).
- Franjas horarias que cruzan medianoche en Google (p.ej. un bar abierto viernes 22:00–sábado 02:00) se parten en dos filas de `business_hours` para no perder horas reservables — probado de forma aislada con 4 casos (semana normal, cruce de medianoche, franja mal formada, sin horario) antes de confiar en la función dentro del cron.
- **No verificado en vivo de punta a punta** (resolución real de cuenta/ubicación, lectura de horario real, sobrescritura en producción): ningún negocio tiene todavía la aprobación de Google necesaria. Sí se verificó en vivo contra Cloudflare que la sección nueva del panel carga bien y que el botón "Conectar" invoca correctamente la Edge Function desplegada.
- **Nueva categoría de negocio "Psicólogo"** (migración `0027_business_type_psicologo.sql`, mismo día): valor nuevo del enum `business_type`, idéntico a `citas` en comportamiento en el momento de crearse (confirmado por una auditoría exhaustiva de cada comparación literal contra el tipo en el código — casi todo ya estaba escrito como "no es restaurante", así que un negocio psicólogo cae automáticamente en el camino de citas). Verificado en vivo de punta a punta: creación desde el super-admin, etiqueta correcta en la UI, widget con el flujo de citas.

**Fase 9 — Ficha de cliente ampliada para negocios Psicólogo (2026-09-21):**
- Primera vez que "Psicólogo" deja de ser idéntico a "Citas": todo lo de esta fase está gateado por `business.type === 'psicologo'`, tanto en el panel como en la Edge Function nueva — `citas`/`restaurante` no ven ningún cambio.
- Migración `0029_psicologo_client_records.sql`: `customers.nif` (opcional, para el recibo), `client_notes` (notas de sesión, opcionalmente ligadas a una reserva concreta), `client_tasks` (tareas/pautas con estado pendiente/completada), `client_ai_reports` (informes generados por IA, persistidos), y `business_integrations.gemini_api_key` + RPCs `get_gemini_status`/`set_gemini_key` (mismo patrón que Resend/WhatsApp/Google, con su propio par de RPCs para no tocar la firma de `get_business_integration`/`set_business_integration`).
- Ficha de cliente (`Panel → Clientes`) con pestañas nuevas para psicólogo: **Historial** (con botón para generar un recibo en PDF, no fiscal, generado 100% en el navegador con `jspdf`), **Editar** (antes no existía — los datos del cliente solo se podían fijar al crearlo), **Notas**, **Tareas** e **Informe** (resumen generado por Gemini a partir de las notas y tareas, vía la nueva Edge Function `generate-client-ai-report`).
- Nueva sección **Seguimiento** en el sidebar psicólogo: lista de citas de hoy en curso ahora mismo (mismo cálculo por ventana de tiempo que "Plano de sala" del restaurante, sin cronómetro), con botón "Empezar cita" que abre un formulario simple de notas.
- **Clave de Gemini por negocio, no global**: el tier gratuito de Gemini es de solo ~10 peticiones/min y ~500-1500/día *por clave* — compartir una sola clave entre negocios se saturaría rápido y mezclaría datos clínicos de distintos tenants. Cada negocio pega la suya (gratis en Google AI Studio) en `Configuración → Informes con IA`.
- **El campo "Tipo" ahora es editable en `Admin → Negocio → Editar negocio`** (antes deshabilitado por diseño). Se habilitó específicamente para poder migrar negocios reales a la nueva categoría sin recurrir a SQL directo: el trigger `guard_business_update` (`0002_rls_policies.sql`) solo permite cambiar `type` cuando la petición viene de una sesión de super-admin *realmente autenticada* — un `UPDATE` por SQL directo (vía MCP/herramientas de automatización) no lleva esa identidad y el trigger lo bloquea correctamente, así que la única vía limpia es hacerlo desde la app con una sesión real.
- **Informe de IA verificado en vivo** (2026-09-21) con una clave real de Gemini en "Ana Sánchez Psicóloga" (ya migrada a `type='psicologo'`, ver `CLAUDE.md`). Detectados y corregidos dos fallos reales en la verificación: `gemini-2.5-flash` ya no está disponible para claves nuevas (cambiado a `gemini-3.6-flash`), y `generate()` en `InformeTab.tsx` no tenía `try/catch/finally`, así que un fallo de red dejaba el botón en "Generando…" para siempre. Gemini devuelve 503 ("alta demanda") con cierta frecuencia ahora mismo — problema de capacidad conocido del lado de Google, no de esta clave — mitigado con reintento automático (hasta 3 intentos) desde el navegador.

---

## Pendientes

Lista única y actualizada de lo que falta. Si retomas el proyecto en otra conversación, empieza por aquí.

### Bloqueados por algo externo (el usuario debe traer la credencial/cuenta)

| Pendiente | Bloqueado por | Al desbloquear |
|---|---|---|
| **Huella bancaria y prepago (Stripe)** | El negocio necesita una cuenta de Stripe (aunque sea de test) | `SetupIntent` para huella bancaria, `PaymentIntent` para prepago; hay que añadir también el aviso legal de política de cancelación (ventana gratuita, importe, aceptación expresa) antes de confirmar — ver la nota legal del documento de referencia en la sección 4 |
| **Resumen de reseñas con IA** | Acceso a la API de Google Business Profile del negocio + una API de IA (p.ej. Claude) para resumir | Leer reseñas vía Google Business Profile API, resumirlas y mostrarlas en Reportes |
| **Sincronización automática de horario desde Google Business Profile** (migración `0026`, código desplegado pero inerte — mismo bloqueo que la fila de arriba) | Google exige aprobación manual "Basic API Access" por proyecto de Google Cloud para la Business Profile API (ficha verificada 60+ días, web propia enlazada, solicitante owner/manager de la ficha); no hay plazo garantizado | Conectar en `Configuración → Horario en Google Business Profile` (reutiliza el Client ID/Secret ya puesto para Calendar); verificar que el horario se sobrescribe en la siguiente pasada del cron (cada hora, minuto 5) |

### Sin priorizar (el usuario dijo que no hace falta todavía)

- **API pública / webhooks** para integraciones a medida (claves de API por negocio + webhooks salientes al crear/cambiar una reserva). No depende de nada externo; se puede construir en cualquier momento si un cliente lo pide.
- **Dashboard agregado multi-local** (KPIs de varios negocios de un mismo dueño en una sola vista). El selector de negocio actual (`Layout.tsx`) ya permite gestionar varios negocios de forma aislada; esto solo sumaría una vista conjunta.

### Mejoras menores pendientes (sin bloqueo, cuestión de tiempo)

- **Verificar en vivo la pestaña "Usuarios" del super-admin** (añadir/quitar usuarios de un negocio, Fase 6): construida y compila, pero ninguna sesión de trabajo ha podido probarla en vivo porque requiere una sesión de super-admin real. Pedirle al usuario que la pruebe él mismo, o retomarlo si hay acceso.
- **Editor visual de posiciones de mesa**: arrastrar y soltar mesas sobre un croquis real de la sala (ya existen las columnas `pos_x`/`pos_y` en `dining_tables`, sin usar todavía). Hoy el Plano de sala es una cuadrícula por zona, no un mapa libre — decisión explícita para entregar antes, ver conversación de la Fase 2.
- **Reasignación manual de mesa para reservas con combinación**: en la Agenda, cambiar de mesa está bloqueado a propósito cuando la reserva usa una combinación (`table_combo_id`); solo funciona para mesas individuales.
- **Arrastrar y soltar en la rejilla semanal de Agenda** para reprogramar reservas visualmente.
- **Multi-idioma del widget** y más proveedores de email/SMS aparte de Resend/WhatsApp.
- **Google Calendar operativo de punta a punta**: los 3 secretos de plataforma ya están configurados (Fase 7), pero ningún negocio tiene todavía su propio Client ID/Secret de Google Cloud puesto en `Configuración → Integraciones`, así que el flujo completo (conectar profesional → exportar cita → importar huecos ocupados) sigue sin probarse en vivo. Pendiente de que un negocio real lo configure.
- **Selector de ubicación de Google Business Profile** (v1 de la sincronización de horario, Fase 8): si la cuenta de Google conectada gestiona 0 o 2+ fichas, la conexión queda guardada pero sin sincronizar (sin selector en el panel). Solo afecta a negocios cuya cuenta de Google gestiona varias fichas — el caso menos común; se puede construir si hace falta.
- **Despliegue real = Cloudflare Workers, no Netlify.** La sección "Desplegar online (Netlify)" de abajo describe una alternativa válida pero ya no es como está desplegado el proyecto de referencia; ver la nota de Cloudflare al principio de este README y [`CLAUDE.md`](CLAUDE.md) para el flujo de despliegue y verificación reales (push a `main` → Cloudflare Workers Builds despliega solo).
