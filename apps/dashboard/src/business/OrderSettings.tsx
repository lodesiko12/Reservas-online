import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import { useBusinessId, useServices, useOrderSettings, useDayOverrides } from "./hooks";
import { Spinner, ConfirmDialog } from "../components/ui";

const WEEKDAYS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

const intOrNull = (v: string): number | null => {
  const t = v.trim();
  if (t === "") return null;
  const n = Number(t);
  return Number.isInteger(n) && n >= 0 ? n : NaN;
};

/** Ajustes del modo encargo: antelación mínima, capacidad diaria, confirmación y cancelación.
 * Todo vacío = sin límite. Solo aplican a los encargos web; el staff nunca está sujeto a ellos. */
export function OrderSettingsSection({ flash }: { flash: (m: string) => void }) {
  const bid = useBusinessId();
  const qc = useQueryClient();
  const { data: settings, isLoading } = useOrderSettings();
  const { data: services } = useServices(true);

  const sizes = useMemo(() => {
    const m = new Map<string, string>();
    for (const s of services ?? []) if (s.size_key && !m.has(s.size_key)) m.set(s.size_key, s.size_label ?? s.size_key);
    return [...m.entries()];
  }, [services]);

  const [minLead, setMinLead] = useState("");
  const [maxTotal, setMaxTotal] = useState("");
  const [bySize, setBySize] = useState<Record<string, string>>({});
  const [cancelMin, setCancelMin] = useState("");
  const [requireConfirmation, setRequireConfirmation] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (isLoading) return;
    setMinLead(settings?.min_lead_hours?.toString() ?? "");
    setMaxTotal(settings?.daily_max_total?.toString() ?? "");
    setCancelMin(settings?.cancel_min_hours?.toString() ?? "");
    setRequireConfirmation(settings?.require_confirmation ?? true);
    const raw = (settings?.daily_max_by_size ?? {}) as Record<string, number>;
    setBySize(Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, String(v)])));
  }, [settings, isLoading]);

  async function save() {
    const lead = intOrNull(minLead), total = intOrNull(maxTotal), cancel = intOrNull(cancelMin);
    if ([lead, total, cancel].some((v) => v !== null && Number.isNaN(v)) || (total !== null && total < 1)) {
      flash("Revisa los números: enteros positivos, o vacío para «sin límite».");
      return;
    }
    const sizeLimits: Record<string, number> = {};
    for (const [k, v] of Object.entries(bySize)) {
      const n = intOrNull(v);
      if (n === null) continue;
      if (Number.isNaN(n) || n < 1) { flash("Los máximos por tamaño deben ser enteros mayores que 0."); return; }
      sizeLimits[k] = n;
    }
    setBusy(true);
    const { error } = await supabase.from("order_settings").upsert({
      business_id: bid, min_lead_hours: lead, daily_max_total: total, daily_max_by_size: sizeLimits,
      require_confirmation: requireConfirmation, cancel_min_hours: cancel,
    });
    setBusy(false);
    if (error) { flash(error.message); return; }
    qc.invalidateQueries({ queryKey: ["order_settings", bid] });
    flash("Ajustes de encargos guardados");
  }

  return (
    <section className="card p-6">
      <h2 className="font-semibold mb-1">Reglas de los encargos online</h2>
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
        Vacío = sin límite. Estas reglas solo afectan a los encargos que hacen los clientes por la web; los que
        crea el staff desde el panel nunca están sujetos a ellas.
      </p>
      {isLoading ? <Spinner /> : (
        <>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Antelación mínima (horas)</label>
              <input className="input" inputMode="numeric" value={minLead} onChange={(e) => setMinLead(e.target.value)} placeholder="Sin mínimo" />
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Ej. 48 = no se puede encargar para dentro de menos de 2 días.</p>
            </div>
            <div>
              <label className="label">Máximo de tartas por día (total)</label>
              <input className="input" inputMode="numeric" value={maxTotal} onChange={(e) => setMaxTotal(e.target.value)} placeholder="Sin límite" />
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Al llegar al máximo, ese día deja de aparecer en la web.</p>
            </div>
            {sizes.map(([k, l]) => (
              <div key={k}>
                <label className="label">Máximo de tartas «{l}» por día</label>
                <input className="input" inputMode="numeric" value={bySize[k] ?? ""} onChange={(e) => setBySize({ ...bySize, [k]: e.target.value })} placeholder="Sin límite" />
              </div>
            ))}
            <div>
              <label className="label">Cancelación online hasta (horas antes)</label>
              <input className="input" inputMode="numeric" value={cancelMin} onChange={(e) => setCancelMin(e.target.value)} placeholder="Hasta la recogida" />
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Pasado ese límite el cliente debe llamar o escribir al negocio.</p>
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm mt-4">
            <input type="checkbox" checked={requireConfirmation} onChange={(e) => setRequireConfirmation(e.target.checked)} />
            Confirmar cada encargo web a mano (si no, se confirman al instante)
          </label>
          <button className="btn-primary mt-4" onClick={save} disabled={busy}>{busy ? "Guardando…" : "Guardar"}</button>
        </>
      )}
    </section>
  );
}

