import { useMemo, useState } from "react";
import { useAuth } from "../lib/auth";
import { useBookings } from "./hooks";
import { ymdInTz, addDaysYmd, zonedDayRange, formatDate, formatTime } from "@reservas/shared";
import { PageHeader, Spinner, StatusBadge, EmptyState } from "../components/ui";

// Estados que cuentan para producir. Los cancelados y los "no recogidos" se excluyen.
const COUNTED = new Set(["pendiente", "confirmada", "listo", "completada"]);

type Row = { key: string; flavor: string; size: string; sizeKey: string; total: number; pending: number };

function summarize(bookings: any[]): { rows: Row[]; bySize: { size: string; total: number }[]; total: number } {
  const map = new Map<string, Row>();
  for (const b of bookings) {
    const flavor = b.option_label ?? b.services?.name ?? "—";
    const size = b.services?.size_label ?? "";
    const sizeKey = b.services?.size_key ?? "";
    const key = `${sizeKey}|${flavor}`;
    const r = map.get(key) ?? { key, flavor, size, sizeKey, total: 0, pending: 0 };
    r.total += 1;
    if (b.status === "pendiente") r.pending += 1;
    map.set(key, r);
  }
  const rows = [...map.values()].sort((a, b) => a.sizeKey.localeCompare(b.sizeKey) || a.flavor.localeCompare(b.flavor, "es"));
  const sizeMap = new Map<string, number>();
  for (const r of rows) sizeMap.set(r.size, (sizeMap.get(r.size) ?? 0) + r.total);
  return { rows, bySize: [...sizeMap.entries()].map(([size, total]) => ({ size, total })), total: bookings.length };
}

/** Vista de producción: cuántas tartas hay que hacer (por sabor y tamaño) y a qué hora
 * se recoge cada una, por día o por semana, imprimible. */
