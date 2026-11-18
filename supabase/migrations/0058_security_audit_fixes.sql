-- 0058 — Arreglos de la auditoría de seguridad (2026-11-17/18).
-- Todo es aditivo o endurece reglas existentes; no borra ni reescribe datos de negocio.
-- Cada bloque indica el hallazgo que cierra. Las funciones que ya existían se reescriben desde la
-- definición VIGENTE (pg_get_functiondef) con un reemplazo de texto comprobado, no desde migraciones
-- antiguas, para no pisar cambios aplicados fuera de las migraciones.

-- =====================================================================
-- 1. Reservas/clientes: el llamante autenticado debe pertenecer al negocio y las referencias
--    deben ser del mismo negocio.
--    Cierra: RPC SECURITY DEFINER sin comprobación de pertenencia (create_public_booking,
--    create_public_dining_booking, create_walkin_booking) y bookings con FK a otro negocio
--    (profesional/servicio/cliente/turno/mesa/combinación) que envenenaba la disponibilidad y
--    permitía a sync-google-event usar el token de Google de otro negocio.
--    Nota: las RPC las llama el Edge Function con service_role (auth.uid() es null) o el panel
--    con un miembro del negocio; ambos casos siguen pasando.
-- =====================================================================
create or replace function public.guard_booking_tenant()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if tg_op = 'INSERT' and auth.uid() is not null and not public.is_business_member(new.business_id) then
    raise exception 'No autorizado';
  end if;

  if new.professional_id is not null and (tg_op = 'INSERT' or new.professional_id is distinct from old.professional_id)
     and not exists (select 1 from public.professionals x where x.id = new.professional_id and x.business_id = new.business_id) then
    raise exception 'El profesional no pertenece a este negocio';
  end if;
  if new.service_id is not null and (tg_op = 'INSERT' or new.service_id is distinct from old.service_id)
     and not exists (select 1 from public.services x where x.id = new.service_id and x.business_id = new.business_id) then
    raise exception 'El servicio no pertenece a este negocio';
  end if;
  if new.customer_id is not null and (tg_op = 'INSERT' or new.customer_id is distinct from old.customer_id)
     and not exists (select 1 from public.customers x where x.id = new.customer_id and x.business_id = new.business_id) then
    raise exception 'El cliente no pertenece a este negocio';
  end if;
  if new.dining_shift_id is not null and (tg_op = 'INSERT' or new.dining_shift_id is distinct from old.dining_shift_id)
     and not exists (select 1 from public.dining_shifts x where x.id = new.dining_shift_id and x.business_id = new.business_id) then
    raise exception 'El turno no pertenece a este negocio';
  end if;
  if new.dining_table_id is not null and (tg_op = 'INSERT' or new.dining_table_id is distinct from old.dining_table_id)
     and not exists (select 1 from public.dining_tables x where x.id = new.dining_table_id and x.business_id = new.business_id) then
    raise exception 'La mesa no pertenece a este negocio';
  end if;
  if new.table_combo_id is not null and (tg_op = 'INSERT' or new.table_combo_id is distinct from old.table_combo_id)
     and not exists (select 1 from public.dining_table_combos x where x.id = new.table_combo_id and x.business_id = new.business_id) then
    raise exception 'La combinación de mesas no pertenece a este negocio';
  end if;
  return new;
end;
$$;
revoke all on function public.guard_booking_tenant() from public, anon, authenticated;

drop trigger if exists trg_guard_booking_tenant on public.bookings;
create trigger trg_guard_booking_tenant
  before insert or update on public.bookings
  for each row execute function public.guard_booking_tenant();

create or replace function public.guard_customer_insert()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if auth.uid() is not null and not public.is_business_member(new.business_id) then
    raise exception 'No autorizado';
  end if;
  return new;
end;
$$;
revoke all on function public.guard_customer_insert() from public, anon, authenticated;

drop trigger if exists trg_guard_customer_insert on public.customers;
create trigger trg_guard_customer_insert
  before insert on public.customers
  for each row execute function public.guard_customer_insert();

-- Combinaciones de mesas: todas las mesas deben ser del mismo negocio.
-- Cierra: dining-combo-table-ids-unvalidated-cross-tenant-reference.
create or replace function public.guard_dining_combo_tables()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if exists (
    select 1 from unnest(new.table_ids) as t(id)
    where not exists (select 1 from public.dining_tables d where d.id = t.id and d.business_id = new.business_id)
  ) then
    raise exception 'La combinación incluye mesas de otro negocio';
  end if;
  return new;
