import { useState } from "react";
import { WEEKDAYS_ES } from "@reservas/shared";

export type Win = { weekday: number; start_time: string; end_time: string };

const ALL_WEEKDAYS = [0, 1, 2, 3, 4, 5, 6];
const WEEKDAY_LETTERS = ["D", "L", "M", "X", "J", "V", "S"];

function dedupe(wins: Win[]): Win[] {
  const seen = new Set<string>();
  return wins.filter((w) => {
    const key = `${w.weekday}|${w.start_time}|${w.end_time}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Editor de franjas horarias semanales (weekday + start/end), reutilizado
 * para el horario de apertura del negocio, el de cada profesional y la
 * disponibilidad propia de cada servicio. Incluye dos atajos para no tener
 * que rellenar día a día:
 *   - "Copiar a todos los días": repite la franja de una fila en el resto.
 *   - "Rellenar rápido": marca los días activos + una franja común y
 *     sustituye todo el horario actual de una vez.
 */
export function WindowsEditor({ wins, onChange }: { wins: Win[]; onChange: (w: Win[]) => void }) {
  const [quickOpen, setQuickOpen] = useState(false);

  function add() { onChange([...wins, { weekday: 1, start_time: "09:00", end_time: "14:00" }]); }
  function update(i: number, patch: Partial<Win>) { onChange(wins.map((w, j) => (j === i ? { ...w, ...patch } : w))); }
  function del(i: number) { onChange(wins.filter((_, j) => j !== i)); }

  function copyToAllDays(i: number) {
    const w = wins[i];
    const rest = ALL_WEEKDAYS.filter((wd) => wd !== w.weekday);
    onChange(dedupe([...wins, ...rest.map((wd) => ({ weekday: wd, start_time: w.start_time, end_time: w.end_time }))]));
  }

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        {wins.map((w, i) => (
          <div key={i} className="flex items-center gap-2">
            <select className="input py-1.5" value={w.weekday} onChange={(e) => update(i, { weekday: +e.target.value })}>
              {WEEKDAYS_ES.map((d, idx) => <option key={idx} value={idx}>{d}</option>)}
            </select>
            <input type="time" className="input py-1.5 w-28" value={w.start_time} onChange={(e) => update(i, { start_time: e.target.value })} />
            <span className="text-slate-400 dark:text-slate-500">–</span>
            <input type="time" className="input py-1.5 w-28" value={w.end_time} onChange={(e) => update(i, { end_time: e.target.value })} />
            <button type="button" className="text-slate-400 dark:text-slate-500 hover:text-brand-600 text-xs whitespace-nowrap" title="Copiar esta franja a todos los días" onClick={() => copyToAllDays(i)}>
              ⧉ a todos
            </button>
            <button type="button" className="text-slate-400 dark:text-slate-500 hover:text-red-600" onClick={() => del(i)}>✕</button>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-3">
        <button type="button" className="btn-ghost text-xs" onClick={add}>+ Añadir franja</button>
        <button type="button" className="text-xs text-brand-600 hover:underline" onClick={() => setQuickOpen((v) => !v)}>
          {quickOpen ? "Ocultar relleno rápido" : "⚡ Rellenar rápido"}
        </button>
      </div>
      {quickOpen && <QuickFill wins={wins} onChange={onChange} onDone={() => setQuickOpen(false)} />}
    </div>
  );
}

function QuickFill({ wins, onChange, onDone }: { wins: Win[]; onChange: (w: Win[]) => void; onDone: () => void }) {
  const [days, setDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [start, setStart] = useState("09:00");
  const [end, setEnd] = useState("18:00");
  const [splitLunch, setSplitLunch] = useState(false);
  const [start2, setStart2] = useState("16:00");
  const [end2, setEnd2] = useState("20:00");

  function toggleDay(wd: number) {
    setDays((d) => (d.includes(wd) ? d.filter((x) => x !== wd) : [...d, wd]));
  }

  function apply() {
    if (wins.length > 0 && !confirm("Esto sustituye el horario actual por la(s) franja(s) seleccionada(s) en esos días. ¿Continuar?")) return;
    const rows = days.flatMap((wd) => {
      const r = [{ weekday: wd, start_time: start, end_time: end }];
      if (splitLunch) r.push({ weekday: wd, start_time: start2, end_time: end2 });
      return r;
    });
    onChange(rows);
    onDone();
  }

  return (
    <div className="border border-slate-200 dark:border-slate-700 rounded-lg p-3 bg-slate-50 dark:bg-slate-800/60 space-y-3">
      <div>
        <div className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">Días activos</div>
        <div className="flex gap-1.5">
          {WEEKDAY_LETTERS.map((letter, wd) => (
            <button
              type="button" key={wd} onClick={() => toggleDay(wd)}
              className={`w-8 h-8 rounded-full text-xs font-semibold border ${days.includes(wd) ? "bg-brand-500 text-white border-brand-500" : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400"}`}
            >
              {letter}
            </button>
          ))}
        </div>
      </div>
      <div>
        {splitLunch && <div className="text-xs text-slate-400 dark:text-slate-500 mb-1">Mañana</div>}
        <div className="flex items-center gap-2">
          <input type="time" className="input py-1.5 w-28" value={start} onChange={(e) => setStart(e.target.value)} />
          <span className="text-slate-400 dark:text-slate-500">–</span>
          <input type="time" className="input py-1.5 w-28" value={end} onChange={(e) => setEnd(e.target.value)} />
        </div>
      </div>
      {splitLunch ? (
        <div>
          <div className="text-xs text-slate-400 dark:text-slate-500 mb-1">Tarde</div>
          <div className="flex items-center gap-2">
            <input type="time" className="input py-1.5 w-28" value={start2} onChange={(e) => setStart2(e.target.value)} />
            <span className="text-slate-400 dark:text-slate-500">–</span>
            <input type="time" className="input py-1.5 w-28" value={end2} onChange={(e) => setEnd2(e.target.value)} />
            <button type="button" className="text-slate-400 dark:text-slate-500 hover:text-red-600 text-xs" onClick={() => setSplitLunch(false)}>✕ quitar</button>
          </div>
        </div>
      ) : (
        <button type="button" className="text-xs text-brand-600 hover:underline" onClick={() => setSplitLunch(true)}>
          + Añadir segunda franja (p. ej. cierre para comer)
        </button>
      )}
      <button type="button" className="btn-primary text-xs" disabled={!days.length} onClick={apply}>
        Aplicar (sustituye el horario actual)
      </button>
    </div>
  );
}
