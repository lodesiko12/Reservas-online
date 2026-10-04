-- 0043_crm_delete_budget.sql
-- Eliminar presupuestos del mini-CRM de autónomos. crm_budgets no tiene política de delete
-- (solo RPC), así que el borrado pasa por esta función. No se permite borrar un presupuesto
-- del que ya salió una factura, para no romper su trazabilidad (crm_invoices.budget_id).
-- Las líneas caen en cascada; la tarjeta del pipeline (card_id) no se toca.
create or replace function public.crm_delete_budget(p_budget_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_budget public.crm_budgets;
begin
  select * into v_budget from public.crm_budgets where id = p_budget_id;
  if v_budget.id is null then
    raise exception 'Presupuesto no encontrado';
  end if;
  if not public.is_business_member(v_budget.business_id) then
    raise exception 'No autorizado';
  end if;
  if exists (select 1 from public.crm_invoices where budget_id = p_budget_id) then
    raise exception 'Este presupuesto ya tiene una factura y no se puede eliminar.';
  end if;

  delete from public.crm_budgets where id = p_budget_id;
end;
$$;

revoke all on function public.crm_delete_budget(uuid) from public, anon;
grant execute on function public.crm_delete_budget(uuid) to authenticated;
