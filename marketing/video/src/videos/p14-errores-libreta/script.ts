/**
 * P14 · T6 lista numerada · restaurantes — "3 errores de quien reserva en libreta" (dom 11 oct).
 * Todo en BEATS (a 120 BPM: 1 beat = 0,5 s). Pista con el drop en el beat 28 (`TRACK_DROP28`): los tres errores
 * van sobre fondo oscuro (cada uno remata con un golpe) y el fondo claro de la solución se abre en el drop.
 * Estructura: título 4 · error 1 (8) · error 2 (8) · error 3 (8) · solución 4 · EndCard 6  (38 beats = 19 s).
 * Cada error: rótulo + libreta que se va escribiendo (1 línea por beat) → a mitad del bloque el error salta
 * (círculo rojo / sello / contador que se vuelve "?") con thud.
 */

export const P14_BEATS = {
  title: 0,
  e1: 4,
  e2: 12,
  e3: 20,
  /** Drop: fondo claro y agenda ordenada. */
  fix: 28,
  end: 32,
  cta: 36,
  total: 38,
} as const;

/** Dentro de cada bloque de 8 beats: cuándo salta el error. */
export const P14_ERROR_AT = 4;

export const P14_TEXT = {
  title: { l1: "3 errores", l2: "de la libreta." },
  errors: [
    { l1: "Mesa", l2: "doble.", tag: "¡Mesa doble!" },
    { l1: "Cliente", l2: "sin avisar.", tag: "¿Vendrá?" },
    { l1: "Nadie sabe", l2: "cuántos son.", tag: "¿Cuántos somos?" },
  ],
  fix: { l1: "Una agenda", l2: "que no tacha." },
  tagline: "Tu negocio, sin papeles.",
} as const;

/** Datos 100 % ficticios. */
export const P14_DATA = {
  /** Error 1: dos nombres para la misma mesa y hora. */
  rows1: ["20:30 · Lola · 2 — Mesa 1", "21:00 · Marta · 4 — Mesa 4", "21:00 · Sr. Pérez · 4 — Mesa 4"],
  /** Error 2: reserva de las 21:30; el reloj llega a las 22:15 y no ha aparecido. */
  rows2: ["21:30 · Pablo · 6 — Mesa 6"],
  clock: { from: [21, 30], to: [22, 15] },
  /** Error 3: el total de comensales cambia según a quién preguntes. */
  guesses: [47, 52, 39, 60, 44, 55],
  /** Solución: agenda en vista Día con la mesa 4 sin doble reserva. */
  agenda: [
    { start: "20:30", end: "22:00", name: "Lola", detail: "Mesa 1 · 2 pers.", source: "web" as const },
    { start: "21:00", end: "22:30", name: "Marta", detail: "Mesa 4 · 4 pers.", source: "web" as const },
    { start: "21:00", end: "22:30", name: "Sr. Pérez", detail: "Mesa 5 · 4 pers.", source: "manual" as const },
  ],
  agendaDate: "sábado, 10 de octubre",
} as const;
