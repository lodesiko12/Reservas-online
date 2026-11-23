import { useEffect, useRef, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../lib/auth";
import { Spinner, Modal } from "../../components/ui";
import { useBusinessId, useProfessionals, type Customer } from "../hooks";
import { ShieldCheck } from "lucide-react";
import { formatDateTime } from "@reservas/shared";

// RGPD: las notas clinicas solo las ve la profesional responsable del paciente
// (o quien la cubra con una cobertura vigente, o la responsable del centro con un
// acceso excepcional registrado). La RLS lo impone en la BD; esto solo da la
// explicacion y deja constancia del acceso.
// Los tipos generados aun no conocen estas RPC/columnas, de ahi el `any`.
const rpc = (name: string, args: Record<string, unknown>) => (supabase as any).rpc(name, args);

function useMyProfessional() {
  const bid = useBusinessId();
  return useQuery({
    queryKey: ["my-professional", bid],
    enabled: !!bid,
    queryFn: async () => {
      const { data } = await rpc("my_professional_id", { b: bid });
      return (data as string | null) ?? null;
    },
  });
}

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
  const { role } = useAuth();
  const { data: mine } = useMyProfessional();
  const qc = useQueryClient();
  const logged = useRef(false);
  const [asking, setAsking] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (allowed && !logged.current) {
      logged.current = true;
      void rpc("log_clinical_access", { p_customer: customer.id, p_action: action });
    }
  }, [allowed, customer.id, action]);

  async function requestAccess() {
    setBusy(true); setError(null);
    const { error } = await rpc("request_exceptional_clinical_access", { p_customer: customer.id, p_reason: reason });
    setBusy(false);
    if (error) { setError(error.message); return; }
    setAsking(false); setReason("");
    qc.invalidateQueries({ queryKey: ["clinical-access", customer.id] });
    qc.invalidateQueries({ queryKey: ["clinical-exceptional", customer.id] });
  }

  if (isLoading) return <Spinner />;
  if (!allowed) {
    const assigned = !!(customer as any).professional_id;
    const canAsk = role === "owner" && !!mine;
    return (
      <div className="card p-4 text-sm text-slate-600 dark:text-slate-300">
        <div className="flex gap-3">
          <ShieldCheck size={20} strokeWidth={1.75} className="shrink-0 text-slate-400" aria-hidden="true" />
          <p>
            {assigned
              ? "Las notas clínicas de este paciente son de su profesional responsable. Solo ella, o quien la cubra durante una ausencia, puede verlas."
              : "Este paciente aún no tiene profesional responsable, así que nadie puede ver ni escribir sus notas clínicas. Asígnalo arriba."}
          </p>
        </div>
        {canAsk && (
          <div className="mt-3 pl-8">
            <button className="btn-ghost text-xs" onClick={() => setAsking(true)}>Acceso excepcional (responsable del centro)…</button>
          </div>
        )}
        <Modal open={asking} onClose={() => setAsking(false)} title="Acceso excepcional a las notas clínicas" width="max-w-md">
          <p className="text-sm text-slate-600 dark:text-slate-300 mb-3">
            Solo para atender un derecho del paciente, un requerimiento judicial o una inspección. Durará 24 horas, quedará
            registrado con tu nombre y el motivo, y la profesional responsable podrá verlo.
          </p>
          <label className="label">Motivo (mínimo 20 caracteres)</label>
          <textarea className="input" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
          {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
          <div className="flex justify-end gap-2 mt-4">
            <button className="btn-ghost" onClick={() => setAsking(false)}>Cancelar</button>
            <button className="btn-primary" disabled={busy || reason.trim().length < 20} onClick={requestAccess}>
              {busy ? "Registrando…" : "Acceder y registrar"}
            </button>
          </div>
        </Modal>
      </div>
    );
  }
  return <>{children}</>;
}

/** Barra con la profesional responsable del paciente, la accion de asignar / traspasar
 * y los accesos excepcionales recientes (los ve la responsable y las owner). */
export function ResponsableBar({ customer }: { customer: Customer }) {
  const qc = useQueryClient();
  const bid = useBusinessId();
  const { business, role } = useAuth();
  const tz = business?.timezone ?? "Europe/Madrid";
  const { data: pros } = useProfessionals();
  const { data: mine } = useMyProfessional();
  const current = (customer as any).professional_id as string | null;
  const currentPro = (pros as any[] | undefined)?.find((p) => p.id === current);
  const currentName = currentPro?.name;
  const [target, setTarget] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: exceptional } = useQuery({
    queryKey: ["clinical-exceptional", customer.id],
    queryFn: async () => {
      const { data } = await (supabase as any).from("clinical_access_log")
        .select("at, detail").eq("customer_id", customer.id).eq("action", "acceso_excepcional")
        .order("at", { ascending: false }).limit(3);
      return (data as { at: string; detail: string }[] | null) ?? [];
    },
  });

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

  // La responsable "huerfana" es la que ya no tiene cuenta vinculada: solo entonces una owner reasigna.
  const orphan = !!current && !currentPro?.user_id;
  const canTransfer = !!current && (current === mine || (role === "owner" && orphan));
  const canAssignFree = !current;
  const options = (pros ?? []).filter((p) => p.id !== current);

  return (
    <div className="mb-4 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-slate-500 dark:text-slate-400">Profesional responsable:</span>
        <strong>{currentName ?? "sin asignar"}</strong>
        {orphan && <span className="text-xs text-amber-600">(sin cuenta activa)</span>}
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
      {!!exceptional?.length && (
        <ul className="mt-2 text-xs text-amber-700 dark:text-amber-400 space-y-0.5">
          {exceptional.map((e, i) => (
            <li key={i}>Acceso excepcional el {formatDateTime(e.at, tz)} — {e.detail}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
