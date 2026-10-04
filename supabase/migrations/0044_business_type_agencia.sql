-- 0044_business_type_agencia.sql
-- Nuevo tipo de negocio "agencia": herramienta interna de organización por equipos y
-- proyectos (tareas, calendario, documentos), sin reservas ni widget público ni portal de
-- clientes. Primer uso real: la Agrupación de Comparsas. Va en su propia migración porque
-- Postgres no permite usar un valor de enum nuevo en la misma transacción en la que se
-- crea (mismo patrón que 0027, 0033 y 0040).
alter type business_type add value 'agencia';
