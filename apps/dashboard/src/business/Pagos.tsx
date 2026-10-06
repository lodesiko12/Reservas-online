import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import { useBusinessId } from "./hooks";
import { formatDate, formatTime } from "@reservas/shared";
import { PageHeader, Spinner, EmptyState, StatCard } from "../components/ui";

type PagoRow = {
  id: string; starts_at: string; ends_at: string; paid_at: string | null; status: string;
  customer_id: string | null; customer_name: string; customer_last_name: string | null;
  services: { name: string; price: number | null } | null;
};

const eur = (n: number) => new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(n);

/** Sesiones ya pasadas (no canceladas ni no-show) que aún no se han cobrado,
 * y las cobradas en los últimos 30 días por si hay que deshacer un marcado. */
function usePagos(view: "pendientes" | "cobradas") {
  const bid = useBusinessId();
  return useQuery({
    queryKey: ["pagos", bid, view],
    enabled: !!bid,
    queryFn: async () => {
      let q = supabase
        .from("bookings")
        .select("id, starts_at, ends_at, paid_at, status, customer_id, customer_name, customer_last_name, services(name, price)")
        .eq("business_id", bid)
        .eq("type", "citas")
        .not("status", "in", "(cancelada,no_show)")
        .lte("starts_at", new Date().toISOString());
      if (view === "pendientes") {
        q = q.is("paid_at", null).order("starts_at", { ascending: false }).limit(1000);
      } else {
        const since = new Date(Date.now() - 30 * 86400000).toISOString();
        q = q.gte("paid_at", since).order("paid_at", { ascending: false }).limit(1000);
      }
      const { data, error } = await q;
      if (error) throw error;
      return data as unknown as PagoRow[];
    },
  });
}

export function Pagos() {
  const { business } = useAuth();
  const tz = business?.timezone ?? "Europe/Madrid";
  const qc = useQueryClient();
  const [view, setView] = useState<"pendientes" | "cobradas">("pendientes");
  const { data, isLoading } = usePagos(view);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const groups = useMemo(() => {
    const term = search.trim().toLowerCase();
    const map = new Map<string, { key: string; name: string; rows: PagoRow[] }>();
    for (const r of data ?? []) {
      const name = `${r.customer_name} ${r.customer_last_name ?? ""}`.trim();
      if (term && !name.toLowerCase().includes(term)) continue;
      const key = r.customer_id ?? `n:${name.toLowerCase()}`;
      if (!map.has(key)) map.set(key, { key, name, rows: [] });
      map.get(key)!.rows.push(r);
    }
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, "es"));
  }, [data, search]);

  const total = (rows: PagoRow[]) => rows.reduce((s, r) => s + (r.services?.price ?? 0), 0);
  const all = groups.flatMap((g) => g.rows);
  const withoutPrice = all.some((r) => r.services?.price == null);

  async function setPaid(ids: string[], paid: boolean) {
    setBusy(true); setError(null);
    const { error } = await supabase.from("bookings").update({ paid_at: paid ? new Date().toISOString() : null }).in("id", ids);
    setBusy(false);
    if (error) { setError(error.message); return; }
    qc.invalidateQueries({ queryKey: ["pagos"] });
    qc.invalidateQueries({ queryKey: ["bookings"] });
  }

  const pendiente = view === "pendientes";

  return (
    <div>
      <PageHeader title="Pagos" subtitle="Quién te debe sesiones y cuáles has cobrado" />
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <button className={pendiente ? "btn-primary" : "btn-ghost"} onClick={() => setView("pendientes")}>Pendientes</button>
        <button className={!pendiente ? "btn-primary" : "btn-ghost"} onClick={() => setView("cobradas")}>Cobradas (30 días)</button>
        <input className="input max-w-xs ml-auto" placeholder="Buscar paciente…" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>
      {error && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-3">{error}</div>}

      {isLoading ? (
        <div className="grid place-items-center py-20"><Spinner /></div>
      ) : !groups.length ? (
        <EmptyState
          title={pendiente ? "No hay sesiones pendientes de cobro" : "No hay sesiones cobradas en los últimos 30 días"}
          hint={pendiente ? "Las sesiones pasadas aparecen aquí hasta que las marques como pagadas." : undefined}
        />
      ) : (
        <div className="space-y-4">
          <div className="grid sm:grid-cols-3 gap-3">
            <StatCard label={pendiente ? "Sesiones pendientes" : "Sesiones cobradas"} value={all.length} />
            <StatCard label="Pacientes" value={groups.length} />
            <StatCard label={pendiente ? "Total pendiente" : "Total cobrado"} value={eur(total(all))} hint={withoutPrice ? "Hay servicios sin precio: no suman" : undefined} />
          </div>
          {groups.map((g) => (
            <div key={g.key} className="card">
              <div className="flex items-center gap-3 px-5 py-3 border-b border-slate-100 dark:border-slate-800 flex-wrap">
                <div className="font-semibold">{g.name}</div>
                <span className="text-sm text-slate-500 dark:text-slate-400">
                  {g.rows.length} {g.rows.length === 1 ? "sesión" : "sesiones"} · {eur(total(g.rows))}
                </span>
                <button className="btn-primary text-xs ml-auto" disabled={busy} onClick={() => setPaid(g.rows.map((r) => r.id), pendiente)}>
                  {pendiente ? "Marcar todas pagadas" : "Deshacer todas"}
                </button>
              </div>
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {g.rows.map((r) => (
                  <div key={r.id} className="flex items-center gap-3 px-5 py-2.5 text-sm">
                    <div className="flex-1 min-w-0">
                      <span className="font-medium">{formatDate(r.starts_at, tz)}</span>
                      <span className="text-slate-500 dark:text-slate-400"> · {formatTime(r.starts_at, tz)} · {r.services?.name ?? "—"}</span>
                    </div>
                    <div className="text-slate-600 dark:text-slate-300 shrink-0">{r.services?.price != null ? eur(r.services.price) : "—"}</div>
                    <button className="btn-ghost text-xs shrink-0" disabled={busy} onClick={() => setPaid([r.id], pendiente)}>
                      {pendiente ? "Pagada" : "Deshacer"}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
