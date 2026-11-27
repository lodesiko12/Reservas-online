// calendar-feed — Endpoint PUBLICO (verify_jwt = false). GET ?t=<token>.
// Sirve un calendario iCalendar (.ics) con las citas y reuniones de UN profesional,
// para que se suscriba desde Google Calendar ("Otros calendarios > Desde URL").
// Solo lectura y de un solo sentido: lo que hagan en Google no vuelve a Turnigo.
// Privacidad clinica: el titulo lleva solo nombre + iniciales de los apellidos
// y la descripcion el servicio; nunca notas, telefono ni email.
// El acceso lo da el token (256 bits) guardado en professional_calendar_feeds.
import { createClient } from "jsr:@supabase/supabase-js@2";

const PAST_DAYS = 30;
const FUTURE_DAYS = 365;

const icsEscape = (s: string) =>
  s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");

const icsDate = (iso: string) => new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

/** Pliega lineas a 75 octetos (RFC 5545). */
function fold(line: string): string {
  const enc = new TextEncoder();
  if (enc.encode(line).length <= 75) return line;
  const out: string[] = [];
  let cur = "";
  for (const ch of line) {
    const limit = out.length === 0 ? 75 : 74;
    if (enc.encode(cur + ch).length > limit) { out.push(cur); cur = ch; } else cur += ch;
  }
  out.push(cur);
  return out.join("\r\n ");
}

function initials(last: string | null): string {
  return (last ?? "").split(/\s+/).filter(Boolean).map((w) => w[0].toUpperCase() + ".").join(" ");
}

Deno.serve(async (req) => {
  if (req.method !== "GET" && req.method !== "HEAD") return new Response("Método no permitido", { status: 405 });
  const token = new URL(req.url).searchParams.get("t") ?? "";
  if (!/^[0-9a-f]{64}$/.test(token)) return new Response("No encontrado", { status: 404 });

  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  });

  const { data: feed } = await sb.from("professional_calendar_feeds").select("professional_id").eq("token", token).maybeSingle();
  if (!feed) return new Response("No encontrado", { status: 404 });

  const { data: pro } = await sb.from("professionals").select("id, name, business_id").eq("id", feed.professional_id).single();
  if (!pro) return new Response("No encontrado", { status: 404 });
  const { data: biz } = await sb.from("businesses").select("name").eq("id", pro.business_id).single();

  const from = new Date(Date.now() - PAST_DAYS * 86400000).toISOString();
  const to = new Date(Date.now() + FUTURE_DAYS * 86400000).toISOString();
  const { data: bookings, error } = await sb
    .from("bookings")
    .select("id, starts_at, ends_at, customer_name, customer_last_name, status, updated_at, services(name)")
    .eq("professional_id", pro.id)
    .eq("business_id", pro.business_id)
    .eq("type", "citas")
    .in("status", ["pendiente", "confirmada", "completada"])
    .gte("starts_at", from)
    .lte("starts_at", to)
    .order("starts_at");
  if (error) return new Response("Error", { status: 500 });

  // Reuniones a las que asiste: las suyas y las de todo el equipo.
  const { data: meetings, error: meetingsError } = await sb
    .from("blocks")
    .select("meeting_id, starts_at, ends_at, reason, created_at")
    .eq("business_id", pro.business_id)
    .eq("kind", "reunion")
    .or(`scope.eq.business,professional_id.eq.${pro.id}`)
    .gte("starts_at", from)
    .lte("starts_at", to)
    .order("starts_at");
  if (meetingsError) return new Response("Error", { status: 500 });

  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Turnigo//Agenda//ES",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${icsEscape(`${biz?.name ?? "Turnigo"} · ${pro.name}`)}`,
    "REFRESH-INTERVAL;VALUE=DURATION:PT1H",
    "X-PUBLISHED-TTL:PT1H",
  ];
  for (const b of bookings ?? []) {
    // Si no hay apellido en su campo (citas importadas), el nombre completo viene junto en
    // customer_name: se deja la primera palabra y el resto se reduce a iniciales.
    const [first, ...rest] = b.customer_name.trim().split(/\s+/);
    const who = b.customer_last_name
      ? `${b.customer_name} ${initials(b.customer_last_name)}`.trim()
      : `${first} ${initials(rest.join(" "))}`.trim();
    const svc = (b as any).services?.name as string | undefined;
    lines.push(
      "BEGIN:VEVENT",
      `UID:${b.id}@turnigo.es`,
      `DTSTAMP:${icsDate(b.updated_at ?? b.starts_at)}`,
      `DTSTART:${icsDate(b.starts_at)}`,
      `DTEND:${icsDate(b.ends_at)}`,
      `SUMMARY:${icsEscape(who)}`,
      ...(svc ? [`DESCRIPTION:${icsEscape(svc)}`] : []),
      "TRANSP:OPAQUE",
      "END:VEVENT",
    );
  }
  for (const m of meetings ?? []) {
    lines.push(
      "BEGIN:VEVENT",
      // meeting_id se mantiene al editar, así Google actualiza el mismo evento.
      `UID:reunion-${m.meeting_id}@turnigo.es`,
      `DTSTAMP:${icsDate(m.created_at)}`,
      `DTSTART:${icsDate(m.starts_at)}`,
      `DTEND:${icsDate(m.ends_at)}`,
      `SUMMARY:${icsEscape(`Reunión: ${m.reason ?? ""}`)}`,
      "TRANSP:OPAQUE",
      "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR");

  return new Response(lines.map(fold).join("\r\n") + "\r\n", {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Cache-Control": "no-store",
      "Content-Disposition": 'inline; filename="turnigo.ics"',
    },
  });
});
