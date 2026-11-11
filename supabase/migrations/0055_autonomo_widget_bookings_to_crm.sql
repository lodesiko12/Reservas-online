-- =====================================================================
-- 0055_autonomo_widget_bookings_to_crm.sql
-- Widget de reservas para negocios tipo `autonomo` (caso: Turnigo).
--
-- El widget ya reserva con el flujo genérico (servicio → día/hora → formulario)
-- y guarda en `bookings`, pero el panel del autónomo solo lee `crm_*`. Esta
-- migración:
--   1) añade `crm_events.booking_id` para enlazar cada cita con su reserva;
--   2) crea un trigger AFTER INSERT/UPDATE en `bookings` que, solo para negocios
--      `autonomo`, crea una tarjeta en la primera etapa del Pipeline y un evento
--      en la Agenda interna, y borra el evento si la reserva se cancela;
--   3) da de alta los dos servicios del negocio `turnigo`.
-- El trigger nunca debe impedir una reserva: cualquier error se degrada a WARNING.
-- =====================================================================

alter table public.crm_events
  add column if not exists booking_id uuid references public.bookings(id) on delete cascade;

create unique index if not exists crm_events_booking_id_key
  on public.crm_events (booking_id) where booking_id is not null;

create or replace function public.trg_booking_to_crm()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_type   business_type;
  v_stage  uuid;
  v_svc    text;
  v_title  text;
  v_card   uuid;
  v_who    text;
  v_detail text;
begin
  select type into v_type from businesses where id = new.business_id;
  if v_type is distinct from 'autonomo' then return new; end if;

  if tg_op = 'UPDATE' then
    -- Reserva cancelada desde el widget: la cita de la Agenda deja de tener sentido.
    if new.status = 'cancelada' and old.status is distinct from 'cancelada' then
      delete from crm_events where booking_id = new.id;
    end if;
    return new;
  end if;

  -- INSERT: tarjeta en la primera etapa + evento en la Agenda.
  select id into v_stage
  from crm_pipeline_stages
  where business_id = new.business_id
  order by position, created_at
  limit 1;
  if v_stage is null then return new; end if;

  select name into v_svc from services where id = new.service_id;
  v_who := btrim(coalesce(new.customer_name, '') || ' ' || coalesce(new.customer_last_name, ''));
  v_title := coalesce(v_svc, 'Reserva') || ' · ' || v_who;
  v_detail := 'Reserva desde el widget (' || new.locator || E')\nTeléfono: ' || coalesce(new.customer_phone, '-')
              || E'\nEmail: ' || coalesce(new.customer_email, '-')
              || case when nullif(btrim(coalesce(new.notes, '')), '') is not null
                      then E'\nNotas: ' || new.notes else '' end;

  insert into crm_cards (business_id, customer_id, stage_id, title, description, position)
  values (
    new.business_id, new.customer_id, v_stage, v_title, v_detail,
    coalesce((select max(position) from crm_cards where stage_id = v_stage), -1) + 1
  )
  returning id into v_card;

  insert into crm_events (business_id, customer_id, card_id, booking_id, type, title, starts_at, ends_at, notes)
  values (new.business_id, new.customer_id, v_card, new.id, 'llamada', v_title, new.starts_at, new.ends_at, v_detail);

  return new;
exception when others then
  raise warning 'trg_booking_to_crm: %', sqlerrm;
  return new;
end $$;

revoke execute on function public.trg_booking_to_crm() from public, anon, authenticated;

drop trigger if exists trg_booking_to_crm on public.bookings;
create trigger trg_booking_to_crm
  after insert or update of status on public.bookings
  for each row execute function public.trg_booking_to_crm();

-- Servicios del widget de Turnigo (30 min cada uno, sin precio; editables después).
insert into public.services (business_id, name, duration_min, sort_order)
select b.id, s.name, s.dur, s.ord
from public.businesses b
cross join (values ('Demo de Turnigo', 30, 0), ('Hablar de tu web', 30, 1)) as s(name, dur, ord)
where b.slug = 'turnigo' and b.type = 'autonomo'
  and not exists (select 1 from public.services x where x.business_id = b.id and x.name = s.name);
