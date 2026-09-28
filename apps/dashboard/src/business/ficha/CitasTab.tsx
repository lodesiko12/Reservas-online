import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../lib/auth";
import { useBusinessId } from "../hooks";
import { EventModal } from "../crm/AgendaInterna";
import { formatDateTime } from "@reservas/shared";
import { Spinner, EmptyState } from "../../components/ui";
import type { Customer } from "../hooks";

const TYPE_LABEL: Record<string, string> = { visita: "Visita", llamada: "Llamada", trabajo: "Trabajo", otro: "Otro" };

export function CitasTab({ customer }: { customer: Customer }) {
  const bid = useBusinessId();
  const { business } = useAuth();
  const tz = business?.timezone ?? "Europe/Madrid";
  const qc = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);

  const { data: events, isLoading } = useQuery({
    queryKey: ["crm_customer_events", bid, customer.id],
    enabled: !!bid,
    queryFn: async () => {
      const { data, error } = await supabase.from("crm_events").select("*")
        .eq("business_id", bid).eq("customer_id", customer.id).order("starts_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  function invalidate() {
    qc.invalidateQueries({ queryKey: ["crm_customer_events", bid, customer.id] });
    qc.invalidateQueries({ queryKey: ["crm_events", bid] });
  }

  return (
    <div>
      <div className="flex justify-end mb-3">
        <button className="btn-ghost text-xs" onClick={() => setCreating(true)}>+ Nueva cita</button>
      </div>
      {isLoading ? <Spinner /> : !events?.length ? (
        <EmptyState title="Sin citas registradas" hint="Crea visitas, llamadas o trabajos para este cliente." />
      ) : (
        <ul className="divide-y divide-slate-100 dark:divide-slate-800 max-h-80 overflow-y-auto">
          {events.map((ev) => (
            <li key={ev.id} className="py-2 flex items-center justify-between text-sm cursor-pointer" onClick={() => setEditing(ev)}>
              <span>{formatDateTime(ev.starts_at, tz)} · {ev.title}</span>
              <span className="badge bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">{TYPE_LABEL[ev.type]}</span>
            </li>
          ))}
        </ul>
      )}
      {creating && <EventModal customerId={customer.id} onClose={() => setCreating(false)} onChanged={() => { invalidate(); setCreating(false); }} />}
      {editing && <EventModal event={editing} onClose={() => setEditing(null)} onChanged={() => { invalidate(); setEditing(null); }} />}
    </div>
  );
}