/** Festivos y cierres: un día concreto que usa el horario de otro día de la semana (p. ej. un festivo
 * que abre como un domingo) o que se cierra. Las vacaciones largas siguen en «Bloqueos». */
export function DayOverridesSection({ flash }: { flash: (m: string) => void }) {
  const bid = useBusinessId();
  const qc = useQueryClient();
  const { data: overrides, isLoading } = useDayOverrides();
  const [day, setDay] = useState("");
  const [mode, setMode] = useState<string>("0"); // weekday a usar, o "closed"
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);

  async function add() {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) { flash("Elige una fecha."); return; }
    setBusy(true);
    const { error } = await supabase.from("business_day_overrides").upsert({
      business_id: bid, day, use_weekday: mode === "closed" ? null : Number(mode), note: note.trim() || null,
    });
    setBusy(false);
    if (error) { flash(error.message); return; }
    setDay(""); setNote("");
    qc.invalidateQueries({ queryKey: ["business_day_overrides", bid] });
    flash("Día especial guardado");
  }
  async function remove() {
    if (!removing) return;
    const d = removing; setRemoving(null);
    const { error } = await supabase.from("business_day_overrides").delete().eq("business_id", bid).eq("day", d);
    if (error) flash(error.message); else qc.invalidateQueries({ queryKey: ["business_day_overrides", bid] });
  }

  const today = new Date().toISOString().slice(0, 10);
  const upcoming = (overrides ?? []).filter((o) => o.day >= today);

  return (
    <section className="card p-6">
      <h2 className="font-semibold mb-1">Festivos y días especiales</h2>
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
        Indica que un día concreto usa el horario de otro día (ej. un festivo que abre como un domingo) o que está cerrado.
        Para vacaciones de varios días o franjas sueltas usa «Bloqueos».
      </p>
      <div className="grid sm:grid-cols-[auto_1fr_1fr_auto] gap-3 items-end">
        <div><label className="label">Fecha</label><input type="date" className="input" value={day} onChange={(e) => setDay(e.target.value)} /></div>
        <div>
          <label className="label">Ese día…</label>
          <select className="input" value={mode} onChange={(e) => setMode(e.target.value)}>
            {[0, 6, 1, 2, 3, 4, 5].map((d) => <option key={d} value={d}>Usa el horario del {WEEKDAYS[d]}</option>)}
            <option value="closed">Cerrado</option>
          </select>
        </div>
        <div><label className="label">Nota (opcional)</label><input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ej. Día de Todos los Santos" maxLength={80} /></div>
        <button className="btn-primary" onClick={add} disabled={busy}>Añadir</button>
      </div>

      {isLoading ? <Spinner /> : upcoming.length > 0 && (
        <ul className="divide-y divide-slate-100 dark:divide-slate-800 mt-4 text-sm">
          {upcoming.map((o) => (
            <li key={o.day} className="flex items-center justify-between py-2 gap-3">
              <span>
                <b>{new Date(o.day + "T12:00:00").toLocaleDateString("es-ES", { weekday: "short", day: "numeric", month: "long", year: "numeric" })}</b>
                {" · "}{o.use_weekday === null ? "Cerrado" : `Horario del ${WEEKDAYS[o.use_weekday]}`}
                {o.note && <span className="text-slate-500 dark:text-slate-400"> · {o.note}</span>}
              </span>
              <button className="text-slate-400 hover:text-red-600" title="Quitar" onClick={() => setRemoving(o.day)}>✕</button>
            </li>
          ))}
        </ul>
      )}
      <ConfirmDialog open={!!removing} title="Quitar día especial" message="¿Quitar este día especial? Volverá a usar su horario normal." onConfirm={remove} onCancel={() => setRemoving(null)} />
    </section>
  );
}