export function Produccion() {
  const { business } = useAuth();
  const tz = business?.timezone ?? "Europe/Madrid";
  const [mode, setMode] = useState<"day" | "week">("day");
  const [anchor, setAnchor] = useState(ymdInTz(new Date(), tz));

  const days = useMemo(() => {
    if (mode === "day") return [anchor];
    const dow = new Date(anchor + "T00:00:00Z").getUTCDay();
    const monday = addDaysYmd(anchor, -((dow + 6) % 7));
    return Array.from({ length: 7 }, (_, i) => addDaysYmd(monday, i));
  }, [mode, anchor]);

  const from = zonedDayRange(days[0], tz)[0];
  const to = zonedDayRange(days[days.length - 1], tz)[1];
  const { data, isLoading } = useBookings(from, to);

  const active = useMemo(() => (data ?? []).filter((b) => COUNTED.has(b.status)), [data]);
  const summary = useMemo(() => summarize(active), [active]);
  const byDay = useMemo(() => {
    const m: Record<string, any[]> = {};
    for (const d of days) m[d] = [];
    for (const b of active) {
      const ymd = ymdInTz(new Date(b.starts_at), tz);
      if (m[ymd]) m[ymd].push(b);
    }
    for (const d of days) m[d].sort((a, b) => a.starts_at.localeCompare(b.starts_at));
    return m;
  }, [active, days, tz]);

  const step = mode === "day" ? 1 : 7;
  const title = mode === "day"
    ? formatDate(zonedDayRange(anchor, tz)[0], tz)
    : `${formatDate(zonedDayRange(days[0], tz)[0], tz)} – ${formatDate(zonedDayRange(days[6], tz)[0], tz)}`;

  return (
    <div>
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #prod-print-area, #prod-print-area * { visibility: visible; }
          #prod-print-area { position: absolute; left: 0; top: 0; width: 100%; color: #000; background: #fff; }
          .no-print { display: none !important; }
          #prod-print-area .card { box-shadow: none; border: 1px solid #999; break-inside: avoid; }
        }
      `}</style>

      <div className="no-print">
        <PageHeader
          title="Producción"
          subtitle="Qué hay que preparar y cuándo se recoge"
          actions={
            <div className="flex items-center gap-2">
              <div className="inline-flex rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
                <button className={`px-3 py-1.5 text-sm font-medium ${mode === "day" ? "bg-brand-500 text-white" : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300"}`} onClick={() => setMode("day")}>Día</button>
                <button className={`px-3 py-1.5 text-sm font-medium ${mode === "week" ? "bg-brand-500 text-white" : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300"}`} onClick={() => setMode("week")}>Semana</button>
              </div>
              <button className="btn-ghost" onClick={() => setAnchor(addDaysYmd(anchor, -step))}>←</button>
              <button className="btn-ghost" onClick={() => setAnchor(ymdInTz(new Date(), tz))}>Hoy</button>
              <button className="btn-ghost" onClick={() => setAnchor(addDaysYmd(anchor, step))}>→</button>
              <button className="btn-primary" onClick={() => window.print()}>🖨 Imprimir</button>
            </div>
          }
        />
      </div>

      {isLoading ? (
        <div className="grid place-items-center py-20"><Spinner /></div>
      ) : (
        <div id="prod-print-area" className="space-y-5">
          <h2 className="font-bold text-lg hidden print:block">{business?.name} · Producción · {title}</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 no-print">{title}</p>

          {summary.total === 0 ? (
            <EmptyState title="Nada que preparar" hint="No hay encargos en este periodo." />
          ) : (
            <>
              <section className="card p-5">
                <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
                  <h3 className="font-semibold">A preparar {mode === "week" ? "esta semana" : "este día"}</h3>
                  <div className="text-sm text-slate-500 dark:text-slate-400">
                    <b className="text-slate-800 dark:text-slate-100">{summary.total}</b> tarta{summary.total === 1 ? "" : "s"}
                    {summary.bySize.map((s) => <span key={s.size}> · {s.total} {s.size.toLowerCase()}</span>)}
                  </div>
                </div>
                <table className="w-full text-sm">
                  <thead className="text-slate-500 dark:text-slate-400 text-left">
                    <tr><th className="py-1.5 pr-3 font-medium">Cant.</th><th className="py-1.5 pr-3 font-medium">Sabor</th><th className="py-1.5 pr-3 font-medium">Tamaño</th><th className="py-1.5 font-medium">Sin confirmar</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {summary.rows.map((r) => (
                      <tr key={r.key}>
                        <td className="py-1.5 pr-3 font-bold text-base">{r.total}×</td>
                        <td className="py-1.5 pr-3">{r.flavor}</td>
                        <td className="py-1.5 pr-3">{r.size}</td>
                        <td className="py-1.5 text-amber-700 dark:text-amber-400">{r.pending ? `${r.pending} por confirmar` : ""}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>

              {days.map((d) => {
                const list = byDay[d];
                if (!list.length) return null;
                return (
                  <section key={d} className="card p-5">
                    <h3 className="font-semibold mb-3 capitalize">
                      {formatDate(zonedDayRange(d, tz)[0], tz)} <span className="font-normal text-slate-500 dark:text-slate-400 normal-case">· {list.length} tarta{list.length === 1 ? "" : "s"}</span>
                    </h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="text-slate-500 dark:text-slate-400 text-left">
                          <tr><th className="py-1.5 pr-3 font-medium">Hora</th><th className="py-1.5 pr-3 font-medium">Tarta</th><th className="py-1.5 pr-3 font-medium">Cliente</th><th className="py-1.5 pr-3 font-medium">Notas</th><th className="py-1.5 font-medium">Estado</th></tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                          {list.map((b) => (
                            <tr key={b.id} className="align-top">
                              <td className="py-1.5 pr-3 font-bold whitespace-nowrap">{formatTime(b.starts_at, tz)}</td>
                              <td className="py-1.5 pr-3">{b.option_label ?? b.services?.name} <span className="text-slate-500 dark:text-slate-400">· {b.services?.size_label}</span></td>
                              <td className="py-1.5 pr-3">{b.customer_name} {b.customer_last_name ?? ""}<div className="text-xs text-slate-500 dark:text-slate-400">{b.customer_phone}</div></td>
                              <td className="py-1.5 pr-3 max-w-[260px]">{b.notes}</td>
                              <td className="py-1.5 whitespace-nowrap"><StatusBadge status={b.status} order /></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </section>
                );
              })}
            </>
          )}
        </div>
      )}
    </div>
  );
}
