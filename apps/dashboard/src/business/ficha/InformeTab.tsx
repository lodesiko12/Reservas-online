import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../lib/auth";
import { Spinner } from "../../components/ui";
import { formatDateTime } from "@reservas/shared";
import { generateClientReportPdf } from "./InformePdf";
import type { Customer } from "../hooks";

export function InformeTab({ customer }: { customer: Customer }) {
  const { business } = useAuth();
  const tz = business?.timezone ?? "Europe/Madrid";
  const qc = useQueryClient();
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);

  function startEditing(id: string, content: string) {
    setEditingId(id);
    setDraft(content);
  }

  async function saveEdit() {
    if (!editingId) return;
    setSaving(true);
    const { error } = await supabase.from("client_ai_reports").update({ content: draft }).eq("id", editingId);
    setSaving(false);
    if (error) { setError(error.message); return; }
    setEditingId(null);
    qc.invalidateQueries({ queryKey: ["customer-ai-reports", customer.id] });
  }

  const { data: reports, isLoading } = useQuery({
    queryKey: ["customer-ai-reports", customer.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("client_ai_reports")
        .select("*").eq("customer_id", customer.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  async function generate() {
    setGenerating(true); setError(null);
    // Gemini devuelve 503 ("alta demanda") con cierta frecuencia ahora mismo
    // (problema de capacidad conocido y documentado del lado de Google, no
    // de nuestra clave/código). Reintentamos un par de veces desde el
    // navegador antes de rendirnos — sin riesgo de colgar el servidor,
    // porque cada intento es una llamada independiente a la Edge Function.
    const MAX_ATTEMPTS = 3;
    try {
      for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        const { data, error } = await supabase.functions.invoke("generate-client-ai-report", { body: { customer_id: customer.id } });
        const body = data as any;
        const isSaturated = !error && body?.ok === false && /satur/i.test(body?.error ?? "");
        if (!error && body?.ok !== false) {
          qc.invalidateQueries({ queryKey: ["customer-ai-reports", customer.id] });
          return;
        }
        if (isSaturated && attempt < MAX_ATTEMPTS) {
          setError(`Gemini está saturado, reintentando… (${attempt}/${MAX_ATTEMPTS})`);
          await new Promise((r) => setTimeout(r, 2000));
          continue;
        }
        setError(body?.error ?? error?.message ?? "Error al generar el informe");
        return;
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado al generar el informe");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div>
      <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
        Genera un borrador de informe psicológico con IA a partir de todas las sesiones registradas en el Historial.
        Puedes editarlo antes de descargarlo en PDF. Requiere haber configurado una clave de Gemini en Configuración → Informes con IA.
      </p>
      <button className="btn-primary text-xs mb-4" disabled={generating} onClick={generate}>{generating ? "Generando…" : "Generar informe"}</button>
      {error && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-3">{error}</div>}
      {isLoading ? <Spinner /> : !reports?.length ? (
        <p className="text-sm text-slate-400 dark:text-slate-500">Sin informes generados todavía.</p>
      ) : (
        <ul className="space-y-3 max-h-96 overflow-y-auto">
          {reports.map((r) => (
            <li key={r.id} className="card p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-slate-400 dark:text-slate-500">{formatDateTime(r.created_at, tz)} · basado en {r.sessions_count} sesión{r.sessions_count === 1 ? "" : "es"}</span>
                {editingId !== r.id && (
                  <div className="flex gap-2">
                    <button className="btn-ghost text-xs" onClick={() => startEditing(r.id, r.content)}>✏️ Editar</button>
                    <button
                      className="btn-ghost text-xs"
                      onClick={() => generateClientReportPdf(customer, r.content, tz)}
                    >
                      📄 Descargar PDF
                    </button>
                  </div>
                )}
              </div>
              {editingId === r.id ? (
                <div className="space-y-2">
                  <textarea
                    className="input w-full font-mono text-xs"
                    rows={16}
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                  />
                  <div className="flex gap-2">
                    <button className="btn-primary text-xs" disabled={saving} onClick={saveEdit}>{saving ? "Guardando…" : "Guardar cambios"}</button>
                    <button className="btn-ghost text-xs" onClick={() => setEditingId(null)}>Cancelar</button>
                  </div>
                </div>
              ) : (
                <pre className="whitespace-pre-wrap text-sm font-sans">{r.content}</pre>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
