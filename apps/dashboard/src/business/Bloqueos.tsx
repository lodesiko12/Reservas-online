import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import { useProfessionals, useBusinessId } from "./hooks";
import { fromLocalInput } from "../lib/datetime";
import { formatDateTime } from "@reservas/shared";
import { PageHeader, Spinner, Modal, EmptyState } from "../components/ui";

export function Bloqueos() {
  const bid = useBusinessId();
  const { business } = useAuth();
  const tz = business?.timezone ?? "Europe/Madrid";
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: blocks, isLoading } = useQuery({
    queryKey: ["blocks", bid],
    enabled: !!bid,
    queryFn: async () => {
      const { data, error } = await supabase.from("blocks")
        .select("*, professionals(name)").eq("business_id", bid).order("starts_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  async function remove(id: string) {
    if (!confirm("¿Eliminar este bloqueo?")) return;
    await supabase.from("blocks").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["blocks", bid] });
  }

  return (
    <div>
      <PageHeader title="Bloqueos" subtitle="Cierra días, horas o la agenda de un profesional"
        actions={<button className="btn-primary" onClick={() => setOpen(true)}>+ Nuevo bloqueo</button>} />

      {isLoading ? <div className="grid place-items-center py-20"><Spinner /></div>
        : !blocks?.length ? <EmptyState title="Sin bloqueos" hint="Crea uno para vacaciones, festivos o ausencias." />
        : (
          <div className="card divide-y divide-slate-100 dark:divide-slate-800">
            {blocks.map((b) => (
              <div key={b.id} className="flex items-center justify-between px-5 py-3">
                <div>
                  <div className="font-medium">{formatDateTime(b.starts_at, tz)} → {formatDateTime(b.ends_at, tz)}</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    {b.scope === "professional" ? `Profesional: ${b.professionals?.name ?? "—"}` : "Todo el negocio"}
                    {b.reason ? ` · ${b.reason}` : ""}
                  </div>
                </div>
                <button className="btn-ghost text-xs" onClick={() => remove(b.id)}>Eliminar</button>
              </div>
            ))}
          </div>
        )}

      {open && <BlockModal bid={bid} tz={tz} onClose={() => setOpen(false)} onSaved={() => { qc.invalidateQueries(); setOpen(false); }} />}
    </div>
  );
}

function BlockModal({ bid, tz, onClose, onSaved }: { bid: string; tz: string; onClose: () => void; onSaved: () => void }) {
  const { data: pros } = useProfessionals();
  const [scope, setScope] = useState<"business" | "professional">("business");
  const [professionalId, setProfessionalId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [reason, setReason] = useState("");
  const [cancelAffected, setCancelAffected] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<string | null>(null);

  async function save() {
    setError(null);
    if (!from || !to) { setError("Indica fecha/hora de inicio y fin."); return; }
    const startsAt = fromLocalInput(from, tz);
    const endsAt = fromLocalInput(to, tz);
    if (endsAt <= startsAt) { setError("El fin debe ser posterior al inicio."); return; }
    if (scope === "professional" && !professionalId) { setError("Selecciona un profesional."); return; }

    setBusy(true);
    const { error: insErr } = await supabase.from("blocks").insert({
      business_id: bid, scope, professional_id: scope === "professional" ? professionalId : null,
      starts_at: startsAt, ends_at: endsAt, reason: reason.trim() || null, cancels_affected: cancelAffected,
    });
    if (insErr) { setBusy(false); setError(insErr.message); return; }

    let cancelled = 0;
    if (cancelAffected) {
      let q = supabase.from("bookings")
        .update({ status: "cancelada" })
        .eq("business_id", bid).eq("status", "confirmada")
        .lt("starts_at", endsAt).gt("ends_at", startsAt);
      if (scope === "professional") q = q.eq("professional_id", professionalId);
      const { data } = await q.select("id");
      cancelled = (data ?? []).length;
    }
    setBusy(false);
    setSummary(`Bloqueo creado.${cancelAffected ? ` ${cancelled} reserva(s) cancelada(s).` : ""}`);
    setTimeout(onSaved, 900);
  }

  return (
    <Modal open onClose={onClose} title="Nuevo bloqueo">
      {summary ? (
        <div className="text-center py-4"><div className="text-3xl">🚫</div><p className="mt-2 font-medium">{summary}</p></div>
      ) : (
        <div className="space-y-4">
          <div>
            <label className="label">Alcance</label>
            <div className="flex gap-2">
              <button type="button" className={scope === "business" ? "btn-primary" : "btn-ghost"} onClick={() => setScope("business")}>Todo el negocio</button>
              <button type="button" className={scope === "professional" ? "btn-primary" : "btn-ghost"} onClick={() => setScope("professional")}>Un profesional</button>
            </div>
          </div>
          {scope === "professional" && (
            <div><label className="label">Profesional</label>
              <select className="input" value={professionalId} onChange={(e) => setProfessionalId(e.target.value)}>
                <option value="">Selecciona…</option>
                {pros?.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Desde</label><input type="datetime-local" className="input" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
            <div><label className="label">Hasta</label><input type="datetime-local" className="input" value={to} onChange={(e) => setTo(e.target.value)} /></div>
          </div>
          <div><label className="label">Motivo (opcional)</label><input className="input" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Vacaciones, festivo…" /></div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={cancelAffected} onChange={(e) => setCancelAffected(e.target.checked)} /> Cancelar automáticamente las reservas afectadas</label>
          {error && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>}
          <div className="flex justify-end gap-2"><button className="btn-ghost" onClick={onClose}>Cancelar</button><button className="btn-primary" disabled={busy} onClick={save}>Crear bloqueo</button></div>
        </div>
      )}
    </Modal>
  );
}
