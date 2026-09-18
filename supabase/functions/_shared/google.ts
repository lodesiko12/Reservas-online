// Helpers de integración con Google Calendar: firma/verificación del
// "state" OAuth (evita que alguien inicie el flujo para un profesional
// que no le pertenece), intercambio/refresco de tokens y llamadas mínimas
// a la API de Google Calendar (eventos + freebusy).

async function hmac(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return btoa(String.fromCharCode(...new Uint8Array(sig))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Firma un state `${business_id}.${professional_id}.${expiresAtMs}` para el flujo OAuth. */
export async function signOAuthState(businessId: string, professionalId: string, secret: string, ttlMs = 10 * 60 * 1000): Promise<string> {
  const payload = `${businessId}.${professionalId}.${Date.now() + ttlMs}`;
  const sig = await hmac(secret, payload);
  return `${btoa(payload)}.${sig}`;
}

/** Verifica el state y devuelve {businessId, professionalId} o null si no es válido/ha caducado. */
export async function verifyOAuthState(state: string, secret: string): Promise<{ businessId: string; professionalId: string } | null> {
  const [payloadB64, sig] = state.split(".");
  if (!payloadB64 || !sig) return null;
  let payload: string;
  try { payload = atob(payloadB64); } catch { return null; }
  const expectedSig = await hmac(secret, payload);
  if (expectedSig !== sig) return null;
  const [businessId, professionalId, expiresAt] = payload.split(".");
  if (!businessId || !professionalId || !expiresAt) return null;
  if (Date.now() > Number(expiresAt)) return null;
  return { businessId, professionalId };
}

export type GoogleTokens = { access_token: string; refresh_token?: string; expires_in: number };

/** Intercambia el `code` de la redirección de Google por tokens. */
export async function exchangeCodeForTokens(
  clientId: string, clientSecret: string, code: string, redirectUri: string
): Promise<GoogleTokens> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId, client_secret: clientSecret, code,
      redirect_uri: redirectUri, grant_type: "authorization_code",
    }),
  });
  if (!res.ok) throw new Error(`Google token exchange error ${res.status}: ${await res.text()}`);
  return res.json();
}

/** Renueva el access_token con el refresh_token guardado. */
export async function refreshAccessToken(
  clientId: string, clientSecret: string, refreshToken: string
): Promise<{ access_token: string; expires_in: number }> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken, grant_type: "refresh_token",
    }),
  });
  if (!res.ok) throw new Error(`Google token refresh error ${res.status}: ${await res.text()}`);
  return res.json();
}

export async function getGoogleUserEmail(accessToken: string): Promise<string | null> {
  const res = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data.email ?? null;
}

export type GoogleEvent = {
  summary: string; description?: string; startsAt: string; endsAt: string; timezone: string;
};

export async function upsertGoogleEvent(
  accessToken: string, calendarId: string, existingEventId: string | null, ev: GoogleEvent
): Promise<string> {
  const body = {
    summary: ev.summary,
    description: ev.description,
    start: { dateTime: ev.startsAt, timeZone: ev.timezone },
    end: { dateTime: ev.endsAt, timeZone: ev.timezone },
  };
  const base = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`;
  const url = existingEventId ? `${base}/${existingEventId}` : base;
  const res = await fetch(url, {
    method: existingEventId ? "PATCH" : "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Google Calendar event error ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.id;
}

export async function deleteGoogleEvent(accessToken: string, calendarId: string, eventId: string): Promise<void> {
  const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${eventId}`;
  const res = await fetch(url, { method: "DELETE", headers: { Authorization: `Bearer ${accessToken}` } });
  // 410 Gone = ya estaba borrado en Google; no es un error real.
  if (!res.ok && res.status !== 410 && res.status !== 404) {
    throw new Error(`Google Calendar delete error ${res.status}: ${await res.text()}`);
  }
}

export type BusyRange = { start: string; end: string };

/** Consulta los huecos ocupados del calendario del profesional en [timeMin, timeMax]. */
export async function queryFreeBusy(accessToken: string, calendarId: string, timeMin: string, timeMax: string): Promise<BusyRange[]> {
  const res = await fetch("https://www.googleapis.com/calendar/v3/freeBusy", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ timeMin, timeMax, items: [{ id: calendarId }] }),
  });
  if (!res.ok) throw new Error(`Google freeBusy error ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.calendars?.[calendarId]?.busy ?? [];
}
