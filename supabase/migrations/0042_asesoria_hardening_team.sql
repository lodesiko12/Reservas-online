-- 0042_asesoria_hardening_team.sql
-- 1) Fija search_path en las funciones de 0041 que no lo tenían (lint
--    function_search_path_mutable del advisor de seguridad).
-- 2) adv_list_team: nombre y email de los miembros del equipo de la asesoría, para elegir
--    el gestor de cada cliente. profiles y auth.users no son legibles por un miembro normal
--    (profiles_select solo permite la fila propia), así que va por security definer.
alter function public.adv_normalize_nif(text) set search_path = public;
alter function public.adv_normalize_phone(text) set search_path = public;
alter function public.adv_clients_normalize() set search_path = public;
alter function public.adv_contacts_normalize() set search_path = public;
alter function public.adv_documents_guard() set search_path = public;

create or replace function public.adv_list_team(p_business_id uuid)
returns table (user_id uuid, role business_user_role, full_name text, email text)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not public.is_business_member(p_business_id) then
    raise exception 'No autorizado';
  end if;
  return query
    select bu.user_id, bu.role, p.full_name, u.email::text
    from public.business_users bu
    left join public.profiles p on p.id = bu.user_id
    left join auth.users u on u.id = bu.user_id
    where bu.business_id = p_business_id
    order by bu.created_at;
end;
$$;
revoke all on function public.adv_list_team(uuid) from public, anon;
grant execute on function public.adv_list_team(uuid) to authenticated;
