// Ocupación del día: minutos reservados / (minutos reservados + minutos libres).
// Los intervalos van en minutos del día (hora local del negocio): [inicio, fin).

export type Interval = [number, number];

export interface OccupancyInput {
  /** Horario del centro hoy (ya aplicado el posible cambio de día). Vacío = cerrado. */
  openHours: Interval[];
  /** Profesionales activos. `hours` = su horario de hoy; `null` = sin horario propio (sigue el del centro). */
  professionals: { id: string; hours: Interval[] | null }[];
  /** Bloqueos que tocan hoy. `professionalId` null = todo el negocio. */
  blocks: { professionalId: string | null; range: Interval }[];
  /** Citas de hoy que ocupan hueco (sin canceladas ni ausencias). */
  bookings: { professionalId: string | null; range: Interval }[];
  /** Plazas simultáneas si el negocio no tiene profesionales. */
  defaultCapacity: number;
}

/** Une intervalos solapados o contiguos y descarta los vacíos. */
function merge(list: Interval[]): Interval[] {
  const out: Interval[] = [];
  for (const [s, e] of list.filter(([s, e]) => e > s).sort((a, b) => a[0] - b[0])) {
    const last = out[out.length - 1];
    if (last && s <= last[1]) last[1] = Math.max(last[1], e);
    else out.push([s, e]);
  }
  return out;
}

function intersect(a: Interval[], b: Interval[]): Interval[] {
  return merge(a.flatMap(([s1, e1]) => b.map(([s2, e2]): Interval => [Math.max(s1, s2), Math.min(e1, e2)])));
}

function subtract(base: Interval[], cut: Interval[]): Interval[] {
  let out = merge(base);
  for (const [cs, ce] of cut) {
    out = out.flatMap(([s, e]): Interval[] => {
      if (ce <= s || cs >= e) return [[s, e]];
      return ([[s, cs], [ce, e]] as Interval[]).filter(([a, b]) => b > a);
    });
  }
  return out;
}

const total = (list: Interval[]) => list.reduce((n, [s, e]) => n + (e - s), 0);

/** Porcentaje 0-100. Las citas fuera de horario cuentan como ocupadas y como disponibles. */
export function dayOccupancy(input: OccupancyInput): number {
  const { openHours, professionals, blocks, bookings, defaultCapacity } = input;
  const blocksFor = (id: string | null) =>
    blocks.filter((b) => b.professionalId === null || b.professionalId === id).map((b) => b.range);

  let booked = 0;
  let capacity = 0;
  const known = new Set(professionals.map((p) => p.id));

  for (const p of professionals) {
    const schedule = p.hours === null ? openHours : intersect(openHours, p.hours);
    const own = merge(bookings.filter((b) => b.professionalId === p.id).map((b) => b.range));
    const available = subtract(schedule, blocksFor(p.id));
    booked += total(own);
    capacity += total(merge([...available, ...own].map(([s, e]): Interval => [s, e])));
  }

  // Citas sin profesional asignado (o de uno ya inactivo).
  const others = bookings.filter((b) => !b.professionalId || !known.has(b.professionalId));
  const othersMin = others.reduce((n, b) => n + (b.range[1] - b.range[0]), 0);
  booked += othersMin;
  if (professionals.length === 0) {
    const places = total(subtract(openHours, blocksFor(null))) * Math.max(1, defaultCapacity);
    capacity += Math.max(places, othersMin);
  } else {
    capacity += othersMin;
  }

  return capacity > 0 ? Math.min(100, Math.round((booked / capacity) * 100)) : 0;
}
