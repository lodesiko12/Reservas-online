import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../lib/auth";
import { useBusinessId } from "../hooks";
import { useFiscalProfile, useBudgetConcepts, customerLabel } from "./hooks";
import { documentTotals, lineTotals, type BudgetLineInput, type CrmInvoice } from "./types";
import { formatCurrency, formatDate } from "@reservas/shared";
import { PageHeader, Spinner, Modal, EmptyState, ConfirmDialog } from "../../components/ui";

const STATUS_LABEL: Record<string, string> = { emitida: "Emitida", pagada: "Pagada", anulada: "Anulada" };
const STATUS_STYLE: Record<string, string> = {
  emitida: "bg-sky-100 text-sky-700", pagada: "bg-emerald-100 text-emerald-700", anulada: "bg-slate-100 text-slate-500",
};

type InvoiceRow = CrmInvoice & {
  customers: { full_name: string; last_name: string | null } | null;
  crm_invoice_lines: BudgetLineInput[];
};

function useInvoices(customerId?: string) {
  const bid = useBusinessId();
  return useQuery({
    queryKey: ["crm_invoices", bid, customerId ?? "all"],
    enabled: !!bid,
    queryFn: async () => {
      let q = supabase.from("crm_invoices")
        .select("*, customers(full_name, last_name), crm_invoice_lines(concept, quantity, unit_price, discount_pct, vat_rate)")
        .eq("business_id", bid)
        .order("issued_at", { ascending: false });
      if (customerId) q = q.eq("customer_id", customerId);
      const { data, error } = await q;
      if (error) throw error;
      return data as unknown as InvoiceRow[];
    },
  });
}

export function Facturas() {
  return <FacturasList />;
}

