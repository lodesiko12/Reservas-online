// Utilidades de fecha/hora sensibles a la timezone del negocio + formato ES.

export const WEEKDAYS_ES = [
  "Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado",
];
export const WEEKDAYS_SHORT_ES = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

/** Fecha larga en la timezone dada, p.ej. "lunes, 15 de septiembre de 2026". */
export function formatDate(iso: string, tz: string): string {
  return new Intl.DateTimeFormat("es-ES", {
    weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: tz,
  }).format(new Date(iso));
}

/** Solo la hora, p.ej. "10:30". */
export function formatTime(iso: string, tz: string): string {
  return new Intl.DateTimeFormat("es-ES", {
    hour: "2-digit", minute: "2-digit", timeZone: tz, hour12: false,
  }).format(new Date(iso));
}

/** Fecha + hora corta, p.ej. "15 sept, 10:30". */
export function formatDateTime(iso: string, tz: string): string {
  return new Intl.DateTimeFormat("es-ES", {
    day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
    timeZone: tz, hour12: false,
  }).format(new Date(iso));
}

/** Devuelve YYYY-MM-DD correspondiente a una fecha en la timezone dada. */
export function ymdInTz(date: Date, tz: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    year: "numeric", month: "2-digit", day: "2-digit", timeZone: tz,
  }).formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/** Minutos desde medianoche (0..1439) de un instante en la timezone dada. */
export function minutesOfDayInTz(iso: string, tz: string): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit", minute: "2-digit", hour12: false, timeZone: tz,
  }).formatToParts(new Date(iso));
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? "0");
  return get("hour") * 60 + get("minute");
}

/** weekday 0..6 (0=Domingo) de una fecha en la timezone dada. */
export function weekdayInTz(date: Date, tz: string): number {
  const wd = new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: tz }).format(date);
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(wd);
}

/** Desfase (ms) de la timezone respecto a UTC para un instante dado (maneja DST). */
function tzOffsetMs(date: Date, tz: string): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: tz, hour12: false,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
  const p: Record<string, string> = {};
  for (const part of dtf.formatToParts(date)) p[part.type] = part.value;
  const asUTC = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  return asUTC - date.getTime();
}

/** Instante UTC correspondiente a la medianoche local (tz) de un YYYY-MM-DD. */
export function zonedDayStartUtc(ymd: string, tz: string): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  const guess = new Date(Date.UTC(y, m - 1, d, 0, 0, 0));
  return new Date(guess.getTime() - tzOffsetMs(guess, tz));
}

/** Rango [inicio, fin) en UTC (ISO) de un día local completo. */
export function zonedDayRange(ymd: string, tz: string): [string, string] {
  const start = zonedDayStartUtc(ymd, tz);
  const end = new Date(start.getTime() + 86400000);
  return [start.toISOString(), end.toISOString()];
}

/** Suma días a un YYYY-MM-DD (calendario, sin tz). */
export function addDaysYmd(ymd: string, days: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

export function formatCurrency(value: number | null | undefined): string {
  if (value == null) return "";
  return new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(value);
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

/** "HH:MM" a partir de un time 'HH:MM:SS'. */
export function shortTime(t: string): string {
  return t.slice(0, 5);
}

export const STATUS_LABEL: Record<string, string> = {
  confirmada: "Confirmada",
  cancelada: "Cancelada",
  completada: "Completada",
  no_show: "No-show",
};

export const STATUS_COLOR: Record<string, string> = {
  confirmada: "#0ea5e9",
  cancelada: "#94a3b8",
  completada: "#16a34a",
  no_show: "#dc2626",
};
