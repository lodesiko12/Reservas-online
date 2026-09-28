import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../../lib/supabase";
import { useBusinessId } from "../hooks";
import { useBudgetConcepts, customerLabel } from "./hooks";
import { documentTotals, lineTotals, type BudgetLineInput, type CrmBudget } from "./types";
import { formatCurrency, formatDate } from "@reservas/shared";
import { PageHeader, Spinner, Modal, EmptyState } from "../../components/ui";

const STATUS_LABEL: Record<string, string> = { borrador: "Borrador", enviado: "Enviado", aceptado: "Aceptado", rechazado: "Rechazado" };
const STATUS_STYLE: Record<string, string> = {
  borrador: "bg-slate-100 text-slate-600", enviado: "bg-sky-100 text-sky-700",
  aceptado: "bg-emerald-100 text-emerald-700", rechazado: "bg-red-100 text-red-700",
};

type BudgetRow = CrmBudget & {
  customers: { full_name: string; last_name: string | null } | null;
  crm_budget_lines: BudgetLineInput[];
};

function useBudgets(customerId?: string) {
  const bid = useBusinessId();
  return useQuery({
    queryKey: ["crm_budgets", bid, customerId ?? "all"],
    enabled: !!bid,
    queryFn: async () => {
      let q = supabase.from("crm_budgets")
        .select("*, customers(full_name, last_name), crm_budget_lines(concept, quantity, unit_price, discount_pct, vat_rate)")
        .eq("business_id", bid)
        .order("issued_at", { ascending: false });
      if (customerId) q = q.eq("customer_id", customerId);
      const { data, error } = await q;
      if (error) throw error;
      return data as unknown as BudgetRow[];
    },
  });
}

export function Presupuestos() {
  return <PresupuestosList />;
}

/** Listado de presupuestos. Si se pasa customerId, se filtra a los de ese
 * cliente (uso desde la ficha, PresupuestosTab). */
