-- demo_centro_ana_sanchez.sql
-- Carga pacientes, citas y sesiones FICTICIOS en el negocio REAL "Centro de Psicología Ana Sánchez"
-- (slug centrodepsicologia-anasanchez) para enseñar el panel a las 3 psicólogas en un meet.
--
-- NO es una migración: se ejecuta a mano (escritura en producción: pedir confirmación antes).
-- Idempotente: se puede relanzar antes de cada demo; solo borra/regenera lo suyo (pacientes cuyo
-- teléfono empieza por 6000010 y sus reservas/sesiones). NO toca pacientes ni reservas reales.
-- Para quitarlo todo antes de empezar a trabajar de verdad: limpiar_demo_centro_ana_sanchez.sql.
--
-- Seguridad:
--  * Los pacientes NO llevan email: el cron request-reviews (reseña de Google) y los avisos solo
--    escriben a quien tiene email, así no sale ningún correo a nadie por error.
--  * Teléfonos ficticios 6000010NN. No hay diagnósticos: los textos de las sesiones son genéricos.
--  * Las sesiones no llevan autor (author_user_id null) para no atribuir notas inventadas a nadie.
--  * Las citas futuras ocupan huecos del widget público: limpiar la demo antes de abrir reservas.
--
-- Plantilla semanal respetando horario del negocio y servicios de cada profesional.
-- Rango: 4 semanas atrás → 2 semanas adelante (relativo a HOY).

do $$
declare
  demo_slug text := 'centrodepsicologia-anasanchez';
  tz        text := 'Europe/Madrid';
  bid uuid;
  p_ana uuid; p_carmen uuid; p_sole uuid;
  s_adul uuid; s_inf uuid; s_par uuid; s_fam uuid;
  monday date := (now() at time zone tz)::date - (extract(isodow from (now() at time zone tz)::date)::int - 1);
  objetivos text[] := array[
    'Gestionar el estrés laboral y recuperar el descanso',
    'Mejorar la comunicación en la pareja',
    'Trabajar la autoestima y los límites con la familia',
    'Afrontar un cambio de etapa personal',
    'Establecer rutinas de sueño y autocuidado',
    'Reducir la autoexigencia en los estudios'];
  notas text[] := array[
    'Primera toma de contacto. Se acuerdan objetivos y frecuencia semanal.',
    'Revisamos la semana: identifica los momentos de mayor tensión y qué le ha ayudado.',
    'Practicamos una técnica de respiración y ordenamos las prioridades de la semana.',
    'Buena evolución: aplica las pautas y nota más calma. Se refuerzan los avances.',
    'Se trabaja una situación concreta y otras formas de responder.',
    'Repaso de lo conseguido y planificación de las próximas sesiones.'];
  seguimientos text[] := array[
    'Continuar con las pautas y revisarlas en la próxima sesión.',
    'Pendiente valorar cómo ha ido la conversación que tenía planteada.',
    'Mantener el registro semanal y traerlo a consulta.'];
  tareas text[] := array[
    'Registro diario de tres momentos del día.',
    'Paseo de 20 minutos tres veces por semana.',
    'Anotar una situación difícil y cómo respondió.',
    'Respiración de 5 minutos antes de dormir.'];
  c record; w int; dt date; starts timestamptz; ends timestamptz;
  sv uuid; pr uuid; dur int; st booking_status; paid timestamptz; bk uuid; loc text;
