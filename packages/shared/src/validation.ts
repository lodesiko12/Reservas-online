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

// ---------------------------------------------------------------------
// Catálogo y configuración del negocio (Servicios, Mesas, Franjas,
// Bloqueos) y formularios del super-admin. Los números llegan de
// <input type="number"> (a veces como "" o NaN): se coaccionan y se acotan.
// ---------------------------------------------------------------------

const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;
const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

function int(min: number, max: number, label: string) {
  return z.coerce.number({ invalid_type_error: `${label}: número no válido` })
    .int(`${label}: debe ser un número entero`)
    .min(min, `${label}: mínimo ${min}`)
    .max(max, `${label}: máximo ${max}`);
}

/** Entero opcional: "" / null / undefined → null. */
function optionalInt(min: number, max: number, label: string) {
  return z.preprocess((v) => (v === "" || v == null ? null : v), int(min, max, label).nullable());
}

const requiredName = (max: number) =>
  z.string().trim().min(1, "El nombre es obligatorio").max(max, `Máximo ${max} caracteres`);
const colorField = z.string().regex(HEX_COLOR_RE, "Color no válido");
const timeField = (label: string) => z.string().regex(TIME_RE, `${label}: hora no válida`);

export const professionalSchema = z.object({
  name: requiredName(NAME_MAX),
  color: colorField,
});

export const serviceSchema = z.object({
  name: requiredName(BUSINESS_NAME_MAX),
  duration_min: int(5, 1440, "Duración"),
  buffer_min: int(0, 1440, "Margen"),
  price: z.preprocess(
    (v) => (v === "" || v == null ? null : v),
    z.coerce.number({ invalid_type_error: "Precio: número no válido" })
      .min(0, "Precio: no puede ser negativo").max(1_000_000, "Precio: demasiado alto").nullable(),
  ),
});

export const diningZoneSchema = z.object({ name: requiredName(NAME_MAX) });

const capacityRange = <T extends { cap_min: number; cap_max: number }>(v: T, ctx: z.RefinementCtx) => {
  if (v.cap_max < v.cap_min) ctx.addIssue({ code: "custom", path: ["cap_max"], message: "El máximo no puede ser menor que el mínimo" });
};

export const diningTableSchema = z.object({
  name: requiredName(NAME_MAX),
  cap_min: int(1, 500, "Mín. personas"),
  cap_max: int(1, 500, "Máx. personas"),
  priority: int(-1000, 1000, "Prioridad"),
}).superRefine(capacityRange);

export const diningComboSchema = z.object({
  name: optionalText(NAME_MAX),
  table_ids: z.array(z.string().uuid()).min(2, "Elige al menos 2 mesas").max(50, "Demasiadas mesas"),
  cap_min: int(1, 500, "Mín. personas"),
  cap_max: int(1, 500, "Máx. personas"),
  priority: int(-1000, 1000, "Prioridad"),
}).superRefine(capacityRange);

export const diningShiftSchema = z.object({
  name: requiredName(NAME_MAX),
  start_time: timeField("Inicio"),
  end_time: timeField("Fin"),
  max_covers: int(1, 10000, "Aforo"),
  slot_interval_min: int(5, 240, "Intervalo"),
  booking_duration_min: int(15, 720, "Duración de mesa"),
  cleanup_min: int(0, 240, "Limpieza"),
  active_weekdays: z.array(int(0, 6, "Día")).min(1, "Elige al menos un día activo").max(7),
  last_call_time: z.preprocess((v) => (v === "" ? null : v), timeField("Última reserva").nullable()),
  max_covers_per_slot: optionalInt(1, 10000, "Máx. comensales por slot"),
  max_bookings_per_slot: optionalInt(1, 10000, "Máx. reservas por slot"),
  online_max_covers: optionalInt(1, 10000, "Stock online"),
});

export const diningDurationRuleSchema = z.object({
  pax_min: int(1, 500, "Desde"),
  pax_max: int(1, 500, "Hasta"),
  duration_min: int(15, 720, "Minutos"),
}).superRefine((v, ctx) => {
  if (v.pax_max < v.pax_min) ctx.addIssue({ code: "custom", path: ["pax_max"], message: "\"Hasta\" no puede ser menor que \"Desde\"" });
});

export const blockReasonSchema = optionalText(200);

/** Zona horaria IANA (Europe/Madrid…): la valida el propio motor de Intl. */
const timezoneField = z.string().trim().min(1, "La zona horaria es obligatoria").max(64, "Zona horaria no válida")
  .refine((tz) => { try { new Intl.DateTimeFormat("es", { timeZone: tz }); return true; } catch { return false; } }, "Zona horaria no válida");

const slugField = z.string().trim().toLowerCase().min(2, "El slug es obligatorio (mín. 2 caracteres)").max(60, "Slug: máximo 60 caracteres")
  .regex(SLUG_RE, "Slug: solo minúsculas, números y guiones");

const BUSINESS_TYPES = ["citas", "restaurante", "psicologo", "autonomo"] as const;

export const adminEditBusinessSchema = z.object({
  name: requiredName(BUSINESS_NAME_MAX),
  slug: slugField,
  primary_color: colorField,
  timezone: timezoneField,
  type: z.enum(BUSINESS_TYPES),
  default_capacity: int(1, 10000, "Aforo por defecto"),
  slot_interval_min: int(5, 240, "Granularidad"),
});

/** Contraseña de alta: mismo tope que bcrypt (72 bytes). */
const passwordField = z.string().min(8, "La contraseña debe tener al menos 8 caracteres").max(72, "Contraseña: máximo 72 caracteres");

export const adminNewBusinessSchema = z.object({
  name: requiredName(BUSINESS_NAME_MAX),
  slug: slugField,
  type: z.enum(BUSINESS_TYPES),
  primary_color: colorField,
  timezone: timezoneField,
  staff_name: optionalText(NAME_MAX),
  staff_email: z.string().trim().min(1, "El email es obligatorio").max(EMAIL_MAX, `Máximo ${EMAIL_MAX} caracteres`).email("Email no válido"),
  staff_password: passwordField,
});

export const adminAddMemberSchema = z.object({
  email: z.string().trim().min(1, "El email es obligatorio").max(EMAIL_MAX, `Máximo ${EMAIL_MAX} caracteres`).email("Email no válido"),
  password: z.preprocess((v) => (v === "" ? undefined : v), passwordField.optional()),
  role: z.enum(["owner", "staff"]),
});

/** Primer mensaje de error de un resultado safeParse fallido. */
export function firstIssue(error: z.ZodError, fallback = "Revisa los datos del formulario."): string {
  return error.issues[0]?.message ?? fallback;
}
