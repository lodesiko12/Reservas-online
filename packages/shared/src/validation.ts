// Límites y formato para los datos de contacto que el widget envía a
// create-booking. Deben coincidir con los del propio Edge Function
// (supabase/functions/_shared/validation.ts) — esto es solo la primera
// barrera (feedback inmediato en el formulario); el servidor revalida.
import { z } from "zod";

export const NAME_MAX = 100;
export const PHONE_MAX = 30;
export const EMAIL_MAX = 254;
export const NOTES_MAX = 1000;

const PHONE_RE = /^[0-9+\s().-]+$/;

export const bookingContactSchema = z.object({
  name: z.string().trim().min(1, "El nombre es obligatorio").max(NAME_MAX, `Máximo ${NAME_MAX} caracteres`),
  lastName: z.string().trim().max(NAME_MAX, `Máximo ${NAME_MAX} caracteres`).optional().default(""),
  phone: z.string().trim().min(1, "El teléfono es obligatorio").max(PHONE_MAX, `Máximo ${PHONE_MAX} caracteres`)
    .regex(PHONE_RE, "Teléfono no válido"),
  email: z.string().trim().min(1, "El email es obligatorio").max(EMAIL_MAX, `Máximo ${EMAIL_MAX} caracteres`)
    .email("Email no válido"),
  notes: z.string().trim().max(NOTES_MAX, `Máximo ${NOTES_MAX} caracteres`).optional().default(""),
});

export type BookingContact = z.infer<typeof bookingContactSchema>;
export type BookingContactInput = { name: string; lastName: string; phone: string; email: string; notes: string };

export function validateBookingContact(input: BookingContactInput) {
  return bookingContactSchema.safeParse(input);
}

// ---------------------------------------------------------------------
// Validadores genéricos para el resto de formularios del panel (datos de
// cliente, notas de sesión, ajustes de negocio…): mismo patrón que arriba
// — trim + límite de longitud siempre, formato solo cuando el campo trae
// algo. Campo vacío u opcional se normaliza a `undefined` antes de validar.
// ---------------------------------------------------------------------

function normalize(v: unknown): unknown {
  if (typeof v !== "string") return v;
  const t = v.trim();
  return t === "" ? undefined : t;
}

/** Texto opcional con tope de longitud (sin restricción de formato). */
export function optionalText(maxLen: number) {
  return z.preprocess(normalize, z.string().max(maxLen, `Máximo ${maxLen} caracteres`).optional());
}

/** Texto opcional que, si trae algo, debe cumplir un patrón. */
export function optionalPattern(re: RegExp, maxLen: number, message: string) {
  return z.preprocess(normalize, z.string().max(maxLen, `Máximo ${maxLen} caracteres`).regex(re, message).optional());
}

export function optionalEmail(maxLen = EMAIL_MAX) {
  return z.preprocess(normalize, z.string().max(maxLen, `Máximo ${maxLen} caracteres`).email("Email no válido").optional());
}

export function optionalUrl(maxLen = 500) {
  return z.preprocess(normalize, z.string().max(maxLen, `Máximo ${maxLen} caracteres`).url("URL no válida").optional());
}

const POSTAL_CODE_RE = /^[0-9A-Za-z][0-9A-Za-z \-]{1,9}$/;

/** Ficha de cliente (EditarTab): todo opcional salvo el nombre. */
export const customerProfileSchema = z.object({
  full_name: z.string().trim().min(1, "El nombre es obligatorio").max(NAME_MAX, `Máximo ${NAME_MAX} caracteres`),
  last_name: optionalText(NAME_MAX),
  phone: optionalPattern(PHONE_RE, PHONE_MAX, "Teléfono no válido"),
  email: optionalEmail(),
  nif: optionalText(20),
  profession: optionalText(100),
  address: optionalText(200),
  city: optionalText(100),
  province: optionalText(100),
  postal_code: optionalPattern(POSTAL_CODE_RE, 10, "Código postal no válido"),
});
export type CustomerProfile = z.infer<typeof customerProfileSchema>;

/** Alta rápida en lista de espera / walk-in (nombre y teléfono sueltos). */
export const waitlistEntrySchema = z.object({
  name: optionalText(NAME_MAX),
  phone: optionalPattern(PHONE_RE, PHONE_MAX, "Teléfono no válido"),
  notes: optionalText(500),
});
export type WaitlistEntry = z.infer<typeof waitlistEntrySchema>;

export const SESSION_NOTES_MAX = 5000;

/** Notas de sesión (psicólogo): todos los campos son textareas largas y opcionales. */
export const clientSessionSchema = z.object({
  objetivo: optionalText(SESSION_NOTES_MAX),
  notas: optionalText(SESSION_NOTES_MAX),
  seguimiento: optionalText(SESSION_NOTES_MAX),
  tareas_pautas: optionalText(SESSION_NOTES_MAX),
});
export type ClientSession = z.infer<typeof clientSessionSchema>;

export const BUSINESS_NAME_MAX = 150;
export const BUSINESS_MESSAGE_MAX = 2000;

export const businessBrandingSchema = z.object({
  name: z.string().trim().min(1, "El nombre es obligatorio").max(BUSINESS_NAME_MAX, `Máximo ${BUSINESS_NAME_MAX} caracteres`),
});

export const businessReviewSchema = z.object({
  reviewUrl: optionalUrl(500),
  reviewMessage: optionalText(BUSINESS_MESSAGE_MAX),
});
