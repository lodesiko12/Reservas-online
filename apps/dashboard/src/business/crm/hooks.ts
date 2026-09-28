import { useQuery } from "@tanstack/react-query";
import { supabase } from "../../lib/supabase";
import { useBusinessId } from "../hooks";
import type { PipelineStage, CrmFiscalProfile, CrmBudgetConcept, CardWithCustomer } from "./types";

/** Etapas del pipeline del negocio, ordenadas por posición. Toda query filtra
 * explícitamente por business_id (capa 2 de aislamiento, además de RLS). */
export function usePipelineStages() {
  const bid = useBusinessId();
  return useQuery({
    queryKey: ["crm_pipeline_stages", bid],
    enabled: !!bid,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("crm_pipeline_stages")
        .select("*")
        .eq("business_id", bid)
        .order("position");
      if (error) throw error;
      return data as PipelineStage[];
    },
  });
}

/** Tarjetas del pipeline con datos básicos del cliente. */
export function useCrmCards() {
  const bid = useBusinessId();
  return useQuery({
    queryKey: ["crm_cards", bid],
    enabled: !!bid,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("crm_cards")
        .select("*, customers(full_name, last_name, phone)")
        .eq("business_id", bid)
        .order("position");
      if (error) throw error;
      return data as unknown as CardWithCustomer[];
    },
  });
}

export function useFiscalProfile() {
  const bid = useBusinessId();
  return useQuery({
    queryKey: ["crm_fiscal_profile", bid],
    enabled: !!bid,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("crm_fiscal_profile")
        .select("*")
        .eq("business_id", bid)
        .maybeSingle();
      if (error) throw error;
      return data as CrmFiscalProfile | null;
    },
  });
}

export function useBudgetConcepts() {
  const bid = useBusinessId();
  return useQuery({
    queryKey: ["crm_budget_concepts", bid],
    enabled: !!bid,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("crm_budget_concepts")
        .select("*")
        .eq("business_id", bid)
        .order("name");
      if (error) throw error;
      return data as CrmBudgetConcept[];
    },
  });
}

export function customerLabel(c: { full_name: string; last_name: string | null } | null | undefined): string {
  if (!c) return "Sin cliente";
  return `${c.full_name} ${c.last_name ?? ""}`.trim();
}
