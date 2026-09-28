-- 0035_crm_rls.sql
-- RLS del mini-CRM de autónomos. Reutiliza is_business_member(business_id) (0002).
--
-- Regla general: las tablas de configuración/trabajo diario (etapas, mapeo de eventos,
-- tarjetas, notas, agenda, perfil fiscal, catálogo de conceptos) son editables
-- directamente por cualquier miembro del negocio, igual que el resto del panel.
--
-- Las tablas con numeración correlativa y efectos en el pipeline (presupuestos, líneas,
-- facturas, líneas, contador) son de SOLO LECTURA para el cliente: toda escritura pasa
-- por los RPC security definer de 0036_crm_rpcs.sql, que revalidan is_business_member y
-- garantizan la numeración/atomicidad. Así ninguna escritura directa puede saltarse la
-- numeración ni mover una tarjeta sin pasar por el mapeo de crm_stage_events.

alter table public.crm_pipeline_stages enable row level security;
create policy crm_pipeline_stages_select on public.crm_pipeline_stages
  for select to authenticated using (public.is_business_member(business_id));
create policy crm_pipeline_stages_insert on public.crm_pipeline_stages
  for insert to authenticated with check (public.is_business_member(business_id));
create policy crm_pipeline_stages_update on public.crm_pipeline_stages
  for update to authenticated using (public.is_business_member(business_id)) with check (public.is_business_member(business_id));
-- Sin política de delete: eliminar una etapa (con reasignación de tarjetas) solo vía
-- crm_delete_pipeline_stage (RPC).

alter table public.crm_stage_events enable row level security;
create policy crm_stage_events_all on public.crm_stage_events
  for all to authenticated using (public.is_business_member(business_id)) with check (public.is_business_member(business_id));

alter table public.crm_cards enable row level security;
create policy crm_cards_all on public.crm_cards
  for all to authenticated using (public.is_business_member(business_id)) with check (public.is_business_member(business_id));

alter table public.crm_card_notes enable row level security;
create policy crm_card_notes_all on public.crm_card_notes
  for all to authenticated
  using (exists (select 1 from public.crm_cards c where c.id = card_id and public.is_business_member(c.business_id)))
  with check (exists (select 1 from public.crm_cards c where c.id = card_id and public.is_business_member(c.business_id)));

alter table public.crm_events enable row level security;
create policy crm_events_all on public.crm_events
  for all to authenticated using (public.is_business_member(business_id)) with check (public.is_business_member(business_id));

alter table public.crm_fiscal_profile enable row level security;
create policy crm_fiscal_profile_all on public.crm_fiscal_profile
  for all to authenticated using (public.is_business_member(business_id)) with check (public.is_business_member(business_id));

alter table public.crm_budget_concepts enable row level security;
create policy crm_budget_concepts_all on public.crm_budget_concepts
  for all to authenticated using (public.is_business_member(business_id)) with check (public.is_business_member(business_id));

alter table public.crm_budgets enable row level security;
create policy crm_budgets_select on public.crm_budgets
  for select to authenticated using (public.is_business_member(business_id));

alter table public.crm_budget_lines enable row level security;
create policy crm_budget_lines_select on public.crm_budget_lines
  for select to authenticated
  using (exists (select 1 from public.crm_budgets b where b.id = budget_id and public.is_business_member(b.business_id)));

alter table public.crm_invoices enable row level security;
create policy crm_invoices_select on public.crm_invoices
  for select to authenticated using (public.is_business_member(business_id));

alter table public.crm_invoice_lines enable row level security;
create policy crm_invoice_lines_select on public.crm_invoice_lines
  for select to authenticated
  using (exists (select 1 from public.crm_invoices i where i.id = invoice_id and public.is_business_member(i.business_id)));

alter table public.crm_document_counters enable row level security;
create policy crm_document_counters_select on public.crm_document_counters
  for select to authenticated using (public.is_business_member(business_id));
