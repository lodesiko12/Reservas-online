import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import { useServices, useProfessionals, useBusinessId, type Service, type Professional } from "./hooks";
import { WEEKDAYS_ES, formatDuration, formatCurrency, shortTime } from "@reservas/shared";
import { PageHeader, Spinner, Modal, EmptyState } from "../components/ui";

type Win = { weekday: number; start_time: string; end_time: string };

export function Servicios() {
  return (
    <div className="space-y-8">
      <PageHeader title="Servicios y profesionales" subtitle="Catálogo, duración, disponibilidad y equipo" />
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

  async function remove(p: Professional) {
    if (!confirm(`¿Eliminar a ${p.name}? Sus servicios quedarán sin profesional asignado.`)) return;
    await supabase.from("professionals").delete().eq("id", p.id);
    qc.invalidateQueries();
  }

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold text-slate-800">Profesionales</h2>
        <button className="btn-ghost" onClick={() => setEditing("new")}>+ Añadir</button>
      </div>
      {isLoading ? <Spinner /> : !pros?.length ? (
        <EmptyState title="Sin profesionales" hint="Opcional: úsalos si asignas servicios a personas concretas." />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {pros.map((p) => (
            <div key={p.id} className="card p-4 flex items-center justify-between">
              <div>
                <div className="font-medium">{p.name}</div>
                <div className="text-xs text-slate-400">{p.is_active ? "Activo" : "Inactivo"}</div>
              </div>
              <div className="flex gap-1">
                <button className="btn-ghost text-xs" onClick={() => setEditing(p)}>Horario</button>
                <button className="btn-ghost text-xs" onClick={() => remove(p)}>🗑</button>
              </div>
            </div>
          ))}
        </div>
      )}
      {editing && <ProfessionalModal bid={bid} professional={editing === "new" ? null : editing} onClose={() => setEditing(null)} onSaved={() => { qc.invalidateQueries(); setEditing(null); }} />}
    </section>
  );
}

function ProfessionalModal({ bid, professional, onClose, onSaved }: {
  bid: string; professional: Professional | null; onClose: () => void; onSaved: () => void;
}) {
  const [name, setName] = useState(professional?.name ?? "");
  const [wins, setWins] = useState<Win[]>([]);
  const [loaded, setLoaded] = useState(!professional);
  const [busy, setBusy] = useState(false);

  useQuery({
    queryKey: ["prof-hours", professional?.id],
    enabled: !!professional,
    queryFn: async () => {
      const { data } = await supabase.from("professional_hours").select("weekday, start_time, end_time").eq("professional_id", professional!.id);
      setWins((data ?? []).map((w) => ({ weekday: w.weekday, start_time: shortTime(w.start_time), end_time: shortTime(w.end_time) })));
      setLoaded(true);
      return data;
    },
  });

  async function save() {
    setBusy(true);
    let pid = professional?.id;
    if (!pid) {
      const { data } = await supabase.from("professionals").insert({ business_id: bid, name: name.trim() }).select().single();
      pid = data!.id;
    } else {
      await supabase.from("professionals").update({ name: name.trim() }).eq("id", pid);
      await supabase.from("professional_hours").delete().eq("professional_id", pid);
    }
    if (wins.length) await supabase.from("professional_hours").insert(wins.map((w) => ({ professional_id: pid, ...w })));
    setBusy(false); onSaved();
  }

  return (
    <Modal open onClose={onClose} title={professional ? "Editar profesional" : "Nuevo profesional"}>
      <div className="space-y-4">
        <div><label className="label">Nombre</label><input className="input" value={name} onChange={(e) => setName(e.target.value)} /></div>
        <div>
          <label className="label">Horario de trabajo</label>
          {loaded ? <WindowsEditor wins={wins} onChange={setWins} /> : <Spinner />}
        </div>
        <div className="flex justify-end gap-2"><button className="btn-ghost" onClick={onClose}>Cancelar</button><button className="btn-primary" disabled={!name.trim() || busy} onClick={save}>Guardar</button></div>
      </div>
    </Modal>
  );
}

