import { useState } from "react";
import { supabase } from "../../lib/supabase";
import type { Customer } from "../hooks";

export function EditarTab({ customer, onSaved }: { customer: Customer; onSaved: () => void }) {
  const [form, setForm] = useState({
    full_name: customer.full_name,
    last_name: customer.last_name ?? "",
    phone: customer.phone ?? "",
    email: customer.email ?? "",
    nif: customer.nif ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true); setError(null);
    const { error } = await supabase.from("customers").update({
      full_name: form.full_name.trim(),
      last_name: form.last_name.trim() || null,
      phone: form.phone.trim() || null,
      email: form.email.trim() || null,
      nif: form.nif.trim() || null,
    }).eq("id", customer.id);
    setSaving(false);
    if (error) { setError(error.message); return; }
    onSaved();
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div><label className="label">Nombre *</label><input className="input" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></div>
        <div><label className="label">Apellidos</label><input className="input" value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} /></div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><label className="label">Teléfono</label><input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
        <div><label className="label">Email</label><input type="email" className="input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
      </div>
      <div><label className="label">NIF/NIE</label><input className="input max-w-xs" value={form.nif} onChange={(e) => setForm({ ...form, nif: e.target.value })} /></div>
      {error && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>}
      <button className="btn-primary" disabled={!form.full_name.trim() || saving} onClick={save}>{saving ? "Guardando…" : "Guardar cambios"}</button>
    </div>
  );
}
