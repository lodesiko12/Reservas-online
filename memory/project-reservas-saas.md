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
[[feedback-edge-function-fetch-timeout]].
