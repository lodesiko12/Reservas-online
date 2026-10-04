-- agency_rls_test.sql
-- Pruebas de seguridad del tipo "agencia" (RLS), ejecutables con execute_sql sobre el tenant
-- demo (supabase/demo/agencia_demo_seed.sql). Simula cada identidad con el rol `authenticated`
-- + claims JWT dentro de una función temporal; las escrituras de prueba se revierten con
-- subtransacciones. Devuelve un JSON con lo que ve/puede hacer cada usuario.
--
-- Resultado esperado (2026-10-04):
--   a_otro_tenant (staff del restaurante): todo 0; no puede insertar tareas ni eventos.
--   b_miembro (miembro01, 1 equipo): 1 equipo, 4 tareas, 4 eventos (3 generales + 1 de su equipo),
--      0 de equipos ajenos; no puede escribir en equipos ajenos, crear equipos ni eventos
--      generales, ni ascenderse; sí puede escribir en su equipo.
--   b2_desactivado: 0 en todo.
--   c_directiva (presidente, en 0 equipos): 8 equipos, 30 tareas, 40 asignados, 10 eventos, 25 miembros,
--      escribe en cualquier equipo; no puede quitarse a sí mismo la directiva.
--   d: solo presidente y secretario pueden dar altas (tesorero es directiva pero no).
create or replace function pg_temp.agency_rls_test() returns jsonb language plpgsql as $$
declare
  res jsonb := '{}'::jsonb;
  biz uuid := (select id from public.businesses where slug = 'agrupacion-demo');
  u_pres uuid := (select id from auth.users where email = 'presidente@agencia.test');
  u_tes  uuid := (select id from auth.users where email = 'tesorero@agencia.test');
  u_m1   uuid := (select id from auth.users where email = 'miembro01@agencia.test');
  u_out  uuid := (select id from auth.users where email = 'staff@restaurante.test');
  own_team uuid; foreign_team uuid; foreign_task uuid; foreign_member uuid;
  ok boolean; n int;
