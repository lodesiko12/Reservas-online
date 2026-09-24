import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import { useServices, useProfessionals, useServiceProfessionals, useBusinessId, type Service, type Professional } from "./hooks";
import { formatDuration, formatCurrency, shortTime } from "@reservas/shared";
import { PageHeader, Spinner, Modal, EmptyState, ConfirmDialog } from "../components/ui";
import { WindowsEditor, type Win } from "../components/WindowsEditor";

const DEFAULT_COLORS = [
  "#3b82f6", "#ef4444", "#22c55e", "#f59e0b", "#a855f7",
  "#06b6d4", "#ec4899", "#84cc16", "#f97316", "#6366f1",
];

export function Servicios() {
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("google") === "connected") setToast("Google Calendar conectado ✅");
    else if (params.get("google_error")) setToast("No se pudo conectar Google Calendar: " + params.get("google_error"));
    if (params.has("google") || params.has("google_error")) {
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  return (
    <div className="space-y-8">
      <PageHeader title="Servicios y profesionales" subtitle="Catálogo, duración, disponibilidad y equipo" />
      {toast && (
        <div className="fixed top-4 right-4 bg-slate-900 text-white text-sm px-4 py-2 rounded-lg shadow-lg z-50 cursor-pointer" onClick={() => setToast(null)}>
          {toast}
        </div>
      )}
      <ProfessionalsSection />
      <ServicesSection />
    </div>
  );
}

/* ------------------------------ Profesionales ------------------------------ */
function ProfessionalsSection() {
  const bid = useBusinessId();
  const qc = useQueryClient();
  const { data: pros, isLoading } = useProfessionals();
  const [editing, setEditing] = useState<Professional | "new" | null>(null);
  const [removing, setRemoving] = useState<Professional | null>(null);

  async function remove(p: Professional) {
    setRemoving(null);
    await supabase.from("professionals").delete().eq("id", p.id);
    qc.invalidateQueries();
  }

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold text-slate-800 dark:text-slate-100">Profesionales</h2>
        <button className="btn-ghost" onClick={() => setEditing("new")}>+ Añadir</button>
      </div>
      {isLoading ? <Spinner /> : !pros?.length ? (
        <EmptyState title="Sin profesionales" hint="Opcional: úsalos si asignas servicios a personas concretas." />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {pros.map((p) => (
            <div key={p.id} className="card p-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="inline-block w-2.5 h-2.5 rounded-full shrink-0" style={{ background: p.color }} />
                <div>
                  <div className="font-medium">{p.name}</div>
                  <div className="text-xs text-slate-400 dark:text-slate-500">{p.is_active ? "Activo" : "Inactivo"}</div>
                </div>
              </div>
              <div className="flex gap-1">
                <button className="btn-ghost text-xs" onClick={() => setEditing(p)}>Editar</button>
                <button className="btn-ghost text-xs" onClick={() => setRemoving(p)}>🗑</button>
              </div>
            </div>
          ))}
        </div>
      )}
      {editing && (
        <ProfessionalModal
          bid={bid}
          professional={editing === "new" ? null : editing}
          nextColor={DEFAULT_COLORS[(pros?.length ?? 0) % DEFAULT_COLORS.length]}
          onClose={() => setEditing(null)}
          onSaved={() => { qc.invalidateQueries(); setEditing(null); }}
        />
      )}
      <ConfirmDialog
        open={!!removing}
        title="Eliminar profesional"
        message={removing ? `¿Eliminar a ${removing.name}? Sus servicios quedarán sin este profesional asignado.` : ""}
        onConfirm={() => removing && remove(removing)}
        onCancel={() => setRemoving(null)}
      />
    </section>
  );
}

