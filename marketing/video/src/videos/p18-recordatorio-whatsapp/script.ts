/**
 * P18 · T9 chat · S32 · citas — "Hoy, 3 huecos vacíos.": recordatorio automático por WhatsApp.
 * Todo en BEATS (120 BPM: 1 beat = 0,5 s). Pista con el drop en el beat 4 (`TRACK_DROP4`): los "Ausente" se estampan
 * sobre el riser y en el drop se abre el chat.
 *
 * Fiel a la app (supabase/functions/whatsapp-reminders): el recordatorio sale SOLO ~24 h antes, con la plantilla que
 * el negocio tiene aprobada en Meta y 4 variables (cliente, negocio, fecha, hora). La RESPUESTA del cliente no cambia
 * nada en Turnigo (no hay webhook): el calendario decía "responde y el hueco pasa a verde" y eso NO se enseña.
 * En la agenda de citas el no-show se rotula "Ausente" (rojo) y existe "Completada" (verde) — textos reales de ui.tsx.
 * La clienta es Clara (no Nerea: Nerea es el estudio y una profesional en P16/P17). Mismo universo que P16/P17.
 * Resultado sin cifras: "Ayuda a reducir los huecos vacíos".
 *
 * Estructura: gancho 4 · el mensaje llega solo 10 · respuesta 4 · cliente avisado 4 · resultado 4 · EndCard 6.
 */

export const P18_BEATS = {
  hook: 0,
  /** Se estampan los tres "Ausente". */
  absent: [1, 2, 3],
  /** Drop: chat. */
  chat: 4,
  message: 5.5,
  read: 7.5,
  auto: 9,
  typing: 14,
  reply: 15,
  notified: 18,
  result: 22,
  /** Los tres huecos de la semana anterior, ahora completados. */
  done: [23, 23.75, 24.5],
  end: 26,
  cta: 30,
  total: 32,
} as const;

export const P18_TEXT = {
  hook: { l1: "Hoy,", l2: "3 huecos vacíos." },
  chat: { l1: "24 h antes,", l2: "le llega esto." },
  auto: { l1: "Sin que tú", l2: "hagas nada." },
  autoChip: "Lo envía Turnigo solo",
  reply: { l1: "Y no se", l2: "le olvida." },
  notified: { l1: "Cliente avisado.", l2: "Sin llamadas." },
  result: { l1: "Ayuda a reducir", l2: "los huecos vacíos." },
  tagline: "Recordatorios que trabajan solos.",
} as const;

export type AgendaRowData = { start: string; end: string; name: string; service: string; pro: number };

/** Agenda del sábado (datos ficticios). `absent` = índices que acaban "Ausente" en el gancho. */
export const P18_DATA = {
  business: "Estudio Nerea",
  before: "sábado, 10 de octubre de 2026",
  after: "sábado, 17 de octubre de 2026",
  rows: [
    { start: "09:30", end: "10:30", name: "Marta Gil", service: "Corte y peinado", pro: 1 },
    { start: "10:30", end: "11:15", name: "Vera López", service: "Tinte", pro: 2 },
    { start: "11:30", end: "12:00", name: "Inés Mora", service: "Cejas", pro: 0 },
    { start: "12:00", end: "13:00", name: "Laura Díaz", service: "Mechas", pro: 1 },
    { start: "16:30", end: "17:15", name: "Clara Vidal", service: "Corte", pro: 1 },
    { start: "17:30", end: "18:30", name: "Noa Pérez", service: "Pedicura", pro: 0 },
  ] as AgendaRowData[],
  absent: [1, 3, 4],
  /** Plantilla de ejemplo (la redacta cada negocio en Meta; variables: cliente, negocio, fecha, hora). */
  message: "Hola Clara 👋 Te recordamos tu cita en Estudio Nerea el sábado, 17 de octubre a las 16:30. ¡Te esperamos!",
  reply: "¡Allí estaré! 👍",
  dayLabel: "VIERNES",
} as const;
