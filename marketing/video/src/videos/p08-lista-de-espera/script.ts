/**
 * P08 · T9 chat · S32 · restaurantes — "Sábado. Completo.": la lista de espera.
 * Todo en BEATS (120 BPM: 1 beat = 0,5 s). Pista con el drop en el beat 4 (`TRACK_DROP4`): el cartel y la pareja
 * que se va suenan sobre el riser; en el drop se abre el fondo claro con la solución.
 *
 * Flujo REAL de la app (PlanoSala.tsx → WaitlistSection): el equipo apunta al cliente ("+ Añadir"), cuando se libera
 * una mesa pulsa "Avisar" (WhatsApp con la plantilla de "mesa lista": nombre del cliente + nombre del negocio) y luego
 * "Sentar". La cancelación la hace el propio cliente desde su enlace de reserva; el plano se actualiza en vivo.
 *
 * Estructura: gancho 4 · lista de espera 6 · se libera una mesa 6 · aviso por WhatsApp 8 · sentar 2 · EndCard 6.
 */

export const P08_BEATS = {
  hook: 0,
  coupleLeaves: 2,
  /** Drop: fondo claro + lista de espera. */
  waitlist: 4,
  tapAdd: 5,
  added: 6,
  freed: 10,
  cancelSticker: 11,
  tableFree: 12,
  notify: 16,
  tapNotify: 17,
  message: 18,
  read: 19,
  reply: 20.5,
  seat: 24,
  seatedChip: 24.5,
  end: 26,
  cta: 30,
  total: 32,
} as const;

export const P08_TEXT = {
  hook: { l1: "Sábado, 21:30." },
  sign: "COMPLETO",
  leaves: "Y se van a otro sitio.",
  waitlist: { l1: "Con Turnigo,", l2: "lista de espera." },
  freed: { l1: "Cancelan una mesa…", l2: "y queda libre." },
  cancelSticker: "Sr. Pérez cancela",
  notify: { l1: "Un toque:", l2: "aviso por WhatsApp." },
  seat: { l1: "Mesa 3,", l2: "otra vez llena." },
  seatedChip: "Mesa 3 · Sentada",
  tagline: "Ni una mesa libre de más.",
} as const;

/** Datos 100 % ficticios. */
export const P08_DATA = {
  business: "Bar La Esquina",
  waitlist: [
    { name: "Ruiz", party: 4, zone: "Terraza", phone: "611 ••• •••" },
    { name: "Lucía", party: 2, phone: "622 ••• •••" },
  ],
  /** Texto de ejemplo de la plantilla "mesa lista" (la redacta cada negocio en Meta; variables: cliente y negocio). */
  message: "Hola Lucía, ya tienes mesa en Bar La Esquina. ¡Te esperamos!",
  reply: "¡Vamos para allá! 🏃",
} as const;
