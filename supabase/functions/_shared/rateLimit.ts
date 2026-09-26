// Rate limiting para Edge Functions: contador de ventana fija en Postgres
// (tabla rate_limits + función rate_limit_hit, ver
// supabase/migrations/0032_rate_limiting.sql). Cada función decide sus
// propios límites; este helper solo hace la llamada y arma la respuesta 429.
import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { json } from "./cors.ts";

/** IP del llamante a partir de las cabeceras que pone la plataforma delante del edge function. */
export function getClientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("cf-connecting-ip") ?? "unknown";
}

/**
 * true si la petición cabe dentro del límite; false si hay que devolver 429.
 * `key` debe incluir el nombre de la función para no compartir contador
 * entre endpoints distintos (p.ej. "create-booking:ip:1.2.3.4").
 */
export async function rateLimitHit(
  service: SupabaseClient,
  key: string,
  max: number,
  windowSeconds: number
): Promise<boolean> {
  const { data, error } = await service.rpc("rate_limit_hit", {
    p_key: key,
    p_max: max,
    p_window_seconds: windowSeconds,
  });
  if (error) {
    // Si el propio limitador falla, no bloqueamos la petición por eso.
    console.error("rate_limit_hit error:", error.message);
    return true;
  }
  return data === true;
}

export function tooManyRequests(retryAfterSeconds: number): Response {
  const res = json({ error: "Demasiadas peticiones. Inténtalo de nuevo en unos minutos." }, 429);
  res.headers.set("Retry-After", String(retryAfterSeconds));
  return res;
}
