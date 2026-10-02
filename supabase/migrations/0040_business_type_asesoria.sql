-- 0040_business_type_asesoria.sql
-- Nuevo tipo de negocio "asesoria" (gestorías / asesorías fiscales y contables):
-- organizador universal de documentos por cliente, sin reservas ni citas. Se añade en su
-- propia migración porque Postgres no permite usar un valor de enum nuevo en la misma
-- transacción en la que se crea (mismo patrón que 0027 y 0033).
alter type business_type add value 'asesoria';
