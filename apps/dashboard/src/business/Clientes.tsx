import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import { useBusinessId, type Customer } from "./hooks";
import { formatDateTime } from "@reservas/shared";
import { PageHeader, Spinner, Modal, StatusBadge, EmptyState } from "../components/ui";

export function Clientes() {
  const bid = useBusinessId();
  const [q, setQ] = useState("");
  const [sel, setSel] = useState<Customer | null>(null);

  const { data: customers, isLoading } = useQuery({
    queryKey: ["customers", bid, q],
    enabled: !!bid,
    queryFn: async () => {
      let query = supabase.from("customers").select("*").eq("business_id", bid).order("updated_at", { ascending: false }).limit(200);
      if (q.trim()) query = query.ilike("full_name", `%${q.trim()}%`);
      const { data, error } = await query;
      if (error) throw error;
      return data as Customer[];
    },
  });

  return (
    <div>
      <PageHeader title="Clientes" subtitle="Histórico y ficha de cada cliente" />
      <div className="mb-4 max-w-sm">
        <input className="input" placeholder="Buscar por nombre…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      {isLoading ? <div className="grid place-items-center py-20"><Spinner /></div>
        : !customers?.length ? <EmptyState title="Sin clientes todavía" />
        : (
          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 text-left">
                <tr>
                  <th className="px-5 py-3 font-medium">Nombre</th>
                  <th className="px-5 py-3 font-medium">Teléfono</th>
                  <th className="px-5 py-3 font-medium">Reservas</th>
                  <th className="px-5 py-3 font-medium">No-shows</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {customers.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50 cursor-pointer" onClick={() => setSel(c)}>
                    <td className="px-5 py-3 font-medium">{c.full_name} {c.last_name ?? ""}</td>
                    <td className="px-5 py-3 text-slate-500">{c.phone ?? "—"}</td>
                    <td className="px-5 py-3">{c.bookings_count}</td>
                    <td className="px-5 py-3">{c.no_show_count > 0 ? <span className="text-red-600 font-semibold">{c.no_show_count}</span> : 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

      {sel && <CustomerModal customer={sel} onClose={() => setSel(null)} />}
    </div>
  );
}

function CustomerModal({ customer, onClose }: { customer: Customer; onClose: () => void }) {
  const { business } = useAuth();
  const tz = business?.timezone ?? "Europe/Madrid";
  const { data: history, isLoading } = useQuery({
    queryKey: ["customer-history", customer.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("bookings")
        .select("*, services(name)").eq("customer_id", customer.id)
        .order("starts_at", { ascending: false }).limit(50);
      if (error) throw error;
      return data as any[];
    },
  });

  return (
    <Modal open onClose={onClose} title={`${customer.full_name} ${customer.last_name ?? ""}`} width="max-w-xl">
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="card p-3 text-center"><div className="text-2xl font-bold">{customer.bookings_count}</div><div className="text-xs text-slate-500">Reservas</div></div>
        <div className="card p-3 text-center"><div className="text-2xl font-bold text-red-600">{customer.no_show_count}</div><div className="text-xs text-slate-500">No-shows</div></div>
        <div className="card p-3 text-center"><div className="text-sm font-semibold mt-1">{customer.phone ?? "—"}</div><div className="text-xs text-slate-500">{customer.email ?? "Sin email"}</div></div>
      </div>
      <h3 className="font-semibold text-sm mb-2">Historial</h3>
      {isLoading ? <Spinner /> : !history?.length ? <p className="text-sm text-slate-400">Sin reservas.</p> : (
        <ul className="divide-y divide-slate-100 max-h-72 overflow-y-auto">
          {history.map((b) => (
            <li key={b.id} className="py-2 flex items-center justify-between text-sm">
              <span>{formatDateTime(b.starts_at, tz)} · {b.services?.name ?? "—"}</span>
              <StatusBadge status={b.status} />
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}
