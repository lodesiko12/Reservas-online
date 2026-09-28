import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../../lib/supabase";
import { useBusinessId } from "../hooks";
import { usePipelineStages, useFiscalProfile, useBudgetConcepts } from "./hooks";
import { Spinner } from "../../components/ui";

const EVENT_KEYS: { key: string; label: string }[] = [
  { key: "presupuesto_enviado", label: "Al enviar un presupuesto" },
  { key: "presupuesto_aceptado", label: "Al aceptar un presupuesto" },
  { key: "factura_pagada", label: "Al marcar una factura como pagada" },
];

/** Sección de configuración fiscal y del CRM para negocios tipo autónomo:
 * datos fiscales, catálogo de conceptos y mapeo etapa<->evento. Se monta
 * dentro de Configuracion.tsx (no rompe el resto de tipos de negocio). */
export function ConfiguracionFiscalSection({ flash }: { flash: (m: string) => void }) {
  return (
    <>
      <FiscalProfileForm flash={flash} />
      <BudgetConceptsSection flash={flash} />
      <StageEventsSection flash={flash} />
    </>
  );
}

function FiscalProfileForm({ flash }: { flash: (m: string) => void }) {
  const bid = useBusinessId();
  const qc = useQueryClient();
  const { data: fiscal, isLoading } = useFiscalProfile();
  const [form, setForm] = useState({ legal_name: "", nif: "", address: "", iban_note: "", default_vat_rate: 21, default_irpf_rate: 0 });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!fiscal) return;
    setForm({
      legal_name: fiscal.legal_name ?? "", nif: fiscal.nif ?? "", address: fiscal.address ?? "", iban_note: fiscal.iban_note ?? "",
      default_vat_rate: Number(fiscal.default_vat_rate), default_irpf_rate: Number(fiscal.default_irpf_rate),
    });
  }, [fiscal]);

  async function save() {
    setSaving(true);
    await supabase.from("crm_fiscal_profile").upsert({
      business_id: bid,
      legal_name: form.legal_name.trim() || null, nif: form.nif.trim() || null,
      address: form.address.trim() || null, iban_note: form.iban_note.trim() || null,
      default_vat_rate: Number(form.default_vat_rate) || 0, default_irpf_rate: Number(form.default_irpf_rate) || 0,
      updated_at: new Date().toISOString(),
    });
    qc.invalidateQueries({ queryKey: ["crm_fiscal_profile", bid] });
    setSaving(false); flash("Datos fiscales guardados");
  }

  return (
    <section className="card p-6">
      <h2 className="font-semibold mb-1">Datos fiscales</h2>
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">Se muestran en los presupuestos y facturas informativas.</p>
      {isLoading ? <Spinner /> : (
        <>
          <div className="grid sm:grid-cols-2 gap-4">
            <div><label className="label">Nombre / razón social</label><input className="input" value={form.legal_name} onChange={(e) => setForm({ ...form, legal_name: e.target.value })} /></div>
            <div><label className="label">NIF</label><input className="input" value={form.nif} onChange={(e) => setForm({ ...form, nif: e.target.value })} /></div>
          </div>
          <div className="mt-4"><label className="label">Dirección</label><textarea className="input" rows={2} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
          <div className="mt-4"><label className="label">Nota de pago (IBAN, etc.)</label><input className="input" value={form.iban_note} onChange={(e) => setForm({ ...form, iban_note: e.target.value })} placeholder="Transferencia a ES00…" /></div>
          <div className="grid sm:grid-cols-2 gap-4 mt-4">
            <div><label className="label">IVA por defecto (%)</label><input type="number" min={0} max={100} className="input" value={form.default_vat_rate} onChange={(e) => setForm({ ...form, default_vat_rate: +e.target.value })} /></div>
            <div><label className="label">IRPF por defecto (%)</label><input type="number" min={0} max={100} className="input" value={form.default_irpf_rate} onChange={(e) => setForm({ ...form, default_irpf_rate: +e.target.value })} /></div>
          </div>
          <button className="btn-primary mt-4" disabled={saving} onClick={save}>{saving ? "Guardando…" : "Guardar datos fiscales"}</button>
        </>
      )}
    </section>
  );
}

