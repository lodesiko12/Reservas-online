import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  DndContext, PointerSensor, TouchSensor, useSensor, useSensors,
  useDroppable, DragOverlay, closestCorners, type DragEndEvent, type DragStartEvent,
} from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { supabase } from "../../lib/supabase";
import { useBusinessId } from "../hooks";
import { usePipelineStages, useCrmCards, customerLabel } from "./hooks";
import type { CardWithCustomer, PipelineStage } from "./types";
import { formatCurrency, formatDateTime } from "@reservas/shared";
import { useAuth } from "../../lib/auth";
import { PageHeader, Spinner, Modal, EmptyState } from "../../components/ui";
import { CardDetail } from "./CardDetail";

const STAGE_COLORS = ["#64748b", "#0ea5e9", "#8b5cf6", "#f59e0b", "#10b981", "#ef4444", "#ec4899", "#14b8a6"];

export function Pipeline() {
  const bid = useBusinessId();
  const { business } = useAuth();
  const tz = business?.timezone ?? "Europe/Madrid";
  const qc = useQueryClient();
  const { data: stages, isLoading: loadingStages } = usePipelineStages();
  const { data: cards, isLoading: loadingCards } = useCrmCards();

  const [activeCard, setActiveCard] = useState<CardWithCustomer | null>(null);
  const [openCardId, setOpenCardId] = useState<string | null>(null);
  const [quickCardOpen, setQuickCardOpen] = useState(false);
  const [addingStage, setAddingStage] = useState(false);
  const [editingStage, setEditingStage] = useState<PipelineStage | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 8 } })
  );

  const cardsByStage = useMemo(() => {
    const map: Record<string, CardWithCustomer[]> = {};
    for (const s of stages ?? []) map[s.id] = [];
    for (const c of cards ?? []) {
      if (!map[c.stage_id]) map[c.stage_id] = [];
      map[c.stage_id].push(c);
    }
    for (const key of Object.keys(map)) map[key].sort((a, b) => a.position - b.position);
    return map;
  }, [stages, cards]);

  function handleDragStart(event: DragStartEvent) {
    const c = (cards ?? []).find((c) => c.id === event.active.id);
    setActiveCard(c ?? null);
  }

  async function handleDragEnd(event: DragEndEvent) {
    setActiveCard(null);
    const { active, over } = event;
    if (!over || !cards) return;
    const moved = cards.find((c) => c.id === active.id);
    if (!moved) return;

    const targetStage = stages?.find((s) => s.id === over.id);
    let targetStageId = targetStage?.id;
    let overCard: CardWithCustomer | undefined;
    if (!targetStageId) {
      overCard = cards.find((c) => c.id === over.id);
      targetStageId = overCard?.stage_id;
    }
    if (!targetStageId) return;
    if (targetStageId === moved.stage_id && (!overCard || overCard.id === moved.id)) return;

    const destBefore = cards
      .filter((c) => c.stage_id === targetStageId && c.id !== moved.id)
      .sort((a, b) => a.position - b.position);
    let insertIndex = destBefore.length;
    if (overCard && overCard.id !== moved.id) {
      const idx = destBefore.findIndex((c) => c.id === overCard!.id);
      if (idx !== -1) insertIndex = idx;
    }
    const dest = [...destBefore];
    dest.splice(insertIndex, 0, { ...moved, stage_id: targetStageId });

    const sourceStageId = moved.stage_id;
    const sourceReindexed = sourceStageId === targetStageId
      ? []
      : cards.filter((c) => c.stage_id === sourceStageId && c.id !== moved.id).sort((a, b) => a.position - b.position);

    // Optimistic cache update.
    const nowIso = new Date().toISOString();
    const nextCards = cards.map((c) => {
      const destIdx = dest.findIndex((d) => d.id === c.id);
      if (destIdx !== -1) {
        return { ...c, stage_id: targetStageId!, position: destIdx, last_moved_at: c.id === moved.id ? nowIso : c.last_moved_at };
      }
      const srcIdx = sourceReindexed.findIndex((d) => d.id === c.id);
      if (srcIdx !== -1) return { ...c, position: srcIdx };
      return c;
    });
    qc.setQueryData(["crm_cards", bid], nextCards);

    try {
      const updates: any[] = dest.map((c, i) =>
        supabase.from("crm_cards").update({
          stage_id: targetStageId,
          position: i,
          ...(c.id === moved.id ? { last_moved_at: nowIso } : {}),
        }).eq("id", c.id).eq("business_id", bid)
      );
      updates.push(...sourceReindexed.map((c, i) =>
        supabase.from("crm_cards").update({ position: i }).eq("id", c.id).eq("business_id", bid)
      ));
      await Promise.all(updates);
    } finally {
      qc.invalidateQueries({ queryKey: ["crm_cards", bid] });
    }
  }

  if (loadingStages || loadingCards) {
    return <div className="grid place-items-center py-20"><Spinner /></div>;
  }

  const sortedStages = (stages ?? []).slice().sort((a, b) => a.position - b.position);

  return (
    <div>
      <PageHeader
        title="Pipeline"
        subtitle="Arrastra las tarjetas entre etapas"
        actions={<button className="btn-primary" onClick={() => setQuickCardOpen(true)}>+ Tarjeta rápida</button>}
      />

      {!sortedStages.length ? (
        <EmptyState
          title="Todavía no hay etapas en tu pipeline"
          hint="Crea la primera etapa (por ejemplo «Nuevo contacto») para empezar a organizar tus trabajos."
          action={<button className="btn-primary" onClick={() => setAddingStage(true)}>+ Crear etapa</button>}
        />
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div className="flex gap-3 overflow-x-auto pb-3 snap-x snap-mandatory -mx-4 px-4 sm:mx-0 sm:px-0">
            {sortedStages.map((stage, i) => (
              <StageColumn
                key={stage.id}
                stage={stage}
                cards={cardsByStage[stage.id] ?? []}
                tz={tz}
                isFirst={i === 0}
                isLast={i === sortedStages.length - 1}
                onOpenCard={(id) => setOpenCardId(id)}
                onEdit={() => setEditingStage(stage)}
              />
            ))}
            <div className="shrink-0 w-16 grid place-items-start pt-1">
              <button className="btn-ghost h-10 w-10 rounded-full text-lg" title="Añadir etapa" onClick={() => setAddingStage(true)}>+</button>
            </div>
          </div>
          <DragOverlay>
            {activeCard && <CardPreview card={activeCard} tz={tz} />}
          </DragOverlay>
        </DndContext>
      )}

      {openCardId && <CardDetail cardId={openCardId} onClose={() => setOpenCardId(null)} />}
      {quickCardOpen && <QuickCardModal stages={sortedStages} onClose={() => setQuickCardOpen(false)} />}
      {addingStage && <StageEditModal stage={null} stages={sortedStages} onClose={() => setAddingStage(false)} />}
      {editingStage && <StageEditModal stage={editingStage} stages={sortedStages} onClose={() => setEditingStage(null)} />}
    </div>
  );
}

