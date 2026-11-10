import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import { shortTime, formatCurrency } from "@reservas/shared";
import {
  useBusinessId, useMenuCategories, useMenuItems, useModifierGroups, useModifiers, useItemGroupLinks,
  useTakeawaySettings, useTakeawayHours,
  type MenuCategory, type MenuItemRow, type ModifierGroup, type Modifier,
} from "./hooks";
import { PageHeader, Spinner, ConfirmDialog, Modal } from "../components/ui";
import { WindowsEditor, type Win } from "../components/WindowsEditor";

const ALLERGENS = [
  "Gluten", "Crustáceos", "Huevos", "Pescado", "Cacahuetes", "Soja", "Lácteos",
  "Frutos de cáscara", "Apio", "Mostaza", "Sésamo", "Sulfitos", "Altramuces", "Moluscos",
];

type Tab = "platos" | "extras" | "ajustes";

const parsePrice = (s: string): number | null => {
  const n = Number(s.trim().replace(",", "."));
  return Number.isFinite(n) && n >= 0 && n <= 9999 ? Math.round(n * 100) / 100 : null;
};

function Toggle({ checked, onChange, title }: { checked: boolean; onChange: (v: boolean) => void; title?: string }) {
  return (
    <label className="relative inline-flex items-center cursor-pointer shrink-0" title={title}>
      <input type="checkbox" className="sr-only peer" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="w-9 h-5 rounded-full bg-slate-300 dark:bg-slate-600 peer-checked:bg-brand-500 transition" />
      <span className="absolute left-0.5 top-0.5 w-4 h-4 rounded-full bg-white transition peer-checked:translate-x-4" />
    </label>
  );
}

/** Carta del restaurante para pedidos online: platos, extras y ajustes de los pedidos. */
export function Carta() {
  const bid = useBusinessId();
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("platos");
  const [toast, setToast] = useState<string | null>(null);
  const { data: cats, isLoading: l1 } = useMenuCategories();
  const { data: items, isLoading: l2 } = useMenuItems();
  const { data: groups, isLoading: l3 } = useModifierGroups();
  const { data: mods, isLoading: l4 } = useModifiers();
  const { data: links, isLoading: l5 } = useItemGroupLinks();

  function flash(m: string) { setToast(m); setTimeout(() => setToast(null), 2400); }
  const refresh = () => {
    for (const k of ["menu_categories", "menu_items", "menu_modifier_groups", "menu_modifiers", "menu_item_modifier_groups"]) {
      qc.invalidateQueries({ queryKey: [k, bid] });
    }
  };

  if (l1 || l2 || l3 || l4 || l5) return <div className="grid place-items-center py-20"><Spinner /></div>;

  const tabs: { id: Tab; label: string }[] = [
    { id: "platos", label: "Platos" },
    { id: "extras", label: "Extras y opciones" },
    { id: "ajustes", label: "Ajustes de pedidos" },
  ];

  return (
    <div className="max-w-3xl space-y-5">
      <PageHeader title="Carta" subtitle="Platos, extras y reglas de los pedidos para llevar" />
      {toast && <div className="fixed top-4 right-4 bg-slate-900 text-white text-sm px-4 py-2 rounded-lg shadow-lg z-50">{toast}</div>}

      <div className="flex gap-1 border-b border-slate-200 dark:border-slate-800 overflow-x-auto">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 text-sm font-semibold whitespace-nowrap border-b-2 -mb-px ${tab === t.id ? "border-brand-500 text-brand-600" : "border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400"}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "platos" && (
        <PlatosTab bid={bid} cats={cats ?? []} items={items ?? []} groups={groups ?? []} links={links ?? []} refresh={refresh} flash={flash} />
      )}
      {tab === "extras" && (
        <ExtrasTab bid={bid} groups={groups ?? []} mods={mods ?? []} links={links ?? []} refresh={refresh} flash={flash} />
      )}
      {tab === "ajustes" && <AjustesTab bid={bid} flash={flash} />}
    </div>
  );
}

