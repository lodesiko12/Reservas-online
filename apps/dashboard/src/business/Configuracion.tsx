import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import { useBusinessId, useDiningSettings } from "./hooks";
import { shortTime } from "@reservas/shared";
import { PageHeader, Spinner } from "../components/ui";
import { IntegrationsForm } from "../components/IntegrationsForm";
import { WindowsEditor, type Win } from "../components/WindowsEditor";

const WIDGET_URL = ((import.meta.env.VITE_WIDGET_URL as string) || "").replace(/\/+$/, "");

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
  const [maxAdvanceDays, setMaxAdvanceDays] = useState<string>(business?.max_advance_days?.toString() ?? "");
  const [reviewUrl, setReviewUrl] = useState(business?.google_review_url ?? "");
  const [reviewMessage, setReviewMessage] = useState(business?.review_email_message ?? "");
  const [savingReview, setSavingReview] = useState(false);
  const [confirmationMessage, setConfirmationMessage] = useState(business?.confirmation_email_message ?? "");
  const [savingConfirmation, setSavingConfirmation] = useState(false);

  const [hours, setHours] = useState<Win[] | null>(null);
  const [savingBranding, setSavingBranding] = useState(false);
  const [savingHours, setSavingHours] = useState(false);
  const [savingRes, setSavingRes] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    supabase.from("business_hours").select("weekday, open_time, close_time").eq("business_id", bid).order("weekday")
      .then(({ data }) => setHours((data ?? []).map((h) => ({ weekday: h.weekday, start_time: shortTime(h.open_time), end_time: shortTime(h.close_time) }))));
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
    await supabase.from("businesses").update({
      default_capacity: Number(capacity), slot_interval_min: Number(slotInterval),
      max_advance_days: maxAdvanceDays.trim() ? Number(maxAdvanceDays) : null,
    }).eq("id", bid);
    await refresh();
    setSavingRes(false); flash("Ajustes de reservas guardados");
  }

  async function saveReview() {
    setSavingReview(true);
    await supabase.from("businesses").update({
      google_review_url: reviewUrl.trim() || null,
      review_email_message: reviewMessage.trim() || null,
    }).eq("id", bid);
    await refresh();
    setSavingReview(false); flash("Enlace de reseña guardado");
  }

  async function saveConfirmationMessage() {
    setSavingConfirmation(true);
    await supabase.from("businesses").update({ confirmation_email_message: confirmationMessage.trim() || null }).eq("id", bid);
    await refresh();
    setSavingConfirmation(false); flash("Mensaje de confirmación guardado");
  }

  async function saveHours() {
    if (!hours) return;
    setSavingHours(true);
    await supabase.from("business_hours").delete().eq("business_id", bid);
    if (hours.length) {
      await supabase.from("business_hours").insert(
        hours.map((h) => ({ business_id: bid, weekday: h.weekday, open_time: h.start_time, close_time: h.end_time }))
      );
    }
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

      {/* Email de confirmación */}
      <section className="card p-6">
        <h2 className="font-semibold mb-1">Email de confirmación</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
          Personaliza el párrafo principal del email que recibe el cliente al reservar. Déjalo vacío para usar el
          mensaje por defecto. Placeholders disponibles: <code className="bg-slate-100 dark:bg-slate-800 px-1 rounded">{"{cliente}"}</code>{" "}
          <code className="bg-slate-100 dark:bg-slate-800 px-1 rounded">{"{negocio}"}</code>{" "}
          <code className="bg-slate-100 dark:bg-slate-800 px-1 rounded">{"{servicio}"}</code>{" "}
          <code className="bg-slate-100 dark:bg-slate-800 px-1 rounded">{"{fecha}"}</code>{" "}
          <code className="bg-slate-100 dark:bg-slate-800 px-1 rounded">{"{hora}"}</code>.
        </p>
        <textarea
          className="input min-h-[100px]"
          value={confirmationMessage}
          onChange={(e) => setConfirmationMessage(e.target.value)}
          placeholder={`Hola {cliente}, tu reserva en {negocio} está confirmada para el {fecha} a las {hora}. ¡Te esperamos!`}
        />
        <button className="btn-primary mt-4" onClick={saveConfirmationMessage} disabled={savingConfirmation}>{savingConfirmation ? "Guardando…" : "Guardar mensaje"}</button>
      </section>

      {/* Horario */}
      <section className="card p-6">
        <h2 className="font-semibold mb-4">Horario de apertura</h2>
        {hours === null ? <Spinner /> : (
          <>
            <WindowsEditor wins={hours} onChange={setHours} />
            {isRestaurant && <p className="text-xs text-slate-400 dark:text-slate-500 mt-2">El aforo por franja se gestiona en “Franjas y aforo”.</p>}
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
            <div>
              <label className="label">Antelación máxima de reserva (días)</label>
              <input type="number" min={1} className="input" value={maxAdvanceDays} onChange={(e) => setMaxAdvanceDays(e.target.value)} placeholder="Sin límite" />
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Vacío = sin límite. Ej. 90 = no se puede reservar con más de 3 meses de antelación. Solo afecta a las reservas web, no a las que crea el staff manualmente.</p>
            </div>
          </div>
          <button className="btn-primary mt-4" onClick={saveReservas} disabled={savingRes}>{savingRes ? "Guardando…" : "Guardar"}</button>
        </section>
      )}

      {/* Reglas generales de reserva (restaurante) */}
      {isRestaurant && <DiningSettingsSection bid={bid} flash={flash} />}

      {/* Petición de reseña post-visita */}
      <section className="card p-6">
        <h2 className="font-semibold mb-1">Reseñas</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
          Si configuras un enlace, 1–3h después de que termine una reserva (y no haya sido cancelada/no-show) se envía
          automáticamente un email pidiendo una reseña. Déjalo vacío para no enviar nada.
        </p>
        <label className="label">Enlace de reseña (Google, TripAdvisor…)</label>
        <input className="input" value={reviewUrl} onChange={(e) => setReviewUrl(e.target.value)} placeholder="https://g.page/r/…/review" />
        <label className="label mt-4">Mensaje personalizado del email</label>
        <textarea
          className="input min-h-[80px]"
          value={reviewMessage}
          onChange={(e) => setReviewMessage(e.target.value)}
          placeholder={`Hola {cliente}, gracias por confiar en {negocio}. ¿Nos dejas tu opinión?`}
        />
        <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Vacío = mensaje por defecto. Placeholders: {"{cliente}"} {"{negocio}"}.</p>
        <button className="btn-primary mt-4" onClick={saveReview} disabled={savingReview}>{savingReview ? "Guardando…" : "Guardar"}</button>
      </section>

      {/* Integraciones: email y WhatsApp por negocio */}
      <section className="card p-6">
        <h2 className="font-semibold mb-1">Integraciones (email y WhatsApp)</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">Envía desde tu propio remitente y número. Tus claves se guardan del lado del servidor y no se muestran aquí.</p>
        <IntegrationsForm businessId={bid} onToast={flash} />
      </section>

      {/* Embed */}
      <section className="card p-6">
        <h2 className="font-semibold mb-1">Insertar el widget en tu web</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-3">Pega este código donde quieras que aparezca el formulario de reservas.</p>
        <pre className="bg-slate-900 text-slate-100 text-xs rounded-lg p-4 overflow-x-auto">{embedSnippet}</pre>
        <button className="btn-ghost mt-3" onClick={() => { navigator.clipboard.writeText(embedSnippet); flash("Snippet copiado"); }}>📋 Copiar snippet</button>
        <a className="btn-ghost mt-3 ml-2" href={`${WIDGET_URL}/?slug=${business?.slug}`} target="_blank" rel="noreferrer">Previsualizar widget ↗</a>
      </section>
    </div>
  );
}

