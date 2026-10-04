-- 0047_agency_comment_author_service.sql
-- agency_comments_guard forzaba author_id := auth.uid(). Con un usuario autenticado sigue
-- siendo así (auth.uid() nunca es null, no se puede suplantar al autor), pero sin JWT
-- (service_role / SQL de administración, p. ej. el seed del tenant demo) auth.uid() es null y el
-- comentario quedaba sin autor. Ahora, sin JWT, se respeta el author_id indicado.
create or replace function public.agency_comments_guard()
returns trigger language plpgsql set search_path = public as $$
declare t record;
begin
  if tg_op = 'UPDATE' then
    if new.task_id is distinct from old.task_id or new.business_id is distinct from old.business_id
       or new.team_id is distinct from old.team_id or new.author_id is distinct from old.author_id then
      raise exception 'Campos inmutables del comentario';
    end if;
    return new;
  end if;
  select business_id, team_id into t from public.agency_tasks where id = new.task_id;
  if not found then raise exception 'Tarea no encontrada'; end if;
  new.business_id := t.business_id;
  new.team_id := t.team_id;
  new.author_id := coalesce(auth.uid(), new.author_id);
  new.body := btrim(new.body);
  -- Solo se pueden mencionar miembros del propio equipo.
  new.mentions := coalesce((
    select array_agg(distinct u) from unnest(new.mentions) u
    where exists (
      select 1 from public.agency_team_members x
      where x.team_id = new.team_id and x.user_id = u
    )
  ), '{}');
  return new;
end;
$$;
