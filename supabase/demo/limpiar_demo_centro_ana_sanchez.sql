-- limpiar_demo_centro_ana_sanchez.sql
-- Borra los datos ficticios cargados por demo_centro_ana_sanchez.sql en el negocio REAL
-- "Centro de Psicología Ana Sánchez" (slug centrodepsicologia-anasanchez).
-- EJECUTAR ANTES DE EMPEZAR A TRABAJAR DE VERDAD (las citas futuras demo ocupan huecos del widget).
-- Solo toca pacientes con teléfono 6000010NN y sus reservas/sesiones. Escritura en producción:
-- pedir confirmación antes. Borrado definitivo (no hay papelera).

do $$
declare
  bid uuid;
  n_b int; n_c int;
begin
  select id into bid from public.businesses where slug = 'centrodepsicologia-anasanchez';
  if bid is null then raise exception 'No existe el negocio'; end if;

  delete from public.client_ai_reports
   where business_id = bid and customer_id in (select id from public.customers where business_id = bid and phone like '6000010%');
  delete from public.client_sessions
   where business_id = bid and customer_id in (select id from public.customers where business_id = bid and phone like '6000010%');
  delete from public.bookings
   where business_id = bid and customer_id in (select id from public.customers where business_id = bid and phone like '6000010%');
  get diagnostics n_b = row_count;
  delete from public.customers where business_id = bid and phone like '6000010%';
  get diagnostics n_c = row_count;

  raise notice 'Borrados: % reservas (con sus sesiones) y % pacientes', n_b, n_c;
end $$;
