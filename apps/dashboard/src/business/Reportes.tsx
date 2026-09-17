import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell, Legend } from "recharts";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import { useBusinessId } from "./hooks";
import { ymdInTz, addDaysYmd, zonedDayRange, formatDateTime } from "@reservas/shared";
import { PageHeader, StatCard, Spinner } from "../components/ui";

const COLORS = { web: "#4f46e5", manual: "#0ea5e9", walkin: "#8b5cf6", pendiente: "#f59e0b", confirmada: "#0ea5e9", sentada: "#10b981", completada: "#16a34a", no_show: "#dc2626", cancelada: "#94a3b8" };

export function Reportes() {
  const bid = useBusinessId();
  const { business } = useAuth();
  const tz = business?.timezone ?? "Europe/Madrid";
  const [days, setDays] = useState(30);

  const todayYmd = ymdInTz(new Date(), tz);
  const startYmd = addDaysYmd(todayYmd, -days);

  const { data: rows, isLoading } = useQuery({
    queryKey: ["report", bid, days],
    enabled: !!bid,
    queryFn: async () => {
      const from = zonedDayRange(startYmd, tz)[0];
      const to = zonedDayRange(todayYmd, tz)[1];
      const { data, error } = await supabase.from("bookings")
        .select("starts_at, status, channel, customer_name, service_id, services(name)")
        .eq("business_id", bid).gte("starts_at", from).lt("starts_at", to).order("starts_at");
      if (error) throw error;
      return data as any[];
    },
  });

  const stats = useMemo(() => {
    if (!rows) return null;
    const total = rows.length;
    const active = rows.filter((r) => r.status !== "cancelada").length;
    const noShow = rows.filter((r) => r.status === "no_show").length;
    const completed = rows.filter((r) => r.status === "completada").length;
    const web = rows.filter((r) => r.channel === "web").length;

    // Evolución diaria por canal
    const byDay: Record<string, { day: string; web: number; manual: number }> = {};
    for (let i = 0; i <= days; i++) {
      const ymd = addDaysYmd(startYmd, i);
      byDay[ymd] = { day: ymd.slice(5), web: 0, manual: 0 };
    }
    for (const r of rows) {
      const ymd = ymdInTz(new Date(r.starts_at), tz);
      if (byDay[ymd]) byDay[ymd][r.channel as "web" | "manual"]++;
    }

    const channelPie = [
      { name: "Web", value: web, key: "web" },
      { name: "Manual", value: total - web, key: "manual" },
    ];
    const statusPie = ["pendiente", "confirmada", "sentada", "completada", "no_show", "cancelada"].map((s) => ({
      name: s, value: rows.filter((r) => r.status === s).length, key: s,
    })).filter((x) => x.value > 0);

    return {
      total, active, noShow, completed, web,
      webPct: total ? Math.round((web / total) * 100) : 0,
      absPct: active ? Math.round((noShow / active) * 100) : 0,
      series: Object.values(byDay),
      channelPie, statusPie,
    };
  }, [rows, days, startYmd, tz]);

  function exportCsv() {
    if (!rows) return;
    const header = "fecha,estado,canal,cliente,servicio\n";
    const body = rows.map((r) =>
      [formatDateTime(r.starts_at, tz), r.status, r.channel, `"${r.customer_name}"`, `"${r.services?.name ?? ""}"`].join(",")
    ).join("\n");
    const blob = new Blob([header + body], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `reservas_${startYmd}_${todayYmd}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <PageHeader title="Reportes" subtitle={`Últimos ${days} días`}
        actions={
          <div className="flex items-center gap-2">
            <select className="input w-auto" value={days} onChange={(e) => setDays(+e.target.value)}>
              <option value={7}>7 días</option><option value={30}>30 días</option><option value={90}>90 días</option>
            </select>
            <button className="btn-ghost" onClick={exportCsv}>⬇ Exportar CSV</button>
          </div>
        } />

      {isLoading || !stats ? <div className="grid place-items-center py-20"><Spinner /></div> : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <StatCard label="Reservas totales" value={stats.total} />
            <StatCard label="Completadas" value={stats.completed} accent="#16a34a" />
            <StatCard label="% por web" value={`${stats.webPct}%`} accent="#4f46e5" />
            <StatCard label="Ausentismo" value={`${stats.absPct}%`} accent={stats.absPct > 15 ? "#dc2626" : undefined} />
          </div>

          <div className="card p-5 mb-6">
            <h3 className="font-semibold mb-4">Evolución de reservas por canal</h3>
            <div style={{ height: 260 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={stats.series} margin={{ left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eef2f7" />
                  <XAxis dataKey="day" fontSize={11} tickLine={false} axisLine={false} interval={Math.floor(stats.series.length / 12)} />
                  <YAxis allowDecimals={false} fontSize={11} tickLine={false} axisLine={false} />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="web" name="Web" stroke="#4f46e5" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="manual" name="Manual" stroke="#0ea5e9" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="grid lg:grid-cols-2 gap-6">
            <PieCard title="Reservas por canal" data={stats.channelPie} />
            <PieCard title="Reservas por estado" data={stats.statusPie} />
          </div>
        </>
      )}
    </div>
  );
}

function PieCard({ title, data }: { title: string; data: { name: string; value: number; key: string }[] }) {
  return (
    <div className="card p-5">
      <h3 className="font-semibold mb-4">{title}</h3>
      <div style={{ height: 240 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={2}>
              {data.map((d) => <Cell key={d.key} fill={(COLORS as any)[d.key] ?? "#cbd5e1"} />)}
            </Pie>
            <Tooltip /><Legend />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
