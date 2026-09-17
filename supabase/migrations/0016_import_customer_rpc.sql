-- =====================================================================
-- 0016_import_customer_rpc.sql
-- El índice único de clientes es parcial (business_id, phone_norm) WHERE
-- phone_norm IS NOT NULL, y el upsert de PostgREST (ON CONFLICT por lista
-- de columnas) no puede inferir un índice parcial. Se añade una función
-- que hace el mismo upsert seguro que ya usan los RPC de creación de
-- reserva, para reutilizarla en la importación CSV desde el panel.
-- =====================================================================
create or replace function public.import_customer(
  p_business_id uuid,
  p_full_name   text,
  p_last_name   text default null,
  p_phone       text default null,
  p_email       text default null,
  p_notes       text default null
) returns public.customers
language plpgsql security definer set search_path = public
as $$
declare v_row public.customers;
begin
  if not public.is_business_member(p_business_id) then
    raise exception 'No autorizado';
  end if;

  if public.normalize_phone(p_phone) is not null then
    insert into public.customers (business_id, full_name, last_name, phone, email, notes)
    values (p_business_id, p_full_name, p_last_name, p_phone, p_email, p_notes)
    on conflict (business_id, phone_norm) where phone_norm is not null do update
      set email      = coalesce(public.customers.email, excluded.email),
          notes      = coalesce(excluded.notes, public.customers.notes),
          updated_at = now()
    returning * into v_row;
  else
    insert into public.customers (business_id, full_name, last_name, phone, email, notes)
    values (p_business_id, p_full_name, p_last_name, p_phone, p_email, p_notes)
    returning * into v_row;
  end if;

  return v_row;
end $$;
grant execute on function public.import_customer(uuid, text, text, text, text, text) to authenticated;
revoke execute on function public.import_customer(uuid, text, text, text, text, text) from public, anon;
