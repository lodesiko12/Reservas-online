import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import { useBusinessId } from "./hooks";
import { WEEKDAYS_ES, shortTime } from "@reservas/shared";
import { PageHeader, Spinner } from "../components/ui";
import { IntegrationsForm } from "../components/IntegrationsForm";

const WIDGET_URL = ((import.meta.env.VITE_WIDGET_URL as string) || "").replace(/\/+$/, "");
type Hour = { weekday: number; open_time: string; close_time: string };

export function Configuracion() {
  const bid = useBusinessId();
  const { business, refresh } = useAuth();
  const qc = useQueryClient();
  const isRestaurant = business?.type === "restaurante";

  const [name, setName] = useState(business?.name ?? "");
  const [color, setColor] = useState(business?.primary_color ?? "#4f46e5");
  const [logoUrl, setLogoUrl] = useState(business?.logo_url ?? "");
  const [capacity, setCapacity] = useState(business?.default_capacity ?? 1);
  const [slotInterval, setSlotInterval] = useState(business?.slot_interval_min ?? 15);

  const [hours, setHours] = useState<Hour[] | null>(null);
  const [savingBranding, setSavingBranding] = useState(false);
  const [savingHours, setSavingHours] = useState(false);
  const [savingRes, setSavingRes] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    supabase.from("business_hours").select("weekday, open_time, close_time").eq("business_id", bid).order("weekday")
      .then(({ data }) => setHours((data ?? []).map((h) => ({ weekday: h.weekday, open_time: shortTime(h.open_time), close_time: shortTime(h.close_time) }))));
  }, [bid]);

  function flash(m: string) { setToast(m); setTimeout(() => setToast(null), 2500); }

  async function saveBranding() {
    setSavingBranding(true);
    await supabase.from("businesses").update({ name: name.trim(), primary_color: color, logo_url: logoUrl || null }).eq("id", bid);
    await refresh(); qc.invalidateQueries();
    setSavingBranding(false); flash("Branding guardado");
  }

  async function saveReservas() {
    setSavingRes(true);
    await supabase.from("businesses").update({ default_capacity: Number(capacity), slot_interval_min: Number(slotInterval) }).eq("id", bid);
    await refresh();
    setSavingRes(false); flash("Ajustes de reservas guardados");
  }

  async function saveHours() {
    if (!hours) return;
    setSavingHours(true);
    await supabase.from("business_hours").delete().eq("business_id", bid);
    if (hours.length) await supabase.from("business_hours").insert(hours.map((h) => ({ business_id: bid, ...h })));
    setSavingHours(false); flash("Horario guardado");
  }

  async function uploadLogo(file: File) {
    setUploading(true);
    const ext = file.name.split(".").pop() ?? "png";
    const path = `${bid}/logo-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("logos").upload(path, file, { upsert: true });
    if (!error) {
      const { data } = supabase.storage.from("logos").getPublicUrl(path);
      setLogoUrl(data.publicUrl);
      await supabase.from("businesses").update({ logo_url: data.publicUrl }).eq("id", bid);
      await refresh(); flash("Logo subido");
    } else flash("Error al subir el logo");
    setUploading(false);
  }

  const embedSnippet =
`<div id="reservas-widget" data-slug="${business?.slug ?? ""}"></div>
<script src="${WIDGET_URL}/embed.js" async></script>`;

  return (
    <div className="max-w-3xl space-y-8">
      <PageHeader title="Configuración" />
      {toast && <div className="fixed top-4 right-4 bg-slate-900 text-white text-sm px-4 py-2 rounded-lg shadow-lg z-50">{toast}</div>}

      {/* Branding */}
      <section className="card p-6">
        <h2 className="font-semibold mb-4">Marca</h2>
        <div className="grid sm:grid-cols-2 gap-4">
          <div><label className="label">Nombre del negocio</label><input className="input" value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div><label className="label">Color primario</label><input type="color" className="input h-[42px] p-1" value={color} onChange={(e) => setColor(e.target.value)} /></div>
        </div>
        <div className="mt-4">
          <label className="label">Logo</label>
          <div className="flex items-center gap-4">
            {logoUrl && <img src={logoUrl} alt="logo" className="h-12 w-12 rounded-lg object-cover border" />}
            <input type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && uploadLogo(e.target.files[0])} />
            {uploading && <Spinner className="h-4 w-4" />}
          </div>
          <input className="input mt-2" placeholder="…o pega una URL de imagen" value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} />
        </div>
        <button className="btn-primary mt-4" onClick={saveBranding} disabled={savingBranding}>{savingBranding ? "Guardando…" : "Guardar marca"}</button>
      </section>

      {/* Horario */}
      <section className="card p-6">
        <h2 className="font-semibold mb-4">Horario de apertura</h2>
        {hours === null ? <Spinner /> : (
          <>
            <div className="space-y-2">
              {hours.map((h, i) => (
                <div key={i} className="flex items-center gap-2">
                  <select className="input py-1.5" value={h.weekday} onChange={(e) => setHours(hours.map((x, j) => j === i ? { ...x, weekday: +e.target.value } : x))}>
                    {WEEKDAYS_ES.map((d, idx) => <option key={idx} value={idx}>{d}</option>)}
                  </select>
                  <input type="time" className="input py-1.5 w-28" value={h.open_time} onChange={(e) => setHours(hours.map((x, j) => j === i ? { ...x, open_time: e.target.value } : x))} />
                  <span className="text-slate-400">–</span>
                  <input type="time" className="input py-1.5 w-28" value={h.close_time} onChange={(e) => setHours(hours.map((x, j) => j === i ? { ...x, close_time: e.target.value } : x))} />
                  <button className="text-slate-400 hover:text-red-600" onClick={() => setHours(hours.filter((_, j) => j !== i))}>✕</button>
                </div>
              ))}
            </div>
            <button type="button" className="btn-ghost text-xs mt-2" onClick={() => setHours([...hours, { weekday: 1, open_time: "09:00", close_time: "18:00" }])}>+ Añadir franja</button>
            {isRestaurant && <p className="text-xs text-slate-400 mt-2">El aforo por franja se gestiona en “Franjas y aforo”.</p>}
            <div><button className="btn-primary mt-4" onClick={saveHours} disabled={savingHours}>{savingHours ? "Guardando…" : "Guardar horario"}</button></div>
          </>
        )}
      </section>

      {/* Reservas */}
      {!isRestaurant && (
        <section className="card p-6">
          <h2 className="font-semibold mb-4">Reservas</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <div><label className="label">Aforo por defecto (servicios sin profesional)</label><input type="number" min={1} className="input" value={capacity} onChange={(e) => setCapacity(+e.target.value)} /></div>
            <div><label className="label">Granularidad de huecos (min)</label><input type="number" min={5} step={5} className="input" value={slotInterval} onChange={(e) => setSlotInterval(+e.target.value)} /></div>
          </div>
          <button className="btn-primary mt-4" onClick={saveReservas} disabled={savingRes}>{savingRes ? "Guardando…" : "Guardar"}</button>
        </section>
      )}

      {/* Integraciones: email y WhatsApp por negocio */}
      <section className="card p-6">
        <h2 className="font-semibold mb-1">Integraciones (email y WhatsApp)</h2>
        <p className="text-sm text-slate-500 mb-4">Envía desde tu propio remitente y número. Tus claves se guardan del lado del servidor y no se muestran aquí.</p>
        <IntegrationsForm businessId={bid} onToast={flash} />
      </section>

      {/* Embed */}
      <section className="card p-6">
        <h2 className="font-semibold mb-1">Insertar el widget en tu web</h2>
        <p className="text-sm text-slate-500 mb-3">Pega este código donde quieras que aparezca el formulario de reservas.</p>
        <pre className="bg-slate-900 text-slate-100 text-xs rounded-lg p-4 overflow-x-auto">{embedSnippet}</pre>
        <button className="btn-ghost mt-3" onClick={() => { navigator.clipboard.writeText(embedSnippet); flash("Snippet copiado"); }}>📋 Copiar snippet</button>
        <a className="btn-ghost mt-3 ml-2" href={`${WIDGET_URL}/?slug=${business?.slug}`} target="_blank" rel="noreferrer">Previsualizar widget ↗</a>
      </section>
    </div>
  );
}