function StageColumn({ stage, cards, tz, isFirst, isLast, onOpenCard, onEdit }: {
  stage: PipelineStage; cards: CardWithCustomer[]; tz: string; isFirst: boolean; isLast: boolean;
  onOpenCard: (id: string) => void; onEdit: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id });
  const total = cards.reduce((s, c) => s + (c.estimated_amount ?? 0), 0);

  return (
    <div className="shrink-0 w-[85vw] xs:w-80 sm:w-72 snap-center">
      <div className="flex items-center justify-between mb-2 px-1">
        <div className="flex items-center gap-2 min-w-0">
          <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: stage.color }} />
          <span className="font-semibold text-sm truncate">{stage.name}</span>
          <span className="text-xs text-slate-400 dark:text-slate-500 shrink-0">{cards.length}</span>
        </div>
        <button className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 px-1" onClick={onEdit} title="Editar etapa">⋮</button>
      </div>
      {total > 0 && <div className="text-xs text-slate-400 dark:text-slate-500 px-1 mb-2">{formatCurrency(total)} estimado</div>}
      <div
        ref={setNodeRef}
        className={`rounded-xl p-2 min-h-[140px] space-y-2 transition-colors ${isOver ? "bg-brand-50 dark:bg-brand-500/10" : "bg-slate-100/60 dark:bg-slate-800/40"}`}
      >
        <SortableContext items={cards.map((c) => c.id)} strategy={verticalListSortingStrategy}>
          {cards.map((c) => <SortableCard key={c.id} card={c} tz={tz} onOpen={() => onOpenCard(c.id)} />)}
        </SortableContext>
        {!cards.length && <div className="text-xs text-slate-400 dark:text-slate-500 text-center py-6">Sin tarjetas</div>}
      </div>
    </div>
  );
}