/* ----------------------------------- Platos ----------------------------------- */

function PlatosTab({ bid, cats, items, groups, links, refresh, flash }: {
  bid: string; cats: MenuCategory[]; items: MenuItemRow[]; groups: ModifierGroup[];
  links: { item_id: string; group_id: string; sort_order: number }[];
  refresh: () => void; flash: (m: string) => void;
}) {
  const [newCat, setNewCat] = useState("");
  const [editing, setEditing] = useState<{ item: MenuItemRow | null; categoryId: string } | null>(null);
  const [deletingCat, setDeletingCat] = useState<MenuCategory | null>(null);

  async function addCategory() {
    const name = newCat.trim();
    if (!name) return;
    const max = Math.max(-1, ...cats.map((c) => c.sort_order));
    const { error } = await supabase.from("menu_categories").insert({ business_id: bid, name, sort_order: max + 1 });
    if (error) flash(error.message); else { setNewCat(""); refresh(); }
  }
  async function renameCategory(c: MenuCategory, name: string) {
    const n = name.trim();
    if (!n || n === c.name) return;
    const { error } = await supabase.from("menu_categories").update({ name: n }).eq("id", c.id);
    if (error) flash(error.message); else refresh();
  }
  async function toggleCategory(c: MenuCategory, v: boolean) {
    const { error } = await supabase.from("menu_categories").update({ is_active: v }).eq("id", c.id);
    if (error) flash(error.message); else refresh();
  }
  async function moveCategory(i: number, dir: -1 | 1) {
    const a = cats[i], b = cats[i + dir];
    if (!a || !b) return;
    // Reescribe el orden completo para no depender de valores repetidos.
    const order = cats.map((c) => c.id);
    [order[i], order[i + dir]] = [order[i + dir], order[i]];
    const res = await Promise.all(order.map((id, n) => supabase.from("menu_categories").update({ sort_order: n }).eq("id", id)));
    if (res.some((r) => r.error)) flash("No se pudo reordenar"); else refresh();
  }
  async function removeCategory() {
    if (!deletingCat) return;
    const { error } = await supabase.from("menu_categories").delete().eq("id", deletingCat.id);
    setDeletingCat(null);
    if (error) flash(error.code === "23001" || error.code === "23503" ? "Vacía la categoría antes de borrarla." : error.message);
    else { refresh(); flash("Categoría eliminada"); }
  }
  async function setAvailable(it: MenuItemRow, v: boolean) {
    const { error } = await supabase.from("menu_items").update({ is_available: v }).eq("id", it.id);
    if (error) flash(error.message); else refresh();
  }
  async function moveItem(catItems: MenuItemRow[], i: number, dir: -1 | 1) {
    if (!catItems[i + dir]) return;
    const order = catItems.map((c) => c.id);
    [order[i], order[i + dir]] = [order[i + dir], order[i]];
    const res = await Promise.all(order.map((id, n) => supabase.from("menu_items").update({ sort_order: n }).eq("id", id)));
    if (res.some((r) => r.error)) flash("No se pudo reordenar"); else refresh();
  }

  return (
    <>
      {cats.length === 0 && (
        <div className="card p-6 text-center text-sm text-slate-500 dark:text-slate-400">
          Empieza creando una categoría (Hamburguesas, Pizzas, Bebidas…) y añade tus platos.
        </div>
      )}

      {cats.map((c, ci) => {
        const catItems = items.filter((i) => i.category_id === c.id);
        return (
          <section key={c.id} className="card p-5">
            <div className="flex items-center gap-2 mb-2">
              <input
                className={`flex-1 min-w-0 font-semibold bg-transparent border-0 border-b border-transparent hover:border-slate-200 dark:hover:border-slate-700 focus:border-brand-500 focus:outline-none ${c.is_active ? "" : "text-slate-400 line-through"}`}
                defaultValue={c.name}
                maxLength={80}
                onBlur={(e) => { renameCategory(c, e.target.value); if (!e.target.value.trim()) e.target.value = c.name; }}
                onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
                aria-label="Nombre de la categoría"
              />
              <span className="text-xs text-slate-400">{catItems.length} plato{catItems.length === 1 ? "" : "s"}</span>
              <Toggle checked={c.is_active} onChange={(v) => toggleCategory(c, v)} title={c.is_active ? "Visible en la carta" : "Oculta"} />
              <button className="text-slate-400 hover:text-slate-700 disabled:opacity-30" disabled={ci === 0} onClick={() => moveCategory(ci, -1)} title="Subir">↑</button>
              <button className="text-slate-400 hover:text-slate-700 disabled:opacity-30" disabled={ci === cats.length - 1} onClick={() => moveCategory(ci, 1)} title="Bajar">↓</button>
              <button className="text-slate-400 hover:text-red-600" onClick={() => setDeletingCat(c)} title="Eliminar categoría">✕</button>
            </div>

            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {catItems.map((it, ii) => (
                <li key={it.id} className="flex items-center gap-3 py-2">
                  <Toggle checked={it.is_available} onChange={(v) => setAvailable(it, v)} title={it.is_available ? "Disponible" : "Agotado hoy"} />
                  <button className="flex-1 min-w-0 text-left" onClick={() => setEditing({ item: it, categoryId: c.id })}>
                    <div className={`font-medium truncate ${it.is_active && it.is_available ? "" : "text-slate-400"} ${it.is_available ? "" : "line-through"}`}>
                      {it.name}
                      {!it.is_active && <span className="ml-2 badge bg-slate-100 text-slate-500">Oculto</span>}
                      {!it.is_available && <span className="ml-2 badge bg-amber-100 text-amber-700">Agotado</span>}
                    </div>
                    {it.description && <div className="text-xs text-slate-500 dark:text-slate-400 truncate">{it.description}</div>}
                  </button>
                  <span className="text-sm font-semibold tabular-nums">{formatCurrency(it.price)}</span>
                  <button className="text-slate-400 hover:text-slate-700 disabled:opacity-30" disabled={ii === 0} onClick={() => moveItem(catItems, ii, -1)} title="Subir">↑</button>
                  <button className="text-slate-400 hover:text-slate-700 disabled:opacity-30" disabled={ii === catItems.length - 1} onClick={() => moveItem(catItems, ii, 1)} title="Bajar">↓</button>
                  <button className="btn-ghost text-xs py-1" onClick={() => setEditing({ item: it, categoryId: c.id })}>Editar</button>
                </li>
              ))}
            </ul>
            <button className="btn-ghost mt-3 text-sm" onClick={() => setEditing({ item: null, categoryId: c.id })}>+ Añadir plato</button>
          </section>
        );
      })}

      <section className="card p-5">
        <h2 className="font-semibold mb-2">Nueva categoría</h2>
        <div className="flex gap-2">
          <input className="input" placeholder="Ej.: Hamburguesas" maxLength={80} value={newCat} onChange={(e) => setNewCat(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addCategory()} />
          <button className="btn-primary shrink-0" onClick={addCategory}>Crear</button>
        </div>
      </section>

      {editing && (
        <ItemModal
          bid={bid}
          item={editing.item}
          defaultCategoryId={editing.categoryId}
          cats={cats}
          groups={groups}
          links={links}
          nextOrder={Math.max(-1, ...items.filter((i) => i.category_id === editing.categoryId).map((i) => i.sort_order)) + 1}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); refresh(); flash("Guardado"); }}
          onError={flash}
        />
      )}

      <ConfirmDialog
        open={!!deletingCat}
        title="Eliminar categoría"
        message={`¿Eliminar «${deletingCat?.name ?? ""}»? Solo se puede borrar si no tiene platos; si solo quieres quitarla un tiempo, apaga su interruptor.`}
        onConfirm={removeCategory}
        onCancel={() => setDeletingCat(null)}
      />
    </>
  );
}

