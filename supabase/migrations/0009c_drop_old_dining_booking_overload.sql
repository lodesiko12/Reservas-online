-- La migración 0009 añadió p_table_id como una NUEVA sobrecarga de
-- create_public_dining_booking en lugar de reemplazar la función, dejando
-- dos signatures coexistiendo (10 y 11 argumentos) que PostgREST no puede
-- desambiguar cuando el cliente omite p_table_id (caso "automático").
-- Se elimina la sobrecarga antigua; la de 11 argumentos (p_table_id default
-- null) la sustituye por completo.
drop function if exists public.create_public_dining_booking(uuid,uuid,timestamptz,int,text,text,text,text,text,booking_channel);
