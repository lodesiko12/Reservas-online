// Factura con los datos y el formato propios de una profesional (professional_invoice_profiles).
import jsPDF from "jspdf";

export interface InvoiceProfile {
  issuer_name: string;
  issuer_title: string | null;
  registration: string | null;
  tax_id: string;
  address: string | null;
  bank_name: string | null;
  account_holder: string | null;
  iban: string | null;
  due_days: number | null;
  footnote: string | null;
  logo_data: string | null;
}

export interface InvoiceCustomer {
  full_name: string;
  last_name: string | null;
  nif: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  province: string | null;
  postal_code: string | null;
}

export interface InvoiceSession {
  status: string;
  services: { name: string; price: number | null } | null;
}

export const DEFAULT_FOOTNOTE =
  "Actividad exenta de IVA según Ley 37/1992 de 28 de Diciembre, del impuesto del valor añadido, artículo 20, núm 1, apartado 3º.";

const MONTHS = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

/** "2026-12-30" → "30 Diciembre 2026" */
export function longDate(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

export const money = (n: number) => `${Number.isInteger(n) ? n : n.toFixed(2).replace(".", ",")}€`;

/** Sesiones completadas agrupadas por servicio y precio: una línea con su cantidad. */
export function invoiceLines(history: InvoiceSession[]) {
  const lines = new Map<string, { description: string; qty: number; price: number }>();
  for (const b of history) {
    if (b.status !== "completada") continue;
    const description = b.services?.name ?? "Sesión de psicoterapia";
    const price = b.services?.price ?? 0;
    const key = `${description}|${price}`;
    const line = lines.get(key) ?? { description, qty: 0, price };
    line.qty += 1;
    lines.set(key, line);
  }
  return [...lines.values()];
}

export function buildProfessionalInvoice(
  profile: InvoiceProfile,
  customer: InvoiceCustomer,
  history: InvoiceSession[],
  issueDate: string, // YYYY-MM-DD en la zona del negocio
  invoiceNumber: string,
): jsPDF {
  const doc = new jsPDF();
  const L = 30, R = 180; // márgenes en mm (A4: 210 × 297)
  const paint = () => { doc.setFillColor(245, 245, 240); doc.rect(0, 0, 210, 297, "F"); doc.setTextColor(10); };
  const text = (s: string, x: number, y: number, size = 10, bold = false, align: "left" | "right" | "center" = "left", font = "helvetica") => {
    doc.setFont(font, bold ? "bold" : "normal"); doc.setFontSize(size);
    doc.text(s, x, y, { align });
  };
  const rule = (y: number, from = L) => { doc.setDrawColor(20); doc.setLineWidth(0.25); doc.line(from, y, R, y); };

  paint();
  if (profile.logo_data) {
    const { width, height } = doc.getImageProperties(profile.logo_data);
    const k = Math.min(32 / width, 32 / height);
    doc.addImage(profile.logo_data, "PNG", L, 18, width * k, height * k);
  }
  text("FACTURA", R, 34, 36, false, "right", "times");
  text(`Factura No. ${invoiceNumber}`, R, 57, 10, false, "right");
  text(longDate(issueDate), R, 62, 10, false, "right");

  text("FACTURADO A:", L, 62, 11, true);
  const place = [customer.city, customer.province].filter(Boolean).join(", ");
  const street = [customer.address, customer.postal_code ? `(${customer.postal_code})` : "", place].filter(Boolean).join(" ");
  const clientLines = [
    `${customer.full_name} ${customer.last_name ?? ""}`.trim(),
    customer.nif ? `DNI: ${customer.nif}` : "",
    customer.phone ?? "",
    street,
  ].filter(Boolean).flatMap((s) => doc.splitTextToSize(s, 90) as string[]);
  clientLines.forEach((s, i) => text(s, L, 71 + i * 5));

  let y = Math.max(104, 71 + clientLines.length * 5 + 6);
  const header = () => {
    rule(y);
    text("Descripción", L + 3, y + 9, 10, true);
    text("Cantidad", 128, y + 9, 10, true, "center");
    text("Precio", 149, y + 7, 10, true, "center");
    text("Unidad", 149, y + 12, 10, true, "center");
    text("Total", 169, y + 9, 10, true, "center");
    rule(y + 16);
    y += 24;
  };
  const newPage = () => { doc.addPage(); paint(); y = 20; };
  header();

  const lines = invoiceLines(history);
  for (const l of lines) {
    const desc = doc.splitTextToSize(l.description, 80) as string[];
    if (y + desc.length * 5 > 270) { newPage(); header(); }
    desc.forEach((s, i) => text(s, L + 3, y + i * 5));
    text(String(l.qty), 128, y, 10, false, "center");
    text(money(l.price), 149, y, 10, false, "center");
    text(money(l.qty * l.price), 169, y, 10, false, "center");
    y += Math.max(1, desc.length) * 5 + 4;
  }
  rule(y + 3);
  y += 3;
  // Totales, nota y pie necesitan unos 100 mm: si no caben, van juntos en otra página.
  if (y + 100 > 290) newPage();

  const total = lines.reduce((n, l) => n + l.qty * l.price, 0);
  text("Subtotal", 149, y + 8, 10, true, "center");
  text(money(total), 169, y + 8, 10, false, "center");
  text("IVA", 149, y + 19, 10, true, "center");
  text("Exento*", 169, y + 19, 10, false, "center");
  rule(y + 25, 137);
  text("Total", 149, y + 34, 16, true, "center");
  text(money(total), 169, y + 34, 16, true, "center");

  doc.setFont("helvetica", "normal"); doc.setFontSize(7);
  const note = doc.splitTextToSize(`*${profile.footnote?.trim() || DEFAULT_FOOTNOTE}`, R - L) as string[];
  note.forEach((s, i) => text(s, 105, y + 43 + i * 3.2, 7, false, "center"));

  // Pie: pago a la izquierda y emisora a la derecha.
  const foot = Math.min(250, Math.max(y + 64, 230));
  const due = new Date(`${issueDate}T12:00:00Z`);
  due.setUTCDate(due.getUTCDate() + (profile.due_days ?? 0));
  const pay = [
    profile.bank_name, profile.account_holder, profile.iban,
    profile.due_days != null ? `Vto: ${longDate(due.toISOString().slice(0, 10))}` : null,
  ].filter((s): s is string => !!s?.trim());
  if (profile.iban?.trim() || profile.bank_name?.trim()) {
    text("INFORMACIÓN DE PAGO", L, foot, 10, true);
    pay.forEach((s, i) => text(s, L, foot + 6 + i * 5));
  }

  text(profile.issuer_name, R, foot, 16, false, "right", "times");
  const issuer = [
    profile.issuer_title,
    [profile.registration, profile.tax_id].filter(Boolean).join("      "),
    ...(profile.address ?? "").split("\n"),
  ].filter((s): s is string => !!s?.trim())
    .flatMap((s) => { doc.setFont("helvetica", "normal"); doc.setFontSize(10); return doc.splitTextToSize(s, 75) as string[]; });
  issuer.forEach((s, i) => text(s, R, foot + 7 + i * 5, 10, false, "right"));

  return doc;
}
