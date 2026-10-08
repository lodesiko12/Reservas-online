/**
 * P02 · T10 cronómetro · S32 · general — "03:12": alguien reserva de madrugada desde el widget.
 * Todo en BEATS (a 120 BPM: 1 beat = 0,5 s). Pista con el drop en el beat 16 (`TRACK_DROP16`).
 * Estructura: gancho 4 · widget 12 (una acción por beat, cronómetro corriendo) · agenda 4 · resultado 4 · EndCard 8.
 * El orden del widget es el REAL (comensales → día y hora → formulario), no el del calendario.
 */

export const P02_BEATS = {
  hook: 0,
  widget: 4,
  tapGuests: 5,
  tapContinue: 6,
  step2: 7,
  tapDay: 8,
  tapTime: 9,
  step3: 10,
  typeName: 11,
  typePhone: 12,
  typeEmail: 13,
  tapConfirm: 14,
  asleep: 15,
  /** Drop de la pista: se abre el fondo claro con la Agenda. */
  agenda: 16,
  insert: 17,
  result: 20,
  end: 24,
  cta: 28,
  total: 32,
} as const;

export const P02_TEXT = {
  hook: { l1: "Tu bar, cerrado.", l2: "Y entra una reserva." },
  asleep: "Y tú, dormido 😴",
  agenda: { l1: "Al despertar,", l2: "ya en tu agenda." },
  result: { l1: "Reservas 24 h.", l2: "Sin llamadas." },
} as const;

/** Datos 100 % ficticios. */
export const P02_WIDGET = {
  business: "Bar La Esquina",
  brand: "#4F46E5",
  guests: 4,
  // Solo salen los días con hueco (el lunes 12 no aparece: está completo).
  days: [
    { dow: "VIE", day: 9, month: "oct" },
    { dow: "SÁB", day: 10, month: "oct" },
    { dow: "DOM", day: 11, month: "oct" },
    { dow: "MAR", day: 13, month: "oct" },
    { dow: "MIÉ", day: 14, month: "oct" },
  ],
  dayIndex: 1,
  times: ["20:00", "20:15", "20:30", "20:45", "21:00", "21:15", "21:30", "21:45", "22:00", "22:15", "22:30"],
  time: "21:00",
  dateLong: "sábado, 10 de octubre de 2026",
  form: { name: "Marta", surname: "López", phone: "600 123 123", email: "marta@ejemplo.com" },
};

export const P02_AGENDA = {
  date: "sábado, 10 de octubre de 2026",
  rows: [
    { start: "14:00", end: "15:15", name: "Sergio Molina", detail: "Mesa 3 · 2 pers.", source: "web" },
    { start: "14:30", end: "16:00", name: "Irene Ruiz", detail: "Mesa 5 · 4 pers.", source: "manual" },
    { start: "20:30", end: "22:00", name: "Nuria Díaz", detail: "Mesa 2 · 2 pers.", source: "web" },
    { start: "21:00", end: "22:45", name: "Marta López", detail: "Mesa 6 · 4 pers.", source: "web", isNew: true },
    { start: "21:45", end: "23:15", name: "Carmen Vidal", detail: "Mesa 4 · 3 pers.", source: "web" },
  ],
} as const;
