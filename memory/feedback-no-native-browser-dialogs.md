---
name: feedback-no-native-browser-dialogs
description: Nunca usar confirm()/alert()/prompt() nativos en el panel; usar siempre Modal/ConfirmDialog de components/ui.tsx
metadata:
  type: feedback
---

`apps/dashboard/src/components/ui.tsx` ya documenta en un comentario que `window.confirm()` "no
funciona en todos los navegadores (confirmado en vivo con el navegador de pruebas de Claude)" —
por eso existe `ConfirmDialog`. Aun así, el 2026-09-28 un agente delegado para construir el
módulo CRM de autónomos usó `confirm("Presupuesto aceptado. ¿Generar la factura ahora?")` nativo
para una decisión secundaria (no era el flujo principal de borrado que ya usa `ConfirmDialog`
en otros sitios). Resultado probado en vivo: el diálogo no aparecía y la acción condicionada
(generar la factura) nunca se disparaba, sin ningún error visible — silenciosamente roto.

**Por qué se coló:** el prompt de la tarea no prohibió explícitamente `confirm()`/`alert()`, solo
pedía reutilizar los componentes existentes en términos generales; el agente no lo dedujo del
comentario en `ui.tsx` porque no llegó a leer ese archivo con suficiente detalle, o lo pasó por
alto al escribir código nuevo bajo presión de completar la tarea.

**Cómo aplicarlo:**
- Al delegar cualquier construcción de UI nueva (propia o vía agente), prohibir explícitamente
  `confirm()`, `alert()`, `prompt()` nativos en las instrucciones, no solo pedir "reutiliza los
  componentes existentes" — la prohibición explícita es más fiable que esperar que se infiera.
- Al revisar el trabajo de un agente antes de darlo por bueno, `grep` por `confirm(`, `alert(`,
  `prompt(` en los archivos nuevos/modificados es una comprobación barata que habría detectado
  esto sin necesidad de probar el flujo en vivo.
- Patrón correcto: un `useState` con el elemento a confirmar (o `null`), y un `<Modal>`/
  `<ConfirmDialog>` condicional en el JSX — ver el arreglo aplicado en
  `apps/dashboard/src/business/crm/Presupuestos.tsx` (estado `offerInvoiceFor` +
  `generatingInvoice`) como ejemplo a copiar para casos similares (confirmación con una acción
  asíncrona de por medio, no solo sí/no).
