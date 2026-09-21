import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../lib/auth";
import { Spinner } from "../../components/ui";
import { formatDateTime } from "@reservas/shared";
import type { Customer } from "../hooks";

export function InformeTab({ customer }: { customer: Customer }) {
  const { business } = useAuth();
  const tz = business?.timezone ?? "Europe/Madrid";
  const qc = useQueryClient();
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    const { data, error } = await supabase.functions.invoke("generate-client-ai-report", { body: { customer_id: customer.id } });
    setGenerating(false);
    const body = data as any;
    if (error || body?.ok === false) { setError(body?.error ?? error?.message ?? "Error al generar el informe"); return; }
    qc.invalidateQueries({ queryKey: ["customer-ai-reports", customer.id] });
  }

  return (
    <div>
      <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
        Genera un resumen con IA a partir de las notas de sesión y las tareas registradas de este cliente.
        Requiere haber configurado una clave de Gemini en Configuración → Informes con IA.
      </p>
      <button className="btn-primary text-xs mb-4" disabled={generating} onClick={generate}>{generating ? "Generando…" : "Generar informe"}</button>
      {error && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-3">{error}</div>}
      {isLoading ? <Spinner /> : !reports?.length ? (
        <p className="text-sm text-slate-400 dark:text-slate-500">Sin informes generados todavía.</p>
      ) : (
        <ul className="space-y-3 max-h-96 overflow-y-auto">
          {reports.map((r) => (
            <li key={r.id} className="card p-3">
              <div className="text-xs text-slate-400 dark:text-slate-500 mb-2">{formatDateTime(r.created_at, tz)} · basado en {r.notes_count} notas y {r.tasks_count} tareas</div>
              <pre className="whitespace-pre-wrap text-sm font-sans">{r.content}</pre>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
