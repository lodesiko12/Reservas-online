-- 0060_delete_orphan_auth_users.sql
-- Cuando se quita a un usuario de un negocio (business_users) o de una agencia (agency_members), o se
-- borra un negocio (ON DELETE CASCADE sobre esas tablas), la cuenta de auth.users se borra también
-- si ya no pertenece a ningún otro negocio ni agencia.
-- Nunca se borra a un super-admin (no pertenece a ningún negocio y una regla simple lo eliminaría).
-- Los miembros de agencia "desactivados" conservan su fila en agency_members, así que no se borran.
-- Borrar de auth.users arrastra (ON DELETE CASCADE) profiles, avisos y suscripciones push; las columnas
-- de autoría (sesiones, mensajes, documentos…) quedan a NULL.

create or replace function public.delete_orphan_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if exists (select 1 from public.business_users where user_id = old.user_id)
     or exists (select 1 from public.agency_members where user_id = old.user_id)
     or exists (select 1 from public.profiles where id = old.user_id and is_super_admin) then
    return old;
  end if;

  delete from auth.users where id = old.user_id;
  return old;
end;
$$;

revoke execute on function public.delete_orphan_auth_user() from public, anon, authenticated;

drop trigger if exists trg_delete_orphan_auth_user on public.business_users;
create trigger trg_delete_orphan_auth_user
  after delete on public.business_users
  for each row execute function public.delete_orphan_auth_user();

drop trigger if exists trg_delete_orphan_auth_user on public.agency_members;
create trigger trg_delete_orphan_auth_user
  after delete on public.agency_members
  for each row execute function public.delete_orphan_auth_user();
