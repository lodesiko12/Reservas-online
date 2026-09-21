// Mapea el `regularHours.periods[]` de la Business Profile API de Google a
// filas de `business_hours` (weekday 0=domingo..6=sábado, open_time/
// close_time "HH:MM"). Función pura, sin red ni DB, para poder probarla en
// aislado antes de confiar en ella dentro del cron de sincronización.
import type { GbpPeriod, GbpTime } from "./google.ts";

const DAY_TO_WEEKDAY: Record<string, number> = {
  SUNDAY: 0, MONDAY: 1, TUESDAY: 2, WEDNESDAY: 3, THURSDAY: 4, FRIDAY: 5, SATURDAY: 6,
};

export type HoursRow = { weekday: number; open_time: string; close_time: string };
export type MapResult = { rows: HoursRow[]; warnings: string[] };

function fmtTime(t: GbpTime | undefined): string {
  const h = String(t?.hours ?? 0).padStart(2, "0");
  const m = String(t?.minutes ?? 0).padStart(2, "0");
  return `${h}:${m}`;
}

export function mapGbpPeriodsToBusinessHours(periods: GbpPeriod[]): MapResult {
  const rows: HoursRow[] = [];
  const warnings: string[] = [];

  for (const p of periods ?? []) {
    const openWeekday = DAY_TO_WEEKDAY[p.openDay];
    const closeWeekday = DAY_TO_WEEKDAY[p.closeDay];
    if (openWeekday === undefined || closeWeekday === undefined) {
      warnings.push(`Día no reconocido en Google (${p.openDay}→${p.closeDay}), franja omitida`);
      continue;
    }

    const openTime = fmtTime(p.openTime);
    const closeTime = fmtTime(p.closeTime);

    if (p.openDay === p.closeDay) {
      if (closeTime > openTime) {
        rows.push({ weekday: openWeekday, open_time: openTime, close_time: closeTime });
      } else {
        warnings.push(`Franja de ${p.openDay} con hora de cierre no posterior a la de apertura, omitida`);
      }
      continue;
    }

    // Cruza medianoche (p.ej. viernes 22:00 → sábado 02:00): se parte en dos
    // filas, aprovechando que business_hours ya admite varias franjas por
    // día — evita perder disponibilidad reservable tras la medianoche.
    rows.push({ weekday: openWeekday, open_time: openTime, close_time: "23:59" });
    if (closeTime > "00:00") {
      rows.push({ weekday: closeWeekday, open_time: "00:00", close_time: closeTime });
    }
    warnings.push(`Franja de ${p.openDay} cruza medianoche; dividida en dos filas (hasta 23:59 y desde 00:00)`);
  }

  return { rows, warnings };
}