function ItemModal({ bid, item, defaultCategoryId, cats, groups, links, nextOrder, onClose, onSaved, onError }: {
  bid: string; item: MenuItemRow | null; defaultCategoryId: string; cats: MenuCategory[]; groups: ModifierGroup[];
  links: { item_id: string; group_id: string; sort_order: number }[]; nextOrder: number;
  onClose: () => void; onSaved: () => void; onError: (m: string) => void;
}) {
  const [name, setName] = useState(item?.name ?? "");
  const [description, setDescription] = useState(item?.description ?? "");
  const [price, setPrice] = useState(item ? String(item.price) : "");
  const [categoryId, setCategoryId] = useState(item?.category_id ?? defaultCategoryId);
  const [allergens, setAllergens] = useState<string[]>(item?.allergens ?? []);
  const [active, setActive] = useState(item?.is_active ?? true);
  const [groupIds, setGroupIds] = useState<string[]>(item ? links.filter((l) => l.item_id === item.id).map((l) => l.group_id) : []);
  const [saving, setSaving] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);

  const toggle = (arr: string[], v: string) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

  async function save() {
    const n = name.trim();
    const p = parsePrice(price);
    if (!n) { onError("Pon un nombre al plato."); return; }
    if (p === null) { onError("Precio no válido."); return; }
    setSaving(true);
    try {
      let id = item?.id;
      const row = { name: n, description: description.trim() || null, price: p, category_id: categoryId, allergens, is_active: active };
      if (id) {
        const { error } = await supabase.from("menu_items").update(row).eq("id", id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from("menu_items").insert({ ...row, business_id: bid, sort_order: nextOrder }).select("id").single();
        if (error) throw error;
        id = data.id;
      }
      // Grupos de extras: sustituye los vínculos del plato.
      const del = await supabase.from("menu_item_modifier_groups").delete().eq("item_id", id!);
      if (del.error) throw del.error;
      if (groupIds.length) {
        const ins = await supabase.from("menu_item_modifier_groups").insert(groupIds.map((g, i) => ({ item_id: id!, group_id: g, sort_order: i })));
        if (ins.error) throw ins.error;
      }
      onSaved();
    } catch (e: any) {
      onError(e.message ?? "No se pudo guardar el plato.");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!item) return;
    const { error } = await supabase.from("menu_items").delete().eq("id", item.id);
    setConfirmDel(false);
    if (error) onError(error.message); else onSaved();
  }

  return (
    <Modal open onClose={onClose} title={item ? "Editar plato" : "Nuevo plato"} width="max-w-xl">
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-2">
            <label className="block text-sm font-medium mb-1">Nombre *</label>
            <input className="input" value={name} maxLength={120} onChange={(e) => setName(e.target.value)} placeholder="Hamburguesa clásica" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Precio (€) *</label>
            <input className="input" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="9,50" />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Descripción</label>
          <textarea className="input" rows={2} maxLength={400} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Ingredientes, tamaño…" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Categoría</label>
          <select className="input" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <div className="text-sm font-medium mb-1">Alérgenos</div>
          <div className="flex flex-wrap gap-1.5">
            {ALLERGENS.map((a) => (
              <button
                type="button" key={a}
                onClick={() => setAllergens((cur) => toggle(cur, a))}
                className={`px-2.5 py-1 rounded-full text-xs border ${allergens.includes(a) ? "bg-amber-100 border-amber-300 text-amber-800" : "border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400"}`}
              >
                {a}
              </button>
            ))}
          </div>
        </div>
        <div>
          <div className="text-sm font-medium mb-1">Extras y opciones de este plato</div>
          {groups.length === 0 ? (
            <p className="text-xs text-slate-500 dark:text-slate-400">Aún no has creado grupos de extras (pestaña «Extras y opciones»).</p>
          ) : (
            <div className="space-y-1">
              {groups.map((g) => (
                <label key={g.id} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={groupIds.includes(g.id)} onChange={() => setGroupIds((cur) => toggle(cur, g.id))} />
                  {g.name}
                  <span className="text-xs text-slate-400">{g.min_choices >= 1 ? "obligatorio" : "opcional"}</span>
                </label>
              ))}
            </div>
          )}
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
          Visible en la carta online
        </label>
        <div className="flex items-center justify-between pt-2">
          {item ? <button className="text-sm text-red-600 hover:underline" onClick={() => setConfirmDel(true)}>Eliminar plato</button> : <span />}
          <div className="flex gap-2">
            <button className="btn-ghost" onClick={onClose}>Cancelar</button>
            <button className="btn-primary" disabled={saving} onClick={save}>{saving ? "Guardando…" : "Guardar"}</button>
          </div>
        </div>
      </div>
      <ConfirmDialog
        open={confirmDel}
        title="Eliminar plato"
        message={`¿Eliminar «${item?.name ?? ""}»? Los pedidos ya hechos conservan su nombre y precio. Si solo está agotado, mejor apaga su interruptor.`}
        onConfirm={remove}
        onCancel={() => setConfirmDel(false)}
      />
    </Modal>
  );
}

