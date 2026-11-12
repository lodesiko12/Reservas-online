// Envío de plantillas de WhatsApp vía Meta Cloud API. Compartido por
// whatsapp-reminders (recordatorio 24h) y notify-waitlist (mesa lista).

function digits(phone: string): string {
  return (phone || "").replace(/[^\d]/g, "");
}

export async function sendWhatsApp(
  token: string,
  phoneId: string,
  toPhone: string,
  templateName: string,
  lang: string,
  params: string[]
): Promise<string> {
  const res = await fetch(`https://graph.facebook.com/v20.0/${phoneId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: digits(toPhone),
      type: "template",
      template: {
        name: templateName,
        language: { code: lang },
        components: [{ type: "body", parameters: params.map((t) => ({ type: "text", text: t })) }],
      },
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`WhatsApp API ${res.status}: ${JSON.stringify(data)}`);
  return data?.messages?.[0]?.id ?? "sent";
}

/** Mensaje de texto libre (solo válido dentro de la ventana de 24 h desde el último mensaje del cliente). */
export async function sendWhatsAppText(
  token: string,
  phoneId: string,
  toPhone: string,
  body: string
): Promise<string> {
  const res = await fetch(`https://graph.facebook.com/v20.0/${phoneId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: digits(toPhone),
      type: "text",
      text: { preview_url: false, body },
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`WhatsApp API ${res.status}: ${JSON.stringify(data?.error ?? data)}`);
  return data?.messages?.[0]?.id ?? "sent";
}
