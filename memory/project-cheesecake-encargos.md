---
name: project-cheesecake-encargos
description: Modo encargo (order_mode) para cheesecake.ando — decisiones, trampas del motor de disponibilidad y estado del alta
metadata:
  type: project
---

Pastelería *cheesecake.ando* (Almansa, slug `cheesecake-ando`): primer negocio en **modo encargo**.
Funcionalidad y migraciones (0051, 0052) en `README.md → Modo encargo`; aquí solo el porqué.

**Decisiones confirmadas con el usuario (2026-11-05, no reabrir):**
- Opción A (tipo `citas` + `order_mode`, 8 servicios = nivel × tamaño + tabla de sabores), no 112
  servicios ni un tipo `pedidos` nuevo.
- Estado nuevo `listo` en el enum compartido (auditado antes: nada existente lo rompe). Recogido =
  `completada`, no recogido = `no_show`; solo cambian las etiquetas.
- Un encargo = una tarta (cantidad > 1 no está soportada; sería repetir el flujo o WhatsApp).
- Encargos web entran `pendiente` (confirmación manual); el staff crea `confirmada`.
- Antelación mínima, capacidad diaria y antelación de cancelación **las decide el dueño**: se dejan
  vacías (sin límite). `default_capacity = 2` (recogidas simultáneas) es un valor de EJEMPLO.

**Trampas del motor que ya se pisaron:**
- Antes de 0052, `get_available_slots` solo contaba `confirmada/completada` como hueco ocupado y
  `create_public_booking` forzaba `confirmada`: un `pendiente` no habría bloqueado la franja.
- Cambiar el tipo de retorno de una RPC obliga a `drop function` + `create` (overloads);
  `create_public_booking` cambió de firma (+`p_option_id`): se borró la antigua y se re-hizo
  `revoke ... from public, anon` + `grant ... to authenticated, service_role`.
- `generate_typescript_types` devuelve JSON `{"types": "..."}` y, al ser enorme, el MCP lo guarda en
  un fichero de `tool-results`: extraer el campo `types` con Python y copiarlo a
  `packages/shared/src/database.types.ts`.
- Para reemplazos multilínea con acentos desde Bash usar un `.py` en el scratchpad con
  `python -X utf8`; los heredocs largos con tildes/backticks fallaron o se desalineaban.
- `embed.js` limita el iframe a 520 px y `.widget` a 480 px; `data-max-width` (→ `?max-width=` →
  `--widget-max`) lo amplía sin cambiar el comportamiento por defecto.

**Estado (2026-11-05):** migraciones, Edge Functions (`create-booking` v20,
`send-confirmation-email` v15), widget y panel desplegados en producción. El negocio
`cheesecake-ando` existe (horario, 8 servicios, 56 sabores). Verificado en vivo: encargo real a 375 px
(queda `pendiente`, «Mi encargo» OK), embed sin doble scroll, y las reglas del motor (pendiente ocupa
hueco, capacidad diaria total/por tamaño, antelación mínima, festivo cerrado/abre como domingo,
cancelación mínima, `listo` no cancelable, sabor no disponible solo bloquea a la web) probadas por
SQL en una transacción que se revierte con `raise exception`. Datos de prueba borrados.
**Sin verificar en vivo:** las pantallas del panel (Agenda, Producción, Catálogo, Configuración) —
requieren sesión de staff. Falta crear el staff (correo dado por el usuario; la contraseña la teclea
él en Admin → Usuarios, y conviene que la cambie porque se compartió en el chat), subir el logo y
poner el slug en `site.ts` de la web. Pendiente del dueño: antelación mínima,
capacidad diaria, política de cancelación, enlace de reseña de Google, correo remitente (Resend) y
plantilla de WhatsApp (4 variables: cliente, negocio, fecha, hora; sin sabor).
