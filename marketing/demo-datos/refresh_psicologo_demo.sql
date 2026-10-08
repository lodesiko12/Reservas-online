-- refresh_psicologo_demo.sql
-- Recarga las citas y sesiones del negocio demo de psicólogo (slug consulta-demo-psicologia),
-- relativas a la fecha ACTUAL: 4 semanas atrás → 2 semanas adelante, más 4 citas de HOY
-- (una en curso, una siguiente, una más tarde y una ya terminada y sin cobrar).
--
-- NO es una migración: se ejecuta a mano ANTES DE CADA CAPTURA O DEMO (la cita "en curso" solo
-- lo está durante ~50 min). Idempotente: borra las reservas y sesiones DE ESTE NEGOCIO y las
-- regenera. Requiere haber ejecutado antes psicologo_demo_seed.sql.
-- Todo son datos inventados; los textos de las sesiones son genéricos y sin diagnósticos.

do $$
declare
  demo_slug text := 'consulta-demo-psicologia';
  tz        text := 'Europe/Madrid';
  bid uuid; prof uuid; uid uuid;
  s_first uuid; s_ind uuid; s_pair uuid; s_online uuid;
  today  date := (now() at time zone tz)::date;
  monday date := (now() at time zone tz)::date - (extract(isodow from (now() at time zone tz)::date)::int - 1);
  rounded timestamptz := date_trunc('hour', now()) + floor(extract(minute from now()) / 5) * 5 * interval '1 minute';
  hours int[] := array[10, 11, 12, 17, 18, 19];
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
  sv uuid; dur int; st booking_status; paid timestamptz; bk uuid; loc text;
begin
  select id into bid from public.businesses where slug = demo_slug;
  if bid is null then raise exception 'No existe el negocio %; ejecuta antes psicologo_demo_seed.sql', demo_slug; end if;
  select id into prof from public.professionals where business_id = bid limit 1;
  select user_id into uid from public.business_users where business_id = bid limit 1;
  select id into s_first  from public.services where business_id = bid and name = 'Primera consulta';
  select id into s_ind    from public.services where business_id = bid and name = 'Terapia individual';
  select id into s_pair   from public.services where business_id = bid and name = 'Terapia de pareja';
  select id into s_online from public.services where business_id = bid and name = 'Sesión online';

  delete from public.client_sessions where business_id = bid;
  delete from public.bookings where business_id = bid;

  -- Citas semanales por paciente (L-V, hora fija por paciente)
  for c in
    select id, full_name, last_name, phone, email, row_number() over (order by phone)::int n
    from public.customers where business_id = bid
  loop
    for w in -4..2 loop
      dt := monday + ((c.n - 1) % 5) + 7 * w;
      continue when dt = today;                                  -- hoy se carga aparte
      starts := (dt + make_interval(hours => hours[((c.n - 1) % 6) + 1])) at time zone tz;
      sv := case when c.n in (9, 10) and w = -4 then s_first
                 when c.n = 3 then s_pair
                 when c.n = 5 then s_online
                 else s_ind end;
      select duration_min into dur from public.services where id = sv;
      ends := starts + make_interval(mins => dur);

      if ends < now() then
        st := case when c.n = 7 and w = -2 then 'no_show'::booking_status else 'completada'::booking_status end;
        -- la mayoría cobradas; unas pocas pendientes de cobro en las dos últimas semanas
        paid := case when st = 'completada' and not ((c.n + w) % 4 = 0 and w >= -2) then ends + interval '10 minutes' else null end;
      else
        st := case when c.n = 4 and w = 1 then 'cancelada'::booking_status else 'confirmada'::booking_status end;
        paid := null;
      end if;

      loc := 'PS-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));
      insert into public.bookings (business_id, type, service_id, professional_id, starts_at, ends_at,
        customer_id, customer_name, customer_last_name, customer_phone, customer_email, locator, status, channel, paid_at)
      values (bid, 'citas', sv, prof, starts, ends, c.id, c.full_name, c.last_name, c.phone, c.email, loc, st,
              case when c.n % 2 = 1 then 'web'::booking_channel else 'manual'::booking_channel end, paid)
      returning id into bk;

      if st = 'completada' then
        insert into public.client_sessions (business_id, customer_id, booking_id, author_user_id, objetivo, notas, seguimiento, tareas_pautas, session_date)
        values (bid, c.id, bk, uid,
                objetivos[(c.n % 6) + 1],
                notas[((w + 4 + c.n) % 6) + 1],
                seguimientos[((w + 4 + c.n) % 3) + 1],
                tareas[((w + 4 + c.n) % 4) + 1],
                starts);
      end if;
    end loop;
  end loop;

  -- HOY: pacientes 1-4 (cuya cita semanal de hoy, si la tenían, se ha saltado arriba)
  for c in
    select id, full_name, last_name, phone, email, row_number() over (order by phone)::int n
    from public.customers where business_id = bid
  loop
    continue when c.n > 4;
    starts := case c.n
      when 1 then rounded - interval '20 minutes'      -- EN CURSO
      when 2 then rounded + interval '40 minutes'      -- siguiente
      when 3 then rounded + interval '130 minutes'     -- más tarde
      else        rounded - interval '3 hours' end;    -- ya terminada, sin cobrar
    ends := starts + interval '50 minutes';
    st := case when c.n = 4 then 'completada'::booking_status else 'confirmada'::booking_status end;
    loc := 'PS-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));
    insert into public.bookings (business_id, type, service_id, professional_id, starts_at, ends_at,
      customer_id, customer_name, customer_last_name, customer_phone, customer_email, locator, status, channel)
    values (bid, 'citas', s_ind, prof, starts, ends, c.id, c.full_name, c.last_name, c.phone, c.email, loc, st,
            case when c.n % 2 = 1 then 'web'::booking_channel else 'manual'::booking_channel end);
  end loop;

  raise notice 'Demo de psicólogo recargada (%).', demo_slug;
end $$;
