import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../lib/auth";
import { Spinner } from "../../components/ui";
import { formatDateTime } from "@reservas/shared";
import type { Customer } from "../hooks";

export function NotasTab({ customer }: { customer: Customer }) {
  const { business } = useAuth();
  const tz = business?.timezone ?? "Europe/Madrid";
  const qc = useQueryClient();
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);

  const { data: notes, isLoading } = useQuery({
    queryKey: ["customer-notes", customer.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("client_notes")
        .select("*").eq("customer_id", customer.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  async function add() {
    if (!body.trim() || !business?.id) return;
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("client_notes").insert({
      business_id: business.id, customer_id: customer.id,
      author_user_id: user?.id ?? null, body: body.trim(),
    });
    setSaving(false);
    if (!error) { setBody(""); qc.invalidateQueries({ queryKey: ["customer-notes", customer.id] }); }
  }

  return (
    <div>
      <div className="mb-4">
        <textarea className="input" rows={2} placeholder="Añadir una nota…" value={body} onChange={(e) => setBody(e.target.value)} />
        <button className="btn-primary text-xs mt-2" disabled={!body.trim() || saving} onClick={add}>{saving ? "Guardando…" : "Añadir nota"}</button>
      </div>
      {isLoading ? <Spinner /> : !notes?.length ? (
        <p className="text-sm text-slate-400 dark:text-slate-500">Sin notas todavía.</p>
      ) : (
        <ul className="space-y-2 max-h-72 overflow-y-auto">
          {notes.map((n) => (
            <li key={n.id} className="card p-3 text-sm">
              <div className="whitespace-pre-wrap">{n.body}</div>
              <div className="text-xs text-slate-400 dark:text-slate-500 mt-1">{formatDateTime(n.created_at, tz)}{n.booking_id ? " · desde Seguimiento" : ""}</div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
