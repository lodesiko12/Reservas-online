import { useEffect, useRef, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../lib/auth";
import { Spinner } from "../../components/ui";
import { useBusinessId, useProfessionals, type Customer } from "../hooks";
import { ShieldCheck } from "lucide-react";

// RGPD: las notas clinicas solo las ve la profesional responsable del paciente
// (o quien la cubra con una cobertura vigente). La RLS lo impone en la BD;
// esto solo da la explicacion y deja constancia del acceso.
// Los tipos generados aun no conocen estas RPC/columnas, de ahi el `any`.
const rpc = (name: string, args: Record<string, unknown>) => (supabase as any).rpc(name, args);

export function useClinicalAccess(customerId: string) {
  return useQuery({
    queryKey: ["clinical-access", customerId],
    queryFn: async () => {
      const { data, error } = await rpc("can_access_clinical", { c: customerId });
      if (error) throw error;
      return !!data;
    },
  });
}

/** Muestra el contenido clinico solo si hay acceso, y registra el acceso una vez por apertura. */
export function ClinicalGate({ customer, action, children }: { customer: Customer; action: string; children: ReactNode }) {
  const { data: allowed, isLoading } = useClinicalAccess(customer.id);
  const logged = useRef(false);
  useEffect(() => {
    if (allowed && !logged.current) {
      logged.current = true;
      void rpc("log_clinical_access", { p_customer: customer.id, p_action: action });
    }
  }, [allowed, customer.id, action]);

  if (isLoading) return <Spinner />;
  if (!allowed) {
    const assigned = !!(customer as any).professional_id;
    return (
      <div className="card p-4 text-sm text-slate-600 dark:text-slate-300 flex gap-3">
        <ShieldCheck size={20} strokeWidth={1.75} className="shrink-0 text-slate-400" aria-hidden="true" />
        <p>
          {assigned
            ? "Las notas clínicas de este paciente son de su profesional responsable. Solo ella, o quien la cubra durante una ausencia, puede verlas."
            : "Este paciente aún no tiene profesional responsable, así que nadie puede ver ni escribir sus notas clínicas. Asígnalo arriba."}
        </p>
      </div>
    );
  }
  return <>{children}</>;
}

/** Barra con la profesional responsable del paciente y la accion de asignar / traspasar. */
export function ResponsableBar({ customer }: { customer: Customer }) {
  const qc = useQueryClient();
  const bid = useBusinessId();
  const { data: pros } = useProfessionals();
  const { data: mine } = useQuery({
    queryKey: ["my-professional", bid],
    enabled: !!bid,
    queryFn: async () => {
      const { data } = await rpc("my_professional_id", { b: bid });
      return (data as string | null) ?? null;
    },
  });
  const { business } = useAuth();
  const current = (customer as any).professional_id as string | null;
  const currentName = pros?.find((p) => p.id === current)?.name;
  const [target, setTarget] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function assign(proId: string) {
    setBusy(true); setError(null);
    const { error } = await rpc("assign_customer_professional", { p_customer: customer.id, p_professional: proId });
    setBusy(false);
    if (error) { setError(error.message); return; }
    qc.invalidateQueries({ queryKey: ["customers", bid] });
    qc.invalidateQueries({ queryKey: ["clinical-access", customer.id] });
    // El modal conserva el objeto `customer` anterior: refresco manual del responsable.
    (customer as any).professional_id = proId;
    setTarget("");
  }

  const canTransfer = !!current && current === mine;
  const canAssignFree = !current;
  const options = (pros ?? []).filter((p) => p.id !== current && (canTransfer || business?.type === "psicologo"));

  return (
    <div className="mb-4 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-slate-500 dark:text-slate-400">Profesional responsable:</span>
        <strong>{currentName ?? "sin asignar"}</strong>
        {canAssignFree && mine && (
          <button className="btn-ghost text-xs" disabled={busy} onClick={() => assign(mine)}>Asignarme</button>
        )}
        {(canTransfer || canAssignFree) && (
          <span className="flex items-center gap-1 ml-auto">
            <select className="input !py-1 text-xs" value={target} onChange={(e) => setTarget(e.target.value)}>
              <option value="">{canTransfer ? "Traspasar a…" : "Asignar a…"}</option>
              {options.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <button className="btn-ghost text-xs" disabled={!target || busy} onClick={() => assign(target)}>Aceptar</button>
          </span>
        )}
      </div>
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  );
}
