// sync-google-event — Endpoint AUTENTICADO (verify_jwt = true).
// Exporta (crea/actualiza/borra) el evento de Google Calendar del
// profesional asignado a una reserva (citas/psicologo/restaurante), o el
// del NEGOCIO entero para un evento de la Agenda interna (autonomo, que no
// tiene profesionales). Se invoca de forma NO bloqueante (fire-and-forget)
// desde create-booking y desde el panel (Agenda / Agenda interna) al
// cambiar de estado, reprogramar, crear o eliminar.
//
// Autorización: el registro se lee con un cliente "como el llamante"
// (Authorization reenviado) para que RLS valide pertenencia al negocio —
// mismo patrón que notify-waitlist. Si el llamante es service_role (p.ej.
// la propia Edge Function create-booking), RLS no aplica y pasa igual.
import { createClient } from "jsr:@supabase/supabase-js@2";
import { json, handleOptions } from "../_shared/cors.ts";
import { refreshAccessToken, upsertGoogleEvent, deleteGoogleEvent } from "../_shared/google.ts";

type Body = { booking_id?: string; event_id?: string; action?: "upsert" | "delete" };

Deno.serve(async (req) => {
  const pre = handleOptions(req);
  if (pre) return pre;
  if (req.method !== "POST") return json({ error: "Método no permitido" }, 405);

  const authHeader = req.headers.get("Authorization") ?? "";
  const asCaller = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    auth: { persistSession: false }, global: { headers: { Authorization: authHeader } },
  });
  const service = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  });

  const { booking_id, event_id, action }: Body = await req.json().catch(() => ({}));
  if ((!booking_id && !event_id) || !action) return json({ error: "Faltan booking_id/event_id o action" }, 400);

  if (event_id) return syncCrmEvent(asCaller, service, event_id, action);
  return syncBooking(asCaller, service, booking_id!, action);
});

/** Reserva de citas/psicologo/restaurante: Google Calendar del profesional. */
async function syncBooking(asCaller: any, service: any, booking_id: string, action: "upsert" | "delete") {
  // RLS (o bypass si es service_role) valida que el llamante tiene acceso a esta reserva.
  const { data: booking } = await asCaller
    .from("bookings")
    .select("id, business_id, professional_id, service_id, starts_at, ends_at, customer_name, customer_last_name, notes, google_event_id, services(name)")
    .eq("id", booking_id)
    .eq("type", "citas")
    .maybeSingle();
  if (!booking) return json({ error: "Reserva no encontrada o sin acceso" }, 404);
  if (!booking.professional_id) return json({ ok: true, skipped: "sin profesional" });

  const [{ data: account }, { data: business }, { data: integ }] = await Promise.all([
    service.from("professional_google_accounts").select("*").eq("professional_id", booking.professional_id).maybeSingle(),
    service.from("businesses").select("timezone").eq("id", booking.business_id).single(),
    service.from("business_integrations").select("google_client_id, google_client_secret").eq("business_id", booking.business_id).maybeSingle(),
  ]);
  if (!account || !account.sync_enabled) return json({ ok: true, skipped: "profesional sin Google conectado" });
  if (!integ?.google_client_id || !integ?.google_client_secret) return json({ ok: true, skipped: "negocio sin credenciales de Google" });

  const accessToken = await ensureAccessToken(service, account, integ, "professional_id", booking.professional_id);
  if (typeof accessToken !== "string") return accessToken; // ya es la respuesta de error

  try {
    if (action === "delete") {
      if (booking.google_event_id) {
        await deleteGoogleEvent(accessToken, account.calendar_id, booking.google_event_id);
        await service.from("bookings").update({ google_event_id: null }).eq("id", booking.id);
      }
      return json({ ok: true });
    }

    const serviceName = (booking as any).services?.name ?? "Cita";
    const eventId = await upsertGoogleEvent(accessToken, account.calendar_id, booking.google_event_id, {
      summary: `${serviceName} · ${booking.customer_name} ${booking.customer_last_name ?? ""}`.trim(),
      description: booking.notes ?? undefined,
      startsAt: booking.starts_at, endsAt: booking.ends_at, timezone: business!.timezone,
    });
    if (eventId !== booking.google_event_id) {
      await service.from("bookings").update({ google_event_id: eventId }).eq("id", booking.id);
    }
    return json({ ok: true, google_event_id: eventId });
  } catch (e) {
    console.error("sync-google-event (booking) error:", (e as Error).message);
    return json({ ok: false, error: (e as Error).message }, 200);
  }
}

