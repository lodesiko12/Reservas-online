import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import { useBusinessId, useProfessionals } from "../business/hooks";
import { Spinner } from "./ui";

const sb = supabase as any;

/** Coberturas de ausencia: la profesional cubierta da acceso temporal a otra
 * a las notas clinicas de sus pacientes. Caduca sola al pasar la fecha final. */
export function CoberturasSection({ onToast }: { onToast: (m: string) => void }) {
  const bid = useBusinessId();
  const qc = useQueryClient();
  const { data: pros } = useProfessionals();
  const { data: mine } = useQuery({
    queryKey: ["my-professional", bid],
    enabled: !!bid,
    queryFn: async () => ((await sb.rpc("my_professional_id", { b: bid })).data as string | null) ?? null,
  });
  const { data: list, isLoading } = useQuery({
    queryKey: ["clinical-coverages", bid],
    enabled: !!bid,
    queryFn: async () => {
      const { data, error } = await sb.from("clinical_coverages").select("*").eq("business_id", bid).order("starts_on", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });
  const [covering, setCovering] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const name = (id: string) => pros?.find((p) => p.id === id)?.name ?? "—";

  async function grant() {
    if (!mine) return;
    setBusy(true); setError(null);
    const { error } = await sb.rpc("grant_clinical_coverage", {
      p_business: bid, p_covered: mine, p_covering: covering, p_from: from, p_to: to,
    });
    setBusy(false);
    if (error) { setError(error.message); return; }
    setCovering(""); setFrom(""); setTo("");
    qc.invalidateQueries({ queryKey: ["clinical-coverages", bid] });
    onToast("Cobertura creada");
  }
  async function revoke(id: string) {
    const { error } = await sb.rpc("revoke_clinical_coverage", { p_id: id });
    if (error) { setError(error.message); return; }
    qc.invalidateQueries({ queryKey: ["clinical-coverages", bid] });
    onToast("Cobertura retirada");
  }

  return (
    <section className="card p-6">
      <h2 className="font-semibold mb-1">Cobertura de ausencias</h2>
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
        Cada profesional solo ve las notas clínicas de sus pacientes. Si vas a faltar, da acceso a una compañera
        durante unas fechas; después se cierra solo y cada acceso queda registrado.
      </p>
      {mine ? (
        <div className="flex flex-wrap items-end gap-2 mb-4">
          <div><label className="label">Me cubre</label>
            <select className="input" value={covering} onChange={(e) => setCovering(e.target.value)}>
              <option value="">Elige…</option>
              {(pros ?? []).filter((p) => p.id !== mine).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select></div>
          <div><label className="label">Desde</label><input type="date" className="input" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
          <div><label className="label">Hasta</label><input type="date" className="input" value={to} min={from} onChange={(e) => setTo(e.target.value)} /></div>
          <button className="btn-primary" disabled={!covering || !from || !to || busy} onClick={grant}>{busy ? "Guardando…" : "Dar acceso"}</button>
        </div>
      ) : (
        <p className="text-sm text-amber-600 mb-4">Tu cuenta no está vinculada a ninguna profesional, así que no puedes conceder coberturas.</p>
      )}
      {error && <p className="text-sm text-red-600 mb-2">{error}</p>}
      {isLoading ? <Spinner /> : !list?.length ? (
        <p className="text-sm text-slate-400 dark:text-slate-500">Sin coberturas.</p>
      ) : (
        <ul className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
          {list.map((c) => (
            <li key={c.id} className="py-2 flex items-center gap-2">
              <span><strong>{name(c.covering_professional_id)}</strong> cubre a <strong>{name(c.covered_professional_id)}</strong>
                {" "}del {c.starts_on} al {c.ends_on}</span>
              {c.covered_professional_id === mine && (
                <button className="btn-ghost text-xs ml-auto" onClick={() => revoke(c.id)}>Retirar</button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
