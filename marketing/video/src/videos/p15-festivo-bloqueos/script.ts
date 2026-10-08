/**
 * P15 · T5 tour de toques · S32 · general — "Festivo. Hoy cierras.": Bloqueos.
 * Todo en BEATS (120 BPM: 1 beat = 0,5 s). Pista con el drop en el beat 4 (`TRACK_DROP4`): la hoja del calendario
 * cae sobre el riser y en el drop se abre el fondo claro con el panel.
 *
 * Flujo REAL de la app (apps/dashboard/src/business/Bloqueos.tsx): "+ Nuevo bloqueo" → modal "Nuevo bloqueo" con
 * Alcance (Todo el negocio / Un profesional), Desde, Hasta, Motivo (opcional) → "Crear bloqueo". La lista muestra
 * "fecha → fecha" y "Todo el negocio · motivo". En el widget, un día sin huecos NO aparece en la tira de días
 * (get_available_days filtra por get_available_slots, que descuenta los bloqueos). En la app no existe
 * "Cierre puntual" (lo decía el calendario): se usan los textos reales.
 *
 * Estructura: gancho 4 · Bloqueos 8 · widget del cliente 8 · resultado 4 · EndCard 8.
 */

export const P15_BEATS = {
  hook: 0,
  worry: 2,
  /** Drop: fondo claro + panel en el móvil. */
  panel: 4,
  tapNew: 5,
  modal: 5.5,
  typeFrom: 6.5,
  typeTo: 7.5,
  /** Cambio de titular (bajo el mismo plano). */
  reason: 8,
  typeReason: 8.5,
  tapCreate: 10,
  /** El modal muestra "🚫 Bloqueo creado." (real) y se cierra; la fila entra en la lista. */
  created: 10.25,
  closeModal: 11,
  row: 11.25,
  /** El cliente abre el widget. */
  widget: 12,
  markDay: 13,
  /** Kick: el lunes 12 sale de la tira. */
  dropDay: 14,
  rebook: 16,
  tapTuesday: 17,
  times: 17.5,
  result: 20,
  stamp: 21,
  end: 24,
  cta: 28,
  total: 32,
} as const;

export const P15_TEXT = {
  hook: { l1: "Festivo.", l2: "Hoy cierras." },
  worry: "¿Y si alguien reserva?",
  panel: { l1: "En Bloqueos,", l2: "eliges el día." },
  reason: { l1: "Motivo: festivo.", l2: "Crear bloqueo." },
  widget: { l1: "Tus clientes", l2: "ya no lo ven." },
  rebook: { l1: "Y reservan", l2: "otro día." },
  result: { l1: "Cierras", l2: "en paz." },
  stamp: "BLOQUEADO",
  tagline: "Festivos sin sorpresas.",
} as const;

/** Datos 100 % ficticios. */
export const P15_DATA = {
  business: "Estudio Nerea",
  /** Color propio del negocio en el widget (cada negocio elige el suyo). */
  widgetBrand: "#C2417F",
  page: { month: "OCTUBRE", day: 12, dow: "LUNES", note: "Fiesta Nacional" },
  from: "12/10/2026, 00:00",
  to: "12/10/2026, 23:59",
  reason: "Festivo",
  /** Así lo pinta la lista de Bloqueos (formatDateTime). */
  row: { when: "12 oct, 00:00 → 12 oct, 23:59", scope: "Todo el negocio · Festivo" },
  widget: {
    subtitle: "Elige día y hora · Corte y peinado · Lola",
    days: [
      { dow: "SÁB", day: 10, month: "oct" },
      { dow: "LUN", day: 12, month: "oct" },
      { dow: "MAR", day: 13, month: "oct" },
      { dow: "MIÉ", day: 14, month: "oct" },
      { dow: "JUE", day: 15, month: "oct" },
    ],
    /** Índice del día bloqueado y del que elige el cliente. */
    blocked: 1,
    picked: 2,
    times: ["10:00", "10:30", "11:30", "12:00", "17:00", "17:30", "18:30", "19:00"],
  },
} as const;
