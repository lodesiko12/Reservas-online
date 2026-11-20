import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../../lib/supabase";
import { Modal, ConfirmDialog } from "../../components/ui";
import { clientSessionSchema } from "@reservas/shared";

export type SessionFields = { objetivo: string; notas: string; seguimiento: string; tareas_pautas: string };
export const EMPTY_SESSION: SessionFields = { objetivo: "", notas: "", seguimiento: "", tareas_pautas: "" };

/** Valida y devuelve los valores listos para insertar/actualizar (null si vacío), o un error. */
export type SessionValues = { [K in keyof SessionFields]: string | null };
export function parseSession(form: SessionFields): { error: string } | { values: SessionValues } {
  const result = clientSessionSchema.safeParse(form);
  if (!result.success) return { error: result.error.issues[0]?.message ?? "Revisa los datos." };
  const v = result.data;
  return { values: { objetivo: v.objetivo ?? null, notas: v.notas ?? null, seguimiento: v.seguimiento ?? null, tareas_pautas: v.tareas_pautas ?? null } };
}

/* ---------- Borrador (localStorage al instante + servidor con debounce) ---------- */

type Stored = { form: SessionFields; updatedAt: number };
const localKey = (bookingId: string) => `turnigo:session-draft:${bookingId}`;

export function readLocalDraft(bookingId: string): Stored | null {
  try {
    const raw = localStorage.getItem(localKey(bookingId));
    return raw ? (JSON.parse(raw) as Stored) : null;
  } catch { return null; }
}

// La tabla es nueva y aún no está en los tipos generados.
const drafts = () => (supabase as any).from("client_session_drafts");

export type DraftTarget = { bookingId: string; businessId: string };

function useSessionDraft(target: DraftTarget | undefined, form: SessionFields, setForm: (f: SessionFields) => void) {
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef(form);
  const dirty = useRef(false);
  const cleared = useRef(false);
  latest.current = form;

  const flush = useCallback(async () => {
    if (!target || !dirty.current || cleared.current) return;
    dirty.current = false;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await drafts().upsert({
      booking_id: target.bookingId, business_id: target.businessId, author_user_id: user.id,
      ...latest.current, updated_at: new Date().toISOString(),
    });
    if (!error) setSavedAt(new Date());
  }, [target?.bookingId, target?.businessId]);

  // Al abrir: recupera el borrador del servidor si es más reciente que el local.
  useEffect(() => {
    if (!target) return;
    let cancelled = false;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await drafts().select("objetivo,notas,seguimiento,tareas_pautas,updated_at")
        .eq("booking_id", target.bookingId).eq("author_user_id", user.id).maybeSingle();
      if (cancelled || !data) return;
      const local = readLocalDraft(target.bookingId);
      if (!local || new Date(data.updated_at).getTime() > local.updatedAt) {
        setForm({ objetivo: data.objetivo ?? "", notas: data.notas ?? "", seguimiento: data.seguimiento ?? "", tareas_pautas: data.tareas_pautas ?? "" });
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target?.bookingId]);

  // En cada cambio: local al instante, servidor con debounce.
  const onChange = useCallback((next: SessionFields) => {
    setForm(next);
    if (!target) return;
    try { localStorage.setItem(localKey(target.bookingId), JSON.stringify({ form: next, updatedAt: Date.now() } satisfies Stored)); } catch { /* sin localStorage */ }
    dirty.current = true;
    cleared.current = false;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => { void flush(); }, 3000);
  }, [target?.bookingId, flush, setForm]);

  // Pantalla apagada / otra pestaña / cierre: se envía ya, sin esperar al debounce.
  useEffect(() => {
    if (!target) return;
    const onHide = () => { if (document.visibilityState === "hidden") void flush(); };
    const onPageHide = () => { void flush(); };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", onPageHide);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", onPageHide);
      if (timer.current) clearTimeout(timer.current);
      void flush(); // al desmontar (cerrar el modal o cambiar de ruta)
    };
  }, [target?.bookingId, flush]);

  const clear = useCallback(async () => {
    if (!target) return;
    cleared.current = true;
    dirty.current = false;
    if (timer.current) clearTimeout(timer.current);
    try { localStorage.removeItem(localKey(target.bookingId)); } catch { /* */ }
    await drafts().delete().eq("booking_id", target.bookingId);
  }, [target?.bookingId]);

  return { onChange, clear, savedAt };
}

