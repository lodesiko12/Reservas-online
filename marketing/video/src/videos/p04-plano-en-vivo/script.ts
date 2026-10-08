/**
 * P04 · T5 · S32 · restaurantes — "Así se ve tu sala un viernes."
 * Todo en BEATS (a 120 BPM: 1 beat = 0,5 s). Pista con el drop en el beat 12 (`TRACK`).
 * Estructura: gancho 4 · reservas que entran 8 (una mesa por beat, sube con el riser) ·
 * DROP → llegan y se sientan 6 · no-show y walk-in 6 · resultado 2 · EndCard 6.
 *
 * Fiel a la app (PlanoSala.tsx): tarjetas por zona, Reservada = celeste, Debería llegar = azul,
 * Sentada = verde, Retrasada = rojo, Libre = blanco; botones "Sentar" / "No-show" / "Liberar mesa" /
 * "Sentar clientes". Un walk-in sin nombre aparece como "Walk-in". La app NO manda notificación de
 * reserva nueva al negocio: las reservas entran pintando la tarjeta, sin banners.
 */

export const P04_BEATS = {
  hook: 0,
  fill: 4,
  /** Drop de la pista: se abre el fondo claro y la cámara entra en la Mesa 2. */
  arrive: 12,
  tapSeat: 14,
  late: 18,
  tapNoShow: 20,
  tapWalkIn: 22,
  result: 24,
  end: 26,
  cta: 30,
  total: 32,
} as const;

export const P04_TEXT = {
  hook: { l1: "Así se ve tu sala", l2: "un viernes." },
  fill: { l1: "Reservan online…", l2: "y aparecen aquí." },
  arrive: { l1: "¿Llegan?", l2: "Un toque y listo." },
  late: { l1: "¿No vienen?", l2: "Mesa libre, ya." },
  walkIn: "¡Llena otra vez!",
  result: { l1: "Todo tu servicio", l2: "de un vistazo." },
  counter: "Reservas hoy",
} as const;

/** Estado de una mesa a partir de un beat. Datos 100 % ficticios. */
export type BeatState = {
  beat: number;
  health: "libre" | "reservada" | "llegar" | "retrasada" | "sentada";
  who?: string;
  time?: string;
  next?: string;
};

const R = (beat: number, who: string, time: string): BeatState => ({ beat, health: "reservada", who, time });

export const P04_PLAN = {
  business: "Bar La Esquina",
  shift: "Cena",
  zones: [
    {
      name: "Interior",
      tables: [
        { name: "Mesa 1", cap: "1–2", states: [{ beat: 0, health: "libre" }, R(6, "Lola · 2 pers.", "20:30 – 22:00"), { beat: 24.5, health: "sentada", who: "Lola · 2 pers.", time: "20:30 – 22:00" }] },
        {
          name: "Mesa 2",
          cap: "2–4",
          states: [
            { beat: 0, health: "libre", next: "Próxima reserva a las 21:00" },
            R(8, "Marta · 4 pers.", "21:00 – 22:30"),
            { beat: 12, health: "llegar", who: "Marta · 4 pers.", time: "21:00 – 22:30" },
            { beat: 14, health: "sentada", who: "Marta · 4 pers.", time: "21:00 – 22:30" },
          ],
        },
        { name: "Mesa 3", cap: "2–4", states: [{ beat: 0, health: "libre" }, R(4, "Sr. Pérez · 2 pers.", "20:30 – 22:00"), { beat: 24, health: "sentada", who: "Sr. Pérez · 2 pers.", time: "20:30 – 22:00" }] },
        { name: "Mesa 4", cap: "2–4", states: [{ beat: 0, health: "libre" }, R(11, "Irene · 3 pers.", "21:30 – 23:00")] },
        {
          name: "Mesa 5",
          cap: "4–6",
          states: [
            { beat: 0, health: "libre" },
            R(7, "Carlos · 4 pers.", "20:30 – 22:00"),
            { beat: 18, health: "retrasada", who: "Carlos · 4 pers.", time: "20:30 – 22:00" },
            { beat: 20, health: "libre" },
            { beat: 22, health: "sentada", who: "Walk-in · 2 pers.", time: "21:15 – 22:45" },
          ],
        },
        { name: "Mesa 6", cap: "6–8", states: [{ beat: 0, health: "libre" }, R(9, "Pablo · 6 pers.", "21:30 – 23:30"), { beat: 25.5, health: "llegar", who: "Pablo · 6 pers.", time: "21:30 – 23:30" }] },
      ],
    },
    {
      name: "Terraza",
      tables: [
        { name: "Terraza 1", cap: "2", states: [{ beat: 0, health: "libre" }, R(5, "Nerea · 2 pers.", "20:00 – 21:30"), { beat: 25, health: "sentada", who: "Nerea · 2 pers.", time: "20:00 – 21:30" }] },
        { name: "Terraza 2", cap: "2–4", states: [{ beat: 0, health: "libre" }, R(10, "Sergio · 3 pers.", "22:00 – 23:30")] },
        { name: "Terraza 3", cap: "2–4", states: [{ beat: 0, health: "libre" }] },
      ],
    },
  ] as { name: string; tables: { name: string; cap: string; states: BeatState[] }[] }[],
  /** Contador "Reservas hoy": parte de las comidas ya hechas y suma una por mesa que entra. */
  counterFrom: 4,
};
