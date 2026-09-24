import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import { useBusinessId, useDiningZones, useDiningTables, useDiningTableCombos, type DiningZone, type DiningTable, type DiningTableCombo } from "./hooks";
import { PageHeader, Spinner, Modal, EmptyState, ConfirmDialog } from "../components/ui";

export function Mesas() {
  const bid = useBusinessId();
  const qc = useQueryClient();
  const { data: zones, isLoading: loadingZones } = useDiningZones();
  const { data: tables, isLoading: loadingTables } = useDiningTables();
  const { data: combos, isLoading: loadingCombos } = useDiningTableCombos();
  const [editingZone, setEditingZone] = useState<DiningZone | "new" | null>(null);
  const [editingTable, setEditingTable] = useState<DiningTable | "new" | null>(null);
  const [editingCombo, setEditingCombo] = useState<DiningTableCombo | "new" | null>(null);
  const [pendingDelete, setPendingDelete] = useState<
    { kind: "zone"; item: DiningZone } | { kind: "table"; item: DiningTable } | { kind: "combo"; item: DiningTableCombo } | null
  >(null);

  const isLoading = loadingZones || loadingTables;

  function invalidate() {
    qc.invalidateQueries({ queryKey: ["dining_zones", bid] });
    qc.invalidateQueries({ queryKey: ["dining_tables", bid] });
  }

  async function removeZone(z: DiningZone) {
    setPendingDelete(null);
    await supabase.from("dining_zones").delete().eq("id", z.id);
    invalidate();
  }
  async function removeTable(t: DiningTable) {
    setPendingDelete(null);
    await supabase.from("dining_tables").delete().eq("id", t.id);
    invalidate();
  }
  async function toggleTable(t: DiningTable) {
    await supabase.from("dining_tables").update({ is_active: !t.is_active }).eq("id", t.id);
    invalidate();
  }
  async function removeCombo(c: DiningTableCombo) {
    setPendingDelete(null);
    await supabase.from("dining_table_combos").delete().eq("id", c.id);
    qc.invalidateQueries({ queryKey: ["dining_table_combos", bid] });
  }
  async function toggleCombo(c: DiningTableCombo) {
    await supabase.from("dining_table_combos").update({ is_active: !c.is_active }).eq("id", c.id);
    qc.invalidateQueries({ queryKey: ["dining_table_combos", bid] });
  }

  const tablesByZone = new Map<string | null, typeof tables>();
  for (const t of tables ?? []) {
    const key = t.zone_id;
    tablesByZone.set(key, [...(tablesByZone.get(key) ?? []), t]);
  }

  return (
    <div>
      <PageHeader
        title="Mesas y zonas"
        subtitle="Mesas físicas de la sala: capacidad, zona y prioridad de asignación"
        actions={
          <div className="flex gap-2">
            <button className="btn-ghost" onClick={() => setEditingZone("new")}>+ Zona</button>
            <button className="btn-primary" onClick={() => setEditingTable("new")}>+ Mesa</button>
          </div>
        }
      />

      {isLoading ? (
        <div className="grid place-items-center py-20"><Spinner /></div>
      ) : !zones?.length && !tables?.length ? (
        <EmptyState title="Sin mesas todavía" hint="Crea al menos una zona (p.ej. Interior) y sus mesas para activar la asignación automática." />
      ) : (
        <div className="space-y-6">
          {(zones ?? []).map((z) => (
            <div key={z.id} className="card p-5">
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-semibold text-lg">{z.name}</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    {z.reservable_online ? "Reservable online" : "Solo manual/teléfono"}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`badge ${z.is_active ? "bg-green-100 text-green-700" : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400"}`}>{z.is_active ? "Activa" : "Inactiva"}</span>
                  <button className="btn-ghost text-xs" onClick={() => setEditingZone(z)}>Editar</button>
                  <button className="btn-ghost text-xs" onClick={() => setPendingDelete({ kind: "zone", item: z })}>🗑</button>
                </div>
              </div>
              <TableGrid tables={tablesByZone.get(z.id) ?? []} onEdit={setEditingTable} onRemove={(t) => setPendingDelete({ kind: "table", item: t })} onToggle={toggleTable} />
            </div>
          ))}

          {(tablesByZone.get(null)?.length ?? 0) > 0 && (
            <div className="card p-5">
              <div className="font-semibold text-lg text-slate-500 dark:text-slate-400">Sin zona</div>
              <TableGrid tables={tablesByZone.get(null) ?? []} onEdit={setEditingTable} onRemove={(t) => setPendingDelete({ kind: "table", item: t })} onToggle={toggleTable} />
            </div>
          )}
        </div>
      )}

      <div className="mt-8">
        <PageHeader
          title="Combinaciones de mesas"
          subtitle="Para grupos grandes: qué mesas se pueden juntar y para qué rango de comensales"
          actions={<button className="btn-primary" onClick={() => setEditingCombo("new")} disabled={(tables?.length ?? 0) < 2}>+ Combinación</button>}
        />
        {loadingCombos ? <Spinner /> : !combos?.length ? (
          <EmptyState title="Sin combinaciones" hint="Crea una para grupos que no caben en una sola mesa (p.ej. Mesa 5 + Mesa 6)." />
        ) : (
          <div className="grid sm:grid-cols-2 gap-3">
            {combos.map((c) => (
              <div key={c.id} className={`card p-4 ${c.is_active ? "" : "opacity-50"}`}>
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-semibold">{c.name || "Combinación"}</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      {c.table_ids.map((id) => tables?.find((t) => t.id === id)?.name ?? "?").join(" + ")}
                    </div>
                  </div>
                  <button onClick={() => toggleCombo(c)} className={`badge ${c.is_active ? "bg-green-100 text-green-700" : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400"}`}>{c.is_active ? "Activa" : "Inactiva"}</button>
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-2">{c.cap_min}–{c.cap_max} comensales{c.priority > 0 ? ` · prioridad ${c.priority}` : ""}</div>
                <div className="mt-2 flex gap-2">
                  <button className="btn-ghost text-xs" onClick={() => setEditingCombo(c)}>Editar</button>
                  <button className="btn-ghost text-xs" onClick={() => setPendingDelete({ kind: "combo", item: c })}>🗑</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {editingZone && (
        <ZoneModal bid={bid} zone={editingZone === "new" ? null : editingZone} onClose={() => setEditingZone(null)}
          onSaved={() => { invalidate(); setEditingZone(null); }} />
      )}
      {editingTable && (
        <TableModal bid={bid} zones={zones ?? []} table={editingTable === "new" ? null : editingTable} onClose={() => setEditingTable(null)}
          onSaved={() => { invalidate(); setEditingTable(null); }} />
      )}
      {editingCombo && (
        <ComboModal bid={bid} tables={tables ?? []} combo={editingCombo === "new" ? null : editingCombo} onClose={() => setEditingCombo(null)}
          onSaved={() => { qc.invalidateQueries({ queryKey: ["dining_table_combos", bid] }); setEditingCombo(null); }} />
      )}
      <ConfirmDialog
        open={!!pendingDelete}
        title="Eliminar"
        message={
          pendingDelete?.kind === "zone" ? `¿Eliminar la zona "${pendingDelete.item.name}"? Las mesas de esa zona quedarán sin zona asignada.`
          : pendingDelete?.kind === "table" ? `¿Eliminar la mesa "${pendingDelete.item.name}"?`
          : pendingDelete?.kind === "combo" ? `¿Eliminar la combinación "${pendingDelete.item.name ?? "sin nombre"}"?`
          : ""
        }
        onConfirm={() => {
          if (!pendingDelete) return;
          if (pendingDelete.kind === "zone") removeZone(pendingDelete.item);
          else if (pendingDelete.kind === "table") removeTable(pendingDelete.item);
          else removeCombo(pendingDelete.item);
        }}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}

function TableGrid({ tables, onEdit, onRemove, onToggle }: {
  tables: DiningTable[]; onEdit: (t: DiningTable) => void; onRemove: (t: DiningTable) => void; onToggle: (t: DiningTable) => void;
}) {
  if (!tables.length) return <p className="text-sm text-slate-400 dark:text-slate-500 mt-3">Sin mesas en esta zona.</p>;
  return (
    <div className="mt-4 grid sm:grid-cols-3 md:grid-cols-4 gap-3">
      {tables.map((t) => (
        <div key={t.id} className={`rounded-lg border p-3 ${t.is_active ? "border-slate-200 dark:border-slate-700" : "border-slate-100 dark:border-slate-800 opacity-50"}`}>
          <div className="flex items-start justify-between">
            <div className="font-semibold">{t.name}</div>
            <button className="text-xs text-slate-400 dark:text-slate-500" onClick={() => onToggle(t)}>{t.is_active ? "●" : "○"}</button>
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400">{t.cap_min === t.cap_max ? `${t.cap_min} pers.` : `${t.cap_min}–${t.cap_max} pers.`}</div>
          {t.priority > 0 && <div className="text-xs text-brand-600">prioridad {t.priority}</div>}
          <div className="mt-2 flex gap-2">
            <button className="btn-ghost text-xs" onClick={() => onEdit(t)}>Editar</button>
            <button className="btn-ghost text-xs" onClick={() => onRemove(t)}>🗑</button>
          </div>
        </div>
      ))}
    </div>
  );
}

function ZoneModal({ bid, zone, onClose, onSaved }: { bid: string; zone: DiningZone | null; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    name: zone?.name ?? "",
    reservable_online: zone?.reservable_online ?? true,
    is_active: zone?.is_active ?? true,
  });
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    const payload = { business_id: bid, name: form.name.trim(), reservable_online: form.reservable_online, is_active: form.is_active };
    if (zone) await supabase.from("dining_zones").update(payload).eq("id", zone.id);
    else await supabase.from("dining_zones").insert(payload);
    setBusy(false); onSaved();
  }

  return (
    <Modal open onClose={onClose} title={zone ? "Editar zona" : "Nueva zona"}>
      <div className="space-y-4">
        <div><label className="label">Nombre</label><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Interior, Terraza…" /></div>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.reservable_online} onChange={(e) => setForm({ ...form, reservable_online: e.target.checked })} /> Reservable online (si no, solo se asigna manualmente)</label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} /> Activa</label>
        <div className="flex justify-end gap-2"><button className="btn-ghost" onClick={onClose}>Cancelar</button><button className="btn-primary" disabled={!form.name.trim() || busy} onClick={save}>Guardar</button></div>
      </div>
    </Modal>
  );
}

function TableModal({ bid, zones, table, onClose, onSaved }: {
  bid: string; zones: DiningZone[]; table: DiningTable | null; onClose: () => void; onSaved: () => void;
}) {
  const [form, setForm] = useState({
    name: table?.name ?? "",
    zone_id: table?.zone_id ?? (zones[0]?.id ?? ""),
    cap_min: table?.cap_min ?? 2,
    cap_max: table?.cap_max ?? 4,
    priority: table?.priority ?? 0,
    is_active: table?.is_active ?? true,
  });
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    const payload = {
      business_id: bid,
      zone_id: form.zone_id || null,
      name: form.name.trim(),
      cap_min: Number(form.cap_min),
      cap_max: Number(form.cap_max),
      priority: Number(form.priority),
      is_active: form.is_active,
    };
    if (table) await supabase.from("dining_tables").update(payload).eq("id", table.id);
    else await supabase.from("dining_tables").insert(payload);
    setBusy(false); onSaved();
  }

  const valid = form.name.trim() && Number(form.cap_max) >= Number(form.cap_min) && Number(form.cap_min) > 0;

  return (
    <Modal open onClose={onClose} title={table ? "Editar mesa" : "Nueva mesa"}>
      <div className="space-y-4">
        <div><label className="label">Nombre</label><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Mesa 4" /></div>
        <div>
          <label className="label">Zona</label>
          <select className="input" value={form.zone_id} onChange={(e) => setForm({ ...form, zone_id: e.target.value })}>
            <option value="">Sin zona</option>
            {zones.map((z) => <option key={z.id} value={z.id}>{z.name}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div><label className="label">Mín. pers.</label><input type="number" min={1} className="input" value={form.cap_min} onChange={(e) => setForm({ ...form, cap_min: +e.target.value })} /></div>
          <div><label className="label">Máx. pers.</label><input type="number" min={1} className="input" value={form.cap_max} onChange={(e) => setForm({ ...form, cap_max: +e.target.value })} /></div>
          <div><label className="label">Prioridad</label><input type="number" className="input" value={form.priority} onChange={(e) => setForm({ ...form, priority: +e.target.value })} /></div>
        </div>
        <p className="text-xs text-slate-400 dark:text-slate-500">La prioridad decide qué mesa se prefiere cuando varias encajan igual de bien (mayor = se asigna antes).</p>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} /> Activa</label>
        <div className="flex justify-end gap-2"><button className="btn-ghost" onClick={onClose}>Cancelar</button><button className="btn-primary" disabled={!valid || busy} onClick={save}>Guardar</button></div>
      </div>
    </Modal>
  );
}

function ComboModal({ bid, tables, combo, onClose, onSaved }: {
  bid: string; tables: DiningTable[]; combo: DiningTableCombo | null; onClose: () => void; onSaved: () => void;
}) {
  const [form, setForm] = useState({
    name: combo?.name ?? "",
    table_ids: combo?.table_ids ?? ([] as string[]),
    cap_min: combo?.cap_min ?? 8,
    cap_max: combo?.cap_max ?? 12,
    priority: combo?.priority ?? 0,
    is_active: combo?.is_active ?? true,
  });
  const [busy, setBusy] = useState(false);

  function toggleTableId(id: string) {
    setForm((f) => ({ ...f, table_ids: f.table_ids.includes(id) ? f.table_ids.filter((x) => x !== id) : [...f.table_ids, id] }));
  }

  async function save() {
    setBusy(true);
    const payload = {
      business_id: bid,
      name: form.name.trim() || null,
      table_ids: form.table_ids,
      cap_min: Number(form.cap_min),
      cap_max: Number(form.cap_max),
      priority: Number(form.priority),
      is_active: form.is_active,
    };
    if (combo) await supabase.from("dining_table_combos").update(payload).eq("id", combo.id);
    else await supabase.from("dining_table_combos").insert(payload);
    setBusy(false); onSaved();
  }

  const valid = form.table_ids.length >= 2 && Number(form.cap_max) >= Number(form.cap_min) && Number(form.cap_min) > 0;

  return (
    <Modal open onClose={onClose} title={combo ? "Editar combinación" : "Nueva combinación"}>
      <div className="space-y-4">
        <div><label className="label">Nombre (opcional)</label><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Mesa 5+6" /></div>
        <div>
          <label className="label">Mesas que se juntan (mínimo 2)</label>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mt-1">
            {tables.map((t) => (
              <button type="button" key={t.id} onClick={() => toggleTableId(t.id)}
                className={`px-2 py-1.5 rounded-lg text-sm border ${form.table_ids.includes(t.id) ? "bg-brand-500 text-white border-brand-500" : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700"}`}>
                {t.name}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div><label className="label">Mín. pers.</label><input type="number" min={1} className="input" value={form.cap_min} onChange={(e) => setForm({ ...form, cap_min: +e.target.value })} /></div>
          <div><label className="label">Máx. pers.</label><input type="number" min={1} className="input" value={form.cap_max} onChange={(e) => setForm({ ...form, cap_max: +e.target.value })} /></div>
          <div><label className="label">Prioridad</label><input type="number" className="input" value={form.priority} onChange={(e) => setForm({ ...form, priority: +e.target.value })} /></div>
        </div>
        <p className="text-xs text-slate-400 dark:text-slate-500">Solo se usa cuando ninguna mesa individual encaja para ese nº de comensales.</p>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} /> Activa</label>
        <div className="flex justify-end gap-2"><button className="btn-ghost" onClick={onClose}>Cancelar</button><button className="btn-primary" disabled={!valid || busy} onClick={save}>Guardar</button></div>
      </div>
    </Modal>
  );
}
