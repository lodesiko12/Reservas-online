/**
 * P10 · T4 texto cinético · S24 · psicólogos — "Cuidas la mente de los demás." (sáb 10 oct, Día Mundial de la Salud Mental).
 * Todo en BEATS (a 120 BPM: 1 beat = 0,5 s). Pista por defecto (`TRACK`, drop en el beat 12):
 *  - 0-12 fondo oscuro (el problema: la agenda en papel, cobros apuntados por todas partes);
 *  - drop en el 12: se abre el fondo claro y entra el panel Seguimiento (la solución);
 *  - 13-17: empezar cita, rellenar la sesión y guardar; 17-20: aparece en el historial del paciente;
 *  - 20-24: EndCard con la frase de cierre "Más tiempo para tus pacientes."
 *
 * Fiel a la app (Seguimiento.tsx / formulario de sesión / ficha → Historial): "En curso" y "Siguiente",
 * botón "Empezar cita", modal "Sesión · <nombre>" con Objetivo, Notas de sesión, Seguimiento y Tareas/Pautas.
 * Sin Informe de IA ni Recibo. Paciente ficticio, sin diagnósticos.
 */

export const P10_BEATS = {
  hook: 0,
  question: 4,
  chaos: 8,
  /** Drop: fondo claro y panel Seguimiento. */
  panel: 12,
  tapStart: 13,
  /** Se abre el formulario de sesión. */
  form: 13.5,
  /** Se rellena el formulario (4 campos en 2,5 beats). */
  type: 13.5,
  typeEnd: 16,
  tapSave: 16.5,
  /** La sesión aparece en el historial. */
  saved: 17,
  end: 20,
  cta: 22,
  total: 24,
} as const;

export const P10_TEXT = {
  hook: { l1: "Cuidas la mente", l2: "de los demás." },
  question: { l1: "¿Quién cuida", l2: "tu agenda?" },
  chaos: { l1: "Notas aquí,", l2: "cobros allá." },
  panel: { l1: "Cita en curso,", l2: "y la siguiente." },
  saved: { l1: "Notas guardadas", l2: "en su historial." },
  tagline: "Más tiempo para tus pacientes.",
  chip: "10 oct · Salud mental",
} as const;

/** Notas de "caos": una cada medio beat. Genéricas y sin datos reales. */
export const P10_STICKERS = [
  { text: "Notas en papel", beat: 4.5, x: 400, y: 960, rot: -6, bg: "#FFE27A" },
  { text: "¿Quién me debe sesión?", beat: 5.5, x: 600, y: 1130, rot: 5, bg: "#FFB4A1" },
  { text: "Cita sin apuntar", beat: 6.5, x: 430, y: 1300, rot: -4, bg: "#BDE7F5" },
  { text: "Cobros en el móvil", beat: 8.5, x: 640, y: 1440, rot: 4, bg: "#D7F0C2" },
] as const;

/** Datos 100 % ficticios (paciente "Marta"; profesional del negocio demo). */
export const P10_DATA = {
  current: { name: "Marta Ibáñez", service: "Terapia individual", time: "16:00–16:50", pro: "Clara Montes" },
  next: { name: "Daniel Ferrer", service: "Terapia individual", time: "17:00–17:50", pro: "Clara Montes" },
  form: {
    objective: "Mejorar la comunicación en casa",
    notes: "Practicamos respiración y ordenamos prioridades",
    followUp: "Revisar cómo ha ido la semana",
    tasks: "Anotar una situación difícil",
  },
} as const;