function DiningSettingsSection({ bid, flash }: { bid: string; flash: (m: string) => void }) {
  const qc = useQueryClient();
  const { business, refresh } = useAuth();
  const { data: settings, isLoading } = useDiningSettings();
  const [form, setForm] = useState({
    min_lead_minutes: 30, max_advance_days: 60, min_party_online: 1, max_party_online: 12,
    require_manual_confirmation: false,
  });
  const [busy, setBusy] = useState(false);
  const [waitlistTemplate, setWaitlistTemplate] = useState(business?.waitlist_template_name ?? "");
  const [savingTemplate, setSavingTemplate] = useState(false);

  async function saveWaitlistTemplate() {
    setSavingTemplate(true);
    await supabase.from("businesses").update({ waitlist_template_name: waitlistTemplate.trim() || null }).eq("id", bid);
    await refresh();
    setSavingTemplate(false); flash("Plantilla guardada");
  }

  useEffect(() => {
    if (!settings) return;
    setForm({
      min_lead_minutes: settings.min_lead_minutes, max_advance_days: settings.max_advance_days,
      min_party_online: settings.min_party_online, max_party_online: settings.max_party_online,
      require_manual_confirmation: settings.require_manual_confirmation,
    });
  }, [settings]);

  async function save() {
    setBusy(true);
    await supabase.from("dining_settings").upsert({ business_id: bid, ...form });
    qc.invalidateQueries({ queryKey: ["dining_settings", bid] });
    setBusy(false); flash("Ajustes de reserva guardados");
  }

  return (
    <section className="card p-6">
      <h2 className="font-semibold mb-1">Reglas de reserva</h2>
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">Antelación, tamaño de grupo permitido online y confirmación de las reservas.</p>
      {isLoading ? <Spinner /> : (
        <>
          <div className="grid sm:grid-cols-2 gap-4">
            <div><label className="label">Antelación mínima (min)</label><input type="number" min={0} step={5} className="input" value={form.min_lead_minutes} onChange={(e) => setForm({ ...form, min_lead_minutes: +e.target.value })} /></div>
            <div><label className="label">Antelación máxima (días)</label><input type="number" min={1} className="input" value={form.max_advance_days} onChange={(e) => setForm({ ...form, max_advance_days: +e.target.value })} /></div>
            <div><label className="label">Mín. comensales online</label><input type="number" min={1} className="input" value={form.min_party_online} onChange={(e) => setForm({ ...form, min_party_online: +e.target.value })} /></div>
            <div><label className="label">Máx. comensales online</label><input type="number" min={1} className="input" value={form.max_party_online} onChange={(e) => setForm({ ...form, max_party_online: +e.target.value })} /></div>
          </div>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-2">Grupos fuera de este rango solo se pueden dar de alta manualmente desde el panel (teléfono/contacto directo). La antelación y estos límites no aplican a las reservas manuales del staff.</p>
          <label className="flex items-center gap-2 text-sm mt-4">
            <input type="checkbox" checked={form.require_manual_confirmation} onChange={(e) => setForm({ ...form, require_manual_confirmation: e.target.checked })} />
            Requerir confirmación manual de las reservas web (si no, se confirman al instante)
          </label>
          <button className="btn-primary mt-4" onClick={save} disabled={busy}>{busy ? "Guardando…" : "Guardar"}</button>

          <div className="border-t mt-6 pt-4">
            <label className="label">Plantilla de WhatsApp para "mesa lista" (lista de espera)</label>
            <input className="input" value={waitlistTemplate} onChange={(e) => setWaitlistTemplate(e.target.value)} placeholder="lista_espera_mesa" />
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Nombre de la plantilla aprobada en Meta con 2 variables: nombre del cliente y nombre del negocio.</p>
            <button className="btn-ghost mt-2 text-xs" onClick={saveWaitlistTemplate} disabled={savingTemplate}>{savingTemplate ? "Guardando…" : "Guardar plantilla"}</button>
          </div>
        </>
      )}
    </section>
  );
}
