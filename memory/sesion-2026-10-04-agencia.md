# Sesión 2026-10-04 — Tipo de negocio "agencia" (Agrupación de Comparsas)

Resumen para retomar. Todo lo de abajo está **en producción y verificado** salvo lo marcado en "Pendiente".

## Qué se construyó
Nuevo tipo `agencia`: herramienta interna (sin reservas, sin widget, sin portal de clientes) para organizar
equipos y proyectos de la Agrupación de Comparsas (25-30 miembros). Sustituye los grupos de WhatsApp.

- **Migraciones** (`supabase/migrations/`): `0044` (enum `agencia`), `0045` (tablas, helpers, RLS, bucket
  `agencia-docs`, trigger que crea los 8 equipos), `0046` (avisos + suscripciones push + crons), `0047`
  (autor de comentarios sin JWT), `0048` (chat). Todas aplicadas con `apply_migration`.
- **Tablas** (todas con `business_id`, índice y RLS): `agency_members`, `agency_teams`, `agency_team_members`,
  `agency_tasks`, `agency_task_assignees`, `agency_task_comments`, `agency_events`, `agency_documents`,
  `agency_notifications`, `agency_push_subscriptions`, `agency_chat_messages`, `agency_chat_reads`.
- **Helpers SQL**: `agency_is_member`, `agency_is_directiva`, `agency_can_manage_members` (presidente/secretario),
  `agency_in_team(b, t)` (directiva todo, miembro solo sus equipos), `agency_storage_access`, `agency_chat_unread`.
- **Edge Functions**: `agency-members` (alta/reset password/activar-desactivar; super-admin + presidente/secretario),
  `agency-push` (envía Web Push; sin JWT, protegida por `CRON_SECRET`), `admin-create-business` actualizado
  (el primer usuario de una agencia es presidente).
- **Panel** (`apps/dashboard/src/business/agencia/`): Mi panel, Panel global (directiva), Equipos (tareas kanban +
  lista, Documentos, Personas), Calendario (mes/agenda, tareas con fecha), Avisos (campana + push), Chat, Miembros.
  Móvil: barra inferior de 6 huecos (`Layout.tsx` ganó `mobileTabs` y `badge`); escritorio: barra lateral.
- **Super-admin**: opción "Agencia" al crear/editar negocio; ficha con pestaña "Directiva y miembros"
  (reutiliza `MembersManager`).
- **Crons**: `agency-deadlines-daily` (06:00 UTC, avisos de fecha límite) y `agency-push-minutely`.
- **Chat**: grupo General (`/app/chat/general`, scope = id de la agencia, `team_id` null) + un grupo por equipo
  (`/app/chat/<teamId>`). Realtime, no leídos por grupo, borrar propio (directiva borra cualquiera), sin edición,
  sin adjuntos, sin push por mensaje.

## Decisiones tomadas
- Convención real del proyecto: `businesses`/`business_id` (no `tenants`/`tenant_id`).
- Nivel de acceso (`directiva`/`miembro`) separado del cargo (texto libre); `directiva_role` estructurado marca los
  5 puestos y solo presidente/secretario dan altas. Todos los usuarios de agencia tienen fila en `business_users`
  (`staff`; el primero creado por Admin, `owner`).
- **Avisos por push a la PWA, no email** (el usuario lo decidió: los miembros instalan la app). Claves VAPID:
  pública en `agencia/push.ts`, privada y pública como secretos `VAPID_PUBLIC_KEY`/`VAPID_PRIVATE_KEY`
  (ya puestos por el usuario).
- Documentos: subida directa a Storage con políticas por equipo (sin Edge Function intermedia).
- Una cuenta existente solo la vincula el super-admin (un presidente no puede apropiarse ni cambiar la contraseña
  de otra cuenta). Desactivar bloquea el login salvo que la cuenta sirva a otro negocio.
- Chat: sin push por mensaje (ruidoso con 25-30 personas); la directiva ve todos los grupos.

## Tenant demo (producción)
Slug `agrupacion-demo`: 5 directiva (`presidente|vicepresidente1|vicepresidente2|secretario|tesorero@agencia.test`)
+ `miembro01..20@agencia.test`, contraseña de prueba común `Agencia1234!`. 8 equipos, 30 tareas, 10 eventos,
2 comentarios con mención, 15 mensajes de chat. Seeds: `supabase/demo/agencia_demo_seed.sql` y
`agencia_demo_chat.sql`. Tests RLS: `supabase/tests/agency_rls_test.sql` y `agency_chat_rls_test.sql`
(resultados esperados en sus cabeceras). **Sin documentos de muestra** (necesitan archivo real en Storage).

