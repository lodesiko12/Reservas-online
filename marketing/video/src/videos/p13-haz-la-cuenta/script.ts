/**
 * P13 · T3 la cuenta · S32 · restaurantes — "Haz la cuenta." (dom 11 oct).
 * Todo en BEATS (a 120 BPM: 1 beat = 0,5 s). Pista por defecto (`TRACK`, drop en el beat 12):
 *  - 0-4 gancho: calculadora gigante;
 *  - 4-12 la cuenta: 3 mesas vacías × 25 € = 75 € por noche; × 26 noches; el número sube con un tick por golpe
 *    y aterriza EXACTAMENTE en el drop (beat 12): "1.950 €/mes" rojo, tiembla, con "(ejemplo)";
 *  - 12-16 el número tiembla (fondo oscuro = problema);
 *  - 16-24 fondo claro: tres herramientas de Turnigo que ayudan a reducir esa cifra;
 *  - 24-28 "Haz tu propia cuenta": huecos por rellenar; 28-32 EndCard con la variante de CTA de pregunta.
 *
 * Cifras SIEMPRE "(ejemplo)". Sin porcentajes de mejora: "ayuda a reducir", nunca "reduce un X %".
 */

export const P13_BEATS = {
  hook: 0,
  /** Empieza la cuenta: 3 mesas × 25 €. */
  perNight: 4,
  /** = 75 € por noche → × 26 noches. */
  perMonth: 8,
  /** El contador empieza a subir (acaba en el drop). */
  rise: 10,
  /** Drop: el total aterriza. */
  hit: 12,
  /** Fondo claro: las tres herramientas. */
  tools: 16,
  yourTurn: 24,
  end: 28,
  cta: 30,
  total: 32,
} as const;

export const P13_TEXT = {
  hook: { l1: "Haz", l2: "la cuenta." },
  perNight: { l1: "3 mesas vacías,", l2: "25 € cada una." },
  perMonth: { l1: "75 € cada noche", l2: "× 26 noches." },
  hit: { l1: "Esto se va", l2: "cada mes." },
  tools: { l1: "Para reducirlo:", l2: "tres ayudas." },
  yourTurn: { l1: "Haz tu propia", l2: "cuenta." },
  unit: "/mes",
  example: "(ejemplo)",
  tagline: "Haz tu propia cuenta.",
  cta: "Comenta cuántas mesas pierdes",
  hint: "y te enseño cómo reducirlo",
} as const;

/** Cifras de ejemplo (siempre con "(ejemplo)" en pantalla). */
export const P13_NUMBERS = { tables: 3, price: 25, perNight: 75, nights: 26, total: 1950 } as const;

/** Las tres ayudas (iconos genéricos; sin logos de terceros). */
export const P13_TOOLS = [
  { icon: "chat", title: "Recordatorio", sub: "24 h antes, por WhatsApp", beat: 17 },
  { icon: "list", title: "Lista de espera", sub: "Si se libera una mesa", beat: 19 },
  { icon: "globe", title: "Reserva online", sub: "A cualquier hora, sin llamar", beat: 21 },
] as const;

/** Huecos de la cuenta propia. */
export const P13_BLANKS = [
  { label: "mesas", beat: 24.5 },
  { label: "€ cada una", beat: 25.5 },
  { label: "noches", beat: 26.5 },
] as const;
