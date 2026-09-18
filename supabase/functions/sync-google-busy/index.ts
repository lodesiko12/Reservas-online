// sync-google-busy — Cron: importa los huecos OCUPADOS del Google Calendar
// de cada profesional conectado y los refleja como `blocks` (scope
// 'professional', source 'google_calendar'), para que get_available_slots
// los descuente automáticamente del widget sin tocar su lógica.
// Protegido por cabecera x-cron-secret (verify_jwt = false), igual patrón
// que whatsapp-reminders/request-reviews.
import { createClient } from "jsr:@supabase/supabase-js@2";
import { json, handleOptions } from "../_shared/cors.ts";
import { refreshAccessToken, queryFreeBusy } from "../_shared/google.ts";

const HORIZON_DAYS = 30;

Deno.serve(async (req) => {
  const pre = handleOptions(req);
  if (pre) return pre;

  const secret = Deno.env.get("CRON_SECRET") ?? Deno.env.get("GOOGLE_SYNC_CRON_SECRET");
  if (secret && req.headers.get("x-cron-secret") !== secret) return json({ error: "No autorizado" }, 401);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } }
  );

  const { data: accounts, error } = await supabase
    .from("professional_google_accounts")
    .select("*, professionals!inner(business_id)")
    .eq("sync_enabled", true);
  if (error) return json({ error: error.message }, 500);

  const timeMin = new Date().toISOString();
  const timeMax = new Date(Date.now() + HORIZON_DAYS * 86400000).toISOString();

  let synced = 0, failed = 0;
  const results: unknown[] = [];

  for (const account of accounts ?? []) {
    const businessId = (account as any).professionals.business_id as string;
    try {
      const { data: integ } = await supabase
        .from("business_integrations").select("google_client_id, google_client_secret")
        .eq("business_id", businessId).maybeSingle();
      if (!integ?.google_client_id || !integ?.google_client_secret) { results.push({ professional_id: account.professional_id, skipped: "sin credenciales" }); continue; }

      let accessToken = account.access_token as string;
      if (!account.token_expires_at || new Date(account.token_expires_at) <= new Date(Date.now() + 60_000)) {
        if (!account.refresh_token) { results.push({ professional_id: account.professional_id, skipped: "sin refresh_token" }); continue; }
        const refreshed = await refreshAccessToken(integ.google_client_id, integ.google_client_secret, account.refresh_token);
        accessToken = refreshed.access_token;
        await supabase.from("professional_google_accounts").update({
          access_token: accessToken,
          token_expires_at: new Date(Date.now() + refreshed.expires_in * 1000).toISOString(),
        }).eq("professional_id", account.professional_id);
      }

      const busy = await queryFreeBusy(accessToken, account.calendar_id, timeMin, timeMax);

      // Reemplazo completo (simple e idempotente): borra los bloqueos que
      // esta sincronización generó antes y vuelve a insertar los actuales.
      await supabase.from("blocks")
        .delete()
        .eq("professional_id", account.professional_id)
        .eq("source", "google_calendar")
        .gte("starts_at", timeMin);

      if (busy.length) {
        await supabase.from("blocks").insert(busy.map((b) => ({
          business_id: businessId, scope: "professional", professional_id: account.professional_id,
          starts_at: b.start, ends_at: b.end, reason: "Google Calendar", source: "google_calendar",
        })));
      }
      synced++; results.push({ professional_id: account.professional_id, busy: busy.length });
    } catch (e) {
      failed++; results.push({ professional_id: account.professional_id, error: (e as Error).message });
    }
  }

  return json({ processed: (accounts ?? []).length, synced, failed, results });
});
