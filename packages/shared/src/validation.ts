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
