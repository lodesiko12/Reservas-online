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
        Genera un resumen con IA a partir de todas las sesiones registradas en el Historial de este cliente.
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
              <div className="text-xs text-slate-400 dark:text-slate-500 mb-2">{formatDateTime(r.created_at, tz)} · basado en {r.sessions_count} sesión{r.sessions_count === 1 ? "" : "es"}</div>
              <pre className="whitespace-pre-wrap text-sm font-sans">{r.content}</pre>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