/* ------------------------------ Servicios ------------------------------ */
function ServicesSection() {
  const qc = useQueryClient();
  const { data: services, isLoading } = useServices(true);
  const { data: pros } = useProfessionals();
  const bid = useBusinessId();
  const [editing, setEditing] = useState<Service | "new" | null>(null);

  async function toggle(s: Service) {
    await supabase.from("services").update({ is_active: !s.is_active }).eq("id", s.id);
    qc.invalidateQueries();
  }
  async function remove(s: Service) {
    if (!confirm(`¿Eliminar "${s.name}"?`)) return;
    await supabase.from("services").delete().eq("id", s.id);
    qc.invalidateQueries();
  }

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold text-slate-800">Servicios</h2>
        <button className="btn-primary" onClick={() => setEditing("new")}>+ Nuevo servicio</button>
      </div>
      {isLoading ? <Spinner /> : !services?.length ? <EmptyState title="Sin servicios" /> : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-left">
              <tr><th className="px-5 py-3 font-medium">Servicio</th><th className="px-5 py-3 font-medium">Duración</th><th className="px-5 py-3 font-medium">Precio</th><th className="px-5 py-3 font-medium">Profesional</th><th className="px-5 py-3 font-medium">Estado</th><th className="px-5 py-3"></th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {services.map((s) => (
                <tr key={s.id} className="hover:bg-slate-50">
                  <td className="px-5 py-3 font-medium">{s.name}</td>
                  <td className="px-5 py-3">{formatDuration(s.duration_min)}{s.buffer_min ? ` (+${s.buffer_min})` : ""}</td>
                  <td className="px-5 py-3">{s.price != null ? formatCurrency(s.price) : "—"}</td>
                  <td className="px-5 py-3">{pros?.find((p) => p.id === s.professional_id)?.name ?? <span className="text-slate-400">Sin asignar</span>}</td>
                  <td className="px-5 py-3"><button onClick={() => toggle(s)} className={`badge ${s.is_active ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"}`}>{s.is_active ? "Activo" : "Inactivo"}</button></td>
                  <td className="px-5 py-3 text-right whitespace-nowrap">
                    <button className="btn-ghost text-xs" onClick={() => setEditing(s)}>Editar</button>
                    <button className="btn-ghost text-xs ml-1" onClick={() => remove(s)}>🗑</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {editing && <ServiceModal bid={bid} service={editing === "new" ? null : editing} pros={pros ?? []} onClose={() => setEditing(null)} onSaved={() => { qc.invalidateQueries(); setEditing(null); }} />}
    </section>
  );
}

function ServiceModal({ bid, service, pros, onClose, onSaved }: {
  bid: string; service: Service | null; pros: Professional[]; onClose: () => void; onSaved: () => void;
}) {
  const [form, setForm] = useState({
    name: service?.name ?? "", duration_min: service?.duration_min ?? 30, buffer_min: service?.buffer_min ?? 0,
    price: service?.price?.toString() ?? "", professional_id: service?.professional_id ?? "", is_active: service?.is_active ?? true,
  });
  const [wins, setWins] = useState<Win[]>([]);
  const [loaded, setLoaded] = useState(!service);
  const [busy, setBusy] = useState(false);

  useQuery({
    queryKey: ["svc-avail", service?.id],
    enabled: !!service,
    queryFn: async () => {
      const { data } = await supabase.from("service_availability").select("weekday, start_time, end_time").eq("service_id", service!.id);
      setWins((data ?? []).map((w) => ({ weekday: w.weekday, start_time: shortTime(w.start_time), end_time: shortTime(w.end_time) })));
      setLoaded(true);
      return data;
    },
  });

  async function save() {
    setBusy(true);
    const payload = {
      business_id: bid, name: form.name.trim(), duration_min: Number(form.duration_min),
      buffer_min: Number(form.buffer_min), price: form.price ? Number(form.price) : null,
      professional_id: form.professional_id || null, is_active: form.is_active,
    };
    let sid = service?.id;
    if (!sid) {
      const { data } = await supabase.from("services").insert(payload).select().single();
      sid = data!.id;
    } else {
      await supabase.from("services").update(payload).eq("id", sid);
      await supabase.from("service_availability").delete().eq("service_id", sid);
    }
    if (wins.length) await supabase.from("service_availability").insert(wins.map((w) => ({ service_id: sid, ...w })));
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
        <div><label className="label">Profesional (opcional)</label>
          <select className="input" value={form.professional_id} onChange={(e) => setForm({ ...form, professional_id: e.target.value })}>
            <option value="">Sin asignar (usa aforo del negocio)</option>
            {pros.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Disponibilidad propia del servicio</label>
          <p className="text-xs text-slate-400 mb-2">Si lo dejas vacío, el servicio se ofrece en todo el horario del negocio.</p>
          {loaded ? <WindowsEditor wins={wins} onChange={setWins} /> : <Spinner />}
        </div>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} /> Activo</label>
        <div className="flex justify-end gap-2"><button className="btn-ghost" onClick={onClose}>Cancelar</button><button className="btn-primary" disabled={!form.name.trim() || busy} onClick={save}>Guardar</button></div>
      </div>
    </Modal>
  );
}

/* ------------------------------ Editor de franjas ------------------------------ */
function WindowsEditor({ wins, onChange }: { wins: Win[]; onChange: (w: Win[]) => void }) {
  function add() { onChange([...wins, { weekday: 1, start_time: "09:00", end_time: "14:00" }]); }
  function update(i: number, patch: Partial<Win>) { onChange(wins.map((w, j) => (j === i ? { ...w, ...patch } : w))); }
  function del(i: number) { onChange(wins.filter((_, j) => j !== i)); }

  return (
    <div className="space-y-2">
      {wins.map((w, i) => (
        <div key={i} className="flex items-center gap-2">
          <select className="input py-1.5" value={w.weekday} onChange={(e) => update(i, { weekday: +e.target.value })}>
            {WEEKDAYS_ES.map((d, idx) => <option key={idx} value={idx}>{d}</option>)}
          </select>
          <input type="time" className="input py-1.5 w-28" value={w.start_time} onChange={(e) => update(i, { start_time: e.target.value })} />
          <span className="text-slate-400">–</span>
          <input type="time" className="input py-1.5 w-28" value={w.end_time} onChange={(e) => update(i, { end_time: e.target.value })} />
          <button className="text-slate-400 hover:text-red-600" onClick={() => del(i)}>✕</button>
        </div>
      ))}
      <button type="button" className="btn-ghost text-xs" onClick={add}>+ Añadir franja</button>
    </div>
  );
}
