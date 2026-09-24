import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { supabase } from "../lib/supabase";
import type { Tables } from "@reservas/shared";
import { ymdInTz, addDaysYmd, zonedDayRange, formatDateTime } from "@reservas/shared";
import { PageHeader, StatCard, Spinner, StatusBadge, ConfirmDialog } from "../components/ui";
import { IntegrationsForm } from "../components/IntegrationsForm";
import { DeleteBusinessModal, BUSINESS_TYPE_LABELS } from "./Businesses";

type Business = Tables<"businesses">;
const WIDGET_URL = ((import.meta.env.VITE_WIDGET_URL as string) || "").replace(/\/+$/, "");
type Tab = "dashboard" | "editar" | "integraciones" | "usuarios";

export function BusinessDetail() {
  const { id = "" } = useParams();
  const [tab, setTab] = useState<Tab>("dashboard");

  const { data: business, isLoading, refetch } = useQuery({
    queryKey: ["admin", "business", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase.from("businesses").select("*").eq("id", id).single();
      if (error) throw error;
      return data as Business;
    },
  });

  if (isLoading || !business) return <div className="grid place-items-center py-20"><Spinner /></div>;

  return (
    <div>
      <Link to="/admin" className="text-sm text-brand-600 hover:underline">← Todos los negocios</Link>
      <PageHeader
        title={business.name}
        subtitle={`/${business.slug} · ${BUSINESS_TYPE_LABELS[business.type] ?? business.type}`}
        actions={
          <a className="btn-ghost" href={`${WIDGET_URL}/?slug=${business.slug}`} target="_blank" rel="noreferrer">Abrir widget ↗</a>
        }
      />

      <div className="flex gap-1 mb-6 border-b border-slate-200 dark:border-slate-700">
        {([["dashboard", "Dashboard"], ["editar", "Editar negocio"], ["integraciones", "Integraciones"], ["usuarios", "Usuarios"]] as [Tab, string][]).map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${tab === k ? "border-brand-500 text-brand-700" : "border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"}`}>
            {label}
          </button>
        ))}
      </div>

      {tab === "dashboard" && <BusinessDashboard business={business} />}
      {tab === "editar" && <EditBusiness business={business} onSaved={refetch} />}
      {tab === "integraciones" && (
        <div className="card p-6 max-w-3xl">
          <h2 className="font-semibold mb-1">Integraciones (email y WhatsApp)</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">Configura las credenciales de este negocio. Los secretos se guardan del lado del servidor.</p>
          <IntegrationsForm businessId={business.id} />
        </div>
      )}
      {tab === "usuarios" && <BusinessUsersSection businessId={business.id} />}
    </div>
  );
}

/* ------------------------------ Usuarios del negocio ------------------------------ */
function BusinessUsersSection({ businessId }: { businessId: string }) {
  const [members, setMembers] = useState<{ id: string; user_id: string; role: string; email: string; created_at: string }[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ email: "", password: "", role: "staff" as "owner" | "staff" });
  const [saving, setSaving] = useState(false);
  const [busyUserId, setBusyUserId] = useState<string | null>(null);
  const [removingUserId, setRemovingUserId] = useState<string | null>(null);

  async function load() {
    setLoading(true); setError(null);
    const { data, error } = await supabase.functions.invoke("admin-business-users", { body: { action: "list", business_id: businessId } });
    setLoading(false);
    if (error || (data as any)?.error) { setError((data as any)?.error ?? error!.message); return; }
    setMembers((data as any).members);
  }

  useEffect(() => { load(); }, [businessId]);

  async function addMember(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setError(null);
    const { data, error } = await supabase.functions.invoke("admin-business-users", {
      body: { action: "add", business_id: businessId, staff_email: form.email.trim(), staff_password: form.password || undefined, role: form.role },
    });
    setSaving(false);
    if (error || (data as any)?.error) { setError((data as any)?.error ?? error!.message); return; }
    setForm({ email: "", password: "", role: "staff" });
    setAdding(false);
    load();
  }

  async function removeMember(userId: string) {
    setRemovingUserId(null);
    setBusyUserId(userId);
    const { data, error } = await supabase.functions.invoke("admin-business-users", { body: { action: "remove", business_id: businessId, user_id: userId } });
    setBusyUserId(null);
    if (error || (data as any)?.error) { setError((data as any)?.error ?? error!.message); return; }
    load();
  }

  async function changeRole(userId: string, role: "owner" | "staff") {
    setBusyUserId(userId);
    await supabase.functions.invoke("admin-business-users", { body: { action: "update_role", business_id: businessId, user_id: userId, role } });
    setBusyUserId(null);
    load();
  }

  return (
    <div className="card p-6 max-w-2xl">
      <div className="flex items-center justify-between mb-1">
        <h2 className="font-semibold">Usuarios con acceso a este negocio</h2>
        <button className="btn-ghost" onClick={() => setAdding((v) => !v)}>{adding ? "Cancelar" : "+ Añadir usuario"}</button>
      </div>
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">Cualquiera de estos usuarios puede entrar al panel y gestionar este negocio (útil si hay varios profesionales con acceso).</p>

      {error && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-4">{error}</div>}

      {adding && (
        <form onSubmit={addMember} className="border border-slate-200 dark:border-slate-700 rounded-lg p-4 mb-4 space-y-3">
          <div className="grid sm:grid-cols-2 gap-3">
            <div><label className="label">Email</label><input type="email" className="input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required /></div>
            <div><label className="label">Rol</label>
              <select className="input" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as "owner" | "staff" })}>
                <option value="staff">Staff</option>
                <option value="owner">Owner</option>
              </select>
            </div>
          </div>
          <div>
            <label className="label">Contraseña (solo si es un email nuevo, sin cuenta todavía)</label>
            <input type="text" className="input" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="mín. 8 caracteres, dejar vacío si ya tiene cuenta" minLength={8} />
          </div>
          <button className="btn-primary" disabled={saving}>{saving ? "Añadiendo…" : "Añadir"}</button>
        </form>
      )}

      {loading ? <Spinner /> : !members?.length ? <p className="text-sm text-slate-400 dark:text-slate-500">Sin usuarios.</p> : (
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {members.map((m) => (
            <div key={m.id} className="flex items-center justify-between py-2.5">
              <div>
                <div className="font-medium text-sm">{m.email}</div>
                <div className="text-xs text-slate-400 dark:text-slate-500">Desde {formatDateTime(m.created_at, "Europe/Madrid")}</div>
              </div>
              <div className="flex items-center gap-2">
                <select className="input py-1 text-xs w-auto" value={m.role} disabled={busyUserId === m.user_id} onChange={(e) => changeRole(m.user_id, e.target.value as "owner" | "staff")}>
                  <option value="staff">Staff</option>
                  <option value="owner">Owner</option>
                </select>
                <button className="btn-ghost text-xs text-red-600" disabled={busyUserId === m.user_id} onClick={() => setRemovingUserId(m.user_id)}>Quitar</button>
              </div>
            </div>
          ))}
        </div>
      )}
      <ConfirmDialog
        open={!!removingUserId}
        title="Quitar usuario"
        message="¿Quitar a este usuario del negocio? Dejará de poder entrar al panel."
        confirmLabel="Quitar"
        onConfirm={() => removingUserId && removeMember(removingUserId)}
        onCancel={() => setRemovingUserId(null)}
      />
    </div>
  );
}

/* ------------------------------ Dashboard del negocio ------------------------------ */
function BusinessDashboard({ business }: { business: Business }) {
  const tz = business.timezone;
  const todayYmd = ymdInTz(new Date(), tz);

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "business-metrics", business.id, todayYmd],
    queryFn: async () => {
      const last30 = zonedDayRange(addDaysYmd(todayYmd, -30), tz)[0];
      const [all, recent, customers] = await Promise.all([
        supabase.from("bookings").select("status, channel", { count: "exact", head: true }).eq("business_id", business.id),
        supabase.from("bookings").select("starts_at, created_at, status, channel, party_size, type").eq("business_id", business.id).gte("created_at", last30),
        supabase.from("customers").select("id", { count: "exact", head: true }).eq("business_id", business.id),
      ]);
      return { total: all.count ?? 0, recent: recent.data ?? [], customers: customers.count ?? 0 };
    },
  });

  const stats = useMemo(() => {
    if (!data) return null;
    const r = data.recent;
    const active = r.filter((b: any) => b.status !== "cancelada");
    const web = r.filter((b: any) => b.channel === "web").length;
    const noShow = r.filter((b: any) => b.status === "no_show").length;
    const lastCreated = r.reduce((mx: string, b: any) => (b.created_at > mx ? b.created_at : mx), "");
    const chart = Array.from({ length: 14 }, (_, i) => {
      const ymd = addDaysYmd(todayYmd, -13 + i);
      const [s, e] = zonedDayRange(ymd, tz);
      const count = r.filter((b: any) => b.created_at >= s && b.created_at < e).length;
      return { label: ymd.slice(5), count };
    });
    return {
      recent30: r.length,
      webPct: r.length ? Math.round((web / r.length) * 100) : 0,
      absPct: active.length ? Math.round((noShow / active.length) * 100) : 0,
      lastCreated, chart,
      byStatus: ["pendiente", "confirmada", "sentada", "completada", "no_show", "cancelada"].map((s) => ({ s, n: r.filter((b: any) => b.status === s).length })),
    };
  }, [data, todayYmd, tz]);

  if (isLoading || !stats) return <div className="grid place-items-center py-16"><Spinner /></div>;

  return (
    <div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Reservas totales" value={data!.total} />
        <StatCard label="Nuevas (30 días)" value={stats.recent30} accent="#4f46e5" />
        <StatCard label="Clientes" value={data!.customers} />
        <StatCard label="Ausentismo (30d)" value={`${stats.absPct}%`} accent={stats.absPct > 15 ? "#dc2626" : undefined} />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 card p-5">
          <h3 className="font-semibold mb-4">Reservas creadas (últimos 14 días)</h3>
          <div style={{ height: 240 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.chart} margin={{ left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eef2f7" />
                <XAxis dataKey="label" fontSize={11} tickLine={false} axisLine={false} interval={1} />
                <YAxis allowDecimals={false} fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip cursor={{ fill: "#f1f5f9" }} />
                <Bar dataKey="count" fill="#4f46e5" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card p-5">
          <h3 className="font-semibold mb-4">Salud (30 días)</h3>
          <ul className="space-y-3 text-sm">
            <li className="flex justify-between"><span className="text-slate-500 dark:text-slate-400">% por web</span><span className="font-semibold">{stats.webPct}%</span></li>
            {stats.byStatus.map((x) => (
              <li key={x.s} className="flex justify-between items-center">
                <StatusBadge status={x.s} /><span className="font-semibold">{x.n}</span>
              </li>
            ))}
            <li className="flex justify-between border-t pt-3"><span className="text-slate-500 dark:text-slate-400">Última reserva</span><span className="font-medium">{stats.lastCreated ? formatDateTime(stats.lastCreated, tz) : "—"}</span></li>
            <li className="flex justify-between"><span className="text-slate-500 dark:text-slate-400">Estado</span>
              <span className={`badge ${business.is_active ? "bg-green-100 text-green-700" : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400"}`}>{business.is_active ? "Activo" : "Inactivo"}</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------ Editar negocio ------------------------------ */
function EditBusiness({ business, onSaved }: { business: Business; onSaved: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    name: business.name, slug: business.slug, primary_color: business.primary_color,
    timezone: business.timezone, is_active: business.is_active, type: business.type,
    default_capacity: business.default_capacity, slot_interval_min: business.slot_interval_min,
  });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function save() {
    setSaving(true); setErr(null); setMsg(null);
    const { error } = await supabase.from("businesses").update({
      name: form.name.trim(), slug: form.slug.trim().toLowerCase(), primary_color: form.primary_color,
      timezone: form.timezone.trim(), is_active: form.is_active, type: form.type,
      default_capacity: Number(form.default_capacity), slot_interval_min: Number(form.slot_interval_min),
    }).eq("id", business.id);
    setSaving(false);
    if (error) { setErr(error.code === "23505" ? "Ese slug ya está en uso." : error.message); return; }
    qc.invalidateQueries(); onSaved();
    setMsg("Cambios guardados");
  }

  return (
    <div className="card p-6 max-w-2xl">
      <div className="grid sm:grid-cols-2 gap-4">
        <div><label className="label">Nombre</label><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
        <div>
          <label className="label">Slug (URL del widget)</label>
          <input className="input" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} />
          <p className="text-xs text-amber-600 mt-1">⚠ Cambiar el slug rompe los widgets ya insertados.</p>
        </div>
        <div>
          <label className="label">Tipo</label>
          <select className="input" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as Business["type"] })}>
            <option value="citas">Citas / turnos</option>
            <option value="psicologo">Psicólogo</option>
            <option value="restaurante">Restaurante</option>
          </select>
          <p className="text-xs text-amber-600 mt-1">⚠ Cambiar el tipo cambia qué secciones ve el negocio en su panel. Solo el super-admin puede hacerlo.</p>
        </div>
        <div><label className="label">Color primario</label><input type="color" className="input h-[42px] p-1" value={form.primary_color} onChange={(e) => setForm({ ...form, primary_color: e.target.value })} /></div>
        <div><label className="label">Timezone</label><input className="input" value={form.timezone} onChange={(e) => setForm({ ...form, timezone: e.target.value })} placeholder="Europe/Madrid" /></div>
        <div className="flex items-end">
          <label className="flex items-center gap-2 text-sm font-medium pb-2">
            <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} />
            Negocio activo (suscripción)
          </label>
        </div>
        {(form.type === "citas" || form.type === "psicologo") && (
          <>
            <div><label className="label">Aforo por defecto</label><input type="number" min={1} className="input" value={form.default_capacity} onChange={(e) => setForm({ ...form, default_capacity: +e.target.value })} /></div>
            <div><label className="label">Granularidad (min)</label><input type="number" min={5} step={5} className="input" value={form.slot_interval_min} onChange={(e) => setForm({ ...form, slot_interval_min: +e.target.value })} /></div>
          </>
        )}
      </div>
      {err && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mt-4">{err}</div>}
      {msg && <div className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2 mt-4">{msg}</div>}
      <button className="btn-primary mt-5" onClick={save} disabled={saving}>{saving ? "Guardando…" : "Guardar cambios"}</button>

      <DangerZone business={business} />
    </div>
  );
}

/* ------------------------------ Zona de peligro: borrado definitivo ------------------------------ */
function DangerZone({ business }: { business: Business }) {
  const navigate = useNavigate();
  const [deleting, setDeleting] = useState(false);

  return (
    <div className="mt-8 pt-5 border-t border-red-200">
      <h3 className="font-semibold text-red-700 mb-1">Zona de peligro</h3>
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-3">Borra este negocio y todos sus datos de forma permanente e irreversible.</p>
      <button className="btn-danger" onClick={() => setDeleting(true)}>Borrar negocio definitivamente</button>
      {deleting && (
        <DeleteBusinessModal
          business={business}
          onClose={() => setDeleting(false)}
          onDeleted={() => navigate("/admin")}
        />
      )}
    </div>
  );
}
