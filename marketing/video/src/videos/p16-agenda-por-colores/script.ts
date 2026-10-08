/**
 * P16 · T2 VS · S32 · citas — "Tu agenda de papel un sábado.": agenda Semana con un color por profesional.
 * Todo en BEATS (120 BPM: 1 beat = 0,5 s). Pista con el drop en el beat 4 (`TRACK_DROP4`): la libreta se
 * garabatea sobre el riser y en el drop la pantalla se parte (papel VS Turnigo).
 *
 * Fiel a la app (apps/dashboard/src/business/Agenda.tsx): en citas cada bloque se tiñe con el color del
 * profesional (fondo al 28 % + borde izquierdo de 4 px); encima de la semana hay una leyenda "Todas" + un chip por
 * profesional. Al pulsar un chip: ese chip lleva anillo oscuro, los demás se apagan (opacidad 40 % + gris), las citas
 * de los demás DESAPARECEN (no se atenúan) y sale el recuento "N citas". Colores de la paleta real (migración 0017).
 * Semana reconstruida con pocos bloques (la demo real es demasiado densa para leerse en vídeo).
 *
 * Estructura: gancho 4 · VS 2 · cascada de colores 6 · zoom al sábado 4 · filtro 8 · EndCard 8.
 */

export const P16_BEATS = {
  hook: 0,
  /** Garabatos de la libreta (uno por medio beat). */
  scribble: [0.25, 0.75, 1.25, 1.75, 2.25],
  strike: 2.75,
  circle: 3.25,
  /** Drop: pantalla partida. */
  vs: 4,
  /** La agenda ocupa toda la pantalla. */
  board: 6,
  /** Cascada: un profesional por beat (Lola, Paula, Nerea). */
  cascade: [7, 8, 9],
  saturday: 12,
  filter: 16,
  tapPaula: 17,
  filtered: 17.5,
  end: 24,
  cta: 28,
  total: 32,
} as const;

export const P16_TEXT = {
  hook: { l1: "Tu agenda de papel", l2: "un sábado." },
  vsLeft: "PAPEL",
  vsRight: "TURNIGO",
  board: { l1: "Un color", l2: "por profesional." },
  saturday: { l1: "Todo el sábado,", l2: "de un vistazo." },
  filter: { l1: "¿Qué tiene Paula?", l2: "Solo lo suyo." },
  tagline: "Tu agenda, por colores.",
} as const;

/** Colores de la paleta real de profesionales (rosa, azul, verde). */
export const PROS = [
  { name: "Lola", color: "#ec4899" },
  { name: "Paula", color: "#3b82f6" },
  { name: "Nerea", color: "#22c55e" },
] as const;

/** Notas de la libreta (Caveat, a boli). `strike` = se tacha; `circle` = se rodea en rojo. */
export const P16_NOTES = [
  { text: "10:00 Lola – Marta (tinte)" },
  { text: "10:30 Eva  Paula?? Nerea", strike: true },
  { text: "11:00 Sra. Gil → ¿12h?" },
  { text: "12:00 ¿¿Paula o Lola??", circle: true },
  { text: "17:30 Ana — llamar!!" },
] as const;

/** Días visibles de la semana del 12 al 18 de octubre; el sábado es "hoy" (cabecera teñida). */
export const P16_DAYS = [
  { dow: "JUE", day: "15" },
  { dow: "VIE", day: "16" },
  { dow: "SÁB", day: "17", today: true },
] as const;

/** Citas ficticias: [día, inicio, minutos, profesional (índice en PROS), cliente]. */
export const P16_BOOKINGS: readonly (readonly [number, string, number, number, string])[] = [
  [0, "09:30", 60, 0, "Marta"],
  [0, "10:30", 30, 1, "Eva"],
  [0, "11:00", 45, 2, "Ana"],
  [0, "12:00", 60, 1, "Irene"],
  [0, "16:30", 60, 0, "Carmen"],
  [0, "17:30", 30, 2, "Julia"],
  [0, "18:30", 45, 1, "Sara"],
  [1, "09:00", 45, 1, "Nuria"],
  [1, "10:00", 60, 2, "Lucía"],
  [1, "11:00", 30, 0, "Rosa"],
  [1, "12:30", 45, 1, "Celia"],
  [1, "16:00", 45, 2, "Alba"],
  [1, "17:00", 60, 0, "Pilar"],
  [1, "18:30", 60, 1, "Teresa"],
  [2, "09:00", 30, 0, "Sonia"],
  [2, "09:30", 60, 1, "Marta"],
  [2, "10:30", 45, 2, "Vera"],
  [2, "11:30", 30, 0, "Inés"],
  [2, "12:00", 60, 1, "Laura"],
  [2, "13:00", 30, 2, "Elena"],
  [2, "16:30", 45, 1, "Clara"],
  [2, "17:30", 60, 0, "Noa"],
  [2, "18:30", 45, 2, "Rocío"],
];

/** Recuento que muestra la app con el filtro puesto (citas de Paula en la semana, de lunes a domingo). */
export const P16_PAULA_COUNT = "14 citas";