export function FacturasList({ customerId }: { customerId?: string }) {
  const bid = useBusinessId();
  const qc = useQueryClient();
  const [status, setStatus] = useState<string>("todos");
  const { data: invoices, isLoading } = useInvoices(customerId);
  const [creating, setCreating] = useState(false);
  const [printing, setPrinting] = useState<InvoiceRow | null>(null);
  const [voiding, setVoiding] = useState<InvoiceRow | null>(null);
  const [error, setError] = useState<string | null>(null);

  function invalidate() {
    qc.invalidateQueries({ queryKey: ["crm_invoices", bid] });
    qc.invalidateQueries({ queryKey: ["crm_cards", bid] });
  }

  const filtered = (invoices ?? []).filter((i) => status === "todos" || i.status === status);

  async function markPaid(id: string) {
    setError(null);
    const { error } = await supabase.rpc("crm_mark_invoice_paid", { p_invoice_id: id });
    if (error) { setError(error.message); return; }
    invalidate();
  }
  async function voidInvoice() {
    if (!voiding) return;
    setError(null);
    const { error } = await supabase.rpc("crm_void_invoice", { p_invoice_id: voiding.id });
    setVoiding(null);
    if (error) { setError(error.message); return; }
    invalidate();
  }

  return (
    <div>
      {!customerId && (
        <PageHeader title="Facturas" actions={<button className="btn-primary" onClick={() => setCreating(true)}>+ Factura manual</button>} />
      )}
      {customerId && (
        <div className="flex justify-end mb-3"><button className="btn-ghost text-xs" onClick={() => setCreating(true)}>+ Factura manual</button></div>
      )}
      {!customerId && (
        <div className="flex gap-2 mb-4 flex-wrap text-xs">
          {["todos", "emitida", "pagada", "anulada"].map((s) => (
            <button key={s} onClick={() => setStatus(s)}
              className={`rounded-full px-3 py-1 font-medium border ${status === s ? "bg-slate-800 text-white border-slate-800 dark:bg-slate-100 dark:text-slate-900" : "bg-white text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700"}`}>
              {s === "todos" ? "Todos" : STATUS_LABEL[s]}
            </button>
          ))}
        </div>
      )}

      {error && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-3">{error}</div>}

      {isLoading ? <div className="grid place-items-center py-16"><Spinner /></div>
        : !filtered.length ? <EmptyState title="Sin facturas todavía" hint="Genera una desde un presupuesto aceptado o crea una manual." />
        : (
          <div className="space-y-2">
            {filtered.map((inv) => {
              const total = documentTotals(inv.crm_invoice_lines ?? []).total;
              const totalWithIrpf = total - (documentTotals(inv.crm_invoice_lines ?? []).base * (Number(inv.irpf_rate) / 100));
              return (
                <div key={inv.id} className="card p-4 flex items-center gap-3 flex-wrap">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{inv.number}</span>
                      <span className={`badge ${STATUS_STYLE[inv.status]}`}>{STATUS_LABEL[inv.status]}</span>
                    </div>
                    <div className="text-sm text-slate-500 dark:text-slate-400 truncate">
                      {customerLabel(inv.customers)} · {formatDate(inv.issued_at, "Europe/Madrid")}
                    </div>
                  </div>
                  <div className="font-bold">{formatCurrency(totalWithIrpf)}</div>
                  <div className="flex gap-1.5 flex-wrap">
                    <button className="btn-ghost text-xs" onClick={() => setPrinting(inv)}>🖨 Ver / imprimir</button>
                    {inv.status === "emitida" && <button className="btn-primary text-xs" onClick={() => markPaid(inv.id)}>Marcar pagada</button>}
                    {inv.status !== "anulada" && <button className="btn-ghost text-xs text-red-600" onClick={() => setVoiding(inv)}>Anular</button>}
                  </div>
                </div>
              );
            })}
          </div>
        )}

      {creating && (
        <ManualInvoiceModal defaultCustomerId={customerId} onClose={() => setCreating(false)} onSaved={() => { invalidate(); setCreating(false); }} />
      )}
      {printing && <PrintableInvoice invoice={printing} onClose={() => setPrinting(null)} />}
      <ConfirmDialog open={!!voiding} title="Anular factura" message={`¿Anular la factura ${voiding?.number}? No se puede deshacer.`} confirmLabel="Anular" onConfirm={voidInvoice} onCancel={() => setVoiding(null)} />
    </div>
  );
}

function ManualInvoiceModal({ defaultCustomerId, onClose, onSaved }: { defaultCustomerId?: string; onClose: () => void; onSaved: () => void }) {
  const bid = useBusinessId();
  const { data: fiscal } = useFiscalProfile();
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
  const [customerId, setCustomerId] = useState(defaultCustomerId ?? "");
  const [irpfRate, setIrpfRate] = useState(fiscal?.default_irpf_rate ?? 0);
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<BudgetLineInput[]>([{ concept: "", quantity: 1, unit_price: 0, discount_pct: 0, vat_rate: fiscal?.default_vat_rate ?? 21 }]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateLine(i: number, patch: Partial<BudgetLineInput>) { setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l))); }
  function addLine() { setLines((prev) => [...prev, { concept: "", quantity: 1, unit_price: 0, discount_pct: 0, vat_rate: fiscal?.default_vat_rate ?? 21 }]); }
  function removeLine(i: number) { setLines((prev) => prev.filter((_, idx) => idx !== i)); }
  function applyConcept(i: number, name: string) {
    const c = concepts?.find((c) => c.name === name);
    if (!c) { updateLine(i, { concept: name }); return; }
    updateLine(i, { concept: c.name, unit_price: Number(c.default_unit_price), vat_rate: Number(c.default_vat_rate) });
  }

  const totals = documentTotals(lines.filter((l) => l.concept.trim()));
  const irpfAmount = totals.base * (Number(irpfRate) / 100);

  async function save() {
    if (!customerId) { setError("Selecciona un cliente."); return; }
    const validLines = lines.filter((l) => l.concept.trim());
    if (!validLines.length) { setError("Añade al menos una línea."); return; }
    setSaving(true); setError(null);
    const { error } = await supabase.rpc("crm_create_invoice_manual", {
      p_business_id: bid, p_customer_id: customerId, p_card_id: null,
      p_irpf_rate: Number(irpfRate) || 0, p_notes: notes.trim() || null, p_lines: validLines,
    } as any);
    setSaving(false);
    if (error) { setError(error.message); return; }
    onSaved();
  }

  return (
    <Modal open onClose={onClose} title="Nueva factura manual" width="max-w-2xl">
      <div className="space-y-4">
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className="label">Cliente *</label>
            <select className="input" value={customerId} onChange={(e) => setCustomerId(e.target.value)} disabled={!!defaultCustomerId}>
              <option value="">Selecciona…</option>
              {(customers ?? []).map((c) => <option key={c.id} value={c.id}>{c.full_name} {c.last_name ?? ""}</option>)}
            </select>
          </div>
          <div><label className="label">IRPF (%)</label><input type="number" min={0} max={100} className="input" value={irpfRate} onChange={(e) => setIrpfRate(+e.target.value)} /></div>
        </div>

        <div>
          <label className="label">Líneas</label>
          <div className="space-y-2">
            {lines.map((l, i) => {
              const t = lineTotals(l);
              return (
                <div key={i} className="grid grid-cols-12 gap-1.5 items-center">
                  <input className="input col-span-4" list="crm-concepts-inv" placeholder="Concepto" value={l.concept} onChange={(e) => applyConcept(i, e.target.value)} />
                  <input type="number" min={0} step="0.01" className="input col-span-2" placeholder="Cant." value={l.quantity} onChange={(e) => updateLine(i, { quantity: +e.target.value })} />
                  <input type="number" min={0} step="0.01" className="input col-span-2" placeholder="Precio" value={l.unit_price} onChange={(e) => updateLine(i, { unit_price: +e.target.value })} />
                  <input type="number" min={0} max={100} className="input col-span-1" title="Descuento %" value={l.discount_pct} onChange={(e) => updateLine(i, { discount_pct: +e.target.value })} />
                  <input type="number" min={0} max={100} className="input col-span-1" title="IVA %" value={l.vat_rate} onChange={(e) => updateLine(i, { vat_rate: +e.target.value })} />
                  <div className="col-span-1 text-xs text-right font-medium">{formatCurrency(t.total)}</div>
                  <button className="col-span-1 text-slate-400 hover:text-red-600 text-sm" onClick={() => removeLine(i)}>✕</button>
                </div>
              );
            })}
            <datalist id="crm-concepts-inv">{(concepts ?? []).map((c) => <option key={c.id} value={c.name} />)}</datalist>
          </div>
          <button className="btn-ghost text-xs mt-2" onClick={addLine}>+ Añadir línea</button>
        </div>

        <div><label className="label">Notas</label><textarea className="input" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} /></div>

        <div className="flex justify-end text-sm gap-6 border-t pt-3">
          <span>Base: <strong>{formatCurrency(totals.base)}</strong></span>
          <span>IVA: <strong>{formatCurrency(totals.iva)}</strong></span>
          <span>IRPF: <strong>-{formatCurrency(irpfAmount)}</strong></span>
          <span>Total: <strong className="text-base">{formatCurrency(totals.total - irpfAmount)}</strong></span>
        </div>

        {error && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>}
        <div className="flex justify-end gap-2">
          <button className="btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn-primary" disabled={saving} onClick={save}>{saving ? "Guardando…" : "Crear factura"}</button>
        </div>
      </div>
    </Modal>
  );
}

