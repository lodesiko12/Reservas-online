-- agency_chat_rls_test.sql
-- Pruebas de seguridad del chat de la agencia sobre el tenant demo (seed + agencia_demo_chat.sql).
-- Mismo método que agency_rls_test.sql: identidades simuladas con rol authenticated + claims.
-- Resultado esperado (2026-10-04):
--   a_otro_tenant: 0 mensajes; no puede escribir.
--   b_miembro (miembro01, equipo Protocolo mayor): 8 mensajes (5 generales + 3 de su equipo), 0 de equipos
--      ajenos; escribe en General y en su equipo; NO en equipos ajenos; no puede firmar como otro;
--      no borra mensajes ajenos (0 filas); sí borra los suyos; no puede editar (0 filas).
--   b2_desactivado: 0.
--   c_directiva (presidente): 15 mensajes (todos los grupos); borra mensajes ajenos (moderación).
create or replace function pg_temp.agency_chat_test() returns jsonb language plpgsql as $$
declare
  res jsonb := '{}'::jsonb;
  biz uuid := (select id from public.businesses where slug = 'agrupacion-demo');
  u_pres uuid := (select id from auth.users where email = 'presidente@agencia.test');
  u_m1   uuid := (select id from auth.users where email = 'miembro01@agencia.test');
  u_m3   uuid := (select id from auth.users where email = 'miembro03@agencia.test');
  u_out  uuid := (select id from auth.users where email = 'staff@restaurante.test');
  own_team uuid; foreign_team uuid; foreign_msg uuid; own_msg uuid;
  ok boolean; n int;
begin
  select tm.team_id into own_team from public.agency_team_members tm where tm.user_id = u_m1 limit 1;
  select t.id into foreign_team from public.agency_teams t where t.business_id = biz and t.name = 'Pólvora';
  select id into foreign_msg from public.agency_chat_messages where team_id = foreign_team limit 1;
  select id into own_msg from public.agency_chat_messages where author_id = u_m1 limit 1;

  perform set_config('request.jwt.claims', json_build_object('sub', u_out, 'role', 'authenticated')::text, true);
  set local role authenticated;
  res := res || jsonb_build_object('a_otro_tenant_mensajes', (select count(*) from public.agency_chat_messages));
  ok := false; begin insert into public.agency_chat_messages (business_id, team_id, body) values (biz, null, 'intruso'); ok := true; raise exception 'rb'; exception when others then null; end;
  res := res || jsonb_build_object('a_otro_tenant_puede_escribir_en_general', ok);
  reset role;

  perform set_config('request.jwt.claims', json_build_object('sub', u_m1, 'role', 'authenticated')::text, true);
  set local role authenticated;
  res := res || jsonb_build_object('b_miembro', jsonb_build_object(
    'total', (select count(*) from public.agency_chat_messages),
    'generales', (select count(*) from public.agency_chat_messages where team_id is null),
    'de_su_equipo', (select count(*) from public.agency_chat_messages where team_id = own_team),
    'de_equipos_ajenos', (select count(*) from public.agency_chat_messages where team_id is not null and team_id <> own_team),
    'no_leidos', (select coalesce(sum(unread), 0) from public.agency_chat_unread(biz))));
  ok := false; begin insert into public.agency_chat_messages (business_id, team_id, body) values (biz, null, 'x'); ok := true; raise exception 'rb'; exception when others then null; end;
  res := res || jsonb_build_object('b_escribir_en_general', ok);
  ok := false; begin insert into public.agency_chat_messages (business_id, team_id, body) values (biz, own_team, 'x'); ok := true; raise exception 'rb'; exception when others then null; end;
  res := res || jsonb_build_object('b_escribir_en_su_equipo', ok);
  ok := false; begin insert into public.agency_chat_messages (business_id, team_id, body) values (biz, foreign_team, 'x'); ok := true; raise exception 'rb'; exception when others then null; end;
  res := res || jsonb_build_object('b_escribir_en_equipo_ajeno', ok);
  ok := false; begin insert into public.agency_chat_messages (business_id, team_id, author_id, body) values (biz, null, u_m3, 'firmado por otro'); ok := true; raise exception 'rb'; exception when others then null; end;
  res := res || jsonb_build_object('b_firmar_como_otro_queda_a_su_nombre_o_falla', ok);
  begin delete from public.agency_chat_messages where id = foreign_msg; get diagnostics n = row_count; exception when others then n := -1; end;
  res := res || jsonb_build_object('b_borrar_mensaje_de_equipo_ajeno_filas', n);
  n := 0; begin delete from public.agency_chat_messages where id = own_msg; get diagnostics n = row_count; raise exception 'rb'; exception when others then null; end;
  res := res || jsonb_build_object('b_borrar_el_suyo_filas', n);
  n := 0; begin update public.agency_chat_messages set body = 'editado' where id = own_msg; get diagnostics n = row_count; raise exception 'rb'; exception when others then null; end;
  res := res || jsonb_build_object('b_editar_mensaje_filas', n); -- 0: sin política de UPDATE no hay error, solo 0 filas
  reset role;

  perform set_config('request.jwt.claims', '', true);
  update public.agency_members set is_active = false where business_id = biz and user_id = u_m1;
  perform set_config('request.jwt.claims', json_build_object('sub', u_m1, 'role', 'authenticated')::text, true);
  set local role authenticated;
  res := res || jsonb_build_object('b2_desactivado_mensajes', (select count(*) from public.agency_chat_messages));
  reset role;
  perform set_config('request.jwt.claims', '', true);
  update public.agency_members set is_active = true where business_id = biz and user_id = u_m1;

  perform set_config('request.jwt.claims', json_build_object('sub', u_pres, 'role', 'authenticated')::text, true);
  set local role authenticated;
  res := res || jsonb_build_object('c_directiva_mensajes', (select count(*) from public.agency_chat_messages));
  n := 0; begin delete from public.agency_chat_messages where id = foreign_msg; get diagnostics n = row_count; raise exception 'rb'; exception when others then null; end;
  res := res || jsonb_build_object('c_directiva_borra_mensaje_ajeno_filas', n);
  reset role;
  perform set_config('request.jwt.claims', '', true);
  return res;
end $$;
select jsonb_pretty(pg_temp.agency_chat_test()) as resultado;
