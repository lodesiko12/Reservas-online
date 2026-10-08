/**
 * P01 · T1 caos→solución · S40 · restaurantes — "Reservó… y no vino."
 * Todo en BEATS (a 120 BPM: 1 beat = 0,5 s). Cada escena empieza en un golpe de la canción.
 * Estructura S40: gancho 4 · caos 8 · giro 2 · 3 funciones × 6 · resultado 2 · EndCard 6.
 */

export const P01_BEATS = {
  hook: 0,
  chaos: 4,
  /** "Hay otra forma." — el kick más fuerte (el drop de la pista). */
  pivot: 12,
  reminder: 14,
  reply: 20,
  resale: 26,
  result: 32,
  end: 34,
  total: 40,
} as const;

/** Textos en pantalla (≤ 6 palabras por pantalla; la 2.ª línea, en color de acento). */
export const P01_TEXT = {
  hook: { l1: "Reservó…", l2: "y no vino." },
  chaos: { l1: "¿Te suena?" },
  pivot: { l1: "Hay otra", l2: "forma." },
  reminder: { l1: "Recordatorio", l2: "automático." },
  reply: { l1: "Marta responde,", l2: "mesa confirmada ✓" },
  resale: { l1: "Si cancelan,", l2: "se vuelve a vender" },
  result: { l1: "Ayuda a reducir", l2: "las mesas vacías." },
} as const;

/** Notas de caos: cada una cae en un beat par del bloque de caos. */
export const P01_STICKERS = [
  { beat: 4, text: "Llamadas perdidas", x: 650, y: 620, rot: -5, bg: "#FFE27A" },
  { beat: 6, text: "Libreta tachada", x: 340, y: 1140, rot: 4, bg: "#FFFFFF", strikeBeat: 7 },
  { beat: 8, text: "¿Quién era la mesa 6?", x: 650, y: 930, rot: -3, bg: "#FFB199" },
  { beat: 10, text: "Mensajes sin leer", x: 350, y: 785, rot: 5, bg: "#A8D8FF" },
] as const;

export const P01_CHAT = {
  contact: "Marta",
  reminder: "Hola Marta 👋 Tu reserva es mañana, 21:00. ¿Nos confirmas?",
  reply: "Ahí estaremos 👍",
};
