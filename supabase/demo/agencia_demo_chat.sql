-- agencia_demo_chat.sql
-- Mensajes de muestra del chat del tenant demo (requiere 0048 y el seed agencia_demo_seed.sql).
-- Un grupo General y tres equipos (Protocolo mayor, Pólvora, Desfiles).
insert into public.agency_chat_messages (business_id, team_id, author_id, body, created_at)
select b.id,
       case when v.team_name is null then null else (select t.id from public.agency_teams t where t.business_id = b.id and t.name = v.team_name) end,
       (select u.id from auth.users u where u.email = v.email),
       v.body,
       now() - v.ago
from public.businesses b
cross join (values
  (null::text, 'presidente@agencia.test', 'Buenas a todos. La asamblea general será el próximo domingo a las 20:30. Confirmad asistencia por aquí.', interval '2 days 3 hours'),
  (null, 'miembro03@agencia.test', 'Yo voy. ¿Hay que llevar algo?', interval '2 days 2 hours'),
  (null, 'secretario@agencia.test', 'Solo el DNI para firmar el acta. Gracias, Marta.', interval '2 days 1 hour'),
  (null, 'miembro15@agencia.test', 'Confirmado también. Un saludo.', interval '1 day 20 hours'),
  (null, 'tesorero@agencia.test', 'Recordad que esta semana cerramos las cuotas de la cena de hermandad.', interval '5 hours'),
  ('Protocolo mayor', 'miembro01@agencia.test', 'He quedado con el ayuntamiento el martes a las 18:00 para el protocolo.', interval '1 day 4 hours'),
  ('Protocolo mayor', 'miembro09@agencia.test', 'Perfecto, yo me encargo de revisar el orden de entrada del desfile.', interval '1 day 3 hours'),
  ('Protocolo mayor', 'miembro17@agencia.test', 'Cuando lo tengáis lo subo a Documentos.', interval '22 hours'),
  ('Pólvora', 'miembro10@agencia.test', 'Falta el permiso de la pirotecnia, lo entrego mañana en Policía Local.', interval '1 day 6 hours'),
  ('Pólvora', 'miembro03@agencia.test', 'Genial. ¿Y el seguro de responsabilidad civil?', interval '1 day 5 hours'),
  ('Pólvora', 'miembro10@agencia.test', 'Está pendiente, es la tarea atrasada. Me pongo con ello.', interval '1 day 4 hours'),
  ('Pólvora', 'miembro15@agencia.test', 'Aviso: la prueba de pólvora es el sábado a las 10:00, traed EPI.', interval '3 hours'),
  ('Desfiles', 'miembro07@agencia.test', 'Ya tengo las bandas de música casi cerradas, falta la invitada.', interval '20 hours'),
  ('Desfiles', 'miembro15@agencia.test', 'Yo puedo repartir los dorsales cuando estén impresos.', interval '19 hours'),
  ('Desfiles', 'miembro03@agencia.test', 'Genial, gracias a las dos.', interval '18 hours')
) as v(team_name, email, body, ago)
where b.slug = 'agrupacion-demo';
