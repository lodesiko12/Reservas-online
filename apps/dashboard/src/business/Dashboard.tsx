import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { BarChart, Bar, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import {
  ymdInTz, zonedDayRange, addDaysYmd, weekdayInTz,
  formatTime, WEEKDAYS_SHORT_ES,
} from "@reservas/shared";
import { PageHeader, StatCard, Spinner, StatusBadge, EmptyState } from "../components/ui";
import { dayOccupancy, type Interval } from "./occupancy";

export function Dashboard() {
  const { business } = useAuth();
  const bid = business?.id ?? "";
  const tz = business?.timezone ?? "Europe/Madrid";
  const todayYmd = ymdInTz(new Date(), tz);

  const { data, isLoading } = useQuery({
    queryKey: ["dashboard", bid, todayYmd],
    enabled: !!bid,
    queryFn: async () => {
      const [todayStart] = zonedDayRange(todayYmd, tz);
      const next7End = zonedDayRange(addDaysYmd(todayYmd, 7), tz)[0];
      const last30Start = zonedDayRange(addDaysYmd(todayYmd, -30), tz)[0];
      const todayEnd = zonedDayRange(todayYmd, tz)[1];

      const [today, next7, last30, hours, profs, blocks, override] = await Promise.all([
        supabase.from("bookings").select("*, services(name), professionals(name)")
          .eq("business_id", bid).gte("starts_at", todayStart).lt("starts_at", todayEnd).order("starts_at"),
        supabase.from("bookings").select("starts_at, status")
          .eq("business_id", bid).gte("starts_at", todayStart).lt("starts_at", next7End).neq("status", "cancelada"),
        supabase.from("bookings").select("channel, status")
          .eq("business_id", bid).gte("starts_at", last30Start).lt("starts_at", todayEnd),
        supabase.from("business_hours").select("weekday, open_time, close_time").eq("business_id", bid),
        supabase.from("professionals").select("id, professional_hours(weekday, start_time, end_time)").eq("business_id", bid).eq("is_active", true),
        supabase.from("blocks").select("scope, professional_id, starts_at, ends_at")
          .eq("business_id", bid).lt("starts_at", todayEnd).gt("ends_at", todayStart),
        supabase.from("business_day_overrides").select("use_weekday").eq("business_id", bid).eq("day", todayYmd).maybeSingle(),
      ]);
      if (today.error) throw today.error;
      if (profs.error) throw profs.error;
      return {
        today: today.data as any[],
        next7: next7.data ?? [],
        last30: last30.data ?? [],
        hours: hours.data ?? [],
        profs: (profs.data ?? []) as { id: string; professional_hours: { weekday: number; start_time: string; end_time: string }[] }[],
        blocks: blocks.data ?? [],
        override: override.data,
        dayRange: [todayStart, todayEnd] as const,
      };
    },
  });

  const kpis = useMemo(() => {
    if (!data) return null;
    const todayActive = data.today.filter((b) => b.status !== "cancelada");
    // Ocupación: reservado / (reservado + libre), según el horario de cada profesional y los bloqueos.
    // Un día especial puede usar el horario de otro día de la semana, o estar cerrado (use_weekday null).
    const wd = data.override ? data.override.use_weekday : weekdayInTz(new Date(), tz);
    const [dayStart, dayEnd] = data.dayRange.map((d) => new Date(d).getTime());
    const toRange = (from: string, to: string): Interval => {
      const min = (iso: string) => {
        const t = new Date(iso).getTime();
        if (t <= dayStart) return 0;
        if (t >= dayEnd) return 1440;
        return clockMinutes(formatTime(iso, tz));
      };
      return [min(from), min(to)];
    };
    const occupancy = dayOccupancy({
      openHours: data.hours
        .filter((h) => h.weekday === wd)
        .map((h): Interval => [clockMinutes(h.open_time), clockMinutes(h.close_time)]),
      professionals: data.profs.map((p) => ({
        id: p.id,
        hours: p.professional_hours.length === 0 ? null : p.professional_hours
          .filter((h) => h.weekday === wd)
          .map((h): Interval => [clockMinutes(h.start_time), clockMinutes(h.end_time)]),
      })),
      blocks: data.blocks
        .filter((b) => b.scope === "business" || b.professional_id)
        .map((b) => ({
          professionalId: b.scope === "business" ? null : b.professional_id,
          range: toRange(b.starts_at, b.ends_at),
        })),
      bookings: todayActive
        .filter((b) => b.status !== "no_show")
        .map((b) => ({ professionalId: b.professional_id, range: toRange(b.starts_at, b.ends_at) })),
      defaultCapacity: business?.default_capacity ?? 1,
    });

    const web = data.last30.filter((b: any) => b.channel === "web").length;
    const total30 = data.last30.filter((b: any) => b.status !== "cancelada").length;
    const webPct = total30 > 0 ? Math.round((web / data.last30.length) * 100) : 0;
    const noShow = data.last30.filter((b: any) => b.status === "no_show").length;
    const absPct = total30 > 0 ? Math.round((noShow / total30) * 100) : 0;
    const coversToday = todayActive
      .filter((b) => b.status !== "no_show")
      .reduce((acc, b) => acc + (b.party_size ?? 0), 0);

    return { count: todayActive.length, occupancy, webPct, absPct, coversToday };
  }, [data, tz, business]);

  const chart = useMemo(() => {
    if (!data) return [];
    return Array.from({ length: 7 }, (_, i) => {
      const ymd = addDaysYmd(ymdInTz(new Date(), tz), i);
      const [s, e] = zonedDayRange(ymd, tz);
      const count = data.next7.filter((b: any) => b.starts_at >= s && b.starts_at < e).length;
      const dayDate = zonedDayRange(ymd, tz)[0];
      return { label: WEEKDAYS_SHORT_ES[weekdayInTz(new Date(dayDate), tz)], count };
    });
  }, [data, tz]);

  const upcoming = useMemo(() => {
    if (!data) return [];
    const now = Date.now();
    return data.today
      .filter((b) => (b.status === "confirmada" || b.status === "pendiente") && new Date(b.starts_at).getTime() >= now)
      .slice(0, 6);
  }, [data]);

  const recentNoShows = useMemo(() => (data ? data.today.filter((b) => b.status === "no_show") : []), [data]);

  if (isLoading || !kpis) return <div className="grid place-items-center py-20"><Spinner /></div>;

  return (
    <div>
      <PageHeader title="Resumen" subtitle={`Hoy · ${new Intl.DateTimeFormat("es-ES", { weekday: "long", day: "numeric", month: "long", timeZone: tz }).format(new Date())}`} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Reservas hoy" value={kpis.count} featured />
        {business?.type === "restaurante"
          ? <StatCard label="Comensales hoy" value={kpis.coversToday} accent="var(--chart-1)" />
          : <StatCard label="Ocupación del día" value={`${kpis.occupancy}%`} accent="var(--chart-1)" />}
        <StatCard label="Reservas por web (30d)" value={`${kpis.webPct}%`} />
        <StatCard label="Ausentismo (30d)" value={`${kpis.absPct}%`} accent={kpis.absPct > 15 ? "#C0392B" : undefined} />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 card p-5">
          <h3 className="tg-display text-[19px] mb-4">Próximos 7 días</h3>
          <div style={{ height: 240 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chart} margin={{ left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#DAEAE7" />
                <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={12} />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} fontSize={12} />
                <Tooltip cursor={{ fill: "#DAEAE7", fillOpacity: 0.6 }} />
                <Bar dataKey="count" fill="var(--chart-1)" radius={[8, 8, 0, 0]} maxBarSize={44}>
                  {/* Hoy a todo color; el resto de días atenuados para dar foco */}
                  {chart.map((_, i) => <Cell key={i} fillOpacity={i === 0 ? 1 : 0.55} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="tg-display text-[19px]">Próximos turnos de hoy</h3>
            <Link to="/app/agenda" className="text-xs text-brand-600 hover:underline">Ver agenda</Link>
          </div>
          {upcoming.length === 0 ? (
            <p className="text-sm text-slate-400 dark:text-slate-500 py-6 text-center">No hay más turnos hoy.</p>
          ) : (
            <ul className="space-y-3">
              {upcoming.map((b) => (
                <li key={b.id} className="flex items-center gap-3">
                  <div className="tg-num shrink-0 rounded-lg bg-brand-50 px-2 py-1 text-sm font-bold text-brand-600 dark:bg-brand-500/15 dark:text-brand-300">{formatTime(b.starts_at, tz)}</div>
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{b.customer_name} {b.customer_last_name ?? ""}</div>
                    <div className="text-xs text-slate-400 dark:text-slate-500 truncate">{b.type === "restaurante" ? `Mesa · ${b.party_size} pers.` : `${b.services?.name ?? ""}${b.professionals?.name ? ` · ${b.professionals.name}` : ""}`}</div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="card p-5 mt-6">
        <h3 className="tg-display text-[19px] mb-3">Ausencias recientes (hoy)</h3>
        {recentNoShows.length === 0 ? (
          <p className="text-sm text-slate-400 dark:text-slate-500">Sin ausencias registradas hoy.</p>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {recentNoShows.map((b) => (
              <li key={b.id} className="py-2 flex items-center justify-between text-sm">
                <span>{b.customer_name} · {b.services?.name}</span>
                <span className="flex items-center gap-2">{formatTime(b.starts_at, tz)} <StatusBadge status={b.status} /></span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/** "HH:mm" o "HH:mm:ss" → minutos desde medianoche. */
function clockMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}
