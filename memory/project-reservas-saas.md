---
name: project-reservas-saas
description: SaaS multi-tenant de reservas online (Supabase + React) — proyecto en curso
metadata:
  type: project
---

SaaS multi-tenant de reservas para negocios locales. Dos tipos de tenant: `citas` (clínicas/peluquerías) y `restaurante` (aforo/comensales). Sin registro público: el super-admin crea los negocios.

**Infra**: proyecto Supabase en vivo `reservas-saas` (project_id `fjpbruwczuovvynhlnzv`, org `zreqgntqklgqzjwtsyto`, región eu-west-1). URL `https://fjpbruwczuovvynhlnzv.supabase.co`. Publishable key `sb_publishable_CKlKGvIyTSN3iUh-XkNlUw_qhuYabRs`.

**Credenciales demo**: super-admin `admin@reservas.test` / `Admin1234!`; staff barbería `staff@barberia.test` / `Barberia1234!`. Negocio demo tipo citas: slug `barberia-demo`.

**Decisiones**: React+Vite+TS+Tailwind v3, Resend para email, Edge Functions Deno. Motor de disponibilidad vive en Postgres (`get_available_slots`) como fuente única de verdad. Widget/paneles nunca leen tablas directamente para lo público: usan RPCs SECURITY DEFINER. Reservas se crean por Edge Function (service_role), no por anon.

**Fase 1 (COMPLETADA y verificada en navegador)**: cimientos + tipo `citas` end-to-end. Migraciones 0001-0005 aplicadas. Edge Functions desplegadas: create-booking, send-confirmation-email, whatsapp-reminders, admin-create-business. Monorepo npm workspaces: apps/widget (5174), apps/dashboard (5173), packages/shared. Ambas apps compilan limpias (`npm run build`). Widget, panel de negocio (8 páginas) y super-admin funcionan.

**Tenant demo restaurante** creado vía super-admin: slug `restaurante-la-plaza`, staff `staff@restaurante.test` / `Restaurante1234!`.

**Fase 2 (COMPLETADA y verificada)**: restaurante end-to-end. Migración 0006 (dining_shifts.booking_duration_min + `get_available_dining_slots` + `create_public_dining_booking`). Widget con flujo comensales→día→hora (agrupada por franja). `create-booking` gestiona ambos tipos (ramifica por `dining_shift_id`). Panel adapta nav por tipo: página Franjas (`business/Franjas.tsx`), NuevaReserva ramifica, Agenda/Dashboard muestran "Mesa · N comensales". Ambas apps compilan limpias.

**Agenda semanal (COMPLETADA)**: `business/Agenda.tsx` con toggle Día/Semana, rejilla de calendario (WeekGrid) con eje horario, bloques por estado y modal de edición al clic. OJO: `ymdInTz`/`weekdayInTz` esperan un `Date`, no un string ISO — envolver siempre en `new Date()` (un string a `Intl.formatToParts` da "Invalid time value").

**Integraciones POR NEGOCIO (COMPLETADA)**: migración 0007 `business_integrations` (email_from, resend_api_key, whatsapp_phone_number_id, whatsapp_token). Secretos protegidos: RLS solo super-admin; staff usa RPCs `set_business_integration`/`get_business_integration` (esta última devuelve estado enmascarado con has_resend_key/has_whatsapp_token, sin secretos). Edge Functions (create-booking, send-confirmation-email, whatsapp-reminders) leen credenciales del negocio con service_role; env globales como fallback. Panel Configuración → sección "Integraciones". Verificado: lectura directa del secreto por el navegador bloqueada por RLS. NOTA: la barbería demo tiene una resend key FALSA de prueba (re_demo_testkey_123456) — email fallará hasta poner una real.

**Super-admin ampliado (COMPLETADO)**: `admin/BusinessDetail.tsx` (ruta `/admin/negocio/:id`) con 3 pestañas: Dashboard por negocio (KPIs+gráfico), Editar negocio (name/slug/color/tz/is_active/aforo; tipo bloqueado), Integraciones (usa `components/IntegrationsForm.tsx`, compartido con el panel de negocio). Listado de negocios con KPIs de plataforma. El super-admin puede gestionar todo porque `is_business_member` devuelve true para super_admin.

**Pendiente**: drag&drop en la rejilla; gestión de mesas individuales; programar cron pg_cron (documentado). Repo con git init pero SIN commits aún.
