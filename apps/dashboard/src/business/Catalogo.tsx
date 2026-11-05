import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import { useBusinessId, useServices, useServiceOptions, useOptionGroups, type ServiceOption } from "./hooks";
import { PageHeader, Spinner, ConfirmDialog } from "../components/ui";

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const slugify = (s: string) => norm(s).replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "nivel";

/** Catálogo del modo encargo: sabores (con "no disponible esta semana"), niveles de precio y precios por tamaño. */
export function Catalogo() {
  const bid = useBusinessId();
  const qc = useQueryClient();
  const { data: services, isLoading: l1 } = useServices(true);
  const { data: options, isLoading: l2 } = useServiceOptions();
  const { data: groups, isLoading: l3 } = useOptionGroups();
  const [query, setQuery] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<ServiceOption | null>(null);
  const [newGroup, setNewGroup] = useState("");

  function flash(m: string) { setToast(m); setTimeout(() => setToast(null), 2200); }
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["service_options", bid] });
    qc.invalidateQueries({ queryKey: ["service_option_groups", bid] });
    qc.invalidateQueries({ queryKey: ["services", bid] });
  };

  async function setAvailable(o: ServiceOption, v: boolean) {
    const { error } = await supabase.from("service_options").update({ is_available: v }).eq("id", o.id);
    if (error) flash(error.message); else refresh();
  }
  async function renameOption(o: ServiceOption, name: string) {
    const n = name.trim();
    if (!n || n === o.name) return;
    const { error } = await supabase.from("service_options").update({ name: n }).eq("id", o.id);
    if (error) flash(error.code === "23505" ? "Ya existe un sabor con ese nombre en este nivel." : error.message); else refresh();
  }
  async function addOption(group: string, name: string): Promise<boolean> {
    const n = name.trim();
    if (!n) return false;
    const max = Math.max(0, ...(options ?? []).filter((o) => o.option_group === group).map((o) => o.sort_order));
    const { error } = await supabase.from("service_options").insert({ business_id: bid, option_group: group, name: n, sort_order: max + 1 });
    if (error) { flash(error.code === "23505" ? "Ya existe un sabor con ese nombre en este nivel." : error.message); return false; }
    refresh(); return true;
  }
  async function removeOption() {
    if (!deleting) return;
    const { error } = await supabase.from("service_options").delete().eq("id", deleting.id);
    setDeleting(null);
    if (error) flash(error.message); else { refresh(); flash("Sabor eliminado"); }
  }
  async function allAvailable() {
    const { error } = await supabase.from("service_options").update({ is_available: true }).eq("business_id", bid).eq("is_available", false);
    if (error) flash(error.message); else { refresh(); flash("Todos los sabores disponibles"); }
  }
  async function renameGroup(key: string, label: string) {
    const l = label.trim();
    if (!l) return;
    const { error } = await supabase.from("service_option_groups").update({ label: l }).eq("business_id", bid).eq("group_key", key);
    if (error) flash(error.message); else refresh();
  }
  async function addGroup() {
    const label = newGroup.trim();
    if (!label) return;
    const key = slugify(label);
    if ((groups ?? []).some((g) => g.group_key === key)) { flash("Ya existe un nivel con ese nombre."); return; }
    const max = Math.max(-1, ...(groups ?? []).map((g) => g.sort_order));
    const { error } = await supabase.from("service_option_groups").insert({ business_id: bid, group_key: key, label, sort_order: max + 1 });
    if (error) flash(error.message); else { setNewGroup(""); refresh(); flash("Nivel creado (falta crear sus servicios de tamaño/precio)"); }
  }
  async function savePrice(id: string, price: string, active: boolean) {
    const p = price.trim() === "" ? null : Number(price.replace(",", "."));
    if (p !== null && (!Number.isFinite(p) || p < 0 || p > 100000)) { flash("Precio no válido"); return; }
    const { error } = await supabase.from("services").update({ price: p, is_active: active }).eq("id", id);
    if (error) flash(error.message); else { refresh(); flash("Guardado"); }
  }

  if (l1 || l2 || l3) return <div className="grid place-items-center py-20"><Spinner /></div>;

  const q = norm(query.trim());
  const unavailable = (options ?? []).filter((o) => !o.is_available).length;

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader
        title="Catálogo"
        subtitle="Sabores, niveles de precio y precios por tamaño"
        actions={unavailable > 0 ? <button className="btn-ghost" onClick={allAvailable}>Marcar los {unavailable} como disponibles</button> : undefined}
      />
      {toast && <div className="fixed top-4 right-4 bg-slate-900 text-white text-sm px-4 py-2 rounded-lg shadow-lg z-50">{toast}</div>}

      {/* Precios por tamaño y nivel */}
      <section className="card p-5">
        <h2 className="font-semibold mb-1">Precios por tamaño</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-3">Un servicio por cada combinación de nivel y tamaño. Desactiva un servicio para dejar de ofrecer ese tamaño en ese nivel.</p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-slate-500 dark:text-slate-400 text-left">
              <tr><th className="py-1.5 pr-3 font-medium">Nivel</th><th className="py-1.5 pr-3 font-medium">Tamaño</th><th className="py-1.5 pr-3 font-medium">Precio (€)</th><th className="py-1.5 font-medium">Activo</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {(services ?? []).filter((s) => s.size_key).map((s) => (
                <PriceRow key={s.id + String(s.price) + String(s.is_active)} service={s}
                  groupLabel={(groups ?? []).find((g) => g.group_key === s.option_group)?.label ?? s.option_group ?? "—"} onSave={savePrice} />
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Sabores */}
      <section className="card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <h2 className="font-semibold">Sabores <span className="font-normal text-slate-400 dark:text-slate-500">({(options ?? []).length})</span></h2>
          <input className="input w-full sm:w-64" type="search" placeholder="Buscar sabor…" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <p className="text-xs text-slate-400 dark:text-slate-500 mb-3">Interruptor apagado = «No disponible esta semana» en el widget (no se borra). Los encargos ya hechos conservan el nombre del sabor.</p>

        <div className="space-y-5">
          {(groups ?? []).map((g) => {
            const items = (options ?? []).filter((o) => o.option_group === g.group_key && (!q || norm(o.name).includes(q)));
            if (q && !items.length) return null;
            return (
              <div key={g.group_key}>
                <GroupHeader label={g.label} count={items.length} onRename={(l) => renameGroup(g.group_key, l)} />
                <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                  {items.map((o) => (
                    <li key={o.id} className="flex items-center gap-3 py-1.5">
                      <label className="relative inline-flex items-center cursor-pointer shrink-0" title={o.is_available ? "Disponible" : "No disponible esta semana"}>
                        <input type="checkbox" className="sr-only peer" checked={o.is_available} onChange={(e) => setAvailable(o, e.target.checked)} />
                        <span className="w-9 h-5 rounded-full bg-slate-300 dark:bg-slate-600 peer-checked:bg-brand-500 transition" />
                        <span className="absolute left-0.5 top-0.5 w-4 h-4 rounded-full bg-white transition peer-checked:translate-x-4" />
                      </label>
                      <input
                        className={`flex-1 min-w-0 bg-transparent border-0 border-b border-transparent hover:border-slate-200 dark:hover:border-slate-700 focus:border-brand-500 focus:outline-none py-0.5 ${o.is_available ? "" : "text-slate-400 line-through"}`}
                        defaultValue={o.name}
                        onBlur={(e) => { renameOption(o, e.target.value); if (!e.target.value.trim()) e.target.value = o.name; }}
                        onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
                        aria-label={`Nombre del sabor ${o.name}`}
                      />
                      <button className="text-slate-400 hover:text-red-600 text-sm" title="Eliminar sabor" onClick={() => setDeleting(o)}>✕</button>
                    </li>
                  ))}
                </ul>
                {!q && <AddOption onAdd={(n) => addOption(g.group_key, n)} />}
              </div>
            );
          })}
        </div>
      </section>

      <section className="card p-5">
        <h2 className="font-semibold mb-1">Nuevo nivel de precio</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-3">Crea el nivel y pide que le añadan sus servicios de tamaño y precio; hasta entonces sus sabores aparecen como no disponibles.</p>
        <div className="flex gap-2">
          <input className="input" placeholder="Ej.: Ediciones de Navidad" value={newGroup} onChange={(e) => setNewGroup(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addGroup()} />
          <button className="btn-primary shrink-0" onClick={addGroup}>Crear</button>
        </div>
      </section>

      <ConfirmDialog
        open={!!deleting}
        title="Eliminar sabor"
        message={`¿Eliminar «${deleting?.name ?? ""}»? Si solo quieres quitarlo unos días, apaga su interruptor en vez de borrarlo.`}
        onConfirm={removeOption}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
}

function PriceRow({ service, groupLabel, onSave }: {
  service: { id: string; price: number | null; is_active: boolean; size_label: string | null; name: string };
  groupLabel: string;
  onSave: (id: string, price: string, active: boolean) => void;
}) {
  const [price, setPrice] = useState(service.price?.toString() ?? "");
  const [active, setActive] = useState(service.is_active);
  const dirty = price !== (service.price?.toString() ?? "") || active !== service.is_active;
  return (
    <tr>
      <td className="py-1.5 pr-3">{groupLabel}</td>
      <td className="py-1.5 pr-3">{service.size_label ?? service.name}</td>
      <td className="py-1.5 pr-3"><input className="input w-24" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} /></td>
      <td className="py-1.5 flex items-center gap-3">
        <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
        {dirty && <button className="btn-primary text-xs py-1" onClick={() => onSave(service.id, price, active)}>Guardar</button>}
      </td>
    </tr>
  );
}

function GroupHeader({ label, count, onRename }: { label: string; count: number; onRename: (l: string) => void }) {
  return (
    <div className="flex items-baseline gap-2 border-b border-slate-200 dark:border-slate-700 pb-1 mb-1">
      <input
        className="font-semibold bg-transparent border-0 focus:outline-none focus:border-b focus:border-brand-500"
        defaultValue={label}
        onBlur={(e) => onRename(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
        aria-label="Nombre del nivel"
      />
      <span className="text-xs text-slate-400 dark:text-slate-500">{count} sabor{count === 1 ? "" : "es"}</span>
    </div>
  );
}

function AddOption({ onAdd }: { onAdd: (name: string) => Promise<boolean> }) {
  const [name, setName] = useState("");
  async function go() { if (await onAdd(name)) setName(""); }
  return (
    <div className="flex gap-2 mt-2">
      <input className="input" placeholder="Añadir sabor a este nivel…" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && go()} />
      <button className="btn-ghost shrink-0" onClick={go}>Añadir</button>
    </div>
  );
}
