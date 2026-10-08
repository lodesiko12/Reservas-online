/**
 * P09 · Carrusel C · restaurantes — checklist antes del puente del Pilar (vie 9 - lun 12 oct).
 * 5 diapositivas = 5 fotogramas (frame N → diapositiva N+1).
 *
 * El calendario decía "5 cosas" con 4 puntos, y dos eran la misma pantalla de la app
 * ("Franjas y aforo" incluye el tope online: campo "Stock online" de cada franja).
 * Se publica como 3 cosas, todas verificadas en el código del panel:
 *   1. Franjas y aforo (Franjas.tsx: Aforo, Días activos, Stock online).
 *   2. Recordatorio 24 h (Configuración → Integraciones: "Activar recordatorio 24h antes").
 *   3. Lista de espera (Plano de sala: "+ Añadir", estados Esperando/Avisado, Avisar/Sentar/Cancelar).
 */

export const P09_SLIDES = 5;

export const P09_TEXT = {
  cover: { kicker: "Antes del puente", l1: "3 cosas", l2: "que revisar hoy." },
  steps: [
    { l1: "Franjas y aforo", l2: "al día.", sub: "Y cuánto se reserva por la web." },
    { l1: "Recordatorio", l2: "24 h antes.", sub: "Que nadie se olvide de venir." },
    { l1: "Lista de espera", l2: "preparada.", sub: "Para cuando cuelgues el «completo»." },
  ],
  checklist: ["Franjas y aforo", "Recordatorio 24 h", "Lista de espera"],
  close: { l1: "Puente", l2: "sin sorpresas.", cta: "Comenta “DEMO”", ctaSub: "y te lo enseño" },
} as const;

/** Datos 100 % ficticios. */
export const P09_DATA = {
  shift: { name: "Cena", start: "20:00", end: "23:30", covers: 60, online: 40, days: ["L", "M", "X", "J", "V", "S", "D"], active: [0, 4, 5, 6] },
  onlineHint: "Comensales que la web puede reservar; el resto del aforo queda para teléfono/walk-in.",
  reminder: "Hola Marta 👋 Tu reserva es mañana, sáb 10 a las 21:00. ¡Te esperamos!",
  waitlist: [
    { who: "Pareja · 2 pers.", meta: "Zona: Terraza · 600 ••• •••", status: "Esperando" as const },
    { who: "Familia Gil · 5 pers.", meta: "Zona: cualquiera · 611 ••• •••", status: "Avisado" as const },
    { who: "Lola · 2 pers.", meta: "Zona: Interior · 622 ••• •••", status: "Esperando" as const },
  ],
} as const;
