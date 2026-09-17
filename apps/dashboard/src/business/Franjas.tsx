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
                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                  <span className="font-medium">Aforo: {s.max_covers} comensales</span>
                  <span className="text-slate-400">cada {s.slot_interval_min} min</span>
                  {s.last_call_time && <span className="text-slate-400">última reserva {shortTime(s.last_call_time)}</span>}
                </div>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {s.pacing_enabled && <span className="badge bg-amber-50 text-amber-700 text-[11px]">Stock por slot activo</span>}
                  {s.online_max_covers != null && <span className="badge bg-amber-50 text-amber-700 text-[11px]">Online: {s.online_max_covers}</span>}
                  {!s.allow_double_turn && <span className="badge bg-slate-100 text-slate-500 text-[11px]">Sin doblar mesa</span>}
                  {s.cleanup_min > 0 && <span className="badge bg-slate-100 text-slate-500 text-[11px]">Limpieza {s.cleanup_min} min</span>}
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

type DurationRule = Tables<"dining_duration_rules">;

function DurationRules({ shiftId }: { shiftId: string }) {
  const qc = useQueryClient();
  const { data: rules } = useQuery({
    queryKey: ["dining_duration_rules", shiftId],
    queryFn: async () => {
      const { data, error } = await supabase.from("dining_duration_rules").select("*").eq("dining_shift_id", shiftId).order("pax_min");
      if (error) throw error;
      return data as DurationRule[];
    },
  });
  const [form, setForm] = useState({ pax_min: 2, pax_max: 2, duration_min: 90 });

  function invalidate() { qc.invalidateQueries({ queryKey: ["dining_duration_rules", shiftId] }); }

  async function add() {
    if (form.pax_max < form.pax_min) return;
    await supabase.from("dining_duration_rules").insert({
      dining_shift_id: shiftId, pax_min: form.pax_min, pax_max: form.pax_max, duration_min: form.duration_min,
    });
    invalidate();
  }
  async function remove(id: string) {
    await supabase.from("dining_duration_rules").delete().eq("id", id);
    invalidate();
  }

  return (
    <div className="mt-4 border-t pt-4">
      <label className="label">Duración según nº de comensales (opcional)</label>
      <p className="text-xs text-slate-400 mb-2">Si un grupo no encaja en ningún rango, se usa la duración por defecto de arriba.</p>
      {!!rules?.length && (
        <div className="space-y-1 mb-3">
          {rules.map((r) => (
            <div key={r.id} className="flex items-center justify-between text-sm bg-slate-50 rounded-lg px-3 py-1.5">
              <span>{r.pax_min === r.pax_max ? `${r.pax_min} pax` : `${r.pax_min}–${r.pax_max} pax`} → {r.duration_min} min</span>
              <button className="text-slate-400 hover:text-red-600" onClick={() => remove(r.id)}>🗑</button>
            </div>
          ))}
        </div>
      )}
      <div className="flex items-end gap-2">
        <div><label className="label">Desde</label><input type="number" min={1} className="input w-20" value={form.pax_min} onChange={(e) => setForm({ ...form, pax_min: +e.target.value })} /></div>
        <div><label className="label">Hasta</label><input type="number" min={1} className="input w-20" value={form.pax_max} onChange={(e) => setForm({ ...form, pax_max: +e.target.value })} /></div>
        <div><label className="label">Minutos</label><input type="number" min={15} step={15} className="input w-24" value={form.duration_min} onChange={(e) => setForm({ ...form, duration_min: +e.target.value })} /></div>
        <button type="button" className="btn-ghost" onClick={add}>+ Añadir</button>
      </div>
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
    last_call_time: shift?.last_call_time ? shortTime(shift.last_call_time) : "",
    pacing_enabled: shift?.pacing_enabled ?? false,
    max_covers_per_slot: shift?.max_covers_per_slot ?? "",
    max_bookings_per_slot: shift?.max_bookings_per_slot ?? "",
    online_max_covers: shift?.online_max_covers ?? "",
    allow_double_turn: shift?.allow_double_turn ?? true,
    cleanup_min: shift?.cleanup_min ?? 0,
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
      last_call_time: form.last_call_time || null,
      pacing_enabled: form.pacing_enabled,
      max_covers_per_slot: form.max_covers_per_slot === "" ? null : Number(form.max_covers_per_slot),
      max_bookings_per_slot: form.max_bookings_per_slot === "" ? null : Number(form.max_bookings_per_slot),
      online_max_covers: form.online_max_covers === "" ? null : Number(form.online_max_covers),
      allow_double_turn: form.allow_double_turn,
      cleanup_min: Number(form.cleanup_min),
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
          <div><label className="label">Mesa (min, por defecto)</label><input type="number" min={30} step={15} className="input" value={form.booking_duration_min} onChange={(e) => setForm({ ...form, booking_duration_min: +e.target.value })} /></div>
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

        <div className="border-t pt-4">
          <label className="label">Última hora de reserva (opcional)</label>
          <input type="time" className="input w-32" value={form.last_call_time} onChange={(e) => setForm({ ...form, last_call_time: e.target.value })} />
          <p className="text-xs text-slate-400 mt-1">Si se deja vacío, se puede reservar hasta el cierre de la franja.</p>
        </div>

        <div className="border-t pt-4">
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.pacing_enabled} onChange={(e) => setForm({ ...form, pacing_enabled: e.target.checked })} /> Limitar stock por franja horaria (además del aforo total)</label>
          {form.pacing_enabled && (
            <div className="grid grid-cols-2 gap-3 mt-3">
              <div><label className="label">Máx. comensales por slot</label><input type="number" min={1} className="input" placeholder="sin límite" value={form.max_covers_per_slot} onChange={(e) => setForm({ ...form, max_covers_per_slot: e.target.value === "" ? "" : +e.target.value })} /></div>
              <div><label className="label">Máx. reservas por slot</label><input type="number" min={1} className="input" placeholder="sin límite" value={form.max_bookings_per_slot} onChange={(e) => setForm({ ...form, max_bookings_per_slot: e.target.value === "" ? "" : +e.target.value })} /></div>
            </div>
          )}
        </div>

        <div className="border-t pt-4">
          <label className="label">Stock online (opcional)</label>
          <input type="number" min={1} className="input w-32" placeholder="= aforo total" value={form.online_max_covers} onChange={(e) => setForm({ ...form, online_max_covers: e.target.value === "" ? "" : +e.target.value })} />
          <p className="text-xs text-slate-400 mt-1">Comensales que la web puede reservar; el resto del aforo queda para teléfono/walk-in. Vacío = igual al aforo total.</p>
        </div>

        <div className="border-t pt-4 grid grid-cols-2 gap-3">
          <div>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.allow_double_turn} onChange={(e) => setForm({ ...form, allow_double_turn: e.target.checked })} /> Permitir doblar mesa</label>
            <p className="text-xs text-slate-400 mt-1">Si se desactiva, cada mesa admite una sola reserva por franja.</p>
          </div>
          <div><label className="label">Limpieza entre reservas (min)</label><input type="number" min={0} step={5} className="input" value={form.cleanup_min} onChange={(e) => setForm({ ...form, cleanup_min: +e.target.value })} /></div>
        </div>

        {shift && <DurationRules shiftId={shift.id} />}
        {!shift && <p className="text-xs text-slate-400 border-t pt-4">Guarda la franja para poder configurar duraciones por nº de comensales.</p>}

        <div className="flex justify-end gap-2"><button className="btn-ghost" onClick={onClose}>Cancelar</button><button className="btn-primary" disabled={!form.name.trim() || busy} onClick={save}>Guardar</button></div>
      </div>
    </Modal>
  );
}
