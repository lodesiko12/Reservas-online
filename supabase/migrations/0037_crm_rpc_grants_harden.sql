-- 0037_crm_rpc_grants_harden.sql
-- Postgres concede EXECUTE a PUBLIC por defecto al crear una función; en 0036 solo se
-- revocó explícitamente para crm_next_document_number. El resto de RPCs del CRM quedaban
-- técnicamente invocables por el rol anon (aunque is_business_member() los bloquea sin
-- JWT, mismo patrón que otras funciones ya existentes en el repo). Se revoca en
-- profundidad para estas, sin cambiar su comportamiento para `authenticated`.
revoke all on function public.crm_move_card_for_event(uuid, uuid, crm_stage_event_key) from public, anon;
revoke all on function public.crm_create_budget(uuid, uuid, uuid, int, text, jsonb) from public, anon;
revoke all on function public.crm_update_budget(uuid, uuid, uuid, int, text, jsonb) from public, anon;
revoke all on function public.crm_duplicate_budget(uuid) from public, anon;
revoke all on function public.crm_update_budget_status(uuid, crm_budget_status) from public, anon;
revoke all on function public.crm_accept_budget(uuid) from public, anon;
revoke all on function public.crm_create_invoice_from_budget(uuid) from public, anon;
revoke all on function public.crm_create_invoice_manual(uuid, uuid, uuid, numeric, text, jsonb) from public, anon;
revoke all on function public.crm_mark_invoice_paid(uuid) from public, anon;
revoke all on function public.crm_void_invoice(uuid) from public, anon;
revoke all on function public.crm_delete_pipeline_stage(uuid, uuid) from public, anon;

grant execute on function public.crm_move_card_for_event(uuid, uuid, crm_stage_event_key) to authenticated;
grant execute on function public.crm_create_budget(uuid, uuid, uuid, int, text, jsonb) to authenticated;
grant execute on function public.crm_update_budget(uuid, uuid, uuid, int, text, jsonb) to authenticated;
grant execute on function public.crm_duplicate_budget(uuid) to authenticated;
grant execute on function public.crm_update_budget_status(uuid, crm_budget_status) to authenticated;
grant execute on function public.crm_accept_budget(uuid) to authenticated;
grant execute on function public.crm_create_invoice_from_budget(uuid) to authenticated;
grant execute on function public.crm_create_invoice_manual(uuid, uuid, uuid, numeric, text, jsonb) to authenticated;
grant execute on function public.crm_mark_invoice_paid(uuid) to authenticated;
grant execute on function public.crm_void_invoice(uuid) to authenticated;
grant execute on function public.crm_delete_pipeline_stage(uuid, uuid) to authenticated;
