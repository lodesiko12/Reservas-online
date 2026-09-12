-- =====================================================================
-- 0002_rls_policies.sql
-- Funciones de rol + Row Level Security.
--
-- Modelo de acceso:
--   * super_admin  -> acceso global a todos los tenants.
--   * staff/owner  -> acceso SOLO a las filas de su(s) business_id.
--   * clientes web -> NO tienen sesión; reservan a través de RPCs
--                     SECURITY DEFINER y Edge Functions con service_role.
--                     Por eso NO se crean políticas para el rol `anon`.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Helpers de rol (SECURITY DEFINER para poder leer profiles/business_users
-- sin recursión de políticas).
-- ---------------------------------------------------------------------
create or replace function public.is_super_admin()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.is_super_admin
  );
$$;

create or replace function public.is_business_member(b uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select public.is_super_admin()
      or exists (
        select 1 from public.business_users bu
        where bu.business_id = b and bu.user_id = auth.uid()
      );
$$;

-- Crea la fila en profiles automáticamente al registrar un usuario en Auth.
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.email))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Evita que un miembro no super-admin altere campos sensibles del negocio
-- (activación de suscripción, tipo o slug). El branding/horario sí lo pueden editar.
create or replace function public.guard_business_update()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if not public.is_super_admin() then
    if new.is_active is distinct from old.is_active
       or new.type is distinct from old.type
       or new.slug is distinct from old.slug then
      raise exception 'Solo el super-admin puede cambiar is_active, type o slug';
    end if;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_guard_business_update on public.businesses;
create trigger trg_guard_business_update
  before update on public.businesses
  for each row execute function public.guard_business_update();

-- ---------------------------------------------------------------------
-- Habilitar RLS en todas las tablas
-- ---------------------------------------------------------------------
alter table public.profiles              enable row level security;
alter table public.businesses            enable row level security;
alter table public.business_users        enable row level security;
alter table public.professionals         enable row level security;
alter table public.professional_hours    enable row level security;
alter table public.services              enable row level security;
alter table public.service_availability  enable row level security;
alter table public.business_hours        enable row level security;
alter table public.dining_shifts         enable row level security;
alter table public.customers             enable row level security;
alter table public.bookings              enable row level security;
alter table public.blocks                enable row level security;
alter table public.whatsapp_reminders_log enable row level security;

-- ---------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_super_admin());

drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid() and is_super_admin = (select is_super_admin from public.profiles where id = auth.uid()));

-- ---------------------------------------------------------------------
-- businesses
-- ---------------------------------------------------------------------
drop policy if exists businesses_select on public.businesses;
create policy businesses_select on public.businesses for select to authenticated
  using (public.is_business_member(id));

drop policy if exists businesses_insert on public.businesses;
create policy businesses_insert on public.businesses for insert to authenticated
  with check (public.is_super_admin());

drop policy if exists businesses_update on public.businesses;
create policy businesses_update on public.businesses for update to authenticated
  using (public.is_business_member(id)) with check (public.is_business_member(id));

drop policy if exists businesses_delete on public.businesses;
create policy businesses_delete on public.businesses for delete to authenticated
  using (public.is_super_admin());

-- ---------------------------------------------------------------------
-- business_users  (gestión reservada al super-admin; miembros solo lectura)
-- ---------------------------------------------------------------------
drop policy if exists business_users_select on public.business_users;
create policy business_users_select on public.business_users for select to authenticated
  using (public.is_business_member(business_id));

drop policy if exists business_users_write on public.business_users;
create policy business_users_write on public.business_users for all to authenticated
  using (public.is_super_admin()) with check (public.is_super_admin());

-- ---------------------------------------------------------------------
-- Tablas de negocio con business_id directo:
-- professionals, services, business_hours, dining_shifts, customers, bookings, blocks
-- Política uniforme: acceso total a los miembros del negocio.
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'professionals','services','business_hours','dining_shifts',
    'customers','bookings','blocks'
  ] loop
    execute format('drop policy if exists %I_all on public.%I;', t, t);
    execute format(
      'create policy %I_all on public.%I for all to authenticated
         using (public.is_business_member(business_id))
         with check (public.is_business_member(business_id));', t, t);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- Tablas hijas sin business_id directo -> se resuelve por el padre.
-- ---------------------------------------------------------------------
drop policy if exists service_availability_all on public.service_availability;
create policy service_availability_all on public.service_availability for all to authenticated
  using (exists (select 1 from public.services s where s.id = service_id and public.is_business_member(s.business_id)))
  with check (exists (select 1 from public.services s where s.id = service_id and public.is_business_member(s.business_id)));

drop policy if exists professional_hours_all on public.professional_hours;
create policy professional_hours_all on public.professional_hours for all to authenticated
  using (exists (select 1 from public.professionals p where p.id = professional_id and public.is_business_member(p.business_id)))
  with check (exists (select 1 from public.professionals p where p.id = professional_id and public.is_business_member(p.business_id)));

-- ---------------------------------------------------------------------
-- whatsapp_reminders_log  (lectura para miembros; escritura vía service_role)
-- ---------------------------------------------------------------------
drop policy if exists wa_log_select on public.whatsapp_reminders_log;
create policy wa_log_select on public.whatsapp_reminders_log for select to authenticated
  using (public.is_business_member(business_id));