## Preferencias del usuario (confirmadas esta sesión)
- Pide confirmación explícita **antes de cada migración y de cada `git push`**; aprobó cada una por separado
  (el OK de una no vale para la siguiente). Yo la pido con una pregunta antes de actuar.
- Verifica en producción (Cloudflare), no en localhost; el usuario inicia sesión en el navegador integrado
  (yo no tecleo contraseñas) y yo hago el recorrido, borrando después mis datos de prueba (prefijo `PRUEBA`).
- Prefiere decidir con opciones cuando hay alternativas reales; si no, quiere que decida yo y se lo cuente.
- Todo el texto de la UI en español; diseño teal/coral de Turnigo; mobile-first.

## Errores encontrados y corregidos
1. **Pantalla en blanco en Avisos**: dos componentes creaban la misma suscripción Realtime y `.on()` tras
   `subscribe()` lanza. Solución: suscribirse UNA vez en `AgenciaApp` (`useNotificationsRealtime`,
   `useChatRealtime`); los hooks de datos son solo `useQuery`. **Regla**: nunca abrir el mismo canal Realtime en
   dos hooks/componentes montados a la vez.
2. **Grupo General del chat no abría en móvil**: su enlace era `/app/chat`, igual que la lista. Ahora
   `/app/chat/general`.
3. Botones Guardar/Cancelar del modal de tarea quedaban fuera de pantalla en móvil → footer `sticky`.
4. El trigger de comentarios forzaba `author_id = auth.uid()` (null en seed por SQL) → `coalesce(auth.uid(), new.author_id)`
   (migración 0047; el chat usa el mismo patrón).
5. Tests RLS: un UPDATE sin política no lanza error, da 0 filas → comprobar `row_count`, no excepción. Y al simular
   identidades por SQL hay que vaciar `request.jwt.claims` antes de hacer cambios "como administrador" (el guard de
   auto-desactivación saltaba por usar las claims del miembro).
6. Se coló en un commit un cambio previo del usuario (`refresh_la_plaza_demo.sql`); se corrigió con
   `git reset --soft` + `restore --staged` antes del push. **Usar `git add` de rutas concretas, nunca `git add supabase`/`-A`.**

## Lecciones técnicas nuevas
- `deploy_edge_function`: los compartidos van con nombre `../_shared/x.ts`; el payload se pega con el contenido del archivo.
- `apply_migration` es atómico: si falla, revierte; no hace falta dry-run aparte.
- Secreto de los crons: copiarlo por SQL del cron existente (`substring(command ...)`) con un `DO`, sin mostrarlo.
- Tras añadir funciones `security definer`, `get_advisors`: las `agency_*` salen solo como "authenticated executable"
  (intencionado, igual que `adv_*`); ninguna accesible por `anon`.
- Regenerar tipos: `generate_typescript_types` devuelve JSON (`.types`) → guardar en `packages/shared/src/database.types.ts`.
- En el navegador integrado: subir archivo simulando `input.files` con `DataTransfer` + evento `change`; las
  notificaciones del navegador integrado están bloqueadas (el push real se prueba en móvil/Chrome del usuario).

## Estado del repo
- Último push a `main`: `2121bd4` (chat + arreglo del General). **Commit local sin pushear**: `2a88fac`
  (capitalización de fechas en separadores del chat, solo estético) + este resumen. Desplegar con el próximo push.
- El push incluyó por accidente el commit de memoria `7e7bad1` (resumen de la sesión anterior).

## Pendiente / siguientes pasos posibles
- Hacer `git push` de `2a88fac` y este resumen (con confirmación del usuario).
- Verificar el chat como **miembro** (Lucía) en pantalla: solo debe ver General + su equipo (RLS ya probada en SQL).
- Onboarding de la Agrupación real: crear su tenant desde Admin y dar de alta a la gente desde Miembros; borrar o
  cambiar la contraseña de las cuentas `@agencia.test` si el demo se queda en producción.
- Ideas no pedidas: aviso push solo para menciones en el chat; documentos de muestra; permitir editar mensajes.
- Conocido sin tocar: cualquier miembro puede editar nombre/color de la agencia (política `businesses_update`
  existente para todos los tipos).
- Fuera de alcance (no bloqueado): comparsas como entidad, finanzas, actas, plantillas de proyecto, WhatsApp,
  votaciones, exportación a PDF.
