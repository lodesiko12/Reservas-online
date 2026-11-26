// Avisos para citas puestas a mano a una hora libre (o reprogramadas): fuera de horario, hora
// partida, tiempo que queda sin aprovechar, solapes y bloqueos. Solo avisan; no impiden guardar.
import { ymdInTz, zonedDayRange, addDaysYmd, weekdayInTz, formatTime } from "@reservas/shared";

type Range = [number, number]; // minutos del día, hora local del negocio

export interface ScheduleInput {
  start: number;
  end: number;
  /** Horario del centro ese día; vacío = cerrado. */
  openHours: Range[];
  /** Horario del profesional ese día; null = sin horario propio (sigue el del centro). */
  professionalHours: Range[] | null;
  professionalName: string | null;
  /** Otras citas del mismo profesional ese día. */
  others: { range: Range; label: string }[];
  blocked: Range[];
}

/** Huecos sueltos menores que esto se consideran descanso normal; a partir de 60 min cabe otra cita. */
const MIN_GAP = 15;
const MAX_GAP = 60;

const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
const inside = (ranges: Range[], s: number, e: number) => ranges.some(([a, b]) => s >= a && e <= b);
const overlaps = ([a, b]: Range, s: number, e: number) => a < e && b > s;

export function scheduleWarnings(i: ScheduleInput): string[] {
  const { start, end, others } = i;
  const who = i.professionalName ?? "la profesional";
  const out: string[] = [];

  for (const o of others) if (overlaps(o.range, start, end)) out.push(`Se solapa con ${o.label}.`);
  if (i.blocked.some((r) => overlaps(r, start, end))) out.push("Coincide con un bloqueo.");
  if (!inside(i.openHours, start, end)) out.push("Queda fuera del horario del centro.");
  if (i.professionalHours && !inside(i.professionalHours, start, end)) out.push(`Queda fuera del horario de ${who}.`);

  // Hora partida: no empieza en punto ni justo a continuación (media hora siguiente) de otra cita.
  const chained = others.some((o) => start >= o.range[1] && start - o.range[1] < 30);
  if (start % 60 !== 0 && !chained) out.push(`Empieza a una hora partida (${hhmm(start)}).`);

  // Tiempo suelto antes y después. El tramo de horario solo cuenta si la cita cae dentro de él.
  const windows = i.professionalHours ?? i.openHours;
  const win = windows.find(([a, b]) => start >= a && end <= b);
  const prevEnd = Math.max(win ? win[0] : -Infinity, ...others.filter((o) => o.range[1] <= start).map((o) => o.range[1]));
  const nextStart = Math.min(...others.filter((o) => o.range[0] >= end).map((o) => o.range[0]), Infinity);
  const before = start - prevEnd;
  const after = nextStart - end;
  if (before >= MIN_GAP && before < MAX_GAP) out.push(`Deja ${before} min sin aprovechar antes.`);
  if (after >= MIN_GAP && after < MAX_GAP) out.push(`Deja ${after} min sin aprovechar después.`);

  return out;
}

const clock = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};

/** Lee horarios, bloqueos y citas del día y devuelve los avisos de la cita propuesta. */
export async function fetchScheduleWarnings(p: {
  // El cliente se pasa desde fuera para que la lógica de arriba se pueda probar sin Supabase.
  supabase: any;
  businessId: string;
  tz: string;
  professionalId: string | null;
  startISO: string;
  durationMin: number;
  excludeBookingId?: string;
}): Promise<string[]> {
  const { supabase, businessId, tz, professionalId } = p;
  const endISO = new Date(new Date(p.startISO).getTime() + p.durationMin * 60000).toISOString();
  const ymd = ymdInTz(new Date(p.startISO), tz);
  const dayStart = zonedDayRange(ymd, tz)[0];
  const dayEnd = zonedDayRange(addDaysYmd(ymd, 1), tz)[0];

  const [hours, override, prof, blocks, bookings] = await Promise.all([
    supabase.from("business_hours").select("weekday, open_time, close_time").eq("business_id", businessId),
    supabase.from("business_day_overrides").select("use_weekday").eq("business_id", businessId).eq("day", ymd).maybeSingle(),
    professionalId
      ? supabase.from("professionals").select("name, professional_hours(weekday, start_time, end_time)").eq("id", professionalId).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    supabase.from("blocks").select("scope, professional_id, starts_at, ends_at")
      .eq("business_id", businessId).lt("starts_at", endISO).gt("ends_at", p.startISO),
    professionalId
      ? supabase.from("bookings").select("id, starts_at, ends_at, customer_name")
          .eq("professional_id", professionalId).in("status", ["confirmada", "pendiente", "completada"])
          .lt("starts_at", dayEnd).gt("ends_at", dayStart)
      : Promise.resolve({ data: [], error: null }),
  ]);
  const failed = [hours, override, prof, blocks, bookings].find((r) => r.error);
  if (failed) return ["No se ha podido comprobar el horario ni los solapes."];

  const wd = override.data ? override.data.use_weekday : weekdayInTz(new Date(p.startISO), tz);
  const minuteOf = (iso: string) => {
    const t = new Date(iso).getTime();
    if (t <= new Date(dayStart).getTime()) return 0;
    if (t >= new Date(dayEnd).getTime()) return 1440;
    return clock(formatTime(iso, tz));
  };
  const start = minuteOf(p.startISO);
  const allProfHours: any[] = prof.data?.professional_hours ?? [];

  return scheduleWarnings({
    start,
    end: start + p.durationMin,
    openHours: (hours.data ?? []).filter((h: any) => h.weekday === wd).map((h: any): Range => [clock(h.open_time), clock(h.close_time)]),
    professionalHours: allProfHours.length === 0 ? null
      : allProfHours.filter((h) => h.weekday === wd).map((h): Range => [clock(h.start_time), clock(h.end_time)]),
    professionalName: prof.data?.name ?? null,
    others: (bookings.data ?? [])
      .filter((b: any) => b.id !== p.excludeBookingId)
      .map((b: any) => ({
        range: [minuteOf(b.starts_at), minuteOf(b.ends_at)] as Range,
        label: `la cita de ${b.customer_name} (${formatTime(b.starts_at, tz)}–${formatTime(b.ends_at, tz)})`,
      })),
    blocked: (blocks.data ?? [])
      .filter((b: any) => b.scope === "business" || (professionalId && b.professional_id === professionalId))
      .map((b: any): Range => [minuteOf(b.starts_at), minuteOf(b.ends_at)]),
  });
}
