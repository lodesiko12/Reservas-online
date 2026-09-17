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

**Sistema de mesas físicas tipo TheFork Manager — Fase 1 (COMPLETADA y verificada en navegador, 2026-09-17)**: siguiendo el documento de referencia del usuario (5 capas: calendario→stock→mesas→duración→reglas), se implementó la capa 3 (mesas físicas) y parte de la capa 4 (duración por nº de comensales) para el tipo restaurante, manteniendo el aforo agregado (capa 2) como límite adicional. Migración 0009 (`dining_tables.sql`): tablas `dining_zones`, `dining_tables`, `dining_duration_rules`; columna `bookings.dining_table_id`; constraint `EXCLUDE` (btree_gist) que impide solapes físicos por mesa a nivel de Postgres. `get_available_dining_slots` y `create_public_dining_booking` ahora exigen mesa libre con asignación best-fit automática (menor desperdicio→prioridad→nombre) + override manual vía `p_table_id`. Si un negocio no tiene mesas cargadas, el motor sigue funcionando solo con aforo agregado (retrocompatible). Nueva RPC `get_dining_table_options` para elegir/reasignar mesa desde el panel. Panel: página nueva `business/Mesas.tsx` (zonas+mesas), `Franjas.tsx` con editor de reglas de duración por rango de pax, `NuevaReserva.tsx` con selector de mesa (automático/manual), `Agenda.tsx` con reasignación de mesa en el modal de reserva. Datos demo: 2 zonas y 10 mesas para `restaurante-la-plaza`.

OJO — bug real encontrado y corregido durante esta fase: al añadir `p_table_id` a `create_public_dining_booking` se creó sin querer una SEGUNDA sobrecarga de la función (10 vs 11 argumentos) en lugar de reemplazarla, y PostgREST no podía desambiguar cuando el cliente omite `p_table_id` (caso automático, ya que `JSON.stringify` elimina claves `undefined`). Solución: **nunca añadir un parámetro nuevo a una función RPC ya expuesta sin `drop function` de la signature vieja primero**, o el `create or replace` con distinta firma crea una sobrecarga fantasma. Ver migración `0009c_drop_old_dining_booking_overload`. [[feedback-supabase-rpc-overloads]]

También se descubrió que el negocio demo `restaurante-la-plaza` tenía `is_active=false` (previo a esta sesión, causa desconocida) — se activó manualmente para poder probar; conviene que el usuario confirme si fue intencionado.

**Restaurante 100% configurable por negocio (COMPLETADA y verificada, 2026-09-17)**: a petición explícita del usuario, todo el motor de restaurante se hizo ajustable por negocio y editable en cualquier momento tras la creación. Migraciones 0010 (enum `booking_status` + valor `pendiente`, en migración propia porque un valor de enum no se puede usar en la misma transacción en que se crea) y 0011 (`dining_settings.sql`):
- `dining_settings` (1:1 por negocio): `min_lead_minutes`, `max_advance_days`, `min_party_online`/`max_party_online`, `require_manual_confirmation`. RPC pública `get_public_dining_settings` para que el widget filtre el selector de comensales.
- `dining_shifts` +columnas: `last_call_time`, `pacing_enabled` + `max_covers_per_slot`/`max_bookings_per_slot` (activable — si no, solo cuenta el aforo total), `online_max_covers` (stock reservado para teléfono/walk-in), `allow_double_turn`, `cleanup_min`.
- `dining_table_combos` (combinaciones de mesas manuales, con `table_ids uuid[]`) — Fase 3 del roadmap original adelantada a petición del usuario.
- `dining_table_busy()`: helper único que centraliza la lógica de "mesa ocupada" (doblar-mesa + limpieza + pertenencia a combo), usado por `get_available_dining_slots`, `create_public_dining_booking` y `get_dining_table_options`.
- **Todas** las reglas nuevas (antelación, mín/máx comensales online, stock por slot/online) solo aplican a `p_channel='web'`; las reservas manuales del staff siempre ven el aforo completo sin restricciones — filosofía "el jefe de sala sabe más que el algoritmo" ya aplicada a la asignación de mesas.
- "Excepciones" (cierres puntuales) no necesitaron cambios: ya eran la tabla `blocks` con scope='business', editable por el negocio en Bloqueos.
- Panel: `Franjas.tsx` (todos los campos nuevos por franja), `Mesas.tsx` (sección Combinaciones), `Configuracion.tsx` (sección "Reglas de reserva"), `NuevaReserva.tsx` (pasa `p_channel:'manual'`), `Agenda.tsx` (badge/estilo `pendiente`, muestra nombre de combo, oculta reasignación manual de mesa para reservas con combo).
- Widget: `get_public_dining_settings` filtra comensales visibles; mensaje "⏳ Solicitud recibida" vs "✅ ¡Mesa reservada!" según `status` devuelto por `create-booking` (Edge Function redeployada). Email de confirmación también distingue pendiente/confirmada (`isPending` en `buildConfirmationEmail`).
- **Otro bug de sobrecarga de RPC evitado** (ver [[feedback-supabase-rpc-overloads]]): `get_available_dining_slots` y `get_dining_table_options` cambiaron de firma (nuevo parámetro `p_channel` / `p_shift_id`) — se hizo `drop function` explícito de las firmas viejas en la misma migración antes de crear las nuevas.
- Verificado en navegador y con SQL directo: pacing on/off, doblar-mesa+limpieza, combinación de mesas (best-fit cae a combo cuando ninguna mesa individual encaja), confirmación manual → estado `pendiente` visible en widget y Agenda.

**Pendiente**: Fase 2 del sistema de mesas (plano de sala visual drag&drop + realtime, estados sentada/no-show, reasignación manual de mesa para reservas con combo); Stripe huella bancaria/prepago, lista de espera; drag&drop en la rejilla de Agenda; programar cron pg_cron (documentado). Repo con git init pero SIN commits aún.
