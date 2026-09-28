-- 0036_crm_rpcs.sql
-- RPCs security definer del mini-CRM: numeración correlativa sin huecos y las
-- transiciones de estado que mueven tarjetas del pipeline. Todas revalidan
-- is_business_member(business_id) explícitamente (no confían solo en RLS, que además
-- para crm_budgets/crm_invoices/*_lines/crm_document_counters no permite escritura
-- directa: solo estas funciones pueden escribir ahí).

-- Numeración atómica: un único UPDATE/UPSERT por fila evita huecos y colisiones aunque
-- dos altas ocurran a la vez (lock de fila implícito de Postgres en el UPDATE).
create or replace function public.crm_next_document_number(p_business_id uuid, p_doc_type crm_document_type, p_year int)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_n int;
  v_prefix text := case p_doc_type when 'presupuesto' then 'P' else 'F' end;
begin
  if not public.is_business_member(p_business_id) then
    raise exception 'No autorizado';
  end if;

  insert into public.crm_document_counters (business_id, doc_type, year, last_number)
  values (p_business_id, p_doc_type, p_year, 1)
  on conflict (business_id, doc_type, year)
  do update set last_number = public.crm_document_counters.last_number + 1
  returning last_number into v_n;

  return v_prefix || '-' || p_year || '-' || lpad(v_n::text, 3, '0');
end;
$$;
revoke all on function public.crm_next_document_number(uuid, crm_document_type, int) from public, anon;
grant execute on function public.crm_next_document_number(uuid, crm_document_type, int) to authenticated;

-- Mueve la tarjeta ligada a un evento del flujo si el negocio tiene mapeada esa etapa
-- (crm_stage_events); si no hay mapeo o la tarjeta no existe, no hace nada. Nunca falla
-- la operación que la llama (presupuesto/factura) por falta de mapeo.
create or replace function public.crm_move_card_for_event(p_business_id uuid, p_card_id uuid, p_event_key crm_stage_event_key)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_stage_id uuid;
begin
  if p_card_id is null then
    return;
  end if;
  select stage_id into v_stage_id from public.crm_stage_events
    where business_id = p_business_id and event_key = p_event_key;
  if v_stage_id is null then
    return;
  end if;
  update public.crm_cards
    set stage_id = v_stage_id, last_moved_at = now(), updated_at = now()
    where id = p_card_id and business_id = p_business_id;
end;
$$;

create or replace function public.crm_create_budget(
  p_business_id uuid,
  p_customer_id uuid,
  p_card_id uuid,
  p_valid_until_days int,
  p_notes text,
  p_lines jsonb
) returns public.crm_budgets
language plpgsql
security definer
set search_path = public
as $$
declare
  v_number text;
  v_budget public.crm_budgets;
  v_line jsonb;
  v_pos int := 0;
begin
  if not public.is_business_member(p_business_id) then
    raise exception 'No autorizado';
  end if;
  if not exists (select 1 from public.customers where id = p_customer_id and business_id = p_business_id) then
    raise exception 'Cliente no válido para este negocio';
  end if;
  if p_card_id is not null and not exists (select 1 from public.crm_cards where id = p_card_id and business_id = p_business_id) then
    raise exception 'Tarjeta no válida para este negocio';
  end if;

  v_number := public.crm_next_document_number(p_business_id, 'presupuesto', extract(year from now())::int);

  insert into public.crm_budgets (business_id, customer_id, card_id, number, valid_until_days, notes)
  values (p_business_id, p_customer_id, p_card_id, v_number, coalesce(p_valid_until_days, 30), p_notes)
  returning * into v_budget;

  for v_line in select * from jsonb_array_elements(coalesce(p_lines, '[]'::jsonb))
  loop
    insert into public.crm_budget_lines (budget_id, concept, quantity, unit_price, discount_pct, vat_rate, position)
    values (
      v_budget.id,
      v_line ->> 'concept',
      coalesce((v_line ->> 'quantity')::numeric, 1),
      coalesce((v_line ->> 'unit_price')::numeric, 0),
      coalesce((v_line ->> 'discount_pct')::numeric, 0),
      coalesce((v_line ->> 'vat_rate')::numeric, 21),
      v_pos
    );
    v_pos := v_pos + 1;
  end loop;

  return v_budget;
end;
$$;
grant execute on function public.crm_create_budget(uuid, uuid, uuid, int, text, jsonb) to authenticated;

-- Igual que crm_create_budget pero edita uno existente EN BORRADOR (sustituye líneas).
-- No permite tocar presupuestos ya enviados/aceptados/rechazados (duplícalo en su lugar).
create or replace function public.crm_update_budget(
  p_budget_id uuid,
  p_customer_id uuid,
  p_card_id uuid,
  p_valid_until_days int,
  p_notes text,
  p_lines jsonb
) returns public.crm_budgets
language plpgsql
security definer
set search_path = public
as $$
declare
  v_budget public.crm_budgets;
  v_line jsonb;
  v_pos int := 0;
begin
  select * into v_budget from public.crm_budgets where id = p_budget_id;
  if v_budget.id is null then
    raise exception 'Presupuesto no encontrado';
  end if;
  if not public.is_business_member(v_budget.business_id) then
    raise exception 'No autorizado';
  end if;
  if v_budget.status <> 'borrador' then
    raise exception 'Solo se puede editar un presupuesto en borrador; duplícalo si necesitas modificarlo.';
  end if;
  if not exists (select 1 from public.customers where id = p_customer_id and business_id = v_budget.business_id) then
    raise exception 'Cliente no válido para este negocio';
  end if;
  if p_card_id is not null and not exists (select 1 from public.crm_cards where id = p_card_id and business_id = v_budget.business_id) then
    raise exception 'Tarjeta no válida para este negocio';
  end if;

  update public.crm_budgets
    set customer_id = p_customer_id, card_id = p_card_id,
        valid_until_days = coalesce(p_valid_until_days, 30), notes = p_notes, updated_at = now()
    where id = p_budget_id
    returning * into v_budget;

  delete from public.crm_budget_lines where budget_id = p_budget_id;
  for v_line in select * from jsonb_array_elements(coalesce(p_lines, '[]'::jsonb))
  loop
    insert into public.crm_budget_lines (budget_id, concept, quantity, unit_price, discount_pct, vat_rate, position)
    values (
      p_budget_id,
      v_line ->> 'concept',
      coalesce((v_line ->> 'quantity')::numeric, 1),
      coalesce((v_line ->> 'unit_price')::numeric, 0),
      coalesce((v_line ->> 'discount_pct')::numeric, 0),
      coalesce((v_line ->> 'vat_rate')::numeric, 21),
      v_pos
    );
    v_pos := v_pos + 1;
  end loop;

  return v_budget;
end;
$$;
grant execute on function public.crm_update_budget(uuid, uuid, uuid, int, text, jsonb) to authenticated;

-- Duplica un presupuesto (cabecera + líneas) como nuevo borrador con número propio.
create or replace function public.crm_duplicate_budget(p_budget_id uuid)
returns public.crm_budgets
language plpgsql
security definer
set search_path = public
as $$
declare
  v_src public.crm_budgets;
  v_new public.crm_budgets;
  v_number text;
begin
  select * into v_src from public.crm_budgets where id = p_budget_id;
  if v_src.id is null then
    raise exception 'Presupuesto no encontrado';
  end if;
  if not public.is_business_member(v_src.business_id) then
    raise exception 'No autorizado';
  end if;

  v_number := public.crm_next_document_number(v_src.business_id, 'presupuesto', extract(year from now())::int);

  insert into public.crm_budgets (business_id, customer_id, card_id, number, status, valid_until_days, notes)
  values (v_src.business_id, v_src.customer_id, v_src.card_id, v_number, 'borrador', v_src.valid_until_days, v_src.notes)
  returning * into v_new;

  insert into public.crm_budget_lines (budget_id, concept, quantity, unit_price, discount_pct, vat_rate, position)
  select v_new.id, concept, quantity, unit_price, discount_pct, vat_rate, position
  from public.crm_budget_lines where budget_id = p_budget_id;

  return v_new;
end;
$$;
grant execute on function public.crm_duplicate_budget(uuid) to authenticated;

-- Cambia el estado a 'enviado', 'rechazado' o de vuelta a 'borrador'. La aceptación
-- (con posible generación de factura) va por crm_accept_budget.
create or replace function public.crm_update_budget_status(p_budget_id uuid, p_status crm_budget_status)
returns public.crm_budgets
language plpgsql
security definer
set search_path = public
as $$
declare
  v_budget public.crm_budgets;
begin
  if p_status = 'aceptado' then
    raise exception 'Usa crm_accept_budget para aceptar un presupuesto';
  end if;
  select * into v_budget from public.crm_budgets where id = p_budget_id;
  if v_budget.id is null then
    raise exception 'Presupuesto no encontrado';
  end if;
  if not public.is_business_member(v_budget.business_id) then
    raise exception 'No autorizado';
  end if;

  update public.crm_budgets set status = p_status, updated_at = now()
    where id = p_budget_id returning * into v_budget;

  if p_status = 'enviado' then
    perform public.crm_move_card_for_event(v_budget.business_id, v_budget.card_id, 'presupuesto_enviado');
  end if;

  return v_budget;
end;
$$;
grant execute on function public.crm_update_budget_status(uuid, crm_budget_status) to authenticated;

create or replace function public.crm_accept_budget(p_budget_id uuid)
returns public.crm_budgets
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
  if v_budget.status = 'aceptado' then
    return v_budget;
  end if;

  update public.crm_budgets set status = 'aceptado', updated_at = now()
    where id = p_budget_id returning * into v_budget;

  perform public.crm_move_card_for_event(v_budget.business_id, v_budget.card_id, 'presupuesto_aceptado');

  return v_budget;
end;
$$;
grant execute on function public.crm_accept_budget(uuid) to authenticated;

create or replace function public.crm_create_invoice_from_budget(p_budget_id uuid)
returns public.crm_invoices
language plpgsql
security definer
set search_path = public
as $$
declare
  v_budget public.crm_budgets;
  v_invoice public.crm_invoices;
  v_number text;
  v_year int := extract(year from now())::int;
  v_irpf numeric(5,2);
begin
  select * into v_budget from public.crm_budgets where id = p_budget_id;
  if v_budget.id is null then
    raise exception 'Presupuesto no encontrado';
  end if;
  if not public.is_business_member(v_budget.business_id) then
    raise exception 'No autorizado';
  end if;
  if v_budget.status <> 'aceptado' then
    raise exception 'Solo se puede facturar un presupuesto aceptado';
  end if;

  select default_irpf_rate into v_irpf from public.crm_fiscal_profile where business_id = v_budget.business_id;

  v_number := public.crm_next_document_number(v_budget.business_id, 'factura', v_year);

  insert into public.crm_invoices (business_id, customer_id, budget_id, card_id, number, year, irpf_rate)
  values (v_budget.business_id, v_budget.customer_id, v_budget.id, v_budget.card_id, v_number, v_year, coalesce(v_irpf, 0))
  returning * into v_invoice;

  insert into public.crm_invoice_lines (invoice_id, concept, quantity, unit_price, discount_pct, vat_rate, position)
  select v_invoice.id, concept, quantity, unit_price, discount_pct, vat_rate, position
  from public.crm_budget_lines where budget_id = v_budget.id;

  return v_invoice;
end;
$$;
grant execute on function public.crm_create_invoice_from_budget(uuid) to authenticated;

create or replace function public.crm_create_invoice_manual(
  p_business_id uuid,
  p_customer_id uuid,
  p_card_id uuid,
  p_irpf_rate numeric,
  p_notes text,
  p_lines jsonb
) returns public.crm_invoices
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invoice public.crm_invoices;
  v_number text;
  v_year int := extract(year from now())::int;
  v_line jsonb;
  v_pos int := 0;
begin
  if not public.is_business_member(p_business_id) then
    raise exception 'No autorizado';
  end if;
  if not exists (select 1 from public.customers where id = p_customer_id and business_id = p_business_id) then
    raise exception 'Cliente no válido para este negocio';
  end if;
  if p_card_id is not null and not exists (select 1 from public.crm_cards where id = p_card_id and business_id = p_business_id) then
    raise exception 'Tarjeta no válida para este negocio';
  end if;

  v_number := public.crm_next_document_number(p_business_id, 'factura', v_year);

  insert into public.crm_invoices (business_id, customer_id, card_id, number, year, irpf_rate, notes)
  values (p_business_id, p_customer_id, p_card_id, v_number, v_year, coalesce(p_irpf_rate, 0), p_notes)
  returning * into v_invoice;

  for v_line in select * from jsonb_array_elements(coalesce(p_lines, '[]'::jsonb))
  loop
    insert into public.crm_invoice_lines (invoice_id, concept, quantity, unit_price, discount_pct, vat_rate, position)
    values (
      v_invoice.id,
      v_line ->> 'concept',
      coalesce((v_line ->> 'quantity')::numeric, 1),
      coalesce((v_line ->> 'unit_price')::numeric, 0),
      coalesce((v_line ->> 'discount_pct')::numeric, 0),
      coalesce((v_line ->> 'vat_rate')::numeric, 21),
      v_pos
    );
    v_pos := v_pos + 1;
  end loop;

  return v_invoice;
end;
$$;
grant execute on function public.crm_create_invoice_manual(uuid, uuid, uuid, numeric, text, jsonb) to authenticated;

create or replace function public.crm_mark_invoice_paid(p_invoice_id uuid)
returns public.crm_invoices
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invoice public.crm_invoices;
begin
  select * into v_invoice from public.crm_invoices where id = p_invoice_id;
  if v_invoice.id is null then
    raise exception 'Factura no encontrada';
  end if;
  if not public.is_business_member(v_invoice.business_id) then
    raise exception 'No autorizado';
  end if;
  if v_invoice.status <> 'emitida' then
    raise exception 'Solo se puede marcar como pagada una factura emitida';
  end if;

  update public.crm_invoices set status = 'pagada', updated_at = now()
    where id = p_invoice_id returning * into v_invoice;

  perform public.crm_move_card_for_event(v_invoice.business_id, v_invoice.card_id, 'factura_pagada');

  return v_invoice;
end;
$$;
grant execute on function public.crm_mark_invoice_paid(uuid) to authenticated;

create or replace function public.crm_void_invoice(p_invoice_id uuid)
returns public.crm_invoices
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invoice public.crm_invoices;
begin
  select * into v_invoice from public.crm_invoices where id = p_invoice_id;
  if v_invoice.id is null then
    raise exception 'Factura no encontrada';
  end if;
  if not public.is_business_member(v_invoice.business_id) then
    raise exception 'No autorizado';
  end if;
  if v_invoice.status = 'anulada' then
    return v_invoice;
  end if;

  update public.crm_invoices set status = 'anulada', updated_at = now()
    where id = p_invoice_id returning * into v_invoice;

  return v_invoice;
end;
$$;
grant execute on function public.crm_void_invoice(uuid) to authenticated;

-- Elimina una etapa del pipeline. Si tiene tarjetas, exige indicar a qué etapa moverlas
-- (el frontend pregunta antes de llamar). El movimiento manual de tarjetas (drag&drop)
-- no pasa por aquí, es un update directo protegido solo por RLS.
create or replace function public.crm_delete_pipeline_stage(p_stage_id uuid, p_move_to_stage_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_stage public.crm_pipeline_stages;
  v_card_count int;
begin
  select * into v_stage from public.crm_pipeline_stages where id = p_stage_id;
  if v_stage.id is null then
    raise exception 'Etapa no encontrada';
  end if;
  if not public.is_business_member(v_stage.business_id) then
    raise exception 'No autorizado';
  end if;

  select count(*) into v_card_count from public.crm_cards where stage_id = p_stage_id;

  if v_card_count > 0 then
    if p_move_to_stage_id is null then
      raise exception 'Esta etapa tiene tarjetas; indica a qué etapa moverlas.';
    end if;
    if p_move_to_stage_id = p_stage_id
       or not exists (select 1 from public.crm_pipeline_stages where id = p_move_to_stage_id and business_id = v_stage.business_id) then
      raise exception 'Etapa de destino no válida';
    end if;
    update public.crm_cards set stage_id = p_move_to_stage_id, updated_at = now() where stage_id = p_stage_id;
  end if;

  delete from public.crm_stage_events where stage_id = p_stage_id;
  delete from public.crm_pipeline_stages where id = p_stage_id;
end;
$$;
grant execute on function public.crm_delete_pipeline_stage(uuid, uuid) to authenticated;
