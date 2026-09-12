import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import {
  ymdInTz, zonedDayRange, addDaysYmd, weekdayInTz,
  formatTime, WEEKDAYS_SHORT_ES,
} from "@reservas/shared";
import { PageHeader, StatCard, Spinner, StatusBadge, EmptyState } from "../components/ui";

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

      const [today, next7, last30, hours, profs] = await Promise.all([
        supabase.from("bookings").select("*, services(name), professionals(name)")
          .eq("business_id", bid).gte("starts_at", todayStart).lt("starts_at", todayEnd).order("starts_at"),
        supabase.from("bookings").select("starts_at, status")
          .eq("business_id", bid).gte("starts_at", todayStart).lt("starts_at", next7End).neq("status", "cancelada"),
        supabase.from("bookings").select("channel, status")
          .eq("business_id", bid).gte("starts_at", last30Start).lt("starts_at", todayEnd),
        supabase.from("business_hours").select("weekday, open_time, close_time").eq("business_id", bid),
        supabase.from("professionals").select("id").eq("business_id", bid).eq("is_active", true),
      ]);
      if (today.error) throw today.error;
      return {
        today: today.data as any[],
        next7: next7.data ?? [],
        last30: last30.data ?? [],
        hours: hours.data ?? [],
        profCount: (profs.data ?? []).length,
      };
    },
  });

  const kpis = useMemo(() => {
    if (!data) return null;
    const todayActive = data.today.filter((b) => b.status !== "cancelada");
    // Ocupación: minutos reservados hoy / minutos-recurso disponibles hoy.
    const wd = weekdayInTz(new Date(), tz);
    const openMin = data.hours
      .filter((h: any) => h.weekday === wd)
      .reduce((acc: number, h: any) => acc + minutesBetween(h.open_time, h.close_time), 0);
    const resources = Math.max(1, data.profCount || (business?.default_capacity ?? 1));
    const capacityMin = openMin * resources;
    const bookedMin = todayActive
      .filter((b) => b.status !== "no_show")
      .reduce((acc, b) => acc + (new Date(b.ends_at).getTime() - new Date(b.starts_at).getTime()) / 60000, 0);
    const occupancy = capacityMin > 0 ? Math.min(100, Math.round((bookedMin / capacityMin) * 100)) : 0;

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
      .filter((b) => b.status === "confirmada" && new Date(b.starts_at).getTime() >= now)
      .slice(0, 6);
  }, [data]);

  const recentNoShows = useMemo(() => (data ? data.today.filter((b) => b.status === "no_show") : []), [data]);

  if (isLoading || !kpis) return <div className="grid place-items-center py-20"><Spinner /></div>;

  return (
    <div>
      <PageHeader title="Resumen" subtitle={`Hoy · ${new Intl.DateTimeFormat("es-ES", { weekday: "long", day: "numeric", month: "long", timeZone: tz }).format(new Date())}`} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Reservas hoy" value={kpis.count} />
        {business?.type === "restaurante"
          ? <StatCard label="Comensales hoy" value={kpis.coversToday} accent="#4f46e5" />
          : <StatCard label="Ocupación del día" value={`${kpis.occupancy}%`} accent="#4f46e5" />}
        <StatCard label="Reservas por web (30d)" value={`${kpis.webPct}%`} />
        <StatCard label="Ausentismo (30d)" value={`${kpis.absPct}%`} accent={kpis.absPct > 15 ? "#dc2626" : undefined} />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 card p-5">
          <h3 className="font-semibold mb-4">Próximos 7 días</h3>
          <div style={{ height: 240 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chart} margin={{ left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eef2f7" />
                <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={12} />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} fontSize={12} />
                <Tooltip cursor={{ fill: "#f1f5f9" }} />
                <Bar dataKey="count" fill="#4f46e5" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">Próximos turnos de hoy</h3>
            <Link to="/app/agenda" className="text-xs text-brand-600 hover:underline">Ver agenda</Link>
          </div>
          {upcoming.length === 0 ? (
            <p className="text-sm text-slate-400 py-6 text-center">No hay más turnos hoy.</p>
          ) : (
            <ul className="space-y-3">
              {upcoming.map((b) => (
                <li key={b.id} className="flex items-center gap-3">
                  <div className="text-sm font-bold text-brand-600 w-12">{formatTime(b.starts_at, tz)}</div>
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{b.customer_name} {b.customer_last_name ?? ""}</div>
                    <div className="text-xs text-slate-400 truncate">{b.type === "restaurante" ? `Mesa · ${b.party_size} pers.` : `${b.services?.name ?? ""}${b.professionals?.name ? ` · ${b.professionals.name}` : ""}`}</div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="card p-5 mt-6">
        <h3 className="font-semibold mb-3">Ausencias recientes (hoy)</h3>
        {recentNoShows.length === 0 ? (
          <p className="text-sm text-slate-400">Sin ausencias registradas hoy. 🎉</p>
        ) : (
          <ul className="divide-y divide-slate-100">
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

function minutesBetween(a: string, b: string): number {
  const [ah, am] = a.split(":").map(Number);
  const [bh, bm] = b.split(":").map(Number);
  return bh * 60 + bm - (ah * 60 + am);
}
