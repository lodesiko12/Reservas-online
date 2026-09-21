import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import type { Tables } from "@reservas/shared";
import { ymdInTz, addDaysYmd, zonedDayRange } from "@reservas/shared";
import { PageHeader, StatCard, Spinner, Modal, EmptyState } from "../components/ui";

type Business = Tables<"businesses">;

const WIDGET_URL = ((import.meta.env.VITE_WIDGET_URL as string) || "").replace(/\/+$/, "");

export const BUSINESS_TYPE_LABELS: Record<string, string> = {
  citas: "Citas", restaurante: "Restaurante", psicologo: "Psicólogo",
};

export function Businesses() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: businesses, isLoading } = useQuery({
    queryKey: ["admin", "businesses"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("businesses")
        .select("*, business_users(count), bookings(count)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as (Business & { business_users: { count: number }[]; bookings: { count: number }[] })[];
    },
  });

  const { data: platform } = useQuery({
    queryKey: ["admin", "platform-metrics"],
    queryFn: async () => {
      const weekAgo = zonedDayRange(addDaysYmd(ymdInTz(new Date(), "Europe/Madrid"), -7), "Europe/Madrid")[0];
      const [biz, active, totalB, week] = await Promise.all([
        supabase.from("businesses").select("id", { count: "exact", head: true }),
        supabase.from("businesses").select("id", { count: "exact", head: true }).eq("is_active", true),
        supabase.from("bookings").select("id", { count: "exact", head: true }),
        supabase.from("bookings").select("id", { count: "exact", head: true }).gte("created_at", weekAgo),
      ]);
      return { businesses: biz.count ?? 0, active: active.count ?? 0, bookings: totalB.count ?? 0, week: week.count ?? 0 };
    },
  });

  const toggle = useMutation({
    mutationFn: async (b: Business) => {
      const { error } = await supabase.from("businesses").update({ is_active: !b.is_active }).eq("id", b.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "businesses"] }),
  });

  const [deleting, setDeleting] = useState<Business | null>(null);

  return (
    <div>
      <PageHeader
        title="Negocios"
        subtitle="Alta, activación y visión global de todos los tenants"
        actions={<button className="btn-primary" onClick={() => setOpen(true)}>+ Nuevo negocio</button>}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Negocios" value={platform?.businesses ?? "—"} />
        <StatCard label="Activos" value={platform?.active ?? "—"} accent="#16a34a" />
        <StatCard label="Reservas totales" value={platform?.bookings ?? "—"} accent="#4f46e5" />
        <StatCard label="Reservas (7 días)" value={platform?.week ?? "—"} />
      </div>

      {isLoading ? (
        <div className="grid place-items-center py-20"><Spinner /></div>
      ) : !businesses?.length ? (
        <EmptyState title="Aún no hay negocios" hint="Crea el primero para empezar." />
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 text-left">
              <tr>
                <th className="px-5 py-3 font-medium">Negocio</th>
                <th className="px-5 py-3 font-medium">Tipo</th>
                <th className="px-5 py-3 font-medium">Reservas</th>
                <th className="px-5 py-3 font-medium">Estado</th>
                <th className="px-5 py-3 font-medium">Widget</th>
                <th className="px-5 py-3 font-medium text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {businesses.map((b) => (
                <tr key={b.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/60">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <span className="h-8 w-8 rounded-lg grid place-items-center text-white text-xs font-bold" style={{ background: b.primary_color }}>
                        {b.name.slice(0, 2).toUpperCase()}
                      </span>
                      <div>
                        <Link to={`/admin/negocio/${b.id}`} className="font-semibold text-slate-800 dark:text-slate-100 hover:text-brand-600 hover:underline">{b.name}</Link>
                        <div className="text-xs text-slate-400 dark:text-slate-500">/{b.slug}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3">{BUSINESS_TYPE_LABELS[b.type] ?? b.type}</td>
                  <td className="px-5 py-3">{b.bookings?.[0]?.count ?? 0}</td>
                  <td className="px-5 py-3">
                    <span className={`badge ${b.is_active ? "bg-green-100 text-green-700" : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400"}`}>
                      {b.is_active ? "Activo" : "Inactivo"}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <a className="text-brand-600 hover:underline text-xs" href={`${WIDGET_URL}/?slug=${b.slug}`} target="_blank" rel="noreferrer">
                      Abrir ↗
                    </a>
                  </td>
                  <td className="px-5 py-3 text-right whitespace-nowrap">
                    <Link to={`/admin/negocio/${b.id}`} className="btn-ghost">Gestionar</Link>
                    <button
                      className={`ml-2 ${b.is_active ? "btn-ghost" : "btn-primary"}`}
                      onClick={() => toggle.mutate(b)}
                      disabled={toggle.isPending}
                    >
                      {b.is_active ? "Desactivar" : "Activar"}
                    </button>
                    <button className="btn-ghost ml-2 text-red-600 hover:text-red-700" onClick={() => setDeleting(b)}>
                      Borrar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      )}

      <NewBusinessModal open={open} onClose={() => setOpen(false)} onCreated={() => qc.invalidateQueries({ queryKey: ["admin", "businesses"] })} />
      {deleting && (
        <DeleteBusinessModal
          business={deleting}
          onClose={() => setDeleting(null)}
          onDeleted={() => { setDeleting(null); qc.invalidateQueries({ queryKey: ["admin", "businesses"] }); }}
        />
      )}
    </div>
  );
}

