import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../lib/auth";
import { useBusinessId } from "../hooks";
import { usePipelineStages, useCrmCards, customerLabel } from "./hooks";
import { formatCurrency, formatDateTime, ymdInTz, zonedDayRange, addDaysYmd } from "@reservas/shared";
import { PageHeader, Spinner, StatCard, EmptyState } from "../../components/ui";

/** Resumen mínimo viable para negocios tipo autónomo: no hay reservas online
 * (Dashboard.tsx genérico no aplica), así que mostramos lo relevante del CRM:
 * tarjetas activas, presupuestos pendientes, facturas por cobrar y próximos
 * eventos de la agenda interna. */
export function ResumenAutonomo() {
  const bid = useBusinessId();
  const { business } = useAuth();
  const tz = business?.timezone ?? "Europe/Madrid";
  const { data: stages, isLoading: loadingStages } = usePipelineStages();
  const { data: cards, isLoading: loadingCards } = useCrmCards();

  const { data: budgets } = useQuery({
    queryKey: ["crm_budgets", bid, "enviado-resumen"],
    enabled: !!bid,
    queryFn: async () => {
      const { data, error } = await supabase.from("crm_budgets").select("id").eq("business_id", bid).eq("status", "enviado");
      if (error) throw error;
      return data;
    },
  });

  const { data: invoices } = useQuery({
    queryKey: ["crm_invoices", bid, "emitida-resumen"],
    enabled: !!bid,
    queryFn: async () => {
      const { data, error } = await supabase.from("crm_invoices").select("*, crm_invoice_lines(quantity, unit_price, discount_pct, vat_rate)").eq("business_id", bid).eq("status", "emitida");
      if (error) throw error;
      return data as any[];
    },
  });

  const [from, to] = zonedDayRange(ymdInTz(new Date(), tz), tz);
  const weekTo = zonedDayRange(addDaysYmd(ymdInTz(new Date(), tz), 7), tz)[1];
  const { data: upcoming, isLoading: loadingEvents } = useQuery({
    queryKey: ["crm_events", bid, "upcoming", from, weekTo],
    enabled: !!bid,
    queryFn: async () => {
      const { data, error } = await supabase.from("crm_events").select("*, customers(full_name, last_name)")
        .eq("business_id", bid).gte("starts_at", from).lt("starts_at", weekTo).order("starts_at").limit(8);
      if (error) throw error;
      return data as any[];
    },
  });

  const pendingInvoicesTotal = (invoices ?? []).reduce((sum, inv) => {
    const base = (inv.crm_invoice_lines ?? []).reduce((s: number, l: any) => s + Number(l.quantity) * Number(l.unit_price) * (1 - Number(l.discount_pct) / 100) * (1 + Number(l.vat_rate) / 100), 0);
    return sum + base;
  }, 0);

  const cardsByStage: Record<string, number> = {};
  for (const c of cards ?? []) cardsByStage[c.stage_id] = (cardsByStage[c.stage_id] ?? 0) + 1;

  return (
    <div>
      <PageHeader title="Resumen" subtitle="Tu actividad de esta semana" />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <StatCard label="Tarjetas activas" value={loadingCards ? "…" : cards?.length ?? 0} />
        <StatCard label="Presupuestos enviados" value={budgets?.length ?? 0} />
        <StatCard label="Facturas por cobrar" value={formatCurrency(pendingInvoicesTotal)} />
        <StatCard label="Eventos próximos 7 días" value={loadingEvents ? "…" : upcoming?.length ?? 0} />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <section className="card p-5">
          <h2 className="font-semibold mb-3">Pipeline por etapa</h2>
          {loadingStages ? <Spinner /> : !stages?.length ? (
            <EmptyState title="Configura tu pipeline" hint="Ve a Pipeline para crear tu primera etapa." action={<Link className="btn-primary" to="/app/pipeline">Ir a Pipeline</Link>} />
          ) : (
            <ul className="space-y-2">
              {stages.slice().sort((a, b) => a.position - b.position).map((s) => (
                <li key={s.id} className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ background: s.color }} />{s.name}</span>
                  <span className="font-semibold">{cardsByStage[s.id] ?? 0}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card p-5">
          <h2 className="font-semibold mb-3">Próximos eventos</h2>
          {loadingEvents ? <Spinner /> : !upcoming?.length ? (
            <EmptyState title="Sin eventos esta semana" action={<Link className="btn-primary" to="/app/agenda">Ir a Agenda</Link>} />
          ) : (
            <ul className="space-y-2">
              {upcoming.map((ev) => (
                <li key={ev.id} className="text-sm flex justify-between gap-2">
                  <span className="truncate">{ev.title} · {customerLabel(ev.customers)}</span>
                  <span className="text-slate-400 dark:text-slate-500 shrink-0">{formatDateTime(ev.starts_at, tz)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
