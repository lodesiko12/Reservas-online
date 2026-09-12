-- =====================================================================
-- 0004_security_hardening.sql
-- Ajustes recomendados por el linter de Supabase.
--
-- Nota: los avisos "SECURITY DEFINER ejecutable por anon/authenticated"
-- sobre las RPCs públicas (get_public_business, get_public_services,
-- get_available_slots, get_booking_by_locator, cancel_booking_by_locator)
-- son INTENCIONADOS: el widget público (rol anon) las necesita.
-- is_super_admin()/is_business_member() deben ser ejecutables por
-- 'authenticated' porque las evalúan las propias políticas RLS.
-- =====================================================================

-- 1) Fijar search_path en funciones internas (evita search_path mutable).
alter function public.set_updated_at()                set search_path = public;
alter function public.recount_customer(uuid)          set search_path = public;
alter function public.trg_booking_customer_counts()   set search_path = public;
alter function public.generate_locator()              set search_path = public;

-- 2) La creación de reservas NO debe ser invocable por clientes sin sesión.
--    Postgres concede EXECUTE a PUBLIC por defecto; lo revocamos para que solo
--    la Edge Function (service_role) y el staff (authenticated) puedan reservar.
revoke execute on function
  public.create_public_booking(uuid,uuid,timestamptz,text,text,text,text,text,booking_channel)
  from public, anon;