export function PresupuestosList({ customerId, cardId }: { customerId?: string; cardId?: string }) {
  const bid = useBusinessId();
  const qc = useQueryClient();
  const [status, setStatus] = useState<string>("todos");
  const { data: budgets, isLoading } = useBudgets(customerId);
  const [editing, setEditing] = useState<BudgetRow | "new" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [offerInvoiceFor, setOfferInvoiceFor] = useState<string | null>(null);
  const [generatingInvoice, setGeneratingInvoice] = useState(false);

  function invalidate() {
    qc.invalidateQueries({ queryKey: ["crm_budgets", bid] });
    qc.invalidateQueries({ queryKey: ["crm_invoices", bid] });
    qc.invalidateQueries({ queryKey: ["crm_cards", bid] });
  }

  const filtered = (budgets ?? []).filter((b) => status === "todos" || b.status === status);

  async function duplicate(id: string) {
    setError(null);
    const { error } = await supabase.rpc("crm_duplicate_budget", { p_budget_id: id });
    if (error) { setError(error.message); return; }
    invalidate();
  }

  async function setDocStatus(id: string, s: "enviado" | "rechazado" | "borrador") {
    setError(null);
    const { error } = await supabase.rpc("crm_update_budget_status", { p_budget_id: id, p_status: s });
    if (error) { setError(error.message); return; }
    invalidate();
  }

  async function accept(id: string) {
    setError(null);
    const { error } = await supabase.rpc("crm_accept_budget", { p_budget_id: id });
    if (error) { setError(error.message); return; }
    invalidate();
    setOfferInvoiceFor(id);
  }

  async function generateInvoiceNow() {
    if (!offerInvoiceFor) return;
    setGeneratingInvoice(true);
    const { error: invErr } = await supabase.rpc("crm_create_invoice_from_budget", { p_budget_id: offerInvoiceFor });
    setGeneratingInvoice(false);
    if (invErr) { setError(invErr.message); return; }
    invalidate();
    setOfferInvoiceFor(null);
  }

  return (
    <div>
      {!customerId && (
        <PageHeader title="Presupuestos" actions={<button className="btn-primary" onClick={() => setEditing("new")}>+ Nuevo presupuesto</button>} />
      )}
      {customerId && (
        <div className="flex justify-end mb-3"><button className="btn-ghost text-xs" onClick={() => setEditing("new")}>+ Nuevo presupuesto</button></div>
      )}

      {!customerId && (
        <div className="flex gap-2 mb-4 flex-wrap text-xs">
          {["todos", "borrador", "enviado", "aceptado", "rechazado"].map((s) => (
            <button key={s} onClick={() => setStatus(s)}
              className={`rounded-full px-3 py-1 font-medium border ${status === s ? "bg-slate-800 text-white border-slate-800 dark:bg-slate-100 dark:text-slate-900" : "bg-white text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700"}`}>
              {s === "todos" ? "Todos" : STATUS_LABEL[s]}
            </button>
          ))}
        </div>
      )}

      {error && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-3">{error}</div>}

      {isLoading ? <div className="grid place-items-center py-16"><Spinner /></div>
        : !filtered.length ? <EmptyState title="Sin presupuestos todavía" hint="Crea el primero para tu cliente." />
        : (
          <div className="space-y-2">
            {filtered.map((b) => {
              const total = documentTotals(b.crm_budget_lines ?? []).total;
              return (
                <div key={b.id} className="card p-4 flex items-center gap-3 flex-wrap">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{b.number}</span>
                      <span className={`badge ${STATUS_STYLE[b.status]}`}>{STATUS_LABEL[b.status]}</span>
                    </div>
                    <div className="text-sm text-slate-500 dark:text-slate-400 truncate">
                      {customerLabel(b.customers)} · {formatDate(b.issued_at, "Europe/Madrid")}
                    </div>
                  </div>
                  <div className="font-bold">{formatCurrency(total)}</div>
                  <div className="flex gap-1.5 flex-wrap">
                    {b.status === "borrador" && <button className="btn-ghost text-xs" onClick={() => setEditing(b)}>Editar</button>}
                    <button className="btn-ghost text-xs" onClick={() => duplicate(b.id)}>Duplicar</button>
                    {b.status === "borrador" && <button className="btn-ghost text-xs" onClick={() => setDocStatus(b.id, "enviado")}>Marcar enviado</button>}
                    {b.status === "enviado" && (
                      <>
                        <button className="btn-primary text-xs" onClick={() => accept(b.id)}>Aceptar</button>
                        <button className="btn-ghost text-xs" onClick={() => setDocStatus(b.id, "rechazado")}>Rechazar</button>
                        <button className="btn-ghost text-xs" onClick={() => setDocStatus(b.id, "borrador")}>Volver a borrador</button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

      {editing && (
        <BudgetEditorModal
          budget={editing === "new" ? null : editing}
          defaultCustomerId={customerId}
          defaultCardId={cardId}
          onClose={() => setEditing(null)}
          onSaved={() => { invalidate(); setEditing(null); }}
        />
      )}

      {offerInvoiceFor && (
        <Modal open onClose={() => setOfferInvoiceFor(null)} title="Presupuesto aceptado" width="max-w-sm">
          <p className="text-sm text-slate-600 dark:text-slate-300 mb-5">¿Generar la factura ahora a partir de este presupuesto?</p>
          <div className="flex justify-end gap-2">
            <button className="btn-ghost" onClick={() => setOfferInvoiceFor(null)}>Ahora no</button>
            <button className="btn-primary" disabled={generatingInvoice} onClick={generateInvoiceNow}>
              {generatingInvoice ? "Generando…" : "Generar factura"}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

/** Editor de presupuesto: crear (crm_create_budget) o editar en borrador
 * (crm_update_budget). Reutilizable desde el listado y desde CardDetail. */
export function BudgetEditorModal({ budget, defaultCustomerId, defaultCardId, onClose, onSaved }: {
  budget: (CrmBudget & { crm_budget_lines?: BudgetLineInput[] }) | null;
  defaultCustomerId?: string; defaultCardId?: string;
  onClose: () => void; onSaved: () => void;
}) {
  const bid = useBusinessId();
  const { data: concepts } = useBudgetConcepts();
  const { data: customers } = useQuery({
    queryKey: ["customers-for-select", bid],
    enabled: !!bid,
    queryFn: async () => {
      const { data, error } = await supabase.from("customers").select("id, full_name, last_name").eq("business_id", bid).order("full_name").limit(500);
      if (error) throw error;
      return data;
    },
  });

  const [customerId, setCustomerId] = useState(budget?.customer_id ?? defaultCustomerId ?? "");
  const [validDays, setValidDays] = useState(budget?.valid_until_days ?? 30);
  const [notes, setNotes] = useState(budget?.notes ?? "");
  const [lines, setLines] = useState<BudgetLineInput[]>(
    budget?.crm_budget_lines?.length
      ? budget.crm_budget_lines.map((l) => ({ concept: l.concept, quantity: Number(l.quantity), unit_price: Number(l.unit_price), discount_pct: Number(l.discount_pct), vat_rate: Number(l.vat_rate) }))
      : [{ concept: "", quantity: 1, unit_price: 0, discount_pct: 0, vat_rate: 21 }]
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateLine(i: number, patch: Partial<BudgetLineInput>) {
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }
  function addLine() { setLines((prev) => [...prev, { concept: "", quantity: 1, unit_price: 0, discount_pct: 0, vat_rate: 21 }]); }
  function removeLine(i: number) { setLines((prev) => prev.filter((_, idx) => idx !== i)); }
  function applyConcept(i: number, conceptName: string) {
    const c = concepts?.find((c) => c.name === conceptName);
    if (!c) { updateLine(i, { concept: conceptName }); return; }
    updateLine(i, { concept: c.name, unit_price: Number(c.default_unit_price), vat_rate: Number(c.default_vat_rate) });
  }

  const totals = documentTotals(lines.filter((l) => l.concept.trim()));

  async function save() {
    if (!customerId) { setError("Selecciona un cliente."); return; }
    const validLines = lines.filter((l) => l.concept.trim());
    if (!validLines.length) { setError("Añade al menos una línea."); return; }
    setSaving(true); setError(null);
    const payload = {
      p_customer_id: customerId,
      p_card_id: defaultCardId ?? budget?.card_id ?? null,
      p_valid_until_days: Number(validDays) || 30,
      p_notes: notes.trim() || null,
      p_lines: validLines,
    };
    const { error } = budget
      ? await supabase.rpc("crm_update_budget", { p_budget_id: budget.id, ...payload } as any)
      : await supabase.rpc("crm_create_budget", { p_business_id: bid, ...payload } as any);
    setSaving(false);
    if (error) { setError(error.message); return; }
    onSaved();
  }

  return (
    <Modal open onClose={onClose} title={budget ? `Editar ${budget.number}` : "Nuevo presupuesto"} width="max-w-2xl">
      <div className="space-y-4">
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className="label">Cliente *</label>
            <select className="input" value={customerId} onChange={(e) => setCustomerId(e.target.value)} disabled={!!defaultCustomerId}>
              <option value="">Selecciona…</option>
              {(customers ?? []).map((c) => <option key={c.id} value={c.id}>{c.full_name} {c.last_name ?? ""}</option>)}
            </select>
          </div>
          <div><label className="label">Válido durante (días)</label><input type="number" min={1} className="input" value={validDays} onChange={(e) => setValidDays(+e.target.value)} /></div>
        </div>

        <div>
          <label className="label">Líneas</label>
          <div className="space-y-2">
            {lines.map((l, i) => {
              const t = lineTotals(l);
              return (
                <div key={i} className="grid grid-cols-12 gap-1.5 items-center">
                  <input className="input col-span-4" list="crm-concepts" placeholder="Concepto" value={l.concept}
                    onChange={(e) => applyConcept(i, e.target.value)} />
                  <input type="number" min={0} step="0.01" className="input col-span-2" placeholder="Cant." value={l.quantity}
                    onChange={(e) => updateLine(i, { quantity: +e.target.value })} />
                  <input type="number" min={0} step="0.01" className="input col-span-2" placeholder="Precio" value={l.unit_price}
                    onChange={(e) => updateLine(i, { unit_price: +e.target.value })} />
                  <input type="number" min={0} max={100} step="1" className="input col-span-1" title="Descuento %" value={l.discount_pct}
                    onChange={(e) => updateLine(i, { discount_pct: +e.target.value })} />
                  <input type="number" min={0} max={100} step="1" className="input col-span-1" title="IVA %" value={l.vat_rate}
                    onChange={(e) => updateLine(i, { vat_rate: +e.target.value })} />
                  <div className="col-span-1 text-xs text-right font-medium">{formatCurrency(t.total)}</div>
                  <button className="col-span-1 text-slate-400 hover:text-red-600 text-sm" onClick={() => removeLine(i)}>✕</button>
                </div>
              );
            })}
            <datalist id="crm-concepts">
              {(concepts ?? []).map((c) => <option key={c.id} value={c.name} />)}
            </datalist>
          </div>
          <button className="btn-ghost text-xs mt-2" onClick={addLine}>+ Añadir línea</button>
        </div>

        <div><label className="label">Notas</label><textarea className="input" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} /></div>

        <div className="flex justify-end text-sm gap-6 border-t pt-3">
          <span>Base: <strong>{formatCurrency(totals.base)}</strong></span>
          <span>IVA: <strong>{formatCurrency(totals.iva)}</strong></span>
          <span>Total: <strong className="text-base">{formatCurrency(totals.total)}</strong></span>
        </div>

        {error && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>}
        <div className="flex justify-end gap-2">
          <button className="btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn-primary" disabled={saving} onClick={save}>{saving ? "Guardando…" : "Guardar presupuesto"}</button>
        </div>
      </div>
    </Modal>
  );
}
