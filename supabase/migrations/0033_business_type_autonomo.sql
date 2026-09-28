-- 0033_business_type_autonomo.sql
-- Nuevo tipo de negocio "autonomo" (electricistas, fontaneros, albañiles...) con
-- mini-CRM propio (pipeline, agenda interna, presupuestos, facturas). Se añade en su
-- propia migración porque Postgres no permite usar un valor de enum nuevo en la misma
-- transacción en la que se crea (mismo patrón que 0027_business_type_psicologo.sql).
alter type business_type add value 'autonomo';
