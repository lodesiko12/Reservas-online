import type { Tables } from "@reservas/shared";

export type PipelineStage = Tables<"crm_pipeline_stages">;
export type CrmCard = Tables<"crm_cards">;
export type CrmCardNote = Tables<"crm_card_notes">;
export type CrmEvent = Tables<"crm_events">;
export type CrmFiscalProfile = Tables<"crm_fiscal_profile">;
export type CrmBudgetConcept = Tables<"crm_budget_concepts">;
export type CrmBudget = Tables<"crm_budgets">;
export type CrmBudgetLine = Tables<"crm_budget_lines">;
export type CrmInvoice = Tables<"crm_invoices">;
export type CrmInvoiceLine = Tables<"crm_invoice_lines">;
export type CrmStageEvent = Tables<"crm_stage_events">;

export type CardWithCustomer = CrmCard & {
  customers: { full_name: string; last_name: string | null; phone: string | null } | null;
};

export type BudgetLineInput = {
  concept: string;
  quantity: number;
  unit_price: number;
  discount_pct: number;
  vat_rate: number;
};

/** base_linea = quantity * unit_price * (1 - discount_pct/100); iva_linea = base_linea * vat_rate/100. */
export function lineTotals(l: BudgetLineInput) {
  const base = l.quantity * l.unit_price * (1 - l.discount_pct / 100);
  const iva = base * (l.vat_rate / 100);
  return { base, iva, total: base + iva };
}

export function documentTotals(lines: BudgetLineInput[]) {
  let base = 0, iva = 0;
  for (const l of lines) {
    const t = lineTotals(l);
    base += t.base;
    iva += t.iva;
  }
  return { base, iva, total: base + iva };
}