/** Evento de Agenda interna (autonomo): Google Calendar del negocio. */
async function syncCrmEvent(asCaller: any, service: any, event_id: string, action: "upsert" | "delete") {
  const { data: ev } = await asCaller
    .from("crm_events")
    .select("id, business_id, title, type, starts_at, ends_at, address, notes, google_event_id, customers(full_name, last_name)")
    .eq("id", event_id)
    .maybeSingle();
  if (!ev) return json({ error: "Evento no encontrado o sin acceso" }, 404);

  const [{ data: account }, { data: business }, { data: integ }] = await Promise.all([
    service.from("professional_google_accounts").select("*").eq("business_id", ev.business_id).maybeSingle(),
    service.from("businesses").select("timezone").eq("id", ev.business_id).single(),
    service.from("business_integrations").select("google_client_id, google_client_secret").eq("business_id", ev.business_id).maybeSingle(),
  ]);
  if (!account || !account.sync_enabled) return json({ ok: true, skipped: "negocio sin Google conectado" });
  if (!integ?.google_client_id || !integ?.google_client_secret) return json({ ok: true, skipped: "negocio sin credenciales de Google" });

  const accessToken = await ensureAccessToken(service, account, integ, "business_id", ev.business_id);
  if (typeof accessToken !== "string") return accessToken;

  try {
    if (action === "delete") {
      if (ev.google_event_id) {
        await deleteGoogleEvent(accessToken, account.calendar_id, ev.google_event_id);
        await service.from("crm_events").update({ google_event_id: null }).eq("id", ev.id);
      }
      return json({ ok: true });
    }

    const customer = (ev as any).customers;
    const who = customer ? ` · ${customer.full_name} ${customer.last_name ?? ""}`.trim() : "";
    const eventId = await upsertGoogleEvent(accessToken, account.calendar_id, ev.google_event_id, {
      summary: `${ev.title}${who}`,
      description: [ev.address, ev.notes].filter(Boolean).join("\n") || undefined,
      startsAt: ev.starts_at, endsAt: ev.ends_at, timezone: business!.timezone,
    });
    if (eventId !== ev.google_event_id) {
      await service.from("crm_events").update({ google_event_id: eventId }).eq("id", ev.id);
    }
    return json({ ok: true, google_event_id: eventId });
  } catch (e) {
    console.error("sync-google-event (crm_event) error:", (e as Error).message);
    return json({ ok: false, error: (e as Error).message }, 200);
  }
}

/** Refresca el access_token si está caducado/por caducar y persiste el nuevo. Devuelve el token o una Response de error para propagar tal cual. */
async function ensureAccessToken(service: any, account: any, integ: any, ownerColumn: "professional_id" | "business_id", ownerId: string) {
  let accessToken = account.access_token as string;
  if (!account.token_expires_at || new Date(account.token_expires_at) <= new Date(Date.now() + 60_000)) {
    if (!account.refresh_token) return json({ ok: false, error: "Token caducado y sin refresh_token; hay que reconectar." }, 200);
    const refreshed = await refreshAccessToken(integ.google_client_id, integ.google_client_secret, account.refresh_token);
    accessToken = refreshed.access_token;
    await service.from("professional_google_accounts").update({
      access_token: accessToken,
      token_expires_at: new Date(Date.now() + refreshed.expires_in * 1000).toISOString(),
    }).eq(ownerColumn, ownerId);
  }
  return accessToken;
}
