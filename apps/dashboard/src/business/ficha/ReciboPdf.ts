import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { formatCurrency, formatDateTime } from "@reservas/shared";

type HistoryRow = {
  starts_at: string;
  status: string;
  services: { name: string; price: number | null } | null;
};

type ReceiptCustomer = {
  full_name: string;
  last_name: string | null;
  nif: string | null;
  address: string | null;
  city: string | null;
  province: string | null;
  postal_code: string | null;
};

// Datos fiscales fijos de Ana Sánchez (único negocio que usa esta factura
// hoy). Si en el futuro otro negocio psicólogo necesita lo mismo, sacar
// esto a business_integrations en vez de tocar más negocios aquí.
const PROFESSIONAL = {
  name: "ANA SÁNCHEZ LÓPEZ",
  title: "PSICÓLOGA",
  colegiado: "COLEGIADO CM01841",
  dni: "D.N.I. 74.513.645-Q",
  addressLine1: "C/ ALBACETE, 10",
  addressLine2: "02640 ALMANSA",
};

/** Factura en PDF de las sesiones completadas de un cliente, con el
 * formato real que usa Ana Sánchez fuera de Turnigo (plantilla ANA.docx).
 * El número de factura se pide a mano en el momento de generar, porque
 * no hay numeración automática todavía. */
export function generateClientReceiptPdf(
  business: { name: string },
  customer: ReceiptCustomer,
  history: HistoryRow[],
  tz: string,
  invoiceNumber: string
) {
  const doc = new jsPDF();

  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.text(PROFESSIONAL.name, 14, 18);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(PROFESSIONAL.title, 14, 24);
  doc.text(PROFESSIONAL.colegiado, 14, 29);
  doc.text(PROFESSIONAL.dni, 14, 34);
  doc.text(PROFESSIONAL.addressLine1, 14, 39);
  doc.text(PROFESSIONAL.addressLine2, 14, 44);

  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text("FACTURA", 196, 20, { align: "right" });
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  const today = formatDateTime(new Date().toISOString(), tz).split(",")[0] ?? "";
  doc.text(`Fecha: ${today}`, 196, 28, { align: "right" });
  doc.text(`Nº Factura: ${invoiceNumber}`, 196, 34, { align: "right" });

  let y = 56;
  doc.setDrawColor(200);
  doc.line(14, y, 196, y);
  y += 8;

  doc.setFont("helvetica", "bold");
  doc.text("Nombre:", 14, y);
  doc.setFont("helvetica", "normal");
  doc.text(`${customer.full_name} ${customer.last_name ?? ""}`.trim(), 40, y);
  y += 6;
  if (customer.nif) {
    doc.setFont("helvetica", "bold");
    doc.text("N.I.F.:", 14, y);
    doc.setFont("helvetica", "normal");
    doc.text(customer.nif, 40, y);
    y += 6;
  }
  if (customer.address) {
    doc.setFont("helvetica", "bold");
    doc.text("Dirección:", 14, y);
    doc.setFont("helvetica", "normal");
    doc.text(customer.address, 40, y);
    y += 6;
  }
  const place = [customer.city, customer.province].filter(Boolean).join(", ");
  if (place) {
    doc.setFont("helvetica", "bold");
    doc.text("Ciudad:", 14, y);
    doc.setFont("helvetica", "normal");
    doc.text(place, 40, y);
    y += 6;
  }
  if (customer.postal_code) {
    doc.setFont("helvetica", "bold");
    doc.text("C.P.:", 14, y);
    doc.setFont("helvetica", "normal");
    doc.text(customer.postal_code, 40, y);
    y += 6;
  }

  const completed = history.filter((b) => b.status === "completada");
  const rows = completed.map((b) => [
    `${formatDateTime(b.starts_at, tz)} · ${b.services?.name ?? "Sesión de terapia individual"}`,
    formatCurrency(b.services?.price ?? null),
  ]);
  const total = completed.reduce((sum, b) => sum + (b.services?.price ?? 0), 0);

  autoTable(doc, {
    startY: y + 4,
    head: [["DESCRIPCIÓN", "HONORARIOS"]],
    body: rows.length ? rows : [["Sin sesiones completadas", formatCurrency(0)]],
    foot: [["TOTAL", formatCurrency(total)]],
    headStyles: { fillColor: [230, 230, 230], textColor: 20 },
    footStyles: { fillColor: [255, 255, 255], textColor: 20, fontStyle: "bold" },
  });

  const filename = `factura-${invoiceNumber || "sin-numero"}-${customer.full_name.trim().toLowerCase().replace(/\s+/g, "-")}.pdf`;
  doc.save(filename);
}
