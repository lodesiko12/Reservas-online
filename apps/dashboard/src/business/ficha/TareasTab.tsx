import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../lib/auth";
import { Spinner } from "../../components/ui";
import type { Customer } from "../hooks";

export function TareasTab({ customer }: { customer: Customer }) {
  const { business } = useAuth();
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  const { data: tasks, isLoading } = useQuery({
    queryKey: ["customer-tasks", customer.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("client_tasks")
        .select("*").eq("customer_id", customer.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  function invalidate() { qc.invalidateQueries({ queryKey: ["customer-tasks", customer.id] }); }

  async function add() {
    if (!title.trim() || !business?.id) return;
    setSaving(true);
    const { error } = await supabase.from("client_tasks").insert({
      business_id: business.id, customer_id: customer.id,
      title: title.trim(), description: description.trim() || null,
    });
    setSaving(false);
    if (!error) { setTitle(""); setDescription(""); invalidate(); }
  }

  async function toggle(taskId: string, current: string) {
    await supabase.from("client_tasks")
      .update({ status: current === "completada" ? "pendiente" : "completada" })
      .eq("id", taskId);
    invalidate();
  }

  return (
    <div>
      <div className="mb-4 space-y-2">
        <input className="input" placeholder="Título de la tarea/pauta" value={title} onChange={(e) => setTitle(e.target.value)} />
        <textarea className="input" rows={2} placeholder="Descripción (opcional)" value={description} onChange={(e) => setDescription(e.target.value)} />
        <button className="btn-primary text-xs" disabled={!title.trim() || saving} onClick={add}>{saving ? "Guardando…" : "Añadir tarea"}</button>
      </div>
      {isLoading ? <Spinner /> : !tasks?.length ? (
        <p className="text-sm text-slate-400 dark:text-slate-500">Sin tareas todavía.</p>
      ) : (
        <ul className="space-y-2 max-h-72 overflow-y-auto">
          {tasks.map((t) => (
            <li key={t.id} className="card p-3 text-sm flex items-start gap-2">
              <input type="checkbox" className="mt-1" checked={t.status === "completada"} onChange={() => toggle(t.id, t.status)} />
              <div>
                <div className={t.status === "completada" ? "line-through text-slate-400 dark:text-slate-500" : "font-medium"}>{t.title}</div>
                {t.description && <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{t.description}</div>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