end;
$$;
revoke all on function public.guard_dining_combo_tables() from public, anon, authenticated;

drop trigger if exists trg_guard_dining_combo_tables on public.dining_table_combos;
create trigger trg_guard_dining_combo_tables
  before insert or update of table_ids, business_id on public.dining_table_combos
  for each row execute function public.guard_dining_combo_tables();

-- =====================================================================
-- 2. RPC de lectura/escritura sin comprobación de pertenencia al negocio.
--    Cierra: get_dining_table_options y crm_move_card_for_event (SECURITY DEFINER, authenticated,
--    sin is_business_member). Solo se comprueba cuando hay usuario (auth.uid() no nulo): las
--    llamadas internas con service_role siguen funcionando.
-- =====================================================================
do $$
declare
  r record;
  def text;
  pos int;
  chk text;
begin
  for r in
    select p.oid, p.proname, case p.proname
             when 'get_dining_table_options' then 'p_business_id'
             when 'crm_move_card_for_event' then 'p_business_id' end as bizarg
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in ('get_dining_table_options', 'crm_move_card_for_event')
  loop
    def := pg_get_functiondef(r.oid);
    if position('is_business_member' in def) > 0 then continue; end if; -- idempotente
    pos := position(E'\nbegin\n' in def);
    if pos = 0 then raise exception 'No se encontró BEGIN en %', r.proname; end if;
    chk := format(E'  if auth.uid() is not null and not public.is_business_member(%s) then\n    raise exception ''No autorizado'';\n  end if;\n', r.bizarg);
    def := substr(def, 1, pos + 6) || chk || substr(def, pos + 7);
    execute def;
  end loop;
end $$;

-- =====================================================================
-- 3. Menú público: hijos del mismo negocio que el padre.
--    Cierra: menu-public-cross-tenant-fk-injection (platos/opciones de otro negocio inyectados
--    en la carta pública y categorías imposibles de borrar).
-- =====================================================================
create or replace function public.guard_menu_tenant()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_item uuid;
  v_group uuid;
begin
  if tg_table_name = 'menu_items' then
    if not exists (select 1 from public.menu_categories c where c.id = new.category_id and c.business_id = new.business_id) then
      raise exception 'La categoría no pertenece a este negocio';
    end if;
  elsif tg_table_name = 'menu_modifiers' then
    if not exists (select 1 from public.menu_modifier_groups g where g.id = new.group_id and g.business_id = new.business_id) then
      raise exception 'El grupo no pertenece a este negocio';
    end if;
  elsif tg_table_name = 'menu_item_modifier_groups' then
    if not exists (
      select 1 from public.menu_items i join public.menu_modifier_groups g on g.business_id = i.business_id
      where i.id = new.item_id and g.id = new.group_id
    ) then
      raise exception 'El plato y el grupo deben ser del mismo negocio';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.guard_menu_tenant() from public, anon, authenticated;

drop trigger if exists trg_guard_menu_items_tenant on public.menu_items;
create trigger trg_guard_menu_items_tenant
  before insert or update of category_id, business_id on public.menu_items
  for each row execute function public.guard_menu_tenant();
drop trigger if exists trg_guard_menu_modifiers_tenant on public.menu_modifiers;
create trigger trg_guard_menu_modifiers_tenant
  before insert or update of group_id, business_id on public.menu_modifiers
  for each row execute function public.guard_menu_tenant();
drop trigger if exists trg_guard_menu_item_groups_tenant on public.menu_item_modifier_groups;
create trigger trg_guard_menu_item_groups_tenant
  before insert or update of item_id, group_id on public.menu_item_modifier_groups
  for each row execute function public.guard_menu_tenant();

-- Defensa en profundidad en la lectura pública: solo filas del negocio pedido.
do $$
declare
  def text;
  newdef text;
  oid_ oid;
begin
  select p.oid into oid_ from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'get_public_menu';
  def := pg_get_functiondef(oid_);
  if position('m.business_id = p_business_id' in def) > 0 then return; end if; -- idempotente
  newdef := replace(def, 'from menu_modifiers m where m.group_id = g.id', 'from menu_modifiers m where m.group_id = g.id and m.business_id = p_business_id');
  newdef := replace(newdef, 'where l.item_id = i.id', 'where l.item_id = i.id and g.business_id = p_business_id');
  newdef := replace(newdef, 'from menu_items i where i.category_id = c.id and i.is_active', 'from menu_items i where i.category_id = c.id and i.business_id = p_business_id and i.is_active');
  if newdef = def or position('m.business_id = p_business_id' in newdef) = 0
     or position('g.business_id = p_business_id' in newdef) = 0
     or position('i.business_id = p_business_id' in newdef) = 0 then
    raise exception 'get_public_menu: no se pudieron aplicar los 3 filtros por negocio';
  end if;
  execute newdef;
