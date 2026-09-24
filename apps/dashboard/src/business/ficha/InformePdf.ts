import jsPDF from "jspdf";
import { formatDateTime } from "@reservas/shared";

type ReportCustomer = {
  full_name: string;
  last_name: string | null;
  birth_date: string | null;
  profession: string | null;
};

const PROFESSIONAL = {
  signatureName: "Ana Mª Sánchez López",
  colegiado: "CM01841",
  place: "Almansa",
  address: "C/. Albacete 10 · Almansa (Albacete)",
  email: "anasanchezpsicologa@gmail.com",
  phone: "Tfno.: 666 753 885",
};

function calculateAge(birthDate: string): number {
  const today = new Date();
  const birth = new Date(birthDate);
  let age = today.getFullYear() - birth.getFullYear();
  const hasHadBirthdayThisYear = today.getMonth() > birth.getMonth() ||
    (today.getMonth() === birth.getMonth() && today.getDate() >= birth.getDate());
  if (!hasHadBirthdayThisYear) age--;
  return age;
}

/** Extrae las secciones "## Título" del markdown generado por la IA. Las
 * que no aparecen se omiten (el psicólogo pudo borrarlas al editar). */
function parseSections(content: string): { title: string; body: string }[] {
  const parts = content.split(/^##\s+/m).filter((p) => p.trim());
  return parts.map((part) => {
    const [firstLine, ...rest] = part.split("\n");
    return { title: firstLine.trim(), body: rest.join("\n").trim() };
  });
}

/** PDF del informe con el formato real de Ana Sánchez (plantilla
 * INFORME ANA.doc): portada, datos personales, historia personal por
 * secciones y firma con nº de colegiado. */
export function generateClientReportPdf(customer: ReportCustomer, content: string, tz: string) {
  const doc = new jsPDF();
  const marginX = 20;
  const pageWidth = 210;
  const contentWidth = pageWidth - marginX * 2;
  const pageHeight = 297;
  let y = 0;

  function ensureSpace(needed: number) {
    if (y + needed > pageHeight - 20) {
      doc.addPage();
      y = 20;
    }
  }

  function heading(text: string) {
    ensureSpace(12);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text(text, marginX, y);
    y += 7;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
  }

  function paragraph(text: string) {
    const lines = doc.splitTextToSize(text, contentWidth);
    for (const line of lines) {
      ensureSpace(6);
      doc.text(line, marginX, y);
      y += 5.5;
    }
    y += 3;
  }

  // Portada
  y = 40;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("INFORME PSICOLÓGICO", pageWidth / 2, y, { align: "center" });
  y += 20;
  doc.setFontSize(11);
  doc.text(`NOMBRE: ${customer.full_name} ${customer.last_name ?? ""}`.trim(), pageWidth / 2, y, { align: "center" });
  y += 8;
  doc.setFont("helvetica", "normal");
  doc.text(`FECHA DE EVALUACIÓN: ${formatDateTime(new Date().toISOString(), tz).split(",")[0] ?? ""}`, pageWidth / 2, y, { align: "center" });

  y = 200;
  doc.setFontSize(9);
  const confidentiality = doc.splitTextToSize(
    "Esta información es confidencial, de uso restringido, no público, para garantizar la preservación de la intimidad.\n\n" +
    "Ningún fragmento de este informe podrá ser sacado de contexto ni utilizado para fines distintos a los que han sido previstos.",
    contentWidth - 20
  );
  doc.text(confidentiality, pageWidth / 2, y, { align: "center" });

  y = pageHeight - 25;
  doc.setFontSize(8);
  doc.text(`${PROFESSIONAL.address}   ${PROFESSIONAL.email}`, pageWidth / 2, y, { align: "center" });
  y += 5;
  doc.text(PROFESSIONAL.phone, pageWidth / 2, y, { align: "center" });

  // Página 2: datos personales + evaluación
  doc.addPage();
  y = 20;
  heading("DATOS PERSONALES");
  paragraph(`Nombre: ${customer.full_name}`);
  if (customer.last_name) paragraph(`Apellidos: ${customer.last_name}`);
  if (customer.birth_date) {
    paragraph(`Fecha de nacimiento: ${customer.birth_date.split("-").reverse().join("/")}`);
    paragraph(`Edad: ${calculateAge(customer.birth_date)} años`);
  }
  if (customer.profession) paragraph(`Profesión: ${customer.profession}`);
  paragraph(`Fecha del informe: ${formatDateTime(new Date().toISOString(), tz).split(",")[0] ?? ""}`);

  heading("DATOS SOBRE LA EVALUACIÓN");
  paragraph("Recursos y fuentes utilizados: Entrevista semiestructurada, Observación clínica.");

  heading("HISTORIA PERSONAL");
  for (const section of parseSections(content)) {
    ensureSpace(14);
    doc.setFont("helvetica", "bold");
    doc.text(section.title.toUpperCase(), marginX, y);
    y += 6;
    doc.setFont("helvetica", "normal");
    paragraph(section.body || "(sin contenido)");
  }

  // Firma
  ensureSpace(30);
  y += 8;
  doc.text(`${PROFESSIONAL.place}, a ${formatDateTime(new Date().toISOString(), tz).split(",")[0] ?? ""}`, marginX, y);
  y += 14;
  doc.text(PROFESSIONAL.signatureName, marginX, y);
  y += 6;
  doc.text(`Fdo.                                    nº colegiado: ${PROFESSIONAL.colegiado}`, marginX, y);

  const filename = `informe-${customer.full_name.trim().toLowerCase().replace(/\s+/g, "-")}.pdf`;
  doc.save(filename);
}