/* ----------------------------------- Extras ----------------------------------- */

function ExtrasTab({ bid, groups, mods, links, refresh, flash }: {
  bid: string; groups: ModifierGroup[]; mods: Modifier[];
  links: { item_id: string; group_id: string; sort_order: number }[];
  refresh: () => void; flash: (m: string) => void;
}) {
  const [newGroup, setNewGroup] = useState("");
  const [deleting, setDeleting] = useState<ModifierGroup | null>(null);

  async function addGroup() {
    const name = newGroup.trim();
    if (!name) return;
    const max = Math.max(-1, ...groups.map((g) => g.sort_order));
    const { error } = await supabase.from("menu_modifier_groups").insert({ business_id: bid, name, sort_order: max + 1, min_choices: 0, max_choices: 1 });
    if (error) flash(error.message); else { setNewGroup(""); refresh(); }
  }
  async function updateGroup(g: ModifierGroup, patch: Partial<Pick<ModifierGroup, "name" | "min_choices" | "max_choices">>) {
    const next = { ...g, ...patch };
    if (next.max_choices < 1) { flash("El máximo debe ser al menos 1."); refresh(); return; }
    if (next.min_choices > next.max_choices) { flash("El mínimo no puede superar al máximo."); refresh(); return; }
    const { error } = await supabase.from("menu_modifier_groups").update(patch).eq("id", g.id);
    if (error) flash(error.message); else refresh();
  }
  async function removeGroup() {
    if (!deleting) return;
    const { error } = await supabase.from("menu_modifier_groups").delete().eq("id", deleting.id);
    setDeleting(null);
    if (error) flash(error.message); else { refresh(); flash("Grupo eliminado"); }
  }
  async function addModifier(g: ModifierGroup, name: string, price: string): Promise<boolean> {
    const n = name.trim();
    const p = price.trim() === "" ? 0 : parsePrice(price);
    if (!n) return false;
    if (p === null) { flash("Precio no válido."); return false; }
    const max = Math.max(-1, ...mods.filter((m) => m.group_id === g.id).map((m) => m.sort_order));
    const { error } = await supabase.from("menu_modifiers").insert({ business_id: bid, group_id: g.id, name: n, price_delta: p, sort_order: max + 1 });
    if (error) { flash(error.message); return false; }
    refresh(); return true;
  }
  async function updateModifier(m: Modifier, patch: Partial<Pick<Modifier, "name" | "price_delta" | "is_available">>) {
    const { error } = await supabase.from("menu_modifiers").update(patch).eq("id", m.id);
    if (error) flash(error.message); else refresh();
  }
  async function removeModifier(m: Modifier) {
    const { error } = await supabase.from("menu_modifiers").delete().eq("id", m.id);
    if (error) flash(error.message); else refresh();
  }

  return (
    <>
      <p className="text-sm text-slate-500 dark:text-slate-400">
        Un grupo de extras agrupa opciones que el cliente elige al pedir un plato («Punto de la carne», «Añade extras»…).
        Se crea una vez y se asigna a todos los platos que lo necesiten, desde la ficha de cada plato.
      </p>

      {groups.length === 0 && <div className="card p-6 text-center text-sm text-slate-500 dark:text-slate-400">Aún no hay grupos de extras.</div>}

      {groups.map((g) => {
        const gm = mods.filter((m) => m.group_id === g.id);
        const used = links.filter((l) => l.group_id === g.id).length;
        return (
          <section key={g.id} className="card p-5 space-y-3">
            <div className="flex items-center gap-2">
              <input
                className="flex-1 min-w-0 font-semibold bg-transparent border-0 border-b border-transparent hover:border-slate-200 dark:hover:border-slate-700 focus:border-brand-500 focus:outline-none"
                defaultValue={g.name}
                maxLength={80}
                onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== g.name) updateGroup(g, { name: v }); else e.target.value = g.name; }}
                onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
                aria-label="Nombre del grupo"
              />
              <span className="text-xs text-slate-400">en {used} plato{used === 1 ? "" : "s"}</span>
              <button className="text-slate-400 hover:text-red-600" onClick={() => setDeleting(g)} title="Eliminar grupo">✕</button>
            </div>
            <div className="flex flex-wrap items-center gap-4 text-sm">
              <label className="flex items-center gap-2">
                Obligatorio
                <input type="checkbox" checked={g.min_choices >= 1} onChange={(e) => updateGroup(g, { min_choices: e.target.checked ? 1 : 0, max_choices: Math.max(g.max_choices, e.target.checked ? 1 : g.max_choices) })} />
              </label>
              <label className="flex items-center gap-2">
                Máximo a elegir
                <input
                  className="input w-16 py-1" type="number" min={1} max={20} defaultValue={g.max_choices}
                  onBlur={(e) => updateGroup(g, { max_choices: Math.max(1, Math.min(20, Math.round(Number(e.target.value) || 1))) })}
                />
              </label>
              {g.min_choices >= 1 && (
                <label className="flex items-center gap-2">
                  Mínimo
                  <input
                    className="input w-16 py-1" type="number" min={1} max={20} defaultValue={g.min_choices}
                    onBlur={(e) => updateGroup(g, { min_choices: Math.max(1, Math.min(20, Math.round(Number(e.target.value) || 1))) })}
                  />
                </label>
              )}
            </div>
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {gm.map((m) => (
                <li key={m.id} className="flex items-center gap-3 py-1.5">
                  <Toggle checked={m.is_available} onChange={(v) => updateModifier(m, { is_available: v })} title={m.is_available ? "Disponible" : "No disponible"} />
                  <input
                    className={`flex-1 min-w-0 bg-transparent border-0 border-b border-transparent hover:border-slate-200 dark:hover:border-slate-700 focus:border-brand-500 focus:outline-none py-0.5 ${m.is_available ? "" : "text-slate-400 line-through"}`}
                    defaultValue={m.name}
                    maxLength={80}
                    onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== m.name) updateModifier(m, { name: v }); else e.target.value = m.name; }}
                    onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
                    aria-label="Nombre de la opción"
                  />
                  <span className="text-sm text-slate-400">+</span>
                  <input
                    className="input w-20 py-1" inputMode="decimal" defaultValue={m.price_delta ? String(m.price_delta) : ""} placeholder="0"
                    onBlur={(e) => {
                      const p = e.target.value.trim() === "" ? 0 : parsePrice(e.target.value);
                      if (p === null) { flash("Precio no válido."); e.target.value = m.price_delta ? String(m.price_delta) : ""; }
                      else if (p !== m.price_delta) updateModifier(m, { price_delta: p });
                    }}
                    aria-label="Suplemento en euros"
                  />
                  <span className="text-sm text-slate-400">€</span>
                  <button className="text-slate-400 hover:text-red-600" onClick={() => removeModifier(m)} title="Eliminar opción">✕</button>
                </li>
              ))}
            </ul>
            <AddModifier onAdd={(n, p) => addModifier(g, n, p)} />
          </section>
        );
      })}

      <section className="card p-5">
        <h2 className="font-semibold mb-2">Nuevo grupo de extras</h2>
        <div className="flex gap-2">
          <input className="input" placeholder="Ej.: Punto de la carne, Añade extras…" maxLength={80} value={newGroup} onChange={(e) => setNewGroup(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addGroup()} />
          <button className="btn-primary shrink-0" onClick={addGroup}>Crear</button>
        </div>
      </section>

      <ConfirmDialog
        open={!!deleting}
        title="Eliminar grupo de extras"
        message={`¿Eliminar «${deleting?.name ?? ""}» y todas sus opciones? Dejará de ofrecerse en los platos que lo usan.`}
        onConfirm={removeGroup}
        onCancel={() => setDeleting(null)}
      />
    </>
  );
}