/**
 * Borrado definitivo de un negocio (superadmin). La RLS `businesses_delete`
 * ya restringe esta operación a super-admins; el resto de tablas del negocio
 * (profesionales, servicios, reservas, clientes, etc.) caen por `on delete
 * cascade`. Exige escribir el nombre exacto del negocio como confirmación,
 * porque es irreversible y borra todo el historial.
 */
export function DeleteBusinessModal({ business, onClose, onDeleted }: {
  business: Business; onClose: () => void; onDeleted: () => void;
}) {
  const [confirmText, setConfirmText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const matches = confirmText.trim() === business.name;

  async function remove() {
    setBusy(true); setError(null);
    const { error } = await supabase.from("businesses").delete().eq("id", business.id);
    setBusy(false);
    if (error) { setError(error.message); return; }
    onDeleted();
  }

  return (
    <Modal open onClose={onClose} title="Borrar negocio definitivamente">
      <div className="space-y-4">
        <div className="text-sm bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2">
          Esta acción es <strong>irreversible</strong>. Se borrará <strong>{business.name}</strong> y todos sus datos:
          profesionales, servicios, reservas, clientes, integraciones y todo su historial. No hay vuelta atrás.
        </div>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Si solo quieres pausar el negocio sin perder datos, cierra esto y usa <strong>Desactivar</strong> en su lugar.
        </p>
        <div>
          <label className="label">Escribe "{business.name}" para confirmar</label>
          <input className="input" value={confirmText} onChange={(e) => setConfirmText(e.target.value)} autoFocus />
        </div>
        {error && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>}
        <div className="flex justify-end gap-2">
          <button className="btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn-danger" disabled={!matches || busy} onClick={remove}>
            {busy ? "Borrando…" : "Borrar definitivamente"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function NewBusinessModal({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({
    name: "", slug: "", type: "citas", primary_color: "#4f46e5", timezone: "Europe/Madrid",
    staff_name: "", staff_email: "", staff_password: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [saving, setSaving] = useState(false);

  function set<K extends keyof typeof form>(k: K, v: string) {
    setForm((f) => ({ ...f, [k]: v, ...(k === "name" && !f.slug ? {} : {}) }));
  }
  function autoSlug(name: string) {
    return name.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null); setSaving(true);
    const { data, error } = await supabase.functions.invoke("admin-create-business", { body: form });
    setSaving(false);
    if (error) {
      let msg = error.message;
      try { const j = await (error as any).context?.json?.(); if (j?.error) msg = j.error; } catch { /* noop */ }
      setError(msg);
      return;
    }
    if ((data as any)?.error) { setError((data as any).error); return; }
    setDone(true);
    onCreated();
  }

  function close() {
    setDone(false); setError(null);
    setForm({ name: "", slug: "", type: "citas", primary_color: "#4f46e5", timezone: "Europe/Madrid", staff_name: "", staff_email: "", staff_password: "" });
    onClose();
  }

  return (
    <Modal open={open} onClose={close} title="Nuevo negocio">
      {done ? (
        <div className="text-center py-4">
          <div className="text-4xl">✅</div>
          <p className="font-semibold mt-2">Negocio creado</p>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            El staff ya puede acceder con <strong>{form.staff_email}</strong>.
          </p>
          <button className="btn-primary mt-4" onClick={close}>Hecho</button>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Nombre del negocio</label>
              <input className="input" value={form.name}
                onChange={(e) => { const v = e.target.value; setForm((f) => ({ ...f, name: v, slug: f.slug || autoSlug(v) })); }} required />
            </div>
            <div>
              <label className="label">Slug (URL)</label>
              <input className="input" value={form.slug} onChange={(e) => set("slug", autoSlug(e.target.value))} required />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Tipo</label>
              <select className="input" value={form.type} onChange={(e) => set("type", e.target.value)}>
                <option value="citas">Citas / turnos</option>
                <option value="psicologo">Psicólogo</option>
                <option value="restaurante">Restaurante</option>
              </select>
            </div>
            <div>
              <label className="label">Color de marca</label>
              <input type="color" className="input h-[42px] p-1" value={form.primary_color} onChange={(e) => set("primary_color", e.target.value)} />
            </div>
          </div>

          <hr className="my-2" />
          <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">Credenciales del staff</p>
          <div>
            <label className="label">Nombre del responsable</label>
            <input className="input" value={form.staff_name} onChange={(e) => set("staff_name", e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Email de acceso</label>
              <input type="email" className="input" value={form.staff_email} onChange={(e) => set("staff_email", e.target.value)} required />
            </div>
            <div>
              <label className="label">Contraseña</label>
              <input type="text" className="input" value={form.staff_password} onChange={(e) => set("staff_password", e.target.value)} required minLength={8} placeholder="mín. 8 caracteres" />
            </div>
          </div>

          {error && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>}

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="btn-ghost" onClick={close}>Cancelar</button>
            <button className="btn-primary" disabled={saving}>{saving ? "Creando…" : "Crear negocio"}</button>
          </div>
        </form>
      )}
    </Modal>
  );
}