begin
  select id into bid from public.businesses where slug = demo_slug;
  if bid is null then raise exception 'No existe el negocio %', demo_slug; end if;
  select id into p_ana    from public.professionals where business_id = bid and name = 'Ana Sánchez';
  select id into p_carmen from public.professionals where business_id = bid and name = 'Carmen';
  select id into p_sole   from public.professionals where business_id = bid and name = 'Soledad';
  select id into s_adul from public.services where business_id = bid and name = 'Terapia adultos';
  select id into s_inf  from public.services where business_id = bid and name = 'Terapia infanto-juvenil';
  select id into s_par  from public.services where business_id = bid and name = 'Terapia de pareja';
  select id into s_fam  from public.services where business_id = bid and name = 'Terapia familiar';
  if p_ana is null or p_carmen is null or p_sole is null or s_adul is null or s_inf is null or s_par is null or s_fam is null then
    raise exception 'Faltan profesionales o servicios esperados en %', demo_slug;
  end if;

  -- 1) Pacientes ficticios (solo los que falten)
  insert into public.customers (business_id, full_name, last_name, phone, profession, birth_date)
  select bid, t.f, t.l, '6000010' || lpad(t.n::text, 2, '0'), t.prof, t.born
  from (values
    (1,  'Marta',  'Ibáñez Soler',   'Maestra',            date '1987-03-14'),
    (2,  'Daniel', 'Ferrer Pons',    'Ingeniero',          date '1982-09-02'),
    (3,  'Lucía',  'Navarro Gil',    'Enfermera',          date '1990-06-21'),
    (4,  'Andrés', 'Molina Ruiz',    'Autónomo',           date '1979-11-30'),
    (5,  'Irene',  'Castillo Vera',  'Estudiante',         date '2001-01-18'),
    (6,  'Pablo',  'Serrano Mas',    'Administrativo',     date '1985-05-09'),
    (7,  'Elena',  'Prieto Lara',    'Farmacéutica',       date '1976-08-25'),
    (8,  'Sergio', 'Cano Blasco',    'Comercial',          date '1993-12-04'),
    (9,  'Nuria',  'Esteve Roig',    'Diseñadora',         date '1988-02-27'),
    (10, 'Hugo',   'Marín Calvo',    'Estudiante (menor)', date '2012-04-11'),
    (11, 'Paula',  'Vidal Ortega',   'Estudiante (menor)', date '2010-10-06'),
    (12, 'Javier', 'Roca Beltrán',   'Arquitecto',         date '1984-07-19'),
    (13, 'Carla',  'Benito Marcos',  'Abogada',            date '1991-03-03'),
    (14, 'Rubén',  'Gallego Nieto',  'Conductor',          date '1980-09-15')
  ) as t(n, f, l, prof, born)
  where not exists (
    select 1 from public.customers x
    where x.business_id = bid and x.phone = '6000010' || lpad(t.n::text, 2, '0'));

  -- 2) Limpiar SOLO lo demo anterior y regenerar
  delete from public.client_sessions
   where business_id = bid and customer_id in (select id from public.customers where business_id = bid and phone like '6000010%');
  delete from public.bookings
   where business_id = bid and customer_id in (select id from public.customers where business_id = bid and phone like '6000010%');

  -- 3) Citas: plantilla semanal por paciente (n, día ISO, hora, minutos, profesional, servicio, quincenal)
  for c in
    select cu.id, cu.full_name, cu.last_name, cu.phone, right(cu.phone, 2)::int as n
    from public.customers cu
    where cu.business_id = bid and cu.phone like '6000010%'
  loop
    declare
      t record;
    begin
      select * into t from (values
        (1,  1, 16, 0,  p_ana,    s_adul, false),
        (2,  3, 17, 0,  p_ana,    s_adul, false),
        (3,  2, 17, 0,  p_sole,   s_par,  true),
        (4,  1, 17, 30, p_carmen, s_adul, false),
        (5,  4, 10, 0,  p_sole,   s_adul, false),
        (6,  4, 17, 0,  p_carmen, s_adul, true),
        (7,  2, 10, 0,  p_ana,    s_fam,  false),
        (8,  5, 10, 0,  p_carmen, s_adul, false),
        (9,  5, 11, 30, p_ana,    s_adul, true),
        (10, 3, 17, 30, p_carmen, s_inf,  false),
        (11, 4, 17, 30, p_ana,    s_inf,  false),
        (12, 3, 18, 0,  p_sole,   s_par,  true),
        (13, 2, 18, 30, p_sole,   s_adul, false),
        (14, 4, 9,  0,  p_ana,    s_adul, false)
      ) as v(n, dow, hh, mm, prof, svc, biweekly) where v.n = c.n;

      for w in -4..2 loop
        continue when t.biweekly and (w + 4) % 2 = 1;
        dt := monday + (t.dow - 1) + 7 * w;
        starts := (dt + make_interval(hours => t.hh, mins => t.mm)) at time zone tz;
        sv := t.svc; pr := t.prof;
        select duration_min into dur from public.services where id = sv;
        ends := starts + make_interval(mins => dur);

        if ends < now() then
          st := case when c.n = 5 and w = -2 then 'no_show'::booking_status else 'completada'::booking_status end;
          -- la mayoría cobradas; unas pocas pendientes de cobro en las dos últimas semanas
          paid := case when st = 'completada' and not ((c.n + w) % 4 = 0 and w >= -2)
                       then ends + interval '10 minutes' else null end;
        else
          st := case when c.n = 6 and w = 1 then 'cancelada'::booking_status else 'confirmada'::booking_status end;
          paid := null;
        end if;

        loc := 'DM-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));
        insert into public.bookings (business_id, type, service_id, professional_id, starts_at, ends_at,
          customer_id, customer_name, customer_last_name, customer_phone, locator, status, channel, paid_at)
        values (bid, 'citas', sv, pr, starts, ends, c.id, c.full_name, c.last_name, c.phone, loc, st,
                case when c.n % 2 = 1 then 'web'::booking_channel else 'manual'::booking_channel end, paid)
        returning id into bk;

        if st = 'completada' then
          insert into public.client_sessions (business_id, customer_id, booking_id, objetivo, notas, seguimiento, tareas_pautas, session_date)
          values (bid, c.id, bk,
                  objetivos[(c.n % 6) + 1],
                  notas[((w + 4 + c.n) % 6) + 1],
                  seguimientos[((w + 4 + c.n) % 3) + 1],
                  tareas[((w + 4 + c.n) % 4) + 1],
                  starts);
        end if;
      end loop;
    end;
  end loop;

  raise notice 'Demo cargada en %.', demo_slug;
end $$;
