import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../lib/auth";
import { Spinner, StatusBadge } from "../../components/ui";
import { formatDateTime, formatCurrency } from "@reservas/shared";
import { generateClientReceiptPdf } from "./ReciboPdf";
import type { Customer } from "../hooks";

type HistoryRow = {
  id: string;
  starts_at: string;
  status: string;
  services: { name: string; price: number | null } | null;
};

/** Recibo del cliente: lista de sesiones (reservas) completadas con su
 * precio, y un botón para descargar el resumen en PDF (no fiscal). */
export function ReciboTab({ customer }: { customer: Customer }) {
  const { business } = useAuth();
  const tz = business?.timezone ?? "Europe/Madrid";
  const [invoiceNumber, setInvoiceNumber] = useState("");

  const { data: history, isLoading } = useQuery({
    queryKey: ["customer-history", customer.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("bookings")
        .select("*, services(name, price)").eq("customer_id", customer.id)
        .order("starts_at", { ascending: false }).limit(200);
      if (error) throw error;
      return data as unknown as HistoryRow[];
    },
  });

  const completed = (history ?? []).filter((b) => b.status === "completada");
  const total = completed.reduce((sum, b) => sum + (b.services?.price ?? 0), 0);

  return (
    <div>
      <h3 className="font-semibold text-sm mb-3">Recibo</h3>
      <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">Genera la factura en el formato de Ana Sánchez con las sesiones completadas.</p>
      <div className="flex items-center gap-2 mb-3">
        <input
          className="input text-xs max-w-[160px]"
          placeholder="Nº factura (ej. 141-26)"
          value={invoiceNumber}
          onChange={(e) => setInvoiceNumber(e.target.value)}
        />
        <button
          className="btn-ghost text-xs"
          disabled={!business || !completed.length || !invoiceNumber.trim()}
          onClick={() => business && generateClientReceiptPdf(business, customer, history ?? [], tz, invoiceNumber.trim())}
        >
          📄 Generar factura PDF
        </button>
      </div>
      {isLoading ? <Spinner /> : !history?.length ? (
        <p className="text-sm text-slate-400 dark:text-slate-500">Sin reservas.</p>
      ) : (
        <>
          <ul className="divide-y divide-slate-100 dark:divide-slate-800 max-h-72 overflow-y-auto">
            {history.map((b) => (
              <li key={b.id} className="py-2 flex items-center justify-between text-sm">
                <span>{formatDateTime(b.starts_at, tz)} · {b.services?.name ?? "—"}</span>
                <div className="flex items-center gap-2">
                  {b.status === "completada" && <span className="text-slate-500 dark:text-slate-400">{formatCurrency(b.services?.price ?? null)}</span>}
                  <StatusBadge status={b.status} />
                </div>
              </li>
            ))}
          </ul>
          <div className="flex justify-between text-sm font-semibold mt-3 pt-3 border-t border-slate-100 dark:border-slate-800">
            <span>Total ({completed.length} sesión{completed.length === 1 ? "" : "es"})</span>
            <span>{formatCurrency(total)}</span>
          </div>
        </>
      )}
    </div>
  );
}
