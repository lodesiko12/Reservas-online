// Conversión entre input datetime-local y ISO UTC respetando la timezone del negocio.

export function toLocalInput(iso: string, tz: string): string {
  const p: Record<string, string> = {};
  for (const part of new Intl.DateTimeFormat("en-CA", {
    timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(new Date(iso))) p[part.type] = part.value;
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}

export function fromLocalInput(local: string, tz: string): string {
  const [datePart, timePart] = local.split("T");
  const [y, m, d] = datePart.split("-").map(Number);
  const [hh, mm] = (timePart ?? "00:00").split(":").map(Number);
  const guess = new Date(Date.UTC(y, m - 1, d, hh, mm));
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: tz, hour12: false, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
  const pp: Record<string, string> = {};
  for (const part of dtf.formatToParts(guess)) pp[part.type] = part.value;
  const asUTC = Date.UTC(+pp.year, +pp.month - 1, +pp.day, +pp.hour, +pp.minute, +pp.second);
  return new Date(guess.getTime() - (asUTC - guess.getTime())).toISOString();
}
