/**
 * P05 · T2 VS pantalla partida · S32 · general — "Libreta VS Turnigo", montado como un combate a 3 rondas.
 * Todo en BEATS (120 BPM: 1 beat = 0,5 s). Pista con el drop en el beat 4 (`TRACK_DROP4`): el título se
 * construye sobre el riser y el combate arranca en el golpe.
 * Ritmo de pregunta-respuesta: la izquierda (libreta) actúa en el beat y la derecha (Turnigo) responde en el
 * contratiempo (+0,5). Cada ronda acaba con un punto para Turnigo en su último beat.
 * Estructura: título 4 · ronda 1 8 · ronda 2 8 · ronda 3 6 · K.O. 2 · EndCard 4.
 */

export const P05_BEATS = {
  titleLeft: 0,
  titleRight: 1,
  vs: 2,
  r1: 4,
  r1Point: 11,
  r2: 12,
  r2Point: 19,
  r3: 20,
  r3Point: 25,
  ko: 26,
  end: 28,
  cta: 30,
  total: 32,
} as const;

export const P05_ROUNDS = ["RONDA 1 · Reservas", "RONDA 2 · Orden", "RONDA 3 · No-shows"] as const;

/** Ronda 1: la libreta pierde llamadas (beats 5-9); Turnigo recibe reservas solas (beats 5,5-9,5). */
export const P05_R1 = {
  missed: ["20:41", "20:44", "20:52", "21:03", "21:10"],
  booked: [
    { name: "Marta · 4 pers.", sub: "sáb 21:00 · web" },
    { name: "Lola · 2 pers.", sub: "sáb 20:30 · web" },
    { name: "Sr. Pérez · 6 pers.", sub: "sáb 21:00 · web" },
    { name: "Nuria · 3 pers.", sub: "sáb 22:15 · web" },
    { name: "Andrés · 2 pers.", sub: "dom 14:00 · web" },
  ],
  verdictLeft: "✗ 5 perdidas",
  verdictRight: "✓ Entran solas",
};

/** Ronda 2: apuntes a mano (con tachón y un nombre repetido) frente a la agenda ordenada. */
export const P05_R2 = {
  notes: [
    { text: "20:30 Lola – 2", beat: 13 },
    { text: "21:00 Pérez – 6", beat: 14, circleBeat: 18 },
    { text: "21:30 Marta 4", beat: 15, strikeBeat: 16 },
    { text: "22:00 Marta 4", beat: 16.5 },
    { text: "21:00 Pérez – 6", beat: 17, circleBeat: 18 },
  ],
  agenda: [
    { time: "20:30", name: "Lola", pax: 2, beat: 13.5 },
    { time: "21:00", name: "Sr. Pérez", pax: 6, beat: 14.5 },
    { time: "22:00", name: "Marta", pax: 4, beat: 16.5 },
    { time: "22:15", name: "Nuria", pax: 3, beat: 17.5 },
  ],
  verdictRight: "✓ Todo en orden",
};

/** Ronda 3: la mesa 4 se queda vacía frente al recordatorio de WhatsApp que la confirma. */
export const P05_R3 = {
  reminder: "Hola Marta 👋 Te esperamos mañana a las 21:00.",
  reply: "¡Ahí estaremos! 👍",
};

export const P05_KO = { l1: "Adiós,", l2: "libreta." };
