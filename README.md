# SaaS de Reservas Online (multi-tenant)

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

### 7. Programar el cron de recordatorios
En el dashboard de Supabase → **Database → Cron** (extensión `pg_cron`), o con `pg_cron`:
```sql
select cron.schedule(
  'whatsapp-reminders-hourly', '0 * * * *',
  $$ select net.http_post(
       url    := 'https://TU_PROJECT_REF.functions.supabase.co/whatsapp-reminders',
       headers:= jsonb_build_object('x-cron-secret', 'EL_MISMO_CRON_SECRET')
     ); $$
);
```

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

**Siguientes fases:**
- Arrastrar-soltar para reprogramar en la rejilla semanal.
- Gestión de mesas individuales (no solo aforo agregado) y combinables.
- Multi-idioma del widget y más proveedores de email/SMS.