function ProfessionalModal({ bid, professional, nextColor, onClose, onSaved }: {
  bid: string; professional: Professional | null; nextColor: string; onClose: () => void; onSaved: () => void;
}) {
  const [name, setName] = useState(professional?.name ?? "");
  const [color, setColor] = useState(professional?.color ?? nextColor);
  const [wins, setWins] = useState<Win[]>([]);
  const [serviceIds, setServiceIds] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(!professional);
  const [busy, setBusy] = useState(false);
  const { data: services } = useServices(true);

  useQuery({
    queryKey: ["prof-hours-and-services", professional?.id],
    enabled: !!professional,
    queryFn: async () => {
      const [hours, svcLinks] = await Promise.all([
        supabase.from("professional_hours").select("weekday, start_time, end_time").eq("professional_id", professional!.id),
        supabase.from("service_professionals").select("service_id").eq("professional_id", professional!.id),
      ]);
      setWins((hours.data ?? []).map((w) => ({ weekday: w.weekday, start_time: shortTime(w.start_time), end_time: shortTime(w.end_time) })));
      setServiceIds((svcLinks.data ?? []).map((s) => s.service_id));
      setLoaded(true);
      return null;
    },
  });

  function toggleService(id: string) {
    setServiceIds((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  }

  async function save() {
    setBusy(true);
    let pid = professional?.id;
    if (!pid) {
      const { data } = await supabase.from("professionals").insert({ business_id: bid, name: name.trim(), color }).select().single();
      pid = data!.id;
    } else {
      await supabase.from("professionals").update({ name: name.trim(), color }).eq("id", pid);
      await supabase.from("professional_hours").delete().eq("professional_id", pid);
      await supabase.from("service_professionals").delete().eq("professional_id", pid);
    }
    if (wins.length) await supabase.from("professional_hours").insert(wins.map((w) => ({ professional_id: pid, ...w })));
    if (serviceIds.length) await supabase.from("service_professionals").insert(serviceIds.map((sid) => ({ service_id: sid, professional_id: pid })));
    setBusy(false); onSaved();
  }

  return (
    <Modal open onClose={onClose} title={professional ? "Editar profesional" : "Nuevo profesional"}>
      <div className="space-y-4">
        <div className="flex gap-3">
          <div className="flex-1"><label className="label">Nombre</label><input className="input" value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div>
            <label className="label">Color</label>
            <input type="color" className="input p-1 h-[38px] w-14" value={color} onChange={(e) => setColor(e.target.value)} />
          </div>
        </div>
        <div>
          <label className="label">Servicios que presta</label>
          {!services?.length ? (
            <p className="text-xs text-slate-400 dark:text-slate-500">Crea servicios primero para poder asignarlos.</p>
          ) : loaded ? (
            <div className="grid sm:grid-cols-2 gap-1.5">
              {services.map((s) => (
                <label key={s.id} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={serviceIds.includes(s.id)} onChange={() => toggleService(s.id)} />
                  {s.name}
                </label>
              ))}
            </div>
          ) : <Spinner />}
        </div>
        <div>
          <label className="label">Horario de trabajo</label>
          {loaded ? <WindowsEditor wins={wins} onChange={setWins} /> : <Spinner />}
        </div>
        {professional && <GoogleCalendarSection professionalId={professional.id} />}
        <div className="flex justify-end gap-2"><button className="btn-ghost" onClick={onClose}>Cancelar</button><button className="btn-primary" disabled={!name.trim() || busy} onClick={save}>Guardar</button></div>
      </div>
    </Modal>
  );
}

/** Conexión de este profesional con su Google Calendar (exportar citas +
 * bloquear huecos que tenga ocupados allí). Solo aplica al editar un
 * profesional ya creado (necesita su id). */
function GoogleCalendarSection({ professionalId }: { professionalId: string }) {
  const [status, setStatus] = useState<{ connected: boolean; google_email: string | null; sync_enabled: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmingDisconnect, setConfirmingDisconnect] = useState(false);

  async function load() {
    const { data } = await supabase.rpc("get_professional_google_status", { p_professional_id: professionalId });
    const row = (data as any[])?.[0];
    setStatus(row ?? { connected: false, google_email: null, sync_enabled: true });
  }

  useEffect(() => { load(); }, [professionalId]);

  async function connect() {
    setBusy(true); setError(null);
    const { data, error } = await supabase.functions.invoke("google-oauth-start", { body: { professional_id: professionalId } });
    setBusy(false);
    if (error || (data as any)?.error) { setError((data as any)?.error ?? error!.message); return; }
    window.location.href = (data as any).url;
  }

  async function disconnect() {
    setConfirmingDisconnect(false);
    setBusy(true);
    await supabase.rpc("disconnect_professional_google", { p_professional_id: professionalId });
    setBusy(false);
    load();
  }

  async function toggleSync(enabled: boolean) {
    setBusy(true);
    await supabase.rpc("set_professional_google_sync", { p_professional_id: professionalId, p_enabled: enabled });
    setBusy(false);
    load();
  }

  if (!status) return null;

  return (
    <div>
      <label className="label">Google Calendar</label>
      {status.connected ? (
        <div className="flex items-center justify-between border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2">
          <div className="text-sm">
            <div className="font-medium text-green-700">Conectado{status.google_email ? ` · ${status.google_email}` : ""}</div>
            <label className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 mt-1">
              <input type="checkbox" checked={status.sync_enabled} onChange={(e) => toggleSync(e.target.checked)} disabled={busy} />
              Sincronizar (exportar citas y bloquear huecos ocupados en Google)
            </label>
          </div>
          <button type="button" className="btn-ghost text-xs" disabled={busy} onClick={() => setConfirmingDisconnect(true)}>Desconectar</button>
        </div>
      ) : (
        <button type="button" className="btn-ghost text-xs" disabled={busy} onClick={connect}>
          Conectar con Google Calendar
        </button>
      )}
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
      <ConfirmDialog
        open={confirmingDisconnect}
        title="Desconectar Google Calendar"
        message="¿Desconectar Google Calendar de este profesional?"
        confirmLabel="Desconectar"
        onConfirm={disconnect}
        onCancel={() => setConfirmingDisconnect(false)}
      />
    </div>
  );
}

/* ------------------------------ Servicios ------------------------------ */
function ServicesSection() {
  const qc = useQueryClient();
  const { data: services, isLoading } = useServices(true);
  const { data: pros } = useProfessionals();
  const { data: links } = useServiceProfessionals();
  const bid = useBusinessId();
  const [editing, setEditing] = useState<Service | "new" | null>(null);
  const [removing, setRemoving] = useState<Service | null>(null);

  function prosForService(serviceId: string): Professional[] {
    const ids = new Set((links ?? []).filter((l) => l.service_id === serviceId).map((l) => l.professional_id));
    return (pros ?? []).filter((p) => ids.has(p.id));
  }

  async function toggle(s: Service) {
    await supabase.from("services").update({ is_active: !s.is_active }).eq("id", s.id);
    qc.invalidateQueries();
  }
  async function remove(s: Service) {
    setRemoving(null);
    await supabase.from("services").delete().eq("id", s.id);
    qc.invalidateQueries();
  }

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold text-slate-800 dark:text-slate-100">Servicios</h2>
        <button className="btn-primary" onClick={() => setEditing("new")}>+ Nuevo servicio</button>
      </div>
      {isLoading ? <Spinner /> : !services?.length ? <EmptyState title="Sin servicios" /> : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 text-left">
              <tr><th className="px-5 py-3 font-medium">Servicio</th><th className="px-5 py-3 font-medium">Duración</th><th className="px-5 py-3 font-medium">Precio</th><th className="px-5 py-3 font-medium">Profesional</th><th className="px-5 py-3 font-medium">Estado</th><th className="px-5 py-3"></th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {services.map((s) => (
                <tr key={s.id} className="hover:bg-slate-50 dark:hover:bg-slate-800">
                  <td className="px-5 py-3 font-medium">{s.name}</td>
                  <td className="px-5 py-3">{formatDuration(s.duration_min)}{s.buffer_min ? ` (+${s.buffer_min})` : ""}</td>
                  <td className="px-5 py-3">{s.price != null ? formatCurrency(s.price) : "—"}</td>
                  <td className="px-5 py-3">
                    {prosForService(s.id).length ? (
                      <div className="flex flex-wrap gap-1">
                        {prosForService(s.id).map((p) => (
                          <span key={p.id} className="badge inline-flex items-center gap-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200">
                            <span className="inline-block w-2 h-2 rounded-full" style={{ background: p.color }} />
                            {p.name}
                          </span>
                        ))}
                      </div>
                    ) : <span className="text-slate-400 dark:text-slate-500">Sin asignar</span>}
                  </td>
                  <td className="px-5 py-3"><button onClick={() => toggle(s)} className={`badge ${s.is_active ? "bg-green-100 text-green-700" : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400"}`}>{s.is_active ? "Activo" : "Inactivo"}</button></td>
                  <td className="px-5 py-3 text-right whitespace-nowrap">
                    <button className="btn-ghost text-xs" onClick={() => setEditing(s)}>Editar</button>
                    <button className="btn-ghost text-xs ml-1" onClick={() => setRemoving(s)}>🗑</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      )}
      {editing && <ServiceModal bid={bid} service={editing === "new" ? null : editing} pros={pros ?? []} onClose={() => setEditing(null)} onSaved={() => { qc.invalidateQueries(); setEditing(null); }} />}
      <ConfirmDialog
        open={!!removing}
        title="Eliminar servicio"
        message={removing ? `¿Eliminar "${removing.name}"?` : ""}
        onConfirm={() => removing && remove(removing)}
        onCancel={() => setRemoving(null)}
      />
    </section>
  );
}

function ServiceModal({ bid, service, pros, onClose, onSaved }: {
  bid: string; service: Service | null; pros: Professional[]; onClose: () => void; onSaved: () => void;
}) {
  const [form, setForm] = useState({
    name: service?.name ?? "", duration_min: service?.duration_min ?? 30, buffer_min: service?.buffer_min ?? 0,
    price: service?.price?.toString() ?? "", is_active: service?.is_active ?? true,
  });
  const [professionalIds, setProfessionalIds] = useState<string[]>([]);
  const [wins, setWins] = useState<Win[]>([]);
  const [loaded, setLoaded] = useState(!service);
  const [busy, setBusy] = useState(false);

  useQuery({
    queryKey: ["svc-avail-and-pros", service?.id],
    enabled: !!service,
    queryFn: async () => {
      const [avail, proLinks] = await Promise.all([
        supabase.from("service_availability").select("weekday, start_time, end_time").eq("service_id", service!.id),
        supabase.from("service_professionals").select("professional_id").eq("service_id", service!.id),
      ]);
      setWins((avail.data ?? []).map((w) => ({ weekday: w.weekday, start_time: shortTime(w.start_time), end_time: shortTime(w.end_time) })));
      setProfessionalIds((proLinks.data ?? []).map((p) => p.professional_id));
      setLoaded(true);
      return null;
    },
  });

  function toggleProfessional(id: string) {
    setProfessionalIds((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  }

  async function save() {
    setBusy(true);
    const payload = {
      business_id: bid, name: form.name.trim(), duration_min: Number(form.duration_min),
      buffer_min: Number(form.buffer_min), price: form.price ? Number(form.price) : null,
      is_active: form.is_active,
    };
    let sid = service?.id;
    if (!sid) {
      const { data } = await supabase.from("services").insert(payload).select().single();
      sid = data!.id;
    } else {
      await supabase.from("services").update(payload).eq("id", sid);
      await supabase.from("service_availability").delete().eq("service_id", sid);
      await supabase.from("service_professionals").delete().eq("service_id", sid);
    }
    if (wins.length) await supabase.from("service_availability").insert(wins.map((w) => ({ service_id: sid, ...w })));
    if (professionalIds.length) await supabase.from("service_professionals").insert(professionalIds.map((pid) => ({ service_id: sid, professional_id: pid })));
    setBusy(false); onSaved();
  }

  return (
    <Modal open onClose={onClose} title={service ? "Editar servicio" : "Nuevo servicio"} width="max-w-xl">
      <div className="space-y-4">
        <div><label className="label">Nombre</label><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
        <div className="grid grid-cols-3 gap-3">
          <div><label className="label">Duración (min)</label><input type="number" className="input" value={form.duration_min} onChange={(e) => setForm({ ...form, duration_min: +e.target.value })} min={5} step={5} /></div>
          <div><label className="label">Margen (min)</label><input type="number" className="input" value={form.buffer_min} onChange={(e) => setForm({ ...form, buffer_min: +e.target.value })} min={0} step={5} /></div>
          <div><label className="label">Precio (€)</label><input type="number" className="input" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} min={0} step="0.5" /></div>
        </div>
        <div>
          <label className="label">Profesionales que lo prestan (opcional)</label>
          <p className="text-xs text-slate-400 dark:text-slate-500 mb-2">Si no marcas ninguno, se usa el aforo del negocio. Si marcas varios, el cliente podrá elegir uno o "cualquiera disponible".</p>
          {!pros.length ? (
            <p className="text-xs text-slate-400 dark:text-slate-500">Crea profesionales primero para poder asignarlos.</p>
          ) : loaded ? (
            <div className="grid sm:grid-cols-2 gap-1.5">
              {pros.map((p) => (
                <label key={p.id} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={professionalIds.includes(p.id)} onChange={() => toggleProfessional(p.id)} />
                  <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: p.color }} />
                  {p.name}
                </label>
              ))}
            </div>
          ) : <Spinner />}
        </div>
        <div>
          <label className="label">Disponibilidad propia del servicio</label>
          <p className="text-xs text-slate-400 dark:text-slate-500 mb-2">Si lo dejas vacío, el servicio se ofrece en todo el horario del negocio.</p>
          {loaded ? <WindowsEditor wins={wins} onChange={setWins} /> : <Spinner />}
        </div>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} /> Activo</label>
        <div className="flex justify-end gap-2"><button className="btn-ghost" onClick={onClose}>Cancelar</button><button className="btn-primary" disabled={!form.name.trim() || busy} onClick={save}>Guardar</button></div>
      </div>
    </Modal>
  );
}

