import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../lib/auth";
import { useBusinessId } from "../hooks";
import { usePipelineStages, customerLabel } from "./hooks";
import { documentTotals, type CrmCardNote } from "./types";
import { formatCurrency, formatDateTime, formatDate } from "@reservas/shared";
import { Spinner, Modal, ConfirmDialog } from "../../components/ui";
import { BudgetEditorModal } from "./Presupuestos";
import { EventModal } from "./AgendaInterna";

const STATUS_LABEL: Record<string, string> = { borrador: "Borrador", enviado: "Enviado", aceptado: "Aceptado", rechazado: "Rechazado" };
const INV_STATUS_LABEL: Record<string, string> = { emitida: "Emitida", pagada: "Pagada", anulada: "Anulada" };

export function CardDetail({ cardId, onClose }: { cardId: string; onClose: () => void }) {
  const bid = useBusinessId();
  const { business } = useAuth();
  const tz = business?.timezone ?? "Europe/Madrid";
  const qc = useQueryClient();
  const { data: stages } = usePipelineStages();
  const [editingTitle, setEditingTitle] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [addingBudget, setAddingBudget] = useState(false);
  const [addingEvent, setAddingEvent] = useState(false);

  const { data: card, isLoading } = useQuery({
    queryKey: ["crm_card", bid, cardId],
    enabled: !!bid,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("crm_cards")
        .select("*, customers(full_name, last_name, phone, email)")
        .eq("id", cardId).eq("business_id", bid).single();
      if (error) throw error;
      return data as any;
    },
  });

  const { data: notes } = useQuery({
    queryKey: ["crm_card_notes", cardId],
    queryFn: async () => {
      const { data, error } = await supabase.from("crm_card_notes").select("*").eq("card_id", cardId).order("created_at", { ascending: false });
      if (error) throw error;
      return data as CrmCardNote[];
    },
  });

  const { data: budgets } = useQuery({
    queryKey: ["crm_card_budgets", bid, cardId],
    enabled: !!bid,
    queryFn: async () => {
      const { data, error } = await supabase.from("crm_budgets").select("*, crm_budget_lines(quantity, unit_price, discount_pct, vat_rate)")
        .eq("business_id", bid).eq("card_id", cardId).order("issued_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  const { data: invoices } = useQuery({
    queryKey: ["crm_card_invoices", bid, cardId],
    enabled: !!bid,
    queryFn: async () => {
      const { data, error } = await supabase.from("crm_invoices").select("*, crm_invoice_lines(quantity, unit_price, discount_pct, vat_rate)")
        .eq("business_id", bid).eq("card_id", cardId).order("issued_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  const { data: events } = useQuery({
    queryKey: ["crm_card_events", bid, cardId],
    enabled: !!bid,
    queryFn: async () => {
      const { data, error } = await supabase.from("crm_events").select("*").eq("business_id", bid).eq("card_id", cardId).order("starts_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  function invalidateCard() {
    qc.invalidateQueries({ queryKey: ["crm_cards", bid] });
    qc.invalidateQueries({ queryKey: ["crm_card", bid, cardId] });
  }

  async function updateField(patch: Record<string, unknown>) {
    await supabase.from("crm_cards").update(patch as any).eq("id", cardId).eq("business_id", bid);
    invalidateCard();
  }

  async function addNote() {
    if (!noteText.trim()) return;
    await supabase.from("crm_card_notes").insert({ card_id: cardId, body: noteText.trim() });
    setNoteText("");
    qc.invalidateQueries({ queryKey: ["crm_card_notes", cardId] });
  }
  async function removeNote(id: string) {
    await supabase.from("crm_card_notes").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["crm_card_notes", cardId] });
  }

  async function removeCard() {
    setConfirmingDelete(false);
    await supabase.from("crm_cards").delete().eq("id", cardId).eq("business_id", bid);
    qc.invalidateQueries({ queryKey: ["crm_cards", bid] });
    onClose();
  }

  if (isLoading || !card) {
    return <Modal open onClose={onClose} title="Tarjeta"><div className="grid place-items-center py-10"><Spinner /></div></Modal>;
  }

  return (
    <Modal open onClose={onClose} title={customerLabel(card.customers)} width="max-w-2xl">
      <div className="space-y-5">
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className="label">Tipo de trabajo</label>
            {editingTitle ? (
              <input className="input" defaultValue={card.title} autoFocus
                onBlur={(e) => { updateField({ title: e.target.value.trim() || card.title }); setEditingTitle(false); }}
                onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }} />
            ) : (
              <div className="input cursor-text" onClick={() => setEditingTitle(true)}>{card.title}</div>
            )}
          </div>
          <div>
            <label className="label">Etapa</label>
            <select className="input" value={card.stage_id} onChange={(e) => updateField({ stage_id: e.target.value, last_moved_at: new Date().toISOString() })}>
              {(stages ?? []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <div><label className="label">Importe estimado (€)</label>
            <input type="number" min={0} step="0.01" className="input" defaultValue={card.estimated_amount ?? ""}
              onBlur={(e) => updateField({ estimated_amount: e.target.value ? Number(e.target.value) : null })} />
          </div>
          <div className="text-xs text-slate-400 dark:text-slate-500 self-end pb-2">
            Última actividad: {formatDateTime(card.last_moved_at, tz)}
          </div>
        </div>
        <div>
          <label className="label">Descripción</label>
          <textarea className="input" rows={2} defaultValue={card.description ?? ""} onBlur={(e) => updateField({ description: e.target.value.trim() || null })} />
        </div>
        {card.customers?.phone && <div className="text-sm text-slate-500 dark:text-slate-400">📞 {card.customers.phone}</div>}

        {/* Accesos rápidos */}
        <div className="flex gap-2 flex-wrap border-t pt-3">
          <button className="btn-ghost text-xs" onClick={() => setAddingBudget(true)}>+ Presupuesto</button>
          <button className="btn-ghost text-xs" onClick={() => setAddingEvent(true)}>+ Cita en agenda</button>
        </div>

        {/* Presupuestos y facturas ligados */}
        {(budgets?.length || invoices?.length) ? (
          <div className="grid sm:grid-cols-2 gap-3">
            {!!budgets?.length && (
              <div>
                <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Presupuestos</div>
                <ul className="space-y-1 text-sm">
                  {budgets.map((b) => (
                    <li key={b.id} className="flex justify-between">
                      <span>{b.number} · {STATUS_LABEL[b.status]}</span>
                      <span className="font-medium">{formatCurrency(documentTotals(b.crm_budget_lines ?? []).total)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {!!invoices?.length && (
              <div>
                <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Facturas</div>
                <ul className="space-y-1 text-sm">
                  {invoices.map((inv) => (
                    <li key={inv.id} className="flex justify-between">
                      <span>{inv.number} · {INV_STATUS_LABEL[inv.status]}</span>
                      <span className="font-medium">{formatCurrency(documentTotals(inv.crm_invoice_lines ?? []).total)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ) : null}

        {!!events?.length && (
          <div>
            <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Citas en agenda</div>
            <ul className="space-y-1 text-sm">
              {events.map((ev) => <li key={ev.id}>{formatDate(ev.starts_at, tz)} · {ev.title}</li>)}
            </ul>
          </div>
        )}

        {/* Notas */}
        <div className="border-t pt-3">
          <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2">Notas</div>
          <div className="flex gap-2 mb-2">
            <input className="input" placeholder="Añadir nota…" value={noteText} onChange={(e) => setNoteText(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") addNote(); }} />
            <button className="btn-ghost shrink-0" onClick={addNote}>Añadir</button>
          </div>
          <ul className="space-y-2 max-h-40 overflow-y-auto">
            {(notes ?? []).map((n) => (
              <li key={n.id} className="text-sm bg-slate-50 dark:bg-slate-800 rounded-lg px-3 py-2 flex justify-between gap-2">
                <div>
                  <div className="whitespace-pre-wrap">{n.body}</div>
                  <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">{formatDateTime(n.created_at, tz)}</div>
                </div>
                <button className="text-slate-400 hover:text-red-600 shrink-0" onClick={() => removeNote(n.id)}>✕</button>
              </li>
            ))}
            {!notes?.length && <li className="text-sm text-slate-400 dark:text-slate-500">Sin notas todavía.</li>}
          </ul>
        </div>

        <div className="border-t pt-4">
          <button className="btn-danger" onClick={() => setConfirmingDelete(true)}>Eliminar tarjeta</button>
        </div>
      </div>

      {addingBudget && (
        <BudgetEditorModal budget={null} defaultCustomerId={card.customer_id ?? undefined} defaultCardId={cardId}
          onClose={() => setAddingBudget(false)}
          onSaved={() => { setAddingBudget(false); qc.invalidateQueries({ queryKey: ["crm_card_budgets", bid, cardId] }); }} />
      )}
      {addingEvent && (
        <EventModal customerId={card.customer_id ?? undefined} cardId={cardId}
          onClose={() => setAddingEvent(false)}
          onChanged={() => { setAddingEvent(false); qc.invalidateQueries({ queryKey: ["crm_card_events", bid, cardId] }); qc.invalidateQueries({ queryKey: ["crm_events", bid] }); }} />
      )}
      <ConfirmDialog open={confirmingDelete} title="Eliminar tarjeta" message="¿Eliminar esta tarjeta del pipeline? No se eliminan los presupuestos/facturas ya generados." onConfirm={removeCard} onCancel={() => setConfirmingDelete(false)} />
    </Modal>
  );
}
