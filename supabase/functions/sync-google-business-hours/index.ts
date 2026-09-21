// sync-google-business-hours — Cron: lee el horario semanal general
// (regularHours) de la ficha de Google Business Profile de cada negocio
// conectado y lo SOBRESCRIBE en business_hours, en una sola transacción
// (RPC replace_business_hours_from_sync). Sin revisión manual: mientras la
// sincronización esté activada, Google es la fuente de verdad para este
// horario. Un fallo de red/token nunca borra el horario existente — solo un
// fetch+mapeo exitoso puede sobrescribir. Protegido por cabecera
// x-cron-secret (verify_jwt = false), igual patrón que sync-google-busy.
import { createClient } from "jsr:@supabase/supabase-js@2";
import { json, handleOptions } from "../_shared/cors.ts";
import { refreshAccessToken, getGoogleBusinessLocationHours } from "../_shared/google.ts";
import { mapGbpPeriodsToBusinessHours } from "../_shared/gbpHours.ts";

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
    .from("business_google_profile_accounts")
    .select("*")
    .eq("sync_enabled", true)
    .not("gbp_location_name", "is", null);
  if (error) return json({ error: error.message }, 500);

  let synced = 0, failed = 0;
  const results: unknown[] = [];

  for (const account of accounts ?? []) {
    const businessId = account.business_id as string;
    try {
      const { data: integ } = await supabase
        .from("business_integrations").select("google_client_id, google_client_secret")
        .eq("business_id", businessId).maybeSingle();
      if (!integ?.google_client_id || !integ?.google_client_secret) {
        results.push({ business_id: businessId, skipped: "sin credenciales" }); continue;
      }

      let accessToken = account.access_token as string;
      if (!account.token_expires_at || new Date(account.token_expires_at) <= new Date(Date.now() + 60_000)) {
        if (!account.refresh_token) {
          await supabase.from("business_google_profile_accounts").update({
            last_sync_status: "error", last_sync_error: "Token caducado y sin refresh_token; hay que reconectar.",
          }).eq("business_id", businessId);
          results.push({ business_id: businessId, skipped: "sin refresh_token" }); continue;
        }
        const refreshed = await refreshAccessToken(integ.google_client_id, integ.google_client_secret, account.refresh_token);
        accessToken = refreshed.access_token;
        await supabase.from("business_google_profile_accounts").update({
          access_token: accessToken,
          token_expires_at: new Date(Date.now() + refreshed.expires_in * 1000).toISOString(),
        }).eq("business_id", businessId);
      }

      const periods = await getGoogleBusinessLocationHours(accessToken, account.gbp_location_name);
      const { rows, warnings } = mapGbpPeriodsToBusinessHours(periods);

      const { error: rpcError } = await supabase.rpc("replace_business_hours_from_sync", {
        p_business_id: businessId,
        p_rows: rows,
      });
      if (rpcError) throw new Error(rpcError.message);

      await supabase.from("business_google_profile_accounts").update({
        last_synced_at: new Date().toISOString(),
        last_sync_status: warnings.length ? "ok_with_warnings" : "ok",
        last_sync_error: warnings.length ? warnings.join("; ") : null,
      }).eq("business_id", businessId);

      synced++; results.push({ business_id: businessId, rows: rows.length, warnings: warnings.length });
    } catch (e) {
      failed++;
      const message = (e as Error).message;
      await supabase.from("business_google_profile_accounts").update({
        last_sync_status: "error", last_sync_error: message,
      }).eq("business_id", businessId);
      results.push({ business_id: businessId, error: message });
    }
  }

  return json({ processed: (accounts ?? []).length, synced, failed, results });
});
