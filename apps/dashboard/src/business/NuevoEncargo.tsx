import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import { useServices, useServiceOptions, useOptionGroups } from "./hooks";
import { ymdInTz, formatTime } from "@reservas/shared";
import { PageHeader, Spinner } from "../components/ui";
import { DateStrip, CustomerFields, Done } from "./NuevaReserva";

/** Alta manual de un encargo (WhatsApp, teléfono, en tienda): tamaño + sabor + recogida.
 * Canal "manual": el staff no está sujeto a antelación mínima, capacidad diaria ni a que el
 * sabor figure como no disponible; el encargo queda confirmado directamente. */
export function NuevoEncargo() {
  const { business } = useAuth();
  const bid = business?.id ?? "";
  const tz = business?.timezone ?? "Europe/Madrid";
  const nav = useNavigate();
  const qc = useQueryClient();
  const { data: services, isLoading: loadingSvc } = useServices();
  const { data: options, isLoading: loadingOpt } = useServiceOptions();
  const { data: groups } = useOptionGroups();

  const [sizeKey, setSizeKey] = useState("");
  const [optionId, setOptionId] = useState("");
  const [date, setDate] = useState(ymdInTz(new Date(), tz));
  const [slots, setSlots] = useState<{ slot_start: string }[]>([]);
  const [slot, setSlot] = useState("");
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [form, setForm] = useState({ name: "", last_name: "", phone: "", email: "", notes: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const sizes = useMemo(() => {
    const m = new Map<string, string>();
    for (const s of services ?? []) if (s.size_key && !m.has(s.size_key)) m.set(s.size_key, s.size_label ?? s.size_key);
    return [...m.entries()];
  }, [services]);

  useEffect(() => { if (!sizeKey && sizes.length) setSizeKey(sizes[0][0]); }, [sizes, sizeKey]);

  const option = (options ?? []).find((o) => o.id === optionId) ?? null;
  const service = option ? (services ?? []).find((s) => s.size_key === sizeKey && s.option_group === option.option_group) ?? null : null;

  // Si cambia el tamaño y el sabor ya no tiene servicio para ese tamaño, se limpia.
  useEffect(() => { if (option && !service) setOptionId(""); }, [option, service]);

  useEffect(() => {
    if (!service || !date) { setSlots([]); return; }
    setLoadingSlots(true); setSlot("");
    (async () => {
      const { data } = await supabase.rpc("get_available_slots", {
        p_business_id: bid, p_service_id: service.id, p_date: date, p_channel: "manual",
      });
      setSlots((data as any[]) ?? []); setLoadingSlots(false);
    })();
  }, [service?.id, date, bid]);

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setError(null);
    if (!service || !option) return;
    setSaving(true);
    const { data, error } = await supabase.rpc("create_public_booking", {
      p_business_id: bid, p_service_id: service.id, p_starts_at: slot,
      p_name: form.name.trim(), p_last_name: form.last_name.trim(),
      p_phone: form.phone.trim(), p_email: form.email.trim(),
      p_notes: form.notes.trim() || undefined, p_channel: "manual", p_option_id: option.id,
    });
    setSaving(false);
    if (error) { setError(error.message); return; }
    qc.invalidateQueries();
    setOk((data as any).locator);
    setTimeout(() => nav("/app/agenda"), 1200);
  }

  const valid = !!service && !!option && !!slot && form.name.trim() && form.phone.trim();
  if (ok) return <Done locator={ok} />;
  if (loadingSvc || loadingOpt) return <div className="grid place-items-center py-20"><Spinner /></div>;

  return (
    <div className="max-w-2xl">
      <PageHeader title="Nuevo encargo" subtitle="Alta manual (WhatsApp, teléfono o en tienda)" />
      <form onSubmit={submit} className="space-y-5">
        <div className="card p-5 grid sm:grid-cols-2 gap-4">
          <div>
            <label className="label">Tamaño *</label>
            <select className="input" value={sizeKey} onChange={(e) => setSizeKey(e.target.value)}>
              {sizes.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Sabor *</label>
            <select className="input" value={optionId} onChange={(e) => setOptionId(e.target.value)} required>
              <option value="">Elige un sabor…</option>
              {(groups ?? []).map((g) => {
                const items = (options ?? []).filter((o) => o.option_group === g.group_key);
                if (!items.length) return null;
                const price = (services ?? []).find((s) => s.size_key === sizeKey && s.option_group === g.group_key)?.price;
                return (
                  <optgroup key={g.group_key} label={`${g.label}${price != null ? ` · ${price} €` : ""}`}>
                    {items.map((o) => <option key={o.id} value={o.id}>{o.name}{o.is_available ? "" : " (no disponible esta semana)"}</option>)}
                  </optgroup>
                );
              })}
            </select>
          </div>
          {service?.price != null && <p className="sm:col-span-2 text-sm text-slate-500 dark:text-slate-400">Precio: <b>{service.price} €</b></p>}
        </div>

        {service && (
          <div className="card p-5">
            <label className="label">Día de recogida</label>
            <DateStrip tz={tz} date={date} setDate={setDate} />
            <label className="label mt-3">Hora de recogida</label>
            {loadingSlots ? <Spinner /> : slots.length === 0 ? (
              <p className="text-sm text-slate-400 dark:text-slate-500">No hay horas ese día (horario, festivo o bloqueo).</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {slots.map((s) => (
                  <button type="button" key={s.slot_start} onClick={() => setSlot(s.slot_start)}
                    className={`rounded-lg border px-3 py-1.5 text-sm font-medium ${slot === s.slot_start ? "bg-brand-500 text-white border-brand-500" : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700"}`}>
                    {formatTime(s.slot_start, tz)}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <CustomerFields form={form} setForm={setForm} />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button className="btn-primary" disabled={!valid || saving}>{saving ? "Guardando…" : "Crear encargo"}</button>
      </form>
    </div>
  );
}
