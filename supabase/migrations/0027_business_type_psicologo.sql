-- =====================================================================
-- 0027_business_type_psicologo.sql
-- Nueva categoría de negocio "psicologo", idéntica a "citas" en
-- comportamiento (motor de disponibilidad, RPCs de reserva, widget, panel):
-- todo el código que distingue tipos ya está escrito como
-- `type === 'restaurante' ? ... : ...`, nunca como un switch cerrado de dos
-- casos, así que cualquier negocio "psicologo" cae automáticamente en el
-- camino de citas sin más cambios de lógica. Solo el super-admin ve/edita
-- el valor de `type` explícitamente (ver Businesses.tsx/BusinessDetail.tsx).
--
-- Una sola sentencia en este archivo a propósito: Postgres no permite usar
-- un valor de enum recién añadido dentro de la misma transacción en la que
-- se añade.
-- =====================================================================

alter type business_type add value 'psicologo';