begin
  select tm.team_id into own_team from public.agency_team_members tm where tm.user_id = u_m1 limit 1;
  select t.id into foreign_team from public.agency_teams t where t.business_id = biz and t.id <> own_team
    and not exists (select 1 from public.agency_team_members x where x.team_id = t.id and x.user_id = u_m1) limit 1;
  select id into foreign_task from public.agency_tasks where team_id = foreign_team limit 1;
  select user_id into foreign_member from public.agency_members where business_id = biz and user_id <> u_m1 and access_level = 'miembro' limit 1;

  -- (a) usuario de OTRO tenant
  perform set_config('request.jwt.claims', json_build_object('sub', u_out, 'role', 'authenticated')::text, true);
  set local role authenticated;
  res := res || jsonb_build_object('a_otro_tenant', jsonb_build_object(
    'negocio_visible', (select count(*) from public.businesses where id = biz),
    'miembros', (select count(*) from public.agency_members),
    'equipos', (select count(*) from public.agency_teams),
    'equipos_miembros', (select count(*) from public.agency_team_members),
    'tareas', (select count(*) from public.agency_tasks),
    'asignados', (select count(*) from public.agency_task_assignees),
    'comentarios', (select count(*) from public.agency_task_comments),
    'eventos', (select count(*) from public.agency_events),
    'documentos', (select count(*) from public.agency_documents),
    'avisos', (select count(*) from public.agency_notifications)));
  ok := false; begin insert into public.agency_tasks (business_id, team_id, title) values (biz, foreign_team, 'intruso'); ok := true; raise exception 'rb'; exception when others then null; end;
  res := res || jsonb_build_object('a_otro_tenant_puede_insertar_tarea', ok);
  ok := false; begin insert into public.agency_events (business_id, title, starts_at) values (biz, 'intruso', now()); ok := true; raise exception 'rb'; exception when others then null; end;
  res := res || jsonb_build_object('a_otro_tenant_puede_insertar_evento', ok);
  reset role;

  -- (b) MIEMBRO
  perform set_config('request.jwt.claims', json_build_object('sub', u_m1, 'role', 'authenticated')::text, true);
  set local role authenticated;
  res := res || jsonb_build_object('b_miembro', jsonb_build_object(
    'equipos_que_ve', (select count(*) from public.agency_teams),
    'equipos_ajenos_que_ve', (select count(*) from public.agency_teams where id <> own_team),
    'tareas_total', (select count(*) from public.agency_tasks),
    'tareas_de_equipos_ajenos', (select count(*) from public.agency_tasks where team_id <> own_team),
    'comentarios_ajenos', (select count(*) from public.agency_task_comments where team_id <> own_team),
    'eventos_total', (select count(*) from public.agency_events),
    'eventos_generales', (select count(*) from public.agency_events where team_id is null),
    'eventos_de_equipos_ajenos', (select count(*) from public.agency_events where team_id is not null and team_id <> own_team),
    'asignados_ajenos', (select count(*) from public.agency_task_assignees where team_id <> own_team),
    'equipos_miembros_ajenos', (select count(*) from public.agency_team_members where team_id <> own_team),
    'avisos_ajenos', (select count(*) from public.agency_notifications where user_id <> u_m1),
    'directorio_miembros', (select count(*) from public.agency_members)));
  ok := false; begin insert into public.agency_tasks (business_id, team_id, title) values (biz, foreign_team, 'x'); ok := true; raise exception 'rb'; exception when others then null; end;
  res := res || jsonb_build_object('b_insertar_tarea_en_equipo_ajeno', ok);
  ok := false; begin insert into public.agency_tasks (business_id, team_id, title) values (biz, own_team, 'x'); ok := true; raise exception 'rb'; exception when others then null; end;
  res := res || jsonb_build_object('b_insertar_tarea_en_su_equipo', ok);
  begin update public.agency_tasks set title = 'hack' where id = foreign_task; get diagnostics n = row_count; exception when others then n := -1; end;
  res := res || jsonb_build_object('b_filas_editadas_tarea_ajena', n);
  begin delete from public.agency_tasks where id = foreign_task; get diagnostics n = row_count; exception when others then n := -1; end;
  res := res || jsonb_build_object('b_filas_borradas_tarea_ajena', n);
  ok := false; begin insert into public.agency_events (business_id, team_id, title, starts_at) values (biz, null, 'x', now()); ok := true; raise exception 'rb'; exception when others then null; end;
  res := res || jsonb_build_object('b_crear_evento_general', ok);
  ok := false; begin insert into public.agency_events (business_id, team_id, title, starts_at) values (biz, foreign_team, 'x', now()); ok := true; raise exception 'rb'; exception when others then null; end;
  res := res || jsonb_build_object('b_crear_evento_en_equipo_ajeno', ok);
  ok := false; begin insert into public.agency_teams (business_id, name) values (biz, 'Equipo pirata'); ok := true; raise exception 'rb'; exception when others then null; end;
  res := res || jsonb_build_object('b_crear_equipo', ok);
  begin update public.agency_members set access_level = 'directiva' where business_id = biz and user_id = u_m1; get diagnostics n = row_count; exception when others then n := -1; end;
  res := res || jsonb_build_object('b_autoascenderse_a_directiva_filas', n);
  begin update public.agency_members set cargo = 'x' where business_id = biz and user_id = foreign_member; get diagnostics n = row_count; exception when others then n := -1; end;
  res := res || jsonb_build_object('b_editar_cargo_de_otro_filas', n);
  ok := false; begin insert into public.agency_team_members (team_id, user_id, business_id) values (foreign_team, u_m1, biz); ok := true; raise exception 'rb'; exception when others then null; end;
  res := res || jsonb_build_object('b_meterse_en_equipo_ajeno', ok);
  ok := false; begin insert into public.agency_notifications (business_id, user_id, kind, title) values (biz, u_m1, 'asignada', 'falso'); ok := true; raise exception 'rb'; exception when others then null; end;
  res := res || jsonb_build_object('b_fabricar_aviso', ok);
  ok := false; begin insert into public.agency_documents (business_id, team_id, name, storage_path, mime_type, size_bytes) values (biz, foreign_team, 'x', biz || '/' || foreign_team || '/x.pdf', 'application/pdf', 1); ok := true; raise exception 'rb'; exception when others then null; end;
  res := res || jsonb_build_object('b_subir_documento_a_equipo_ajeno', ok);
  ok := false; begin insert into public.agency_documents (business_id, team_id, name, storage_path, mime_type, size_bytes) values (biz, own_team, 'x', biz || '/' || own_team || '/x.pdf', 'application/pdf', 1); ok := true; raise exception 'rb'; exception when others then null; end;
  res := res || jsonb_build_object('b_subir_documento_a_su_equipo', ok);
  res := res || jsonb_build_object('b_acceso_storage_equipo_ajeno', public.agency_storage_access(biz || '/' || foreign_team || '/x.pdf'), 'b_acceso_storage_su_equipo', public.agency_storage_access(biz || '/' || own_team || '/x.pdf'));
  reset role;

  -- (b2) miembro DESACTIVADO (se actualiza como administrador: sin claims)
  perform set_config('request.jwt.claims', '', true);
  update public.agency_members set is_active = false where business_id = biz and user_id = u_m1;
  perform set_config('request.jwt.claims', json_build_object('sub', u_m1, 'role', 'authenticated')::text, true);
  set local role authenticated;
  res := res || jsonb_build_object('b2_desactivado', jsonb_build_object(
    'equipos', (select count(*) from public.agency_teams), 'tareas', (select count(*) from public.agency_tasks),
    'eventos', (select count(*) from public.agency_events), 'avisos', (select count(*) from public.agency_notifications)));
  reset role;
  perform set_config('request.jwt.claims', '', true);
  update public.agency_members set is_active = true where business_id = biz and user_id = u_m1;

  -- (c) DIRECTIVA (presidente)
  perform set_config('request.jwt.claims', json_build_object('sub', u_pres, 'role', 'authenticated')::text, true);
  set local role authenticated;
  res := res || jsonb_build_object('c_directiva', jsonb_build_object(
    'equipos', (select count(*) from public.agency_teams),
    'tareas', (select count(*) from public.agency_tasks),
    'asignados', (select count(*) from public.agency_task_assignees),
    'eventos', (select count(*) from public.agency_events),
    'miembros', (select count(*) from public.agency_members),
    'equipos_miembros', (select count(*) from public.agency_team_members),
    'esta_en_algun_equipo', (select count(*) from public.agency_team_members where user_id = u_pres)));
  ok := false; begin insert into public.agency_tasks (business_id, team_id, title) values (biz, foreign_team, 'x'); ok := true; raise exception 'rb'; exception when others then null; end;
  res := res || jsonb_build_object('c_crear_tarea_en_cualquier_equipo', ok);
  ok := false; begin insert into public.agency_events (business_id, team_id, title, starts_at) values (biz, null, 'x', now()); ok := true; raise exception 'rb'; exception when others then null; end;
  res := res || jsonb_build_object('c_crear_evento_general', ok);
  ok := false; begin insert into public.agency_teams (business_id, name) values (biz, 'Equipo nuevo'); ok := true; raise exception 'rb'; exception when others then null; end;
  res := res || jsonb_build_object('c_crear_equipo', ok);
  n := 0; begin update public.agency_members set cargo = 'Cargo editado' where business_id = biz and user_id = foreign_member; get diagnostics n = row_count; raise exception 'rb'; exception when others then null; end;
  res := res || jsonb_build_object('c_editar_cargo_de_otro', n = 1);
  begin update public.agency_members set access_level = 'miembro' where business_id = biz and user_id = u_pres; n := 1; exception when others then n := -1; end;
  res := res || jsonb_build_object('c_quitarse_la_directiva_a_si_mismo_bloqueado', n = -1);
  reset role;

  -- (d) puestos que pueden dar altas
  perform set_config('request.jwt.claims', json_build_object('sub', u_tes, 'role', 'authenticated')::text, true);
  set local role authenticated;
  res := res || jsonb_build_object('d_tesorero', jsonb_build_object('puede_dar_altas', public.agency_can_manage_members(biz), 'es_directiva', public.agency_is_directiva(biz)));
  perform set_config('request.jwt.claims', json_build_object('sub', u_pres, 'role', 'authenticated')::text, true);
  res := res || jsonb_build_object('d_presidente_puede_dar_altas', public.agency_can_manage_members(biz));
  perform set_config('request.jwt.claims', json_build_object('sub', u_m1, 'role', 'authenticated')::text, true);
  res := res || jsonb_build_object('d_miembro_puede_dar_altas', public.agency_can_manage_members(biz));
  reset role;
  perform set_config('request.jwt.claims', '', true);
  return res;
end $$;
select jsonb_pretty(pg_temp.agency_rls_test()) as resultado;
