/**
 * P06 · Carrusel C · general — "¿Qué es Turnigo? En 5 diapositivas".
 * 5 diapositivas = 5 fotogramas de la composición (frame N → diapositiva N+1).
 * Portada oscura (la pregunta) → 3 funciones en claro (la solución) → cierre oscuro con logo y CTA,
 * igual que la simetría de los vídeos.
 */

export const P06_SLIDES = 5;

export const P06_TEXT = {
  cover: { kicker: "En 5 diapositivas", l1: "¿Qué es", l2: "Turnigo?", sub: "Reservas, agenda y avisos en un solo sitio." },
  features: [
    {
      l1: "Reservas online",
      l2: "en tu web.",
      sub: "Tus clientes reservan solos, 24 h.",
      chips: ["Sin cuenta ni contraseña", "Solo días con hueco"],
    },
    {
      l1: "Agenda y sala,",
      l2: "en vivo.",
      sub: "Todo el servicio de un vistazo.",
      chips: ["Sentar · No-show · Liberar"],
    },
    {
      l1: "Recordatorios y",
      l2: "reseñas, solos.",
      sub: "Antes, WhatsApp. Después, reseña.",
      chips: [],
    },
  ],
  close: {
    l1: "Hecho para",
    l2: "tu negocio.",
    tiles: ["Restaurantes", "Peluquerías y estética", "Consultas", "Autónomos"],
    cta: "Comenta “DEMO”",
    ctaSub: "y te lo enseño",
  },
  swipe: "Desliza",
} as const;

/** Datos 100 % ficticios. */
export const P06_DATA = {
  business: "Bar La Esquina",
  widget: {
    brand: "#4F46E5",
    guests: 4,
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
  },
  reminder: "Hola Marta 👋 Te recordamos tu reserva de mañana a las 21:00.",
  reply: "¡Ahí estaremos! 👍",
  review: { subject: "¿Qué tal tu visita, Marta?", body: "Tu opinión nos ayuda mucho.", button: "Dejar reseña" },
} as const;
