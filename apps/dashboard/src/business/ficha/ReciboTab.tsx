import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../lib/auth";
import { Spinner, StatusBadge } from "../../components/ui";
import { formatDateTime, formatCurrency, ymdInTz } from "@reservas/shared";
import { generateClientReceiptPdf } from "./ReciboPdf";
import { buildProfessionalInvoice } from "./ProfessionalInvoicePdf";
import type { Customer } from "../hooks";
import { FileDown } from "lucide-react";

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

  // Si la profesional responsable del paciente tiene factura propia, sale la suya.
  const professionalId = customer.professional_id;
  const profile = useQuery({
    queryKey: ["invoice-profile", professionalId],
    enabled: !!professionalId,
    queryFn: async () => {
      const { data, error } = await supabase.from("professional_invoice_profiles")
        .select("*").eq("professional_id", professionalId!).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  // Hasta saber cuál toca no se puede generar: no debe salir por error con los datos de otra persona.
  const profileReady = !professionalId || profile.isSuccess;

  function generate() {
    if (!business) return;
    if (profile.data) {
      const number = invoiceNumber.trim();
      const name = customer.full_name.trim().toLowerCase().replace(/\s+/g, "-");
      buildProfessionalInvoice(profile.data, customer, history ?? [], ymdInTz(new Date(), tz), number)
        .save(`factura-${number.replace(/[\\/]/g, "-")}-${name}.pdf`);
    } else {
      generateClientReceiptPdf(business, customer, history ?? [], tz, invoiceNumber.trim());
    }
  }

  return (
    <div>
      <h3 className="font-semibold text-sm mb-3">Recibo</h3>
      <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
        {profile.isError ? "No se ha podido comprobar qué factura corresponde. Recarga la página."
          : !profileReady ? "Comprobando qué factura corresponde…"
          : `Genera la factura de ${profile.data?.issuer_name ?? "Ana Sánchez"} con las sesiones completadas.`}
      </p>
      <div className="flex items-center gap-2 mb-3">
        <input
          className="input text-xs max-w-[160px]"
          placeholder="Nº factura (ej. 141-26)"
          value={invoiceNumber}
          onChange={(e) => setInvoiceNumber(e.target.value)}
        />
        <button
          className="btn-ghost text-xs"
          disabled={!business || !profileReady || !completed.length || !invoiceNumber.trim()}
          onClick={generate}
        >
          <FileDown size={15} strokeWidth={1.75} aria-hidden="true" /> Generar factura PDF
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
