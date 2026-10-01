import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { formatCurrency, formatDate } from "@reservas/shared";
import { documentTotals, lineTotals, type BudgetLineInput, type CrmBudget, type CrmFiscalProfile } from "./types";

type BudgetCustomer = {
  full_name: string;
  last_name: string | null;
  nif?: string | null;
  address?: string | null;
  city?: string | null;
  province?: string | null;
  postal_code?: string | null;
};

/** Presupuesto en PDF con los datos fiscales del negocio (crm_fiscal_profile),
 * el cliente, las líneas con su IVA y los totales. Se genera en el navegador. */
export function generateBudgetPdf(
  business: { name: string },
  fiscal: CrmFiscalProfile | null | undefined,
  budget: CrmBudget,
  customer: BudgetCustomer | null,
  lines: BudgetLineInput[],
  tz: string
) {
  const doc = new jsPDF();

  // Emisor
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.text(fiscal?.legal_name || business.name, 14, 18);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  let ey = 24;
  if (fiscal?.nif) { doc.text(`NIF: ${fiscal.nif}`, 14, ey); ey += 5; }
  if (fiscal?.address) {
    const addr = doc.splitTextToSize(fiscal.address, 90) as string[];
    doc.text(addr, 14, ey);
    ey += addr.length * 5;
  }

  // Cabecera del documento
  const validUntil = new Date(new Date(budget.issued_at).getTime() + budget.valid_until_days * 86_400_000).toISOString();
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text("PRESUPUESTO", 196, 20, { align: "right" });
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`Nº: ${budget.number}`, 196, 28, { align: "right" });
  doc.text(`Fecha: ${formatDate(budget.issued_at, tz)}`, 196, 34, { align: "right" });
  doc.text(`Válido hasta: ${formatDate(validUntil, tz)}`, 196, 40, { align: "right" });

  // Cliente
  let y = Math.max(ey, 46) + 6;
  doc.setDrawColor(200);
  doc.line(14, y, 196, y);
  y += 8;
  const field = (label: string, value: string | null | undefined) => {
    if (!value) return;
    doc.setFont("helvetica", "bold");
    doc.text(label, 14, y);
    doc.setFont("helvetica", "normal");
    doc.text(value, 40, y);
    y += 6;
  };
  field("Cliente:", customer ? `${customer.full_name} ${customer.last_name ?? ""}`.trim() : "");
  field("N.I.F.:", customer?.nif);
  field("Dirección:", customer?.address);
  field("Ciudad:", [customer?.postal_code, customer?.city, customer?.province].filter(Boolean).join(" · "));

  // Líneas
  const valid = lines.filter((l) => l.concept.trim());
  autoTable(doc, {
    startY: y + 4,
    head: [["CONCEPTO", "CANT.", "PRECIO", "DTO.", "IVA", "TOTAL"]],
    body: valid.map((l) => [
      l.concept,
      String(Number(l.quantity)),
      formatCurrency(Number(l.unit_price)),
      Number(l.discount_pct) ? `${Number(l.discount_pct)}%` : "—",
      `${Number(l.vat_rate)}%`,
      formatCurrency(lineTotals({ ...l, quantity: Number(l.quantity), unit_price: Number(l.unit_price), discount_pct: Number(l.discount_pct), vat_rate: Number(l.vat_rate) }).total),
    ]),
    headStyles: { fillColor: [230, 230, 230], textColor: 20 },
    columnStyles: { 1: { halign: "right" }, 2: { halign: "right" }, 3: { halign: "right" }, 4: { halign: "right" }, 5: { halign: "right" } },
  });

  // Totales
  const totals = documentTotals(valid.map((l) => ({ ...l, quantity: Number(l.quantity), unit_price: Number(l.unit_price), discount_pct: Number(l.discount_pct), vat_rate: Number(l.vat_rate) })));
  let ty = ((doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y) + 10;
  if (ty > 260) { doc.addPage(); ty = 20; }
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text("Base imponible", 150, ty, { align: "right" }); doc.text(formatCurrency(totals.base), 196, ty, { align: "right" }); ty += 6;
  doc.text("IVA", 150, ty, { align: "right" }); doc.text(formatCurrency(totals.iva), 196, ty, { align: "right" }); ty += 7;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("TOTAL", 150, ty, { align: "right" }); doc.text(formatCurrency(totals.total), 196, ty, { align: "right" }); ty += 12;

  // Notas y pie
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  if (budget.notes) {
    const note = doc.splitTextToSize(`Notas: ${budget.notes}`, 182) as string[];
    if (ty + note.length * 5 > 280) { doc.addPage(); ty = 20; }
    doc.text(note, 14, ty);
    ty += note.length * 5 + 4;
  }
  if (fiscal?.iban_note) {
    const iban = doc.splitTextToSize(fiscal.iban_note, 182) as string[];
    if (ty + iban.length * 5 > 280) { doc.addPage(); ty = 20; }
    doc.text(iban, 14, ty);
  }

  const who = customer ? customer.full_name.trim().toLowerCase().replace(/\s+/g, "-") : "cliente";
  doc.save(`presupuesto-${budget.number.replace(/[^\w-]+/g, "-")}-${who}.pdf`);
}
