/**
 * P11 · T5 tour de toques · S32 · restaurantes — "Entran 2 sin reserva." (walk-ins, sáb 10 oct).
 * Todo en BEATS (a 120 BPM: 1 beat = 0,5 s). Pista por defecto (`TRACK`, drop en el beat 12).
 *
 * Fiel a la app (PlanoSala.tsx): solo las mesas LIBRES ofrecen "Sentar clientes"; al tocarlo se abre
 * "Sentar clientes · <mesa>" ("¿Cuántos son? Toca un número para sentarlos") y un toque en el número
 * sienta al grupo (walk-in sin nombre: "Walk-in"). Una mesa con reserva solo ofrece "Sentar" / "No-show":
 * el walk-in nunca se le asigna (mismo motor de asignación que las reservas). El plano NO sugiere una mesa:
 * la elige el equipo.
 *
 * Estructura: gancho 4 (llegan 2 sin reserva) · 8 (¿hay mesa? se ve en el plano; las libres laten) ·
 * DROP en el 12: la cámara entra en la Mesa 3 y se toca "Sentar clientes" → "2" → sentados (6) ·
 * 6 la mesa reservada de 6 sigue a salvo · 2 resultado · 6 EndCard.
 */

export const P11_BEATS = {
  hook: 0,
  plan: 4,
  /** Drop: fondo claro y la cámara entra en la Mesa 3. */
  drop: 12,
  tapSeat: 13.5,
  modal: 14,
  tapParty: 15,
  seated: 15.5,
  /** La cámara pasa a la mesa reservada de 6. */
  reserved: 18,
  result: 24,
  end: 26,
  cta: 30,
  total: 32,
} as const;

export const P11_TEXT = {
  hook: { l1: "Entran 2", l2: "sin reserva." },
  plan: { l1: "¿Hay mesa?", l2: "Mira el plano." },
  drop: { l1: "Toca la mesa,", l2: "sienta al grupo." },
  reserved: { l1: "Las reservadas", l2: "quedan a salvo." },
  result: { l1: "Sin reserva", l2: "también." },
  chip: "Walk-in · 2 pers.",
  shield: "Reservada 21:30",
} as const;

/** Mesa del plano donde se sienta el walk-in (zona 0, 3.ª tarjeta) y la reservada de 6 (zona 0, 6.ª). */
export const P11_SEAT = { zone: 0, table: 2, name: "Mesa 3" } as const;
export const P11_PROTECTED = { zone: 0, table: 5 } as const;
/** Mesas libres que laten mientras se mira el plano: [zona, mesa]. */
export const P11_FREE = [
  [0, 2],
  [1, 1],
  [1, 2],
] as const;

/** Datos 100 % ficticios. */
export const P11_PLAN = {
  business: "Bar La Esquina",
  shift: "Cena",
  zones: [
    {
      name: "Interior",
      tables: [
        { name: "Mesa 1", cap: "1–2", health: "reservada", who: "Lola · 2 pers.", time: "21:30 – 23:00" },
        { name: "Mesa 2", cap: "2–4", health: "sentada", who: "Marta · 4 pers.", time: "20:30 – 22:00" },
        { name: "Mesa 3", cap: "2–4", health: "libre", next: "Próxima reserva a las 22:30" },
        { name: "Mesa 4", cap: "2–4", health: "reservada", who: "Irene · 3 pers.", time: "21:45 – 23:15" },
        { name: "Mesa 5", cap: "4–6", health: "sentada", who: "Carlos · 4 pers.", time: "20:30 – 22:00" },
        { name: "Mesa 6", cap: "6–8", health: "reservada", who: "Pablo · 6 pers.", time: "21:30 – 23:30" },
      ],
    },
    {
      name: "Terraza",
      tables: [
        { name: "Terraza 1", cap: "2", health: "sentada", who: "Nerea · 2 pers.", time: "20:45 – 22:15" },
        { name: "Terraza 2", cap: "2–4", health: "libre" },
        { name: "Terraza 3", cap: "2–4", health: "libre" },
      ],
    },
  ] as {
    name: string;
    tables: { name: string; cap: string; health: "libre" | "reservada" | "sentada"; who?: string; time?: string; next?: string }[];
  }[],
};