function AddModifier({ onAdd }: { onAdd: (name: string, price: string) => Promise<boolean> }) {
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  async function go() { if (await onAdd(name, price)) { setName(""); setPrice(""); } }
  return (
    <div className="flex gap-2">
      <input className="input" placeholder="Añadir opción…" maxLength={80} value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && go()} />
      <input className="input w-24" inputMode="decimal" placeholder="+ €" value={price} onChange={(e) => setPrice(e.target.value)} onKeyDown={(e) => e.key === "Enter" && go()} />
      <button className="btn-ghost shrink-0" onClick={go}>Añadir</button>
    </div>
  );
}

/* ----------------------------------- Ajustes ----------------------------------- */

function AjustesTab({ bid, flash }: { bid: string; flash: (m: string) => void }) {
  const qc = useQueryClient();
  const { data: settings, isLoading: l1 } = useTakeawaySettings();
  const { data: hoursRows, isLoading: l2 } = useTakeawayHours();

  const [accepting, setAccepting] = useState(true);
  const [prep, setPrep] = useState("20");
  const [interval, setIntervalMin] = useState("15");
  const [maxPerSlot, setMaxPerSlot] = useState("");
  const [advance, setAdvance] = useState("7");
  const [minAmount, setMinAmount] = useState("0");
  const [wins, setWins] = useState<Win[] | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (l1 || l2) return;
    if (settings) {
      setAccepting(settings.accepting);
      setPrep(String(settings.prep_minutes));
      setIntervalMin(String(settings.slot_interval_min));
      setMaxPerSlot(settings.max_orders_per_slot?.toString() ?? "");
      setAdvance(String(settings.max_advance_days));
      setMinAmount(String(settings.min_order_amount));
    }
    setWins((hoursRows ?? []).map((h) => ({ weekday: h.weekday, start_time: shortTime(h.start_time), end_time: shortTime(h.end_time) })));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [l1, l2]);

  const invalid = useMemo(() => (wins ?? []).some((w) => !w.start_time || !w.end_time || w.end_time <= w.start_time), [wins]);

  async function save() {
    const prepN = Math.round(Number(prep));
    const advN = Math.round(Number(advance));
    const maxN = maxPerSlot.trim() === "" ? null : Math.round(Number(maxPerSlot));
    const minA = parsePrice(minAmount || "0");
    if (!Number.isFinite(prepN) || prepN < 0 || prepN > 1440) { flash("Tiempo de preparación no válido."); return; }
    if (!Number.isFinite(advN) || advN < 1 || advN > 60) { flash("La antelación máxima debe estar entre 1 y 60 días."); return; }
    if (maxN !== null && (!Number.isFinite(maxN) || maxN < 1)) { flash("El máximo por franja debe ser al menos 1 (o déjalo vacío)."); return; }
    if (minA === null) { flash("Pedido mínimo no válido."); return; }
    if (invalid) { flash("Revisa el horario: la hora de fin debe ser posterior a la de inicio."); return; }
    setSaving(true);
    try {
      const up = await supabase.from("takeaway_settings").upsert({
        business_id: bid, accepting, prep_minutes: prepN, slot_interval_min: Number(interval),
        max_orders_per_slot: maxN, max_advance_days: advN, min_order_amount: minA,
      });
      if (up.error) throw up.error;
      const del = await supabase.from("takeaway_hours").delete().eq("business_id", bid);
      if (del.error) throw del.error;
      if ((wins ?? []).length) {
        const ins = await supabase.from("takeaway_hours").insert((wins ?? []).map((w) => ({ business_id: bid, weekday: w.weekday, start_time: w.start_time, end_time: w.end_time })));
        if (ins.error) throw ins.error;
      }
      qc.invalidateQueries({ queryKey: ["takeaway_settings", bid] });
      qc.invalidateQueries({ queryKey: ["takeaway_hours", bid] });
      flash("Ajustes guardados");
    } catch (e: any) {
      flash(e.message ?? "No se pudo guardar.");
    } finally {
      setSaving(false);
    }
  }

  if (l1 || l2 || wins === null) return <div className="grid place-items-center py-10"><Spinner /></div>;

  return (
    <>
      {!settings && (
        <div className="card p-4 text-sm bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-900/20 dark:text-amber-200 dark:border-amber-800">
          Los pedidos online <strong>no estarán disponibles</strong> hasta que guardes estos ajustes y añadas al menos una franja de recogida.
        </div>
      )}
      <section className="card p-5 space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="font-semibold">Aceptar pedidos online</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">Apágalo para pausar los pedidos (cocina saturada, cierre inesperado…). La carta sigue visible.</p>
          </div>
          <Toggle checked={accepting} onChange={setAccepting} />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Preparación (min)</label>
            <input className="input" type="number" min={0} value={prep} onChange={(e) => setPrep(e.target.value)} />
            <p className="text-xs text-slate-400 mt-1">Margen mínimo entre el pedido y la recogida.</p>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Hueco de recogida</label>
            <select className="input" value={interval} onChange={(e) => setIntervalMin(e.target.value)}>
              {[5, 10, 15, 20, 30, 60].map((n) => <option key={n} value={n}>cada {n} min</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Pedidos por hueco</label>
            <input className="input" type="number" min={1} placeholder="Sin límite" value={maxPerSlot} onChange={(e) => setMaxPerSlot(e.target.value)} />
            <p className="text-xs text-slate-400 mt-1">Vacío = sin límite.</p>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Antelación máxima (días)</label>
            <input className="input" type="number" min={1} max={60} value={advance} onChange={(e) => setAdvance(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Pedido mínimo (€)</label>
            <input className="input" inputMode="decimal" value={minAmount} onChange={(e) => setMinAmount(e.target.value)} />
          </div>
        </div>
      </section>

      <section className="card p-5">
        <h2 className="font-semibold mb-1">Horario de recogida</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-3">Franjas en las que se pueden recoger pedidos (puedes poner comida y cena por separado). Sin franjas, no hay horas disponibles.</p>
        <WindowsEditor wins={wins} onChange={setWins} />
      </section>

      <div><button className="btn-primary" onClick={save} disabled={saving}>{saving ? "Guardando…" : "Guardar ajustes"}</button></div>
    </>
  );
}
