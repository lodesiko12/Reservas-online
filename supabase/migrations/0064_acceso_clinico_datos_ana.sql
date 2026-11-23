-- 0064: datos de 0063 para el centro de Ana Sanchez (negocio real).
-- 1) Vincula cada profesional con su cuenta.
-- 2) Asigna como responsable a cada paciente la profesional de sus citas
--    (solo si todas sus citas son de una unica profesional; el resto queda sin asignar).
do $$
declare b uuid;
begin
  select id into b from public.businesses where slug = 'centrodepsicologia-anasanchez';
  if b is null then return; end if;

  update public.professionals p set user_id = u.id
  from auth.users u
  where p.business_id = b
    and ((p.name = 'Ana Sánchez' and u.email = 'anasanchezpsicologa@gmail.com')
      or (p.name = 'Carmen'      and u.email = 'cmgarciapsicologa@gmail.com')
      or (p.name = 'Soledad'     and u.email = 'soledadaesposito@gmail.com'));

  update public.customers c set professional_id = x.pid
  from (
    select bk.customer_id, min(bk.professional_id::text)::uuid as pid
    from public.bookings bk
    where bk.business_id = b and bk.customer_id is not null
    group by bk.customer_id
    having count(distinct bk.professional_id) = 1 and count(*) filter (where bk.professional_id is null) = 0
  ) x
  where c.id = x.customer_id and c.business_id = b and c.professional_id is null;
end $$;