/** Vista imprimible de una factura informativa, con los datos fiscales del
 * negocio y la leyenda obligatoria de "no válida como factura oficial". */
function PrintableInvoice({ invoice, onClose }: { invoice: InvoiceRow; onClose: () => void }) {
  const { business } = useAuth();
  const { data: fiscal } = useFiscalProfile();
  const totals = documentTotals(invoice.crm_invoice_lines ?? []);
  const irpfAmount = totals.base * (Number(invoice.irpf_rate) / 100);
  const finalTotal = totals.total - irpfAmount;

  return (
    <Modal open onClose={onClose} title={`Factura ${invoice.number}`} width="max-w-2xl">
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #crm-print-area, #crm-print-area * { visibility: visible; }
          #crm-print-area { position: absolute; left: 0; top: 0; width: 100%; }
          .no-print { display: none !important; }
        }
      `}</style>
      <div id="crm-print-area" className="text-sm">
        <div className="flex justify-between mb-6">
          <div>
            <div className="font-bold text-lg">{fiscal?.legal_name || business?.name}</div>
            {fiscal?.nif && <div>NIF: {fiscal.nif}</div>}
            {fiscal?.address && <div className="whitespace-pre-line">{fiscal.address}</div>}
          </div>
          <div className="text-right">
            <div className="font-bold text-lg">{invoice.number}</div>
            <div>{formatDate(invoice.issued_at, "Europe/Madrid")}</div>
            <div className="badge mt-1">{STATUS_LABEL[invoice.status]}</div>
          </div>
        </div>

        <div className="mb-4">
          <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">Cliente</div>
          <div className="font-medium">{customerLabel(invoice.customers)}</div>
        </div>

        <table className="w-full text-xs mb-4">
          <thead>
            <tr className="border-b text-left text-slate-500 dark:text-slate-400">
              <th className="py-1">Concepto</th><th className="py-1 text-right">Cant.</th><th className="py-1 text-right">Precio</th>
              <th className="py-1 text-right">Dto.</th><th className="py-1 text-right">IVA</th><th className="py-1 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {(invoice.crm_invoice_lines ?? []).map((l, i) => {
              const t = lineTotals(l);
              return (
                <tr key={i} className="border-b border-slate-100 dark:border-slate-800">
                  <td className="py-1.5">{l.concept}</td>
                  <td className="py-1.5 text-right">{l.quantity}</td>
                  <td className="py-1.5 text-right">{formatCurrency(l.unit_price)}</td>
                  <td className="py-1.5 text-right">{l.discount_pct}%</td>
                  <td className="py-1.5 text-right">{l.vat_rate}%</td>
                  <td className="py-1.5 text-right">{formatCurrency(t.total)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <div className="flex justify-end">
          <div className="w-56 space-y-1">
            <div className="flex justify-between"><span>Base imponible</span><span>{formatCurrency(totals.base)}</span></div>
            <div className="flex justify-between"><span>IVA</span><span>{formatCurrency(totals.iva)}</span></div>
            {Number(invoice.irpf_rate) > 0 && <div className="flex justify-between"><span>IRPF ({invoice.irpf_rate}%)</span><span>-{formatCurrency(irpfAmount)}</span></div>}
            <div className="flex justify-between font-bold text-base border-t pt-1"><span>Total</span><span>{formatCurrency(finalTotal)}</span></div>
          </div>
        </div>

        {fiscal?.iban_note && <div className="mt-4 text-xs text-slate-500 dark:text-slate-400">{fiscal.iban_note}</div>}
        {invoice.notes && <div className="mt-2 text-xs whitespace-pre-line">{invoice.notes}</div>}

        <div className="mt-8 text-center text-[11px] text-slate-400 dark:text-slate-500 border-t pt-3">
          Documento informativo, no válido como factura oficial.
        </div>
      </div>

      <div className="no-print flex justify-end gap-2 mt-5">
        <button className="btn-ghost" onClick={onClose}>Cerrar</button>
        <button className="btn-primary" onClick={() => window.print()}>🖨 Imprimir</button>
      </div>
    </Modal>
  );
}