end $$;

-- =====================================================================
-- 4. Asesoría: el acceso a contactos de clientes exige ser miembro AHORA, y al eliminar a un
--    miembro se quitan sus clientes asignados. Cierra: asesoria:adv-client-contacts-access-survives-membership-removal.
--    Además, adv_list_team (emails) no se expone a miembros de una agencia que no sean directiva.
-- =====================================================================
create or replace function public.adv_can_access_client(b uuid, c uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select public.is_business_owner(b)
      or (
        public.is_business_member(b)
        and exists (
          select 1 from public.adv_clients cl
          where cl.id = c and cl.business_id = b and cl.manager_id = auth.uid()
        )
      );
$$;

create or replace function public.clear_manager_on_member_removal()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  update public.adv_clients set manager_id = null
   where business_id = old.business_id and manager_id = old.user_id;
  return old;
end;
$$;
revoke all on function public.clear_manager_on_member_removal() from public, anon, authenticated;

drop trigger if exists trg_clear_manager_on_member_removal on public.business_users;
create trigger trg_clear_manager_on_member_removal
  after delete on public.business_users
  for each row execute function public.clear_manager_on_member_removal();

create or replace function public.adv_list_team(p_business_id uuid)
returns table(user_id uuid, role business_user_role, full_name text, email text)
language plpgsql
stable
security definer
set search_path to 'public'
as $$
begin
  if not public.is_business_member(p_business_id) then
    raise exception 'No autorizado';
  end if;
  -- En una agencia el directorio de emails es solo para la directiva (agency_list_members_admin).
  if exists (select 1 from public.businesses b where b.id = p_business_id and b.type = 'agencia')
     and not public.agency_is_directiva(p_business_id) and not public.is_super_admin() then
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

-- =====================================================================
-- 5. Agencia: una directiva no puede cambiar su propio puesto (ni otro puesto sin ser
--    presidente/secretario). Cierra: agency-members:directiva-role-self-escalation...
--    Solo se aplica con usuario (auth.uid() no nulo): el Edge Function agency-members usa
--    service_role y sigue pudiendo dar de alta con cualquier puesto.
-- =====================================================================
do $$
declare
  def text;
  newdef text;
  oid_ oid;
begin
  select p.oid into oid_ from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'agency_members_guard';
  def := pg_get_functiondef(oid_);
  if position('cambiar puestos' in def) > 0 then return; end if; -- idempotente
  newdef := replace(def,
    E'  if new.access_level <> ''directiva'' then new.directiva_role := null; end if;',
    E'  if tg_op = ''UPDATE'' and auth.uid() is not null and not public.is_super_admin()\n'
    || E'     and new.directiva_role is distinct from old.directiva_role\n'
    || E'     and (old.user_id = auth.uid() or not public.agency_can_manage_members(old.business_id)) then\n'
    || E'    raise exception ''Solo el presidente o el secretario pueden cambiar puestos (y no el propio)'';\n'
    || E'  end if;\n'
    || E'  if new.access_level <> ''directiva'' then new.directiva_role := null; end if;');
  if newdef = def then raise exception 'agency_members_guard: no se pudo aplicar el parche'; end if;
  execute newdef;
end $$;

-- Asignados de tareas: la tarea debe ser del mismo equipo/negocio y el asignado, miembro activo.
-- Cierra: agency-task-assignees-update-bypasses-team-guard-and-task-binding.
create or replace function public.guard_agency_assignee()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if not exists (select 1 from public.agency_tasks t where t.id = new.task_id and t.business_id = new.business_id and t.team_id = new.team_id) then
    raise exception 'La tarea no pertenece a este equipo';
  end if;
  if not exists (select 1 from public.agency_members m where m.business_id = new.business_id and m.user_id = new.user_id and m.is_active) then
    raise exception 'El asignado no es miembro activo de la agencia';
  end if;
  return new;
end;
$$;
revoke all on function public.guard_agency_assignee() from public, anon, authenticated;

drop trigger if exists trg_guard_agency_assignee on public.agency_task_assignees;
create trigger trg_guard_agency_assignee
  before insert or update on public.agency_task_assignees
  for each row execute function public.guard_agency_assignee();

-- =====================================================================
-- 6. Claves de integraciones (Resend/WhatsApp): solo propietario o super-admin.
--    Cierra: password-setup-recovery-token-via-tenant-controlled-resend-key (un miembro "staff"
--    podía guardar su propia clave de Resend y recibir los enlaces de recuperación de otros).
--    Cambio de comportamiento: el personal "staff" ya no puede guardar estas claves.
-- =====================================================================
do $$
declare
  def text;
  newdef text;
  oid_ oid;
begin
  select p.oid into oid_ from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'set_business_integration';
  def := pg_get_functiondef(oid_);
  newdef := replace(def, 'if not public.is_business_member(p_business_id) then', 'if not public.is_business_owner(p_business_id) then');
  if newdef = def and position('is_business_owner' in def) = 0 then raise exception 'set_business_integration: no se pudo aplicar el parche'; end if;
  if newdef <> def then execute newdef; end if;
end $$;

-- =====================================================================
-- 7. Disponibilidad: ocupación real y límites de las RPC anónimas.
-- =====================================================================
-- 7a. Las reservas "sentada" (y los walk-in) siguen ocupando mesa y cubiertos.
--     Cierra: dining-seated-status-excluded-from-occupancy.
--     (La restricción de exclusión bookings_table_no_overlap no se toca aquí: puede haber filas
--     "sentada" solapadas ya existentes y fallaría. Queda como mejora aparte.)
do $$
declare
  r record;
  def text;
  newdef text;
begin
  for r in
    select p.oid, p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in ('dining_table_busy', 'get_available_dining_slots')
  loop
    def := pg_get_functiondef(r.oid);
    newdef := replace(def, '''confirmada'',''pendiente'',''completada''', '''confirmada'',''pendiente'',''sentada'',''completada''');
    if newdef = def then
      if position('''sentada''' in def) = 0 then raise exception 'sentada: patrón no encontrado en %', r.proname; end if;
    else
      execute newdef;
    end if;
  end loop;
end $$;

-- 7b. Rango máximo en get_available_days / get_available_dining_days (antes ilimitado, ejecutable por anon).
create or replace function public.get_available_days(
  p_business_id uuid, p_service_id uuid, p_date_from date, p_date_to date,
  p_professional_id uuid default null, p_channel booking_channel default 'web'
)
returns table(day date)
language sql
stable
security definer
set search_path to 'public'
as $$
  select d::date as day
  from generate_series(p_date_from, p_date_to, interval '1 day') as d
  where p_date_to - p_date_from between 0 and 366
    and exists (
      select 1 from public.get_available_slots(p_business_id, p_service_id, d::date, p_professional_id, p_channel) limit 1
    )
$$;

create or replace function public.get_available_dining_days(
  p_business_id uuid, p_date_from date, p_date_to date, p_party_size integer,
  p_channel booking_channel default 'web'
)
returns table(day date)
language sql
stable
security definer
set search_path to 'public'
as $$
  select d::date as day
  from generate_series(p_date_from, p_date_to, interval '1 day') as d
  where p_date_to - p_date_from between 0 and 366
    and exists (
      select 1 from public.get_available_dining_slots(p_business_id, d::date, p_party_size, p_channel) limit 1
    )
$$;

-- 7c. Las consultas por localizador usan upper(locator): sin este índice cada llamada anónima
--     recorría toda la tabla.
create index if not exists idx_bookings_locator_upper on public.bookings (upper(locator));
create index if not exists idx_orders_locator_upper on public.orders (upper(locator));

-- =====================================================================
-- 8. Zona horaria válida: una zona inválida abortaba el cron de recordatorios de TODOS los negocios.
-- =====================================================================
create or replace function public.validate_business_timezone()
returns trigger
language plpgsql
set search_path to 'public'
as $$
begin
  if new.timezone is not null then
    begin
      perform now() at time zone new.timezone;
    exception when others then
      raise exception 'Zona horaria no válida: %', new.timezone;
    end;
  end if;
  return new;
end;
$$;
revoke all on function public.validate_business_timezone() from public, anon, authenticated;

drop trigger if exists trg_validate_business_timezone on public.businesses;
create trigger trg_validate_business_timezone
  before insert or update of timezone on public.businesses
  for each row execute function public.validate_business_timezone();

-- =====================================================================
-- 9. Bucket público de logos: solo imágenes y tamaño acotado.
-- =====================================================================
update storage.buckets
   set file_size_limit = 2097152,
       allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp', 'image/gif']
 where id = 'logos';