function SortableCard({ card, tz, onOpen }: { card: CardWithCustomer; tz: string; onOpen: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: card.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 };
  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <CardBody card={card} tz={tz} onOpen={onOpen} />
    </div>
  );
}

function CardPreview({ card, tz }: { card: CardWithCustomer; tz: string }) {
  return <div className="rotate-2 shadow-lg"><CardBody card={card} tz={tz} onOpen={() => {}} /></div>;
}

function CardBody({ card, tz, onOpen }: { card: CardWithCustomer; tz: string; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="card w-full text-left p-3 cursor-grab active:cursor-grabbing touch-none select-none"
    >
      <div className="font-semibold text-sm truncate">{customerLabel(card.customers)}</div>
      {card.customers?.phone && <div className="text-xs text-slate-500 dark:text-slate-400">{card.customers.phone}</div>}
      <div className="text-sm mt-1 truncate">{card.title}</div>
      <div className="flex items-center justify-between mt-2">
        {card.estimated_amount != null
          ? <span className="badge bg-emerald-100 text-emerald-700">{formatCurrency(card.estimated_amount)}</span>
          : <span />}
        <span className="text-[11px] text-slate-400 dark:text-slate-500">{formatDateTime(card.last_moved_at, tz)}</span>
      </div>
    </button>
  );
}

function QuickCardModal({ stages, onClose }: { stages: PipelineStage[]; onClose: () => void }) {
  const bid = useBusinessId();
  const qc = useQueryClient();
  const [form, setForm] = useState({ full_name: "", phone: "", description: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (!form.full_name.trim() || !stages.length) return;
    setSaving(true); setError(null);
    const initialStage = stages[0];
    const { data: customer, error: custErr } = await supabase
      .from("customers")
      .insert({ business_id: bid, full_name: form.full_name.trim(), phone: form.phone.trim() || null })
      .select("id")
      .single();
    if (custErr || !customer) { setSaving(false); setError(custErr?.message ?? "No se pudo crear el cliente"); return; }
    const { error: cardErr } = await supabase.from("crm_cards").insert({
      business_id: bid, customer_id: customer.id, stage_id: initialStage.id,
      title: form.description.trim() || "Nuevo trabajo", position: 0,
    });
    setSaving(false);
    if (cardErr) { setError(cardErr.message); return; }
    qc.invalidateQueries({ queryKey: ["crm_cards", bid] });
    qc.invalidateQueries({ queryKey: ["customers", bid] });
    onClose();
  }

  return (
    <Modal open onClose={onClose} title="Tarjeta rápida" width="max-w-sm">
      <div className="space-y-3">
        <div><label className="label">Nombre del cliente *</label><input className="input" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} autoFocus /></div>
        <div><label className="label">Teléfono</label><input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
        <div><label className="label">Tipo de trabajo</label><textarea className="input" rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Ej. Revisión de cuadro eléctrico" /></div>
        {error && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>}
        <div className="flex justify-end gap-2">
          <button className="btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn-primary" disabled={!form.full_name.trim() || saving} onClick={save}>{saving ? "Creando…" : "Crear tarjeta"}</button>
        </div>
      </div>
    </Modal>
  );
}

