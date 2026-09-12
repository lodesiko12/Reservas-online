import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import { useBusinessId } from "./hooks";
import type { Tables } from "@reservas/shared";
import { WEEKDAYS_SHORT_ES, shortTime } from "@reservas/shared";
import { PageHeader, Spinner, Modal, EmptyState } from "../components/ui";

type Shift = Tables<"dining_shifts">;

export function Franjas() {
  const bid = useBusinessId();
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Shift | "new" | null>(null);

  const { data: shifts, isLoading } = useQuery({
    queryKey: ["dining_shifts", bid],
    enabled: !!bid,
    queryFn: async () => {
      const { data, error } = await supabase.from("dining_shifts").select("*").eq("business_id", bid).order("start_time");
      if (error) throw error;
      return data as Shift[];
    },
  });

  async function toggle(s: Shift) {
    await supabase.from("dining_shifts").update({ is_active: !s.is_active }).eq("id", s.id);
    qc.invalidateQueries({ queryKey: ["dining_shifts", bid] });
  }
  async function remove(s: Shift) {
    if (!confirm(`¿Eliminar la franja "${s.name}"?`)) return;
    await supabase.from("dining_shifts").delete().eq("id", s.id);
    qc.invalidateQueries({ queryKey: ["dining_shifts", bid] });
  }

  return (
    <div>
      <PageHeader title="Franjas y aforo" subtitle="Turnos de servicio con capacidad de comensales"
        actions={<button className="btn-primary" onClick={() => setEditing("new")}>+ Nueva franja</button>} />

      {isLoading ? <div className="grid place-items-center py-20"><Spinner /></div>
        : !shifts?.length ? <EmptyState title="Sin franjas" hint="Crea al menos una (p.ej. Comida y Cena)." />
        : (
          <div className="grid sm:grid-cols-2 gap-4">
            {shifts.map((s) => (
              <div key={s.id} className="card p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-semibold text-lg">{s.name}</div>
                    <div className="text-sm text-slate-500">{shortTime(s.start_time)}–{shortTime(s.end_time)} · mesa {s.booking_duration_min} min</div>
                  </div>
                  <button onClick={() => toggle(s)} className={`badge ${s.is_active ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"}`}>{s.is_active ? "Activa" : "Inactiva"}</button>
                </div>
                <div className="mt-3 flex items-center gap-4 text-sm">
                  <span className="font-medium">Aforo: {s.max_covers} comensales</span>
                  <span className="text-slate-400">cada {s.slot_interval_min} min</span>
                </div>
                <div className="mt-2 flex gap-1">
                  {[1, 2, 3, 4, 5, 6, 0].map((wd) => (
                    <span key={wd} className={`text-xs px-1.5 py-0.5 rounded ${s.active_weekdays.includes(wd) ? "bg-brand-50 text-brand-700" : "bg-slate-100 text-slate-400"}`}>
                      {WEEKDAYS_SHORT_ES[wd]}
                    </span>
                  ))}
                </div>
                <div className="mt-4 flex gap-2">
                  <button className="btn-ghost text-xs" onClick={() => setEditing(s)}>Editar</button>
                  <button className="btn-ghost text-xs" onClick={() => remove(s)}>🗑 Eliminar</button>
                </div>
              </div>
            ))}
          </div>
        )}

      {editing && <ShiftModal bid={bid} shift={editing === "new" ? null : editing} onClose={() => setEditing(null)} onSaved={() => { qc.invalidateQueries({ queryKey: ["dining_shifts", bid] }); setEditing(null); }} />}
    </div>
  );
}

function ShiftModal({ bid, shift, onClose, onSaved }: { bid: string; shift: Shift | null; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    name: shift?.name ?? "",
    start_time: shift ? shortTime(shift.start_time) : "13:00",
    end_time: shift ? shortTime(shift.end_time) : "16:00",
    max_covers: shift?.max_covers ?? 40,
    slot_interval_min: shift?.slot_interval_min ?? 15,
    booking_duration_min: shift?.booking_duration_min ?? 90,
    active_weekdays: shift?.active_weekdays ?? [1, 2, 3, 4, 5, 6, 0],
    is_active: shift?.is_active ?? true,
  });
  const [busy, setBusy] = useState(false);

  function toggleDay(wd: number) {
    setForm((f) => ({
      ...f,
      active_weekdays: f.active_weekdays.includes(wd) ? f.active_weekdays.filter((d) => d !== wd) : [...f.active_weekdays, wd],
    }));
  }

  async function save() {
    setBusy(true);
    const payload = {
      business_id: bid, name: form.name.trim(),
      start_time: form.start_time, end_time: form.end_time,
      max_covers: Number(form.max_covers), slot_interval_min: Number(form.slot_interval_min),
      booking_duration_min: Number(form.booking_duration_min),
      active_weekdays: form.active_weekdays.sort(), is_active: form.is_active,
    };
    if (shift) await supabase.from("dining_shifts").update(payload).eq("id", shift.id);
    else await supabase.from("dining_shifts").insert(payload);
    setBusy(false); onSaved();
  }

  return (
    <Modal open onClose={onClose} title={shift ? "Editar franja" : "Nueva franja"}>
      <div className="space-y-4">
        <div><label className="label">Nombre</label><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Comida, Cena…" /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label">Inicio</label><input type="time" className="input" value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })} /></div>
          <div><label className="label">Fin</label><input type="time" className="input" value={form.end_time} onChange={(e) => setForm({ ...form, end_time: e.target.value })} /></div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div><label className="label">Aforo</label><input type="number" min={1} className="input" value={form.max_covers} onChange={(e) => setForm({ ...form, max_covers: +e.target.value })} /></div>
          <div><label className="label">Cada (min)</label><input type="number" min={5} step={5} className="input" value={form.slot_interval_min} onChange={(e) => setForm({ ...form, slot_interval_min: +e.target.value })} /></div>
          <div><label className="label">Mesa (min)</label><input type="number" min={30} step={15} className="input" value={form.booking_duration_min} onChange={(e) => setForm({ ...form, booking_duration_min: +e.target.value })} /></div>
        </div>
        <div>
          <label className="label">Días activos</label>
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5, 6, 0].map((wd) => (
              <button key={wd} type="button" onClick={() => toggleDay(wd)}
                className={`px-2.5 py-1.5 rounded-lg text-sm font-medium ${form.active_weekdays.includes(wd) ? "bg-brand-500 text-white" : "bg-slate-100 text-slate-500"}`}>
                {WEEKDAYS_SHORT_ES[wd]}
              </button>
            ))}
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} /> Activa</label>
        <div className="flex justify-end gap-2"><button className="btn-ghost" onClick={onClose}>Cancelar</button><button className="btn-primary" disabled={!form.name.trim() || busy} onClick={save}>Guardar</button></div>
      </div>
    </Modal>
  );
}