function BudgetConceptsSection({ flash }: { flash: (m: string) => void }) {
  const bid = useBusinessId();
  const qc = useQueryClient();
  const { data: concepts, isLoading } = useBudgetConcepts();
  const [form, setForm] = useState({ name: "", default_unit_price: 0, default_vat_rate: 21 });
  const [saving, setSaving] = useState(false);

  function invalidate() { qc.invalidateQueries({ queryKey: ["crm_budget_concepts", bid] }); }

  async function add() {
    if (!form.name.trim()) return;
    setSaving(true);
    await supabase.from("crm_budget_concepts").insert({
      business_id: bid, name: form.name.trim(), default_unit_price: Number(form.default_unit_price) || 0, default_vat_rate: Number(form.default_vat_rate) || 21,
    });
    setForm({ name: "", default_unit_price: 0, default_vat_rate: 21 });
    invalidate(); setSaving(false); flash("Concepto añadido");
  }
  async function remove(id: string) {
    await supabase.from("crm_budget_concepts").delete().eq("id", id);
    invalidate();
  }
  async function updateConcept(id: string, patch: Record<string, unknown>) {
    await supabase.from("crm_budget_concepts").update(patch as any).eq("id", id);
    invalidate();
  }

  return (
    <section className="card p-6">
      <h2 className="font-semibold mb-1">Catálogo de conceptos</h2>
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">Se usan para autocompletar líneas de presupuestos y facturas.</p>
      {isLoading ? <Spinner /> : (
        <>
          <div className="space-y-2 mb-4">
            {(concepts ?? []).map((c) => (
              <div key={c.id} className="grid grid-cols-12 gap-2 items-center text-sm">
                <input className="input col-span-6" defaultValue={c.name} onBlur={(e) => updateConcept(c.id, { name: e.target.value.trim() || c.name })} />
                <input type="number" className="input col-span-2" defaultValue={c.default_unit_price} onBlur={(e) => updateConcept(c.id, { default_unit_price: +e.target.value })} />
                <input type="number" className="input col-span-2" defaultValue={c.default_vat_rate} onBlur={(e) => updateConcept(c.id, { default_vat_rate: +e.target.value })} />
                <button className="col-span-2 text-slate-400 hover:text-red-600 justify-self-end" onClick={() => remove(c.id)}>Eliminar</button>
              </div>
            ))}
            {!concepts?.length && <p className="text-sm text-slate-400 dark:text-slate-500">Sin conceptos todavía.</p>}
          </div>
          <div className="grid grid-cols-12 gap-2 items-end border-t pt-4">
            <div className="col-span-6"><label className="label">Concepto nuevo</label><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div className="col-span-2"><label className="label">Precio (€)</label><input type="number" min={0} className="input" value={form.default_unit_price} onChange={(e) => setForm({ ...form, default_unit_price: +e.target.value })} /></div>
            <div className="col-span-2"><label className="label">IVA (%)</label><input type="number" min={0} max={100} className="input" value={form.default_vat_rate} onChange={(e) => setForm({ ...form, default_vat_rate: +e.target.value })} /></div>
            <button className="btn-primary col-span-2" disabled={!form.name.trim() || saving} onClick={add}>+ Añadir</button>
          </div>
        </>
      )}
    </section>
  );
}

function StageEventsSection({ flash }: { flash: (m: string) => void }) {
  const bid = useBusinessId();
  const qc = useQueryClient();
  const { data: stages } = usePipelineStages();
  const { data: mapping, isLoading } = useQuery({
    queryKey: ["crm_stage_events", bid],
    enabled: !!bid,
    queryFn: async () => {
      const { data, error } = await supabase.from("crm_stage_events").select("*").eq("business_id", bid);
      if (error) throw error;
      return data;
    },
  });

  async function setMapping(eventKey: string, stageId: string) {
    await supabase.from("crm_stage_events").upsert({ business_id: bid, event_key: eventKey as any, stage_id: stageId || null });
    qc.invalidateQueries({ queryKey: ["crm_stage_events", bid] });
    flash("Mapeo guardado");
  }

  return (
    <section className="card p-6">
      <h2 className="font-semibold mb-1">Mover tarjetas automáticamente</h2>
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
        Cuando ocurra uno de estos eventos, la tarjeta ligada se moverá a la etapa que elijas (opcional).
      </p>
      {isLoading ? <Spinner /> : (
        <div className="space-y-3">
          {EVENT_KEYS.map((ev) => {
            const current = mapping?.find((m) => m.event_key === ev.key)?.stage_id ?? "";
            return (
              <div key={ev.key} className="flex items-center justify-between gap-3 flex-wrap">
                <span className="text-sm">{ev.label}</span>
                <select className="input max-w-xs" value={current ?? ""} onChange={(e) => setMapping(ev.key, e.target.value)}>
                  <option value="">Sin mover tarjeta</option>
                  {(stages ?? []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
