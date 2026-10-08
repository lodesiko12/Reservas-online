/**
 * P17 · T5 tour de toques · S32 · citas — "¿Solo la agenda de Paula?": filtro por profesional en la vista Día.
 * Todo en BEATS (120 BPM: 1 beat = 0,5 s). Pista por defecto (`TRACK`, drop en el beat 12): la agenda mezclada suena
 * sobre el riser y el toque en "Paula" cae justo en el drop.
 *
 * Fiel a la app (Agenda.tsx, vista Día): NO hay columnas por profesional (lo decía el calendario); es una lista de
 * filas con borde izquierdo de 5 px del color del profesional, fondo al 10 %, hora inicio/fin, cliente + servicio,
 * chip del profesional (35 %), origen y estado. Al pulsar un chip de la leyenda quedan solo sus filas, el resto de
 * chips se apaga y sale "N citas". En la fila se omite el teléfono y el chip web/manual para que el nombre se lea.
 *
 * Estructura: gancho 4 · agenda mezclada 8 · toque + filtro 6 · "Un toque." 6 · EndCard 8.
 */

export const P17_BEATS = {
  hook: 0,
  /** La leyenda cae en el gancho; "Paula" late con la pregunta. */
  chipsIn: 0.75,
  paulaPulse: 2.5,
  /** Móvil con la agenda del día (filas en cascada, una por medio beat). */
  phone: 4,
  rowsFrom: 4.5,
  /** Cada profesional "late" en su beat (sus filas brillan). */
  proPulses: [9, 10, 11],
  /** Drop: toque en "Paula". */
  tap: 12,
  oneTap: 18,
  end: 24,
  cta: 28,
  total: 32,
} as const;

export const P17_TEXT = {
  hook: { l1: "¿Solo la agenda", l2: "de Paula?" },
  mixed: { l1: "Todo el equipo,", l2: "en una lista." },
  filtered: { l1: "Solo Paula:", l2: "sus 3 citas." },
  oneTap: { l1: "Un toque.", l2: "Cada una, lo suyo." },
  tagline: "Cada profesional, su agenda.",
} as const;

export const P17_DATA = {
  business: "Estudio Nerea",
  date: "sábado, 17 de octubre de 2026",
  count: "3 citas",
  /** Sábado 17 (el mismo de P16), datos ficticios: [inicio, fin, cliente, servicio, profesional (índice en PROS)]. */
  rows: [
    ["09:00", "09:30", "Sonia Ruiz", "Manicura", 0],
    ["09:30", "10:30", "Marta Gil", "Corte y peinado", 1],
    ["10:30", "11:15", "Vera López", "Tinte", 2],
    ["11:30", "12:00", "Inés Mora", "Cejas", 0],
    ["12:00", "13:00", "Laura Díaz", "Mechas", 1],
    ["13:00", "13:30", "Elena Sanz", "Peinado", 2],
    ["16:30", "17:15", "Clara Vidal", "Corte", 1],
    ["17:30", "18:30", "Noa Pérez", "Pedicura", 0],
    ["18:30", "19:15", "Rocío León", "Tinte", 2],
  ] as const,
} as const;
