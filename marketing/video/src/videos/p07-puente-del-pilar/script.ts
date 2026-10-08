/**
 * P07 · T4 texto cinético · S24 · restaurantes — "Puente del Pilar." (vie 9 - lun 12 oct).
 * Todo en BEATS (a 120 BPM: 1 beat = 0,5 s). Pista por defecto (`TRACK`, drop en el beat 12):
 * el drop cae justo en "¿Y los que no aparecen?" — el golpe es el problema; el fondo claro
 * (la solución) se abre en el 16.
 * Una frase por escena de 4 beats; cada palabra entra en un golpe.
 */

export const P07_BEATS = {
  bridge: 0,
  full: 4,
  count: 8,
  /** Drop: 3 mesas se ponen rojas. */
  noShow: 12,
  /** Fondo claro: recordatorio por WhatsApp 24 h antes. */
  reminder: 16,
  end: 20,
  cta: 22,
  total: 24,
} as const;

export const P07_TEXT = {
  bridge: { l1: "Puente del", l2: "Pilar." },
  full: { l1: "Sala", l2: "llena." },
  count: { l1: "Reservas", l2: "hasta arriba." },
  noShow: { l1: "¿Y los que", l2: "no aparecen?" },
  reminder: { l1: "Que no te pille", l2: "sin recordatorios." },
  countLabel: "reservas este puente",
  example: "(ejemplo)",
  noShowTag: "No vino",
  reminderChip: "24 h antes · automático",
} as const;

/** Días del puente (2026). El lunes 12 es festivo nacional. */
export const P07_DAYS = [
  { dow: "VIE", day: 9 },
  { dow: "SÁB", day: 10 },
  { dow: "DOM", day: 11 },
  { dow: "LUN", day: 12, holiday: true },
] as const;

/** Cifra de ejemplo (siempre con "(ejemplo)" en pantalla). */
export const P07_COUNT = 148;

/** Mesas que fallan en el drop (índices de la cuadrícula 4×3). */
export const P07_NO_SHOWS = [2, 7, 9] as const;

/** Datos 100 % ficticios (mismo tono que el recordatorio de P01). */
export const P07_REMINDER = "Hola Marta 👋 Tu reserva es mañana, sáb 10 a las 21:00. ¡Te esperamos!";
