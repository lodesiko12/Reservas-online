/**
 * P12 · Carrusel C · psicólogos — "Tu consulta, sin papeles" (sáb 10 oct, Día Mundial de la Salud Mental).
 * 5 diapositivas = 5 fotogramas (frame N → diapositiva N+1).
 *
 * Todo verificado en el código del panel (Seguimiento.tsx, ficha → Historial, Pagos.tsx, PaymentMethodDialog):
 *   1. Seguimiento: "En curso" y "Siguiente", botón "Empezar cita" (abre el formulario de sesión).
 *   2. Historial de sesiones: Objetivo, Notas, Seguimiento y Tareas/Pautas, la más reciente arriba.
 *   3. Pagos → Pendientes: sesiones pendientes, pacientes y total pendiente; "Pagada" / "Marcar todas pagadas".
 *   4. Al marcar pagada la app pregunta "¿Cómo se ha pagado?" (Bizum o Efectivo, obligatorio).
 * Sin Informe de IA ni Recibo (usa datos fiscales de Ana Sánchez). Pacientes ficticios, sin diagnósticos.
 */

export const P12_SLIDES = 5;

export const P12_TEXT = {
  cover: { kicker: "Para psicólogos", l1: "Tu consulta,", l2: "sin papeles." },
  steps: [
    { l1: "La cita en curso", l2: "y la siguiente.", sub: "Empiezas la sesión con un toque." },
    { l1: "Cada sesión,", l2: "en su historial.", sub: "Objetivo, notas y pautas." },
    { l1: "Quién te debe", l2: "sesiones.", sub: "Y cuánto, de un vistazo." },
  ],
  close: { l1: "Marcar pagada", l2: "en un toque.", cta: "Comenta “DEMO”", ctaSub: "y te lo enseño" },
  example: "Datos de ejemplo",
} as const;

/** Datos 100 % ficticios. */
export const P12_DATA = {
  current: { name: "Marta Ibáñez", service: "Terapia individual", time: "16:00–16:50", pro: "Clara Montes" },
  next: { name: "Daniel Ferrer", service: "Terapia individual", time: "17:00–17:50", pro: "Clara Montes" },
  history: [
    {
      when: "9 oct, 16:00",
      fields: {
        objective: "Mejorar la comunicación en casa",
        notes: "Practicamos respiración y ordenamos prioridades",
        followUp: "Revisar cómo ha ido la semana",
        tasks: "Anotar una situación difícil",
      },
    },
    {
      when: "2 oct, 16:00",
      fields: {
        objective: "Poner nombre a lo que siento",
        notes: "Primera toma de contacto y expectativas",
        followUp: "Valorar el ritmo de las sesiones",
        tasks: "Apuntar tres momentos del día",
      },
    },
  ],
  pagos: {
    stats: { sessions: "8", patients: "7", total: "475,00 €" },
    patients: [
      { name: "Andrés Molina", summary: "1 sesión · 60,00 €", rows: [{ when: "mar, 6 oct", service: "13:20 · Terapia individual", price: "60,00 €" }] },
      { name: "Marta Ibáñez", summary: "1 sesión · 60,00 €", rows: [{ when: "mar, 6 oct", service: "16:00 · Terapia individual", price: "60,00 €" }] },
    ],
  },
} as const;
