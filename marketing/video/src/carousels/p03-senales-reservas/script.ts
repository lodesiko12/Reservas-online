/**
 * P03 · Carrusel C · restaurantes — "¿Tu restaurante necesita reservas online?"
 * 5 diapositivas = 5 fotogramas de la composición (frame N → diapositiva N+1).
 *
 * El calendario titulaba "5 señales" pero solo traía 3 (libreta, llamadas, mesa doble):
 * se publica como "3 señales" para que la portada no prometa lo que no hay.
 */

export const P03_SLIDES = 5;

export const P03_TEXT = {
  cover: { kicker: "3 señales", l1: "¿Tu restaurante necesita", l2: "reservas online?" },
  signals: [
    { l1: "Apuntas reservas", l2: "en una libreta.", sub: "Y nadie entiende tu letra." },
    { l1: "Coges el teléfono", l2: "en pleno servicio.", sub: "Y la cocina esperando." },
    { l1: "Das una mesa", l2: "dos veces.", sub: "Y llegan los dos a la vez." },
  ],
  close: {
    l1: "Hay otra",
    l2: "forma.",
    /** Cada chip responde a una señal (libreta · teléfono · mesa doble). */
    chips: ["Reservas web 24 h", "Sin llamadas", "Sin mesas dobles"],
    cta: "Comenta “DEMO”",
    ctaSub: "y te lo enseño",
  },
  swipe: "Desliza",
} as const;

/** Datos 100 % ficticios. */
export const P03_DATA = {
  business: "Bar La Esquina",
  notebook: {
    day: "Sáb 10 · cenas",
    rows: [
      { time: "21:00", who: "Marta", n: "x4" },
      { time: "21:30", who: "Pérez", fix: "López", n: "2" },
      { time: "21:00", who: "Lola", n: "2  ¿mesa?" },
      { time: "22:00", who: "Sr. ¿Pérez?", n: "¿6 o 7?" },
    ],
    postIt: "¿Quién era\nla mesa 6?",
  },
  tickets: [
    { table: "Mesa 6", when: "Sáb · 21:00", who: "Marta · 4 pers." },
    { table: "Mesa 6", when: "Sáb · 21:00", who: "Sr. Pérez · 2 pers." },
  ],
  agenda: {
    date: "sábado, 10 de octubre",
    rows: [
      { start: "13:30", end: "15:00", who: "Lola Gil", where: "Mesa 3 · 2 pers.", src: "web" },
      { start: "14:00", end: "15:30", who: "Sr. Pérez", where: "Mesa 6 · 2 pers.", src: "manual" },
      { start: "20:30", end: "22:00", who: "Marta Ruiz", where: "Mesa 6 · 4 pers.", src: "web" },
      { start: "21:00", end: "22:30", who: "Nerea Sanz", where: "Terraza 2 · 3 pers.", src: "web" },
      { start: "21:30", end: "23:00", who: "Carlos Mora", where: "Barra 1 · 2 pers.", src: "web" },
      { start: "22:00", end: "23:30", who: "Pablo Vidal", where: "Mesa 8 · 6 pers.", src: "web" },
    ],
  },
} as const;
