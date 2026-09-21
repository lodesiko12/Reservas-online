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

// ---------------------------------------------------------------------
// Business Profile (ficha de Google Business): a diferencia de Calendar,
// la conexión es POR NEGOCIO (una ficha, no una por profesional), así que
// el `state` firmado no lleva professional_id.
// ---------------------------------------------------------------------

/** Firma un state `${business_id}.${expiresAtMs}` para el flujo OAuth de Business Profile (a nivel de negocio). */
export async function signBusinessState(businessId: string, secret: string, ttlMs = 10 * 60 * 1000): Promise<string> {
  const payload = `${businessId}.${Date.now() + ttlMs}`;
  const sig = await hmac(secret, payload);
  return `${btoa(payload)}.${sig}`;
}

/** Verifica el state de signBusinessState y devuelve {businessId} o null si no es válido/ha caducado. */
export async function verifyBusinessState(state: string, secret: string): Promise<{ businessId: string } | null> {
  const [payloadB64, sig] = state.split(".");
  if (!payloadB64 || !sig) return null;
  let payload: string;
  try { payload = atob(payloadB64); } catch { return null; }
  const expectedSig = await hmac(secret, payload);
  if (expectedSig !== sig) return null;
  const [businessId, expiresAt] = payload.split(".");
  if (!businessId || !expiresAt) return null;
  if (Date.now() > Number(expiresAt)) return null;
  return { businessId };
}

export type GbpAccount = { name: string };
export type GbpLocation = { name: string; title?: string };

/** Lista las cuentas de Google Business Profile que gestiona el usuario conectado. */
export async function listGoogleBusinessAccounts(accessToken: string): Promise<GbpAccount[]> {
  const res = await fetch("https://mybusinessaccountmanagement.googleapis.com/v1/accounts", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Google Business accounts error ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.accounts ?? [];
}

/** Lista las ubicaciones (fichas) de una cuenta de Business Profile. */
export async function listGoogleBusinessLocations(accessToken: string, accountName: string): Promise<GbpLocation[]> {
  const url = `https://mybusinessbusinessinformation.googleapis.com/v1/${accountName}/locations?readMask=name,title`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!res.ok) throw new Error(`Google Business locations error ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.locations ?? [];
}

export type GbpTime = { hours?: number; minutes?: number };
export type GbpPeriod = { openDay: string; openTime: GbpTime; closeDay: string; closeTime: GbpTime };

/** Lee el horario semanal general (`regularHours`) de una ubicación de Business Profile. */
export async function getGoogleBusinessLocationHours(accessToken: string, locationName: string): Promise<GbpPeriod[]> {
  const url = `https://mybusinessbusinessinformation.googleapis.com/v1/${locationName}?readMask=regularHours`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!res.ok) throw new Error(`Google Business hours error ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.regularHours?.periods ?? [];
}
