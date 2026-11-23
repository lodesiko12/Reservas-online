-- =====================================================================
-- 0067_asignar_responsable_automatico.sql
-- Un paciente sin profesional responsable (customers.professional_id nulo)
-- recibe como responsable la profesional de su primera cita, para que quien
-- lo atiende pueda escribir sus notas sin pasos manuales. Solo rellena
-- huecos: nunca cambia un responsable ya asignado.
-- =====================================================================

create or replace function public.assign_customer_from_booking()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.customer_id is not null and new.professional_id is not null then
    update public.customers
       set professional_id = new.professional_id
     where id = new.customer_id
       and business_id = new.business_id
       and professional_id is null
       and exists (select 1 from public.professionals p
                   where p.id = new.professional_id and p.business_id = new.business_id);
  end if;
  return new;
end $$;
revoke execute on function public.assign_customer_from_booking() from public, anon, authenticated;

drop trigger if exists trg_assign_customer_from_booking on public.bookings;
create trigger trg_assign_customer_from_booking
  after insert on public.bookings
  for each row execute function public.assign_customer_from_booking();
