import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import { ConfirmDialog, Spinner } from "../components/ui";
import { DEFAULT_FOOTNOTE } from "./ficha/ProfessionalInvoicePdf";

const EMPTY = {
  issuer_name: "", issuer_title: "", registration: "", tax_id: "", address: "",
  bank_name: "", account_holder: "", iban: "", due_days: "7", footnote: "", logo_data: "",
};
type Form = typeof EMPTY;

const FIELDS: { key: keyof Form; label: string }[] = [
  { key: "issuer_name", label: "Nombre en la factura *" },
  { key: "issuer_title", label: "Título profesional" },
  { key: "registration", label: "Nº de colegiado" },
  { key: "tax_id", label: "NIF / NIE *" },
  { key: "bank_name", label: "Banco" },
  { key: "account_holder", label: "Titular de la cuenta" },
  { key: "iban", label: "IBAN" },
];

/** Reduce la imagen a 400 px como máximo y la devuelve como PNG en data URL. */
async function toLogo(file: File): Promise<string> {
  const img = await createImageBitmap(file);
  const k = Math.min(1, 400 / Math.max(img.width, img.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(img.width * k);
  canvas.height = Math.round(img.height * k);
  canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/png");
}

/** Datos de factura propios de una profesional (si los tiene, sus pacientes reciben su factura). */
export function InvoiceProfileSection({ businessId, professionalId }: { businessId: string; professionalId: string }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Form>(EMPTY);
  const [exists, setExists] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [confirmingRemove, setConfirmingRemove] = useState(false);

  useEffect(() => {
    let cancelled = false;
    supabase.from("professional_invoice_profiles").select("*").eq("professional_id", professionalId).maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) { setMessage({ ok: false, text: error.message }); return; }
        setExists(!!data);
        if (data) {
          setForm(Object.fromEntries(
            Object.keys(EMPTY).map((k) => [k, String((data as Record<string, unknown>)[k] ?? "")]),
          ) as Form);
        }
      });
    return () => { cancelled = true; };
  }, [professionalId]);

  const set = (key: keyof Form, value: string) => { setForm((f) => ({ ...f, [key]: value })); setMessage(null); };

  async function save() {
    if (!form.issuer_name.trim() || !form.tax_id.trim()) { setMessage({ ok: false, text: "El nombre y el NIF son obligatorios." }); return; }
    setBusy(true); setMessage(null);
    const clean = (v: string) => v.trim() || null;
    const { error } = await supabase.from("professional_invoice_profiles").upsert({
      professional_id: professionalId, business_id: businessId,
      issuer_name: form.issuer_name.trim(), issuer_title: clean(form.issuer_title), registration: clean(form.registration),
      tax_id: form.tax_id.trim(), address: clean(form.address), bank_name: clean(form.bank_name),
      account_holder: clean(form.account_holder), iban: clean(form.iban),
      due_days: form.due_days.trim() === "" ? null : Number(form.due_days),
      footnote: clean(form.footnote), logo_data: form.logo_data || null, updated_at: new Date().toISOString(),
    });
    setBusy(false);
    if (error) { setMessage({ ok: false, text: error.message }); return; }
    setExists(true);
    setMessage({ ok: true, text: "Datos de factura guardados." });
    qc.invalidateQueries({ queryKey: ["invoice-profile", professionalId] });
  }

  async function remove() {
    setConfirmingRemove(false); setBusy(true);
    const { error } = await supabase.from("professional_invoice_profiles").delete().eq("professional_id", professionalId);
    setBusy(false);
    if (error) { setMessage({ ok: false, text: error.message }); return; }
    setExists(false); setForm(EMPTY);
    setMessage({ ok: true, text: "Sus pacientes vuelven a recibir la factura del centro." });
    qc.invalidateQueries({ queryKey: ["invoice-profile", professionalId] });
  }

  return (
    <div>
      <label className="label">Factura propia</label>
      <div className="border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2">
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm text-slate-500 dark:text-slate-400">
            {exists === null ? "Cargando…" : exists ? "Sus pacientes reciben su propia factura." : "Sus pacientes reciben la factura del centro."}
          </span>
          <button type="button" className="btn-ghost text-xs shrink-0" onClick={() => setOpen((o) => !o)}>
            {open ? "Ocultar" : exists ? "Editar datos" : "Configurar"}
          </button>
        </div>
        {open && (exists === null ? <Spinner /> : (
          <div className="space-y-3 mt-3">
            <div className="grid sm:grid-cols-2 gap-3">
              {FIELDS.map((f) => (
                <label key={f.key} className="block"><span className="label">{f.label}</span>
                  <input className="input" value={form[f.key]} onChange={(e) => set(f.key, e.target.value)} />
                </label>
              ))}
              <label className="block"><span className="label">Vencimiento (días)</span>
                <input type="number" min={0} max={365} className="input" value={form.due_days} onChange={(e) => set("due_days", e.target.value)} />
              </label>
            </div>
            <label className="block"><span className="label">Dirección (una línea por renglón)</span>
              <textarea className="input" rows={2} value={form.address} onChange={(e) => set("address", e.target.value)} />
            </label>
            <label className="block"><span className="label">Nota de exención de IVA</span>
              <textarea className="input" rows={2} placeholder={DEFAULT_FOOTNOTE} value={form.footnote} onChange={(e) => set("footnote", e.target.value)} />
            </label>
            <div>
              <span className="label">Logo (opcional)</span>
              <div className="flex items-center gap-3">
                {form.logo_data && <img src={form.logo_data} alt="Logo de la factura" className="h-14 w-14 object-contain rounded bg-white" />}
                <input type="file" accept="image/png,image/jpeg" className="text-xs" onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  try { set("logo_data", await toLogo(file)); }
                  catch { setMessage({ ok: false, text: "No se ha podido leer la imagen." }); }
                }} />
                {form.logo_data && <button type="button" className="btn-ghost text-xs" onClick={() => set("logo_data", "")}>Quitar</button>}
              </div>
            </div>
            <div className="flex gap-2">
              <button type="button" className="btn-primary text-xs" disabled={busy} onClick={save}>Guardar datos de factura</button>
              {exists && <button type="button" className="btn-ghost text-xs" disabled={busy} onClick={() => setConfirmingRemove(true)}>Usar la del centro</button>}
            </div>
          </div>
        ))}
        {message && <p className={`text-xs mt-2 ${message.ok ? "text-green-700" : "text-red-600"}`}>{message.text}</p>}
      </div>
      <ConfirmDialog
        open={confirmingRemove}
        title="Usar la factura del centro"
        message="Se borrarán estos datos de factura. Los pacientes de esta profesional recibirán la factura del centro."
        confirmLabel="Borrar datos"
        onConfirm={remove}
        onCancel={() => setConfirmingRemove(false)}
      />
    </div>
  );
}
