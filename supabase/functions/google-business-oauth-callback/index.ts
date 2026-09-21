// google-business-oauth-callback — Endpoint PÚBLICO (verify_jwt = false),
// redirect_uri de Google para el flujo de Business Profile. Verifica el
// `state` firmado por google-business-oauth-start, intercambia el code por
// tokens con las credenciales del negocio (las mismas de Calendar), resuelve
// automáticamente la cuenta/ubicación de Google Business Profile conectada
// (auto-selecciona si hay exactamente una; si hay 0 o 2+, guarda la
// conexión pero deja la sincronización desactivada — sin selector de
// ubicación en esta v1) y termina redirigiendo al panel.
import { createClient } from "jsr:@supabase/supabase-js@2";
import { handleOptions } from "../_shared/cors.ts";
import {
  verifyBusinessState, exchangeCodeForTokens, getGoogleUserEmail,
  listGoogleBusinessAccounts, listGoogleBusinessLocations,
} from "../_shared/google.ts";

function redirect(path: string): Response {
  const base = (Deno.env.get("DASHBOARD_URL") ?? "").replace(/\/+$/, "");
  return new Response(null, { status: 302, headers: { Location: `${base}${path}` } });
}

Deno.serve(async (req) => {
  const pre = handleOptions(req);
  if (pre) return pre;

  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const googleError = url.searchParams.get("error");

  if (googleError) return redirect(`/app/configuracion?google_business_error=${encodeURIComponent(googleError)}`);
  if (!code || !state) return redirect("/app/configuracion?google_business_error=missing_params");

  const stateSecret = Deno.env.get("GOOGLE_STATE_SECRET");
  if (!stateSecret) return redirect("/app/configuracion?google_business_error=server_misconfigured");

  const verified = await verifyBusinessState(state, stateSecret);
  if (!verified) return redirect("/app/configuracion?google_business_error=invalid_state");
  const { businessId } = verified;

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } }
  );

  const { data: integ } = await admin
    .from("business_integrations")
    .select("google_client_id, google_client_secret")
    .eq("business_id", businessId)
    .maybeSingle();
  if (!integ?.google_client_id || !integ?.google_client_secret) {
    return redirect("/app/configuracion?google_business_error=missing_credentials");
  }

  const redirectUri = `${Deno.env.get("SUPABASE_URL")}/functions/v1/google-business-oauth-callback`;

  try {
    const tokens = await exchangeCodeForTokens(integ.google_client_id, integ.google_client_secret, code, redirectUri);
    const email = await getGoogleUserEmail(tokens.access_token);
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

    const accounts = await listGoogleBusinessAccounts(tokens.access_token);
    if (!accounts.length) {
      return redirect("/app/configuracion?google_business_error=no_google_business_account");
    }
    const account = accounts[0];
    const locations = await listGoogleBusinessLocations(tokens.access_token, account.name);

    let locationName: string | null = null;
    let locationTitle: string | null = null;
    let status: string;
    let syncEnabled: boolean;
    if (locations.length === 0) {
      status = "no_locations"; syncEnabled = false;
    } else if (locations.length === 1) {
      locationName = locations[0].name; locationTitle = locations[0].title ?? null;
      status = "pending"; syncEnabled = true;
    } else {
      status = "multiple_locations"; syncEnabled = false;
    }

    // El refresh_token solo viene la primera vez que se autoriza; si Google
    // no lo manda (reconexión sin revocar antes), conservamos el que ya había.
    const { data: existing } = await admin
      .from("business_google_profile_accounts")
      .select("refresh_token")
      .eq("business_id", businessId)
      .maybeSingle();

    await admin.from("business_google_profile_accounts").upsert({
      business_id: businessId,
      google_email: email,
      gbp_account_name: account.name,
      gbp_location_name: locationName,
      gbp_location_title: locationTitle,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token || existing?.refresh_token || null,
      token_expires_at: expiresAt,
      sync_enabled: syncEnabled,
      last_sync_status: status,
      last_sync_error: null,
    });

    return redirect("/app/configuracion?google_business=connected");
  } catch (e) {
    console.error("google-business-oauth-callback error:", (e as Error).message);
    return redirect("/app/configuracion?google_business_error=token_exchange_failed");
  }
});
