// Constructor y envío de emails de confirmación vía Resend.
// Si RESEND_API_KEY no está configurada, el envío se omite sin romper la reserva.

export type ConfirmationData = {
  businessName: string;
  serviceName: string | null;
  startsAt: string; // ISO
  timezone: string;
  locator: string;
  customerName: string;
  manageUrl?: string; // enlace a "Mi reserva"
  primaryColor?: string;
  isPending?: boolean; // el negocio requiere confirmación manual
};

function fmtDate(iso: string, tz: string): string {
  return new Intl.DateTimeFormat("es-ES", {
    weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: tz,
  }).format(new Date(iso));
}
function fmtTime(iso: string, tz: string): string {
  return new Intl.DateTimeFormat("es-ES", {
    hour: "2-digit", minute: "2-digit", timeZone: tz, hour12: false,
  }).format(new Date(iso));
}

export function buildConfirmationEmail(d: ConfirmationData): { subject: string; html: string; text: string } {
  const color = d.primaryColor || "#4f46e5";
  const date = fmtDate(d.startsAt, d.timezone);
  const time = fmtTime(d.startsAt, d.timezone);
  const pending = !!d.isPending;
  const subject = pending ? `Solicitud recibida · ${d.businessName}` : `Reserva confirmada · ${d.businessName}`;
  const heading = pending ? "Pendiente de confirmación" : "Reserva confirmada";
  const intro = pending
    ? `Hola ${d.customerName}, hemos recibido tu solicitud de reserva. El negocio la confirmará en breve. Estos son los detalles:`
    : `Hola ${d.customerName}, tu reserva está confirmada. Estos son los detalles:`;

  const manage = d.manageUrl
    ? `<p style="margin:16px 0 0">Puedes consultar o cancelar tu reserva aquí:<br>
         <a href="${d.manageUrl}" style="color:${color}">${d.manageUrl}</a></p>`
    : "";

  const html = `<!doctype html><html><body style="margin:0;background:#f1f5f9;padding:24px;font-family:system-ui,Segoe UI,Arial,sans-serif;color:#0f172a">
  <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:14px;overflow:hidden;border:1px solid #e2e8f0">
    <div style="background:${color};color:#fff;padding:20px 24px">
      <h1 style="margin:0;font-size:20px">${d.businessName}</h1>
      <p style="margin:4px 0 0;opacity:.9">${heading}</p>
    </div>
    <div style="padding:24px">
      <p style="margin:0 0 12px">${intro}</p>
      <table style="width:100%;border-collapse:collapse;font-size:15px">
        ${d.serviceName ? `<tr><td style="padding:6px 0;color:#64748b">Detalle</td><td style="padding:6px 0;text-align:right"><strong>${d.serviceName}</strong></td></tr>` : ""}
        <tr><td style="padding:6px 0;color:#64748b">Fecha</td><td style="padding:6px 0;text-align:right"><strong>${date}</strong></td></tr>
        <tr><td style="padding:6px 0;color:#64748b">Hora</td><td style="padding:6px 0;text-align:right"><strong>${time}</strong></td></tr>
      </table>
      <div style="margin:20px 0;text-align:center;background:#f8fafc;border:1px dashed ${color};border-radius:12px;padding:16px">
        <div style="color:#64748b;font-size:13px">Código localizador</div>
        <div style="font-size:26px;font-weight:800;letter-spacing:2px;color:${color}">${d.locator}</div>
      </div>
      ${manage}
      <p style="margin:18px 0 0;color:#94a3b8;font-size:12px">Guarda este código para gestionar tu reserva.</p>
    </div>
  </div></body></html>`;

  const text = `${pending ? "Solicitud de reserva recibida en" : "Reserva confirmada en"} ${d.businessName}
${d.serviceName ? `Detalle: ${d.serviceName}\n` : ""}Fecha: ${date}
Hora: ${time}
Código localizador: ${d.locator}
${d.manageUrl ? `Gestiona tu reserva: ${d.manageUrl}` : ""}`;

  return { subject, html, text };
}

export type ReviewRequestData = {
  businessName: string;
  customerName: string;
  reviewUrl: string;
  primaryColor?: string;
};

/** Email post-visita pidiendo una reseña. Solo se construye/envía si el
 * negocio tiene configurado un enlace de reseña (Google/TripAdvisor...). */
export function buildReviewRequestEmail(d: ReviewRequestData): { subject: string; html: string; text: string } {
  const color = d.primaryColor || "#4f46e5";
  const subject = `¿Qué tal tu visita a ${d.businessName}?`;
  const html = `<!doctype html><html><body style="margin:0;background:#f1f5f9;padding:24px;font-family:system-ui,Segoe UI,Arial,sans-serif;color:#0f172a">
  <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:14px;overflow:hidden;border:1px solid #e2e8f0">
    <div style="background:${color};color:#fff;padding:20px 24px">
      <h1 style="margin:0;font-size:20px">${d.businessName}</h1>
      <p style="margin:4px 0 0;opacity:.9">Gracias por tu visita</p>
    </div>
    <div style="padding:24px">
      <p style="margin:0 0 16px">Hola ${d.customerName}, esperamos que lo hayas pasado genial. Si tienes un minuto, nos ayudaría muchísimo que dejaras tu opinión:</p>
      <p style="text-align:center;margin:24px 0">
        <a href="${d.reviewUrl}" style="background:${color};color:#fff;text-decoration:none;padding:12px 24px;border-radius:10px;font-weight:600;display:inline-block">Dejar una reseña</a>
      </p>
      <p style="margin:18px 0 0;color:#94a3b8;font-size:12px">Gracias por confiar en nosotros.</p>
    </div>
  </div></body></html>`;
  const text = `Hola ${d.customerName}, gracias por tu visita a ${d.businessName}. Si tienes un minuto, déjanos tu opinión aquí: ${d.reviewUrl}`;
  return { subject, html, text };
}

/**
 * Envía el email con Resend usando las credenciales del negocio si están
 * disponibles; si no, cae al RESEND_API_KEY/EMAIL_FROM globales (fallback).
 * Devuelve el id del mensaje o null si no hay ninguna API key configurada.
 */
export async function sendEmail(
  to: string,
  subject: string,
  html: string,
  text: string,
  businessApiKey?: string | null,
  businessFrom?: string | null
): Promise<string | null> {
  const apiKey = businessApiKey || Deno.env.get("RESEND_API_KEY");
  const from = businessFrom || Deno.env.get("EMAIL_FROM") || "Turnigo <onboarding@resend.dev>";
  if (!apiKey) {
    console.warn("[email] Sin credencial de Resend (ni del negocio ni global); se omite el envío.");
    return null;
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to, subject, html, text }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Resend error ${res.status}: ${body}`);
  }
  const data = await res.json();
  return data.id ?? null;
}