function StageEditModal({ stage, stages, onClose }: { stage: PipelineStage | null; stages: PipelineStage[]; onClose: () => void }) {
  const bid = useBusinessId();
  const qc = useQueryClient();
  const [name, setName] = useState(stage?.name ?? "");
  const [color, setColor] = useState(stage?.color ?? STAGE_COLORS[stages.length % STAGE_COLORS.length]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [moveTo, setMoveTo] = useState("");

  function invalidate() {
    qc.invalidateQueries({ queryKey: ["crm_pipeline_stages", bid] });
    qc.invalidateQueries({ queryKey: ["crm_cards", bid] });
  }

  async function save() {
    if (!name.trim()) return;
    setSaving(true); setError(null);
    if (stage) {
      const { error } = await supabase.from("crm_pipeline_stages").update({ name: name.trim(), color }).eq("id", stage.id).eq("business_id", bid);
      setSaving(false);
      if (error) { setError(error.message); return; }
    } else {
      const nextPosition = stages.length ? Math.max(...stages.map((s) => s.position)) + 1 : 0;
      const { error } = await supabase.from("crm_pipeline_stages").insert({ business_id: bid, name: name.trim(), color, position: nextPosition });
      setSaving(false);
      if (error) { setError(error.message); return; }
    }
    invalidate();
    onClose();
  }

  async function move(dir: -1 | 1) {
    if (!stage) return;
    const sorted = stages.slice().sort((a, b) => a.position - b.position);
    const idx = sorted.findIndex((s) => s.id === stage.id);
    const swapIdx = idx + dir;
    if (swapIdx < 0 || swapIdx >= sorted.length) return;
    const other = sorted[swapIdx];
    await Promise.all([
      supabase.from("crm_pipeline_stages").update({ position: other.position }).eq("id", stage.id).eq("business_id", bid),
      supabase.from("crm_pipeline_stages").update({ position: stage.position }).eq("id", other.id).eq("business_id", bid),
    ]);
    invalidate();
  }

  async function remove() {
    if (!stage) return;
    setDeleting(true); setError(null);
    const { error } = await supabase.rpc("crm_delete_pipeline_stage", {
      p_stage_id: stage.id, p_move_to_stage_id: moveTo || null,
    } as any);
    setDeleting(false);
    if (error) { setError(error.message); return; }
    invalidate();
    onClose();
  }

  const cardsElsewhere = stages.filter((s) => s.id !== stage?.id);

  return (
    <Modal open onClose={onClose} title={stage ? "Editar etapa" : "Nueva etapa"} width="max-w-sm">
      <div className="space-y-3">
        <div><label className="label">Nombre</label><input className="input" value={name} onChange={(e) => setName(e.target.value)} autoFocus /></div>
        <div>
          <label className="label">Color</label>
          <div className="flex gap-2 flex-wrap">
            {STAGE_COLORS.map((c) => (
              <button key={c} type="button" onClick={() => setColor(c)}
                className={`h-7 w-7 rounded-full ${color === c ? "ring-2 ring-offset-2 ring-slate-800 dark:ring-slate-100 dark:ring-offset-slate-900" : ""}`}
                style={{ background: c }} />
            ))}
          </div>
        </div>
        {stage && (
          <div className="flex gap-2">
            <button className="btn-ghost text-xs" onClick={() => move(-1)}>← Mover antes</button>
            <button className="btn-ghost text-xs" onClick={() => move(1)}>Mover después →</button>
          </div>
        )}
        {error && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>}
        <div className="flex justify-end gap-2">
          <button className="btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn-primary" disabled={!name.trim() || saving} onClick={save}>{saving ? "Guardando…" : "Guardar"}</button>
        </div>

        {stage && (
          <div className="border-t pt-3 mt-3">
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">Eliminar esta etapa. Si tiene tarjetas, elige a dónde moverlas.</p>
            {cardsElsewhere.length > 0 && (
              <select className="input mb-2" value={moveTo} onChange={(e) => setMoveTo(e.target.value)}>
                <option value="">Si tiene tarjetas, elige etapa destino…</option>
                {cardsElsewhere.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            )}
            <button className="btn-danger" disabled={deleting} onClick={remove}>{deleting ? "Eliminando…" : "Eliminar etapa"}</button>
          </div>
        )}
      </div>
    </Modal>
  );
}