/* ---------- Modal común: nueva sesión, sesión de hoy y edición ---------- */

export function SessionFormModal({ title, width, initial, submitLabel = "Guardar sesión", draft, onSubmit, onClose, compact }: {
  title: string;
  width?: string;
  initial?: SessionFields;
  submitLabel?: string;
  /** Si se indica, las notas se guardan como borrador continuo asociado a la cita. */
  draft?: DraftTarget;
  /** Devuelve un mensaje de error, o null si fue bien (el llamador cierra el modal). */
  onSubmit: (values: SessionValues) => Promise<string | null>;
  onClose: () => void;
  compact?: boolean;
}) {
  const [form, setForm] = useState<SessionFields>(() => (draft ? readLocalDraft(draft.bookingId)?.form : undefined) ?? initial ?? EMPTY_SESSION);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [discarding, setDiscarding] = useState(false);
  const { onChange, clear, savedAt } = useSessionDraft(draft, form, setForm);

  const hasContent = Object.values(form).some((v) => v.trim());
  const rows = compact ? 2 : 3;
  const set = (k: keyof SessionFields) => (e: React.ChangeEvent<HTMLTextAreaElement>) => onChange({ ...form, [k]: e.target.value });

  async function save() {
    setError(null);
    const parsed = parseSession(form);
    if ("error" in parsed) { setError(parsed.error); return; }
    setSaving(true);
    const err = await onSubmit(parsed.values);
    setSaving(false);
    if (err) { setError(err); return; }
    await clear();
    onClose();
  }

  return (
    <Modal open onClose={onClose} title={title} width={width}>
      <div className="space-y-3">
        <div><label className="label">Objetivo</label><textarea className="input" rows={2} placeholder="Objetivo de la sesión…" value={form.objetivo} onChange={set("objetivo")} autoFocus /></div>
        <div><label className="label">Notas de sesión</label><textarea className="input" rows={rows} placeholder="Notas sobre la cita…" value={form.notas} onChange={set("notas")} /></div>
        <div><label className="label">Seguimiento (qué revisar en próximas sesiones)</label><textarea className="input" rows={2} value={form.seguimiento} onChange={set("seguimiento")} /></div>
        <div><label className="label">Tareas/Pautas (ejercicios para el cliente)</label><textarea className="input" rows={2} value={form.tareas_pautas} onChange={set("tareas_pautas")} /></div>
      </div>
      {error && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mt-3">{error}</div>}
      {draft && (
        <p className="text-xs text-slate-400 dark:text-slate-500 mt-3">
          Las notas se guardan solas mientras escribes{savedAt ? ` · borrador guardado a las ${savedAt.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}` : ""}. Puedes cerrar y seguir después.
        </p>
      )}
      <div className="flex justify-end gap-2 mt-4">
        {draft && hasContent && <button className="btn-ghost mr-auto text-red-600" onClick={() => setDiscarding(true)}>Descartar borrador</button>}
        <button className="btn-ghost" onClick={onClose}>{draft ? "Cerrar" : "Cancelar"}</button>
        <button className="btn-primary" disabled={!hasContent || saving} onClick={save}>{saving ? "Guardando…" : submitLabel}</button>
      </div>
      <ConfirmDialog
        open={discarding} title="Descartar borrador" confirmLabel="Descartar"
        message="Se borrarán las notas escritas hasta ahora. No se puede deshacer."
        onCancel={() => setDiscarding(false)}
        onConfirm={async () => { setDiscarding(false); await clear(); onClose(); }}
      />
    </Modal>
  );
}
