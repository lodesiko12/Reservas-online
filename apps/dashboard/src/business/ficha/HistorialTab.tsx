import { Spinner, StatusBadge } from "../../components/ui";
import { formatDateTime } from "@reservas/shared";
import { useAuth } from "../../lib/auth";
import { generateClientReceiptPdf } from "./ReciboPdf";
import type { Customer } from "../hooks";

type HistoryRow = {
  id: string;
  starts_at: string;
  status: string;
  services: { name: string; price: number | null } | null;
};

export function HistorialTab({ customer, history, isLoading }: {
  customer: Customer; history: HistoryRow[] | undefined; isLoading: boolean;
}) {
  const { business } = useAuth();
  const tz = business?.timezone ?? "Europe/Madrid";

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-semibold text-sm">Historial</h3>
        <button
          className="btn-ghost text-xs"
          disabled={!business || !history?.length}
          onClick={() => business && generateClientReceiptPdf(business, customer, history ?? [], tz)}
        >
          📄 Generar recibo PDF
        </button>
      </div>
      {isLoading ? <Spinner /> : !history?.length ? <p className="text-sm text-slate-400 dark:text-slate-500">Sin reservas.</p> : (
        <ul className="divide-y divide-slate-100 dark:divide-slate-800 max-h-72 overflow-y-auto">
          {history.map((b) => (
            <li key={b.id} className="py-2 flex items-center justify-between text-sm">
              <span>{formatDateTime(b.starts_at, tz)} · {b.services?.name ?? "—"}</span>
              <StatusBadge status={b.status} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
