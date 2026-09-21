import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { formatCurrency, formatDateTime } from "@reservas/shared";

type HistoryRow = {
  starts_at: string;
  status: string;
  services: { name: string; price: number | null } | null;
};

/** Recibo/resumen en PDF de las sesiones completadas de un cliente. Documento
 * generado 100% en el navegador, sin validez fiscal (sin numeración ni datos
 * tributarios) — solo un resumen descargable para el cliente. */
export function generateClientReceiptPdf(
  business: { name: string },
  customer: { full_name: string; last_name: string | null; nif: string | null },
  history: HistoryRow[],
  tz: string
) {
  const doc = new jsPDF();
  doc.setFontSize(16);
  doc.text(business.name, 14, 18);
  doc.setFontSize(10);
  doc.setTextColor(120);
  doc.text("Resumen de sesiones (documento sin validez fiscal)", 14, 25);
  doc.setTextColor(0);
  doc.text(`Cliente: ${customer.full_name} ${customer.last_name ?? ""}`.trim(), 14, 34);
  if (customer.nif) doc.text(`NIF/NIE: ${customer.nif}`, 14, 40);

  const completed = history.filter((b) => b.status === "completada");
  const rows = completed.map((b) => [
    formatDateTime(b.starts_at, tz),
    b.services?.name ?? "—",
    formatCurrency(b.services?.price ?? null),
  ]);
  const total = completed.reduce((sum, b) => sum + (b.services?.price ?? 0), 0);

  autoTable(doc, {
    startY: customer.nif ? 46 : 40,
    head: [["Fecha", "Sesión", "Importe"]],
    body: rows.length ? rows : [["—", "Sin sesiones completadas", formatCurrency(0)]],
    foot: [["", "Total", formatCurrency(total)]],
  });

  const filename = `recibo-${customer.full_name.trim().toLowerCase().replace(/\s+/g, "-")}.pdf`;
  doc.save(filename);
}
