# Turnigo — SaaS de reservas online (multi-tenant)

Plataforma **multi-tenant** de reservas para negocios locales, con tres piezas:

1. **Widget embebible** — se inserta en la web que el negocio ya tiene, vía un `<script>` + iframe aislado, con branding por tenant.
2. **Panel de negocio** — agenda, KPIs, clientes, servicios, bloqueos, reportes y configuración.
3. **Panel super-admin** — alta de negocios, credenciales de staff y activación de suscripciones (sin registro público).

Dos tipos de tenant:
- **`citas`** (clínicas, peluquerías, dentistas…): reserva de un servicio con duración y, opcionalmente, un profesional.
- **`restaurante`** (mesas/comensales): franjas de servicio (`dining_shifts`) con aforo de comensales y duración de mesa.

Todo el backend vive en **Supabase** (Postgres + Auth + RLS + Edge Functions + Storage). No hay servidor adicional.

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
│   │   ├── _shared/            # CORS + constructor de email (compartido)
│   │   ├── create-booking/         # Público: crea reserva + envía email
│   │   ├── send-confirmation-email/# Reenvía email de confirmación
│   │   ├── whatsapp-reminders/     # Cron: recordatorios 24h
│   │   ├── notify-waitlist/        # Panel: avisa por WhatsApp que hay mesa
│   │   ├── request-reviews/        # Cron: pide reseña 1-3h post-visita
│   │   └── admin-create-business/  # Super-admin: alta de negocio + staff
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
| Super-admin | `admin@reservas.test` | `Admin1234!` |
| Staff (Barbería, citas) | `staff@barberia.test` | `Barberia1234!` |
| Staff (Restaurante) | `staff@restaurante.test` | `Restaurante1234!` |

- Negocio demo **tipo citas**: *Barbería El Corte* (`slug: barberia-demo`) con horario, 2 profesionales (Ana con jornada partida 9–14 / 16–20, Luis 10–20), 4 servicios (uno, *Tinte*, con disponibilidad propia Mar–Jue y sin profesional, usando aforo del negocio) y reservas de ejemplo (web/manual, futuras y pasadas incluyendo un no-show).
- Negocio demo **tipo restaurante**: *Restaurante La Plaza* (`slug: restaurante-la-plaza`) con dos franjas — *Comida* (13–16, aforo 40) y *Cena* (20–23:30, aforo 50) — y reservas de mesa de ejemplo. Widget: `http://localhost:5174/?slug=restaurante-la-plaza`.

Flujo completo probado: **widget → reserva → email → panel (agenda/estado) → bloqueo con cancelación → reportes**.

Widget demo local: `http://localhost:5174/?slug=barberia-demo`.

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

**Siguientes fases (ver `docs/` para el roadmap completo tipo TheFork):**
- Huella bancaria/prepago con Stripe (`SetupIntent`/`PaymentIntent`, con el aviso legal de política de cancelación que exige el documento de referencia) — pendiente de cuenta Stripe.
- Resumen de reseñas con IA — pendiente de acceso a Google Business Profile.
- API pública/webhooks para integraciones a medida — sin priorizar aún.
- Editor visual de posiciones de mesa (drag&drop sobre un croquis) — de momento el plano es una cuadrícula por zona, no un mapa libre.
- Arrastrar-soltar para reprogramar en la rejilla semanal de Agenda.
- Multi-idioma del widget y más proveedores de email/SMS.
