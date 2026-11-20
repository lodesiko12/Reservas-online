# Sesión 2026-11-10 (tarde) — Pecado Carnal y Burguer Chin en Turnigo

Continuación del mismo día que `sesion-2026-11-10.md` (pedidos para llevar). Aquí: alta de dos clientes
restaurante nuevos y una conversación de precios. Para retomar, leer esto + `CLAUDE.md` + README → Pendientes.

## Qué se pidió y qué se hizo
Petición: "entra en las carpetas de Pecado Carnal y Burguer Chin (apartado Web), haz un negocio para cada uno;
el de Pecado Carnal ya está creado, modifícalo".

- Las carpetas están en `C:\Users\javie\Documents\cositas\Emprendimiento\Webs\` (**"Webs"**, no "Web"):
  - `Pecado Carnal\` — web ya construida (`web-pecado-carnal\`, `tools\menu_data.py` con la carta,
    `assets\js\widget-config.js` con horarios, teléfonos y slugs esperados del widget).
  - `Burger Chin\propuestas\` — solo 4 propuestas de diseño; la elegida es la **2b "Cobre y Acero vivo"**
    (carta de muestra con precios, tel 967 49 66 01, burguerchin32@gmail.com, @burguer_chin; dirección y horario "pendiente de confirmar").
- Estado previo en BD: un único negocio `pecadocarnal` (creado hoy 09:55, owner `pecadocarnal@gmail.com`,
  1 categoría + hamburguesa de prueba "Trufada", takeaway Jue-Dom 20-23 con mín. 20 €).
- Pregunté con 3 preguntas y el usuario eligió: **dos negocios** para Pecado Carnal (Tudela y Ejea, porque la web ya
  espera `pecado-carnal-tudela` y `pecado-carnal-ejea`), Burguer Chin como **restaurante con pedidos**, **sin staff** por ahora.
- Plan presentado y confirmado ("Sí, aplícalo") antes de tocar la BD (regla del proyecto). Aplicado en una sola
  transacción con `supabase/demo/setup_pecado_carnal_burguer_chin.sql` (idempotente; borra y recarga carta/horarios,
  se niega si el negocio ya tiene pedidos).

## Estado final en producción
| Negocio | Slug | Carta | Horario |
|---|---|---|---|
| Pecado Carnal Tudela (el existente, renombrado) | `pecadocarnal` (**pendiente cambiar a `pecado-carnal-tudela`**) | 23 platos | Jue-Dom 20:00-23:30 |
| Pecado Carnal Ejea (nuevo) | `pecado-carnal-ejea` | 23 platos | Vie 20:30-23:30, Sáb 20:00-00:00, Dom 20:00-23:30 |
| Burguer Chin (nuevo, color #A8501F) | `burguer-chin` | 19 platos (muestra de la web) | **Provisional**: Mar-Dom comida 13-16 y cena 20-23:30 |

Los tres: tipo `restaurante`, `online_orders` activo, 8 mesas genéricas en zona "Sala", takeaway 40 min / franjas 30 min / 15 por franja.
Staff: solo Tudela (`pecadocarnal@gmail.com`, owner). Ejea y Chin sin usuario.

Verificado: carta y pestañas en el widget de Burguer Chin; franjas de sala y de recogida por RPC
(`get_available_dining_slots`, `get_takeaway_slots`) en los tres (Ejea cerrado los jueves, correcto).
**No verificado**: reserva o pedido completo de extremo a extremo; panel con sesión; widget de Tudela/Ejea en el navegador.
Advisors de seguridad: sin avisos nuevos.

Commit `7285587` en `main` (scripts de alta + memoria del día). **No se ha hecho push** (y no hace falta: solo SQL/notas).

## Pendientes inmediatos
1. **El usuario** debe cambiar el slug de Tudela a `pecado-carnal-tudela` en Admin → Editar negocio
   (el trigger `guard_business_update` exige super-admin real; no saltarlo por SQL). Hasta entonces el widget de Tudela es `?slug=pecadocarnal`.
2. Confirmar con los dueños: mesas reales (plano), horario y dirección reales de Burguer Chin, resto de su carta
   (arroces "consultar precio", más platos), alérgenos (no cargados; hay PDF en la web de Pecado Carnal), `google_review_url`
   (la web solo tiene un enlace común a los dos locales), sábado de Ejea (la web dice cierre 00:00, el turno acaba 23:59).
3. Dar de alta staff de Ejea y Burguer Chin desde Admin → Usuarios cuando se decida el correo
   (para Chin la propuesta usa burguerchin32@gmail.com).
4. Cuando se vaya a enseñar: probar una reserva y un pedido completos en cada widget y borrar los datos de prueba.
5. Conectar la web de Pecado Carnal: `widget-config.js` ya apunta a `pecado-carnal-tudela` / `pecado-carnal-ejea`;
   los widgets de "encargar" (`order`) están vacíos y la web usa Flipdish (`pecadocarnal.flipdish.menu/order`).

## Conversación comercial (no está en el código)
- Pecado Carnal paga hoy **Flipdish**. Tarifas oficiales en euros (por sede): Website 49 €/mes con pago anual (69 € mensual),
  Website + app 79 € (99 €). Para 2 locales: **98 €/mes** (1.176 €/año) o 138 € mensual; con app 158/198 €. Comisión por pedido
  y IVA no confirmados para España: hay que pedir la factura real del negocio.
- Propuesta del usuario: **100 €/mes** por mantener la web + los dos sistemas Turnigo, y **350 € únicos** por web nueva + puesta en marcha.
  Mi valoración: cuota competitiva (≈ plan anual de Flipdish); primer año ≈ 1.550 € vs 1.176 €; 350 € es barato (sugerí 450-600 €
  o mantenerlo como gancho dejando claro qué incluye). Recomendé fijar qué cubre la cuota (cambios de carta, límite de cambios de web, soporte),
  aclarar IVA y ofrecer opcionalmente 1.000 €/año pagado de golpe.
- **Límites de Turnigo hoy frente a Flipdish** (decirlo al cliente): sin pago online con tarjeta (Stripe, bloqueado por cuenta del negocio),
  sin reparto a domicilio (fase 2). Planteamiento: "web + reservas + pedidos para llevar sin comisión por lo mismo", y dejar Flipdish
  si necesitan cobrar online hasta tener Stripe.
- Coste interno a recordar: Supabase Pro (25 $/mes) ya está justificado con clientes reales; los 100 €/mes lo cubren.
- Ofrecí preparar una comparación de una página para enseñarla al cliente cuando el usuario pase la factura de Flipdish. Sin respuesta.

## Preferencias y reglas confirmadas en esta sesión
- Sigue vigente: **confirmar antes de cualquier cambio en la BD** (aquí se presentó el plan y se esperó el "sí"), y confirmar antes de `git push`.
- El usuario responde corto ("Sí, aplícalo") cuando el plan está claro: presentar el plan completo con supuestos antes de ejecutar.
- Prefiere que las dudas de diseño se resuelvan con preguntas cerradas (opciones con recomendación primero).
- Pide commit explícito ("Confirma los cambios del árbol de trabajo") y yo lo hago sin push.
- Pide cifras concretas de precios y valoración honesta de su oferta, no solo teoría.

## Errores y correcciones de la sesión
- Primer SQL de consulta falló por asumir columnas (`phone` no existe en `businesses`): consultar `information_schema`/`select *` antes de nombrar columnas.
- El nombre de la carpeta es "Webs" (el usuario dijo "Web") y "Burger Chin" en disco pero "Burguer Chin" en la marca: el negocio se llama **Burguer Chin** (con "gu").
- La web de Pecado Carnal tiene 2 locales → 2 negocios Turnigo; el negocio previo era uno solo, por eso se renombró a Tudela en vez de crear otro.
- Aviso de seguridad previo respetado: no cambiar `slug`/`type`/`is_active` por SQL; el nombre sí se pudo cambiar por SQL.

## Datos técnicos útiles
- Script reutilizable: `supabase/demo/setup_pecado_carnal_burguer_chin.sql` (helpers `pg_temp.pc_menu` y `pg_temp.pc_service`;
  menú y horarios como JSON, fácil de adaptar a otro restaurante).
- Tablas implicadas: `businesses`, `business_hours`, `takeaway_hours`, `takeaway_settings`, `dining_settings`, `dining_zones`,
  `dining_tables`, `dining_shifts`, `menu_categories`, `menu_items` (alérgenos = `text[]` vacío por defecto), `business_users`.
- Widget de producción: `https://turnigo-widget.lodesiko12.workers.dev/?slug=<slug>`; panel: `https://turnigo-panel.lodesiko12.workers.dev/`.
- Hoy es 2026-11-10 (martes). Memoria local del asistente: `project-pecado-carnal-burguer-chin.md` (índice en `MEMORY.md`).
