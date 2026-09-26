// Validación de inputs de negocio para Edge Functions públicas/con datos de
// usuario: formato y límite de longitud antes de pasar cualquier valor a un
// RPC. Primera barrera (defensa en profundidad); las RPC y sus constraints
// siguen siendo la fuente de verdad. Límites alineados con
// packages/shared/src/validation.ts (usado por los formularios del widget).
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[0-9+\s().-]+$/;

export function isUuid(v: unknown): v is string {
  return typeof v === "string" && UUID_RE.test(v);
}

/** Recorta espacios y valida longitud; null si no es texto válido no vacío. */
export function cleanText(v: unknown, maxLen: number): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  if (!t || t.length > maxLen) return null;
  return t;
}

/** Igual que cleanText pero permite cadena vacía (campo opcional). */
export function cleanOptionalText(v: unknown, maxLen: number): string {
  if (typeof v !== "string") return "";
  const t = v.trim();
  return t.length <= maxLen ? t : t.slice(0, maxLen);
}

export function isEmail(v: unknown, maxLen = 254): v is string {
  return typeof v === "string" && v.length > 0 && v.length <= maxLen && EMAIL_RE.test(v);
}

export function isPhone(v: unknown, maxLen = 30): v is string {
  return typeof v === "string" && v.trim().length > 0 && v.length <= maxLen && PHONE_RE.test(v);
}

export function isIsoDate(v: unknown): v is string {
  return typeof v === "string" && v.length <= 40 && !Number.isNaN(Date.parse(v));
}

export function isPositiveInt(v: unknown, max = 1000): v is number {
  return typeof v === "number" && Number.isInteger(v) && v > 0 && v <= max;
}
