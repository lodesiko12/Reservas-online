-- Configuración base de "Centro de Psicología Ana Sánchez" (slug centrodepsicologia-anasanchez),
-- que sustituye a "Ana Sánchez Psicóloga". Copia equipo, servicio y horario del negocio antiguo.
-- Idempotente: no hace nada si el negocio ya tiene profesionales o servicios.
do $$
declare
  v_biz uuid := '6fb98a7a-d501-4cdd-a5f5-ec20d3100132';
  v_svc uuid;
begin
  if exists (select 1 from professionals where business_id = v_biz)
     or exists (select 1 from services where business_id = v_biz) then
    raise notice 'El negocio ya tiene profesionales o servicios; no se hace nada';
    return;
  end if;

  -- Sesiones de 60 min: huecos cada 60 min (el 15 por defecto daría inicios a :15/:30/:45)
  update businesses set slot_interval_min = 60 where id = v_biz;

  insert into professionals (business_id, name, color, is_active) values
    (v_biz, 'Ana Sánchez', '#3b82f6', true),
    (v_biz, 'Carmen',      '#ef4444', true),
    (v_biz, 'Soledad',     '#22c55e', true);

  insert into services (business_id, name, duration_min, buffer_min, price, is_active, sort_order)
  values (v_biz, 'Terapia Individual', 60, 0, 60, true, 0)
  returning id into v_svc;

  insert into service_professionals (service_id, professional_id)
  select v_svc, id from professionals where business_id = v_biz;

  -- Horario: L-J 10-13 y 16-18, V 10-13 y 16-20 (sustituye al 9-18 por defecto)
  delete from business_hours where business_id = v_biz;
  insert into business_hours (business_id, weekday, open_time, close_time)
  select v_biz, d, t.o::time, t.c::time
  from generate_series(1, 5) d
  cross join lateral (values ('10:00','13:00'), ('16:00', case when d = 5 then '20:00' else '18:00' end)) as t(o, c);
end $$;
