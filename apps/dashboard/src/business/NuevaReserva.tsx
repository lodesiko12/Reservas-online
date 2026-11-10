import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import { useServices, useProfessionals, useServiceProfessionals } from "./hooks";
import { ymdInTz, addDaysYmd, weekdayInTz, WEEKDAYS_SHORT_ES, formatTime, formatDuration, PARTY_SIZE_OPTIONS } from "@reservas/shared";
import { PageHeader, Spinner } from "../components/ui";
import { NuevoEncargo } from "./NuevoEncargo";

const PARTY_OPTIONS = PARTY_SIZE_OPTIONS;

export function NuevaReserva() {
  const { business } = useAuth();
  if (business?.order_mode) return <NuevoEncargo />;
  return business?.type === "restaurante" ? <NuevaReservaRestaurante /> : <NuevaReservaCitas />;
}

const DAYS_AHEAD = 21;

/**
 * Días (YYYY-MM-DD) de los próximos 21 con algún hueco para el staff (canal "manual"), igual que
 * el selector del widget solo ofrece días con disponibilidad. `fetchDays` llama a la RPC de días;
 * `deps` son los filtros que la invalidan (servicio, profesional, comensales…). Si la fecha elegida
 * deja de tener huecos se limpia. `enabled=false` aún no consulta (p. ej. sin servicio elegido).
 */
export function useAvailableDays(
  tz: string,
  enabled: boolean,
  fetchDays: (from: string, to: string) => PromiseLike<Set<string>>,
  date: string,
  setDate: (d: string) => void,
  deps: unknown[],
) {
  const [days, setDays] = useState<Set<string> | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!enabled) { setDays(null); setLoading(false); return; }
    let cancelled = false;
    const from = ymdInTz(new Date(), tz);
    setDays(null); setLoading(true); setFailed(false);
    Promise.resolve(fetchDays(from, addDaysYmd(from, DAYS_AHEAD - 1)))
      .then((set) => {
        if (cancelled) return;
        setDays(set);
        if (date && !set.has(date)) setDate("");
      })
      .catch(() => { if (!cancelled) { setFailed(true); setDays(null); } })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, tz, ...deps]);

  return { days, loading, failed };
}

export async function rpcDays(fn: "get_available_days" | "get_available_dining_days", args: Record<string, unknown>): Promise<Set<string>> {
  const { data, error } = await supabase.rpc(fn as any, { ...args, p_channel: "manual" } as any);
  if (error) throw error;
  return new Set(((data as { day: string }[]) ?? []).map((r) => r.day));
}

export function DateStrip({ tz, date, setDate, available, loading, failed }: {
  tz: string; date: string; setDate: (d: string) => void;
  /** Días con huecos; null = aún sin cargar (o error) → no se filtra. */
  available?: Set<string> | null; loading?: boolean; failed?: boolean;
}) {
  if (loading) return <div className="py-2"><Spinner /></div>;
  const today = ymdInTz(new Date(), tz);
  const all = Array.from({ length: DAYS_AHEAD }, (_, i) => addDaysYmd(today, i));
  const dates = available ? all.filter((d) => available.has(d)) : all;
  if (available && dates.length === 0) {
    return <p className="text-sm text-slate-400 dark:text-slate-500 pb-2">No hay días con disponibilidad en las próximas semanas.</p>;
  }
  return (
    <div>
    {failed && <p className="text-xs text-amber-600 mb-1">No se pudo comprobar la disponibilidad; se muestran todos los días.</p>}
    <div className="flex gap-2 overflow-x-auto pb-2">
      {dates.map((ymd) => {
        const d = new Date(ymd + "T12:00:00");
        return (
          <button type="button" key={ymd} onClick={() => setDate(ymd)}
            className={`shrink-0 rounded-lg border px-3 py-2 text-center ${date === ymd ? "bg-brand-500 text-white border-brand-500" : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700"}`}>
            <div className="text-[10px] uppercase opacity-80">{WEEKDAYS_SHORT_ES[weekdayInTz(d, tz)]}</div>
            <div className="font-bold">{ymd.slice(8)}</div>
          </button>
        );
      })}
    </div>
    </div>
  );
}

export function CustomerFields({ form, setForm }: { form: any; setForm: (f: any) => void }) {
  return (
    <div className="card p-5 grid sm:grid-cols-2 gap-4">
      <div><label className="label">Nombre *</label><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></div>
      <div><label className="label">Apellidos</label><input className="input" value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} /></div>
      <div><label className="label">Teléfono *</label><input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} required /></div>
      <div><label className="label">Email</label><input type="email" className="input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
      <div className="sm:col-span-2"><label className="label">Notas</label><textarea className="input" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
    </div>
  );
}

export function Done({ locator }: { locator: string }) {
  return (
    <div className="grid place-items-center py-20 text-center">
      <div className="card p-8">
        <div className="text-4xl">✅</div>
        <p className="font-semibold mt-2">Reserva creada</p>
        <p className="text-brand-600 font-bold text-xl mt-1">{locator}</p>
        <p className="text-sm text-slate-400 dark:text-slate-500 mt-2">Redirigiendo a la agenda…</p>
      </div>
    </div>
  );
}

/* ------------------------------- CITAS ------------------------------- */
function NuevaReservaCitas() {
  const { business } = useAuth();
  const bid = business?.id ?? "";
  const tz = business?.timezone ?? "Europe/Madrid";
  const nav = useNavigate();
  const { data: services } = useServices();
  const { data: pros } = useProfessionals();
  const { data: links } = useServiceProfessionals();

  const [serviceId, setServiceId] = useState("");
  const [professionalId, setProfessionalId] = useState(""); // "" = cualquiera disponible
  const [date, setDate] = useState(ymdInTz(new Date(), tz));
  const [slots, setSlots] = useState<{ slot_start: string }[]>([]);
  const [slot, setSlot] = useState("");
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [form, setForm] = useState({ name: "", last_name: "", phone: "", email: "", notes: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const serviceProfessionals = (pros ?? []).filter((p) =>
    (links ?? []).some((l) => l.service_id === serviceId && l.professional_id === p.id)
  );

  const avail = useAvailableDays(tz, !!serviceId, (from, to) => rpcDays("get_available_days", {
    p_business_id: bid, p_service_id: serviceId, p_date_from: from, p_date_to: to,
    p_professional_id: professionalId || undefined,
  }), date, setDate, [serviceId, professionalId, bid]);

  useEffect(() => {
    if (!serviceId || !date) { setSlots([]); return; }
    setLoadingSlots(true); setSlot("");
    (async () => {
      // Canal "manual": el staff no está sujeto al límite de antelación máxima
      // pensado para reservas web.
      const { data } = await supabase.rpc("get_available_slots", {
        p_business_id: bid, p_service_id: serviceId, p_date: date, p_channel: "manual",
        p_professional_id: professionalId || undefined,
      });
      setSlots((data as any[]) ?? []); setLoadingSlots(false);
    })();
  }, [serviceId, professionalId, date, bid]);

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setError(null); setSaving(true);
    const { data, error } = await supabase.rpc("create_public_booking", {
      p_business_id: bid, p_service_id: serviceId, p_starts_at: slot,
      p_name: form.name.trim(), p_last_name: form.last_name.trim(),
      p_phone: form.phone.trim(), p_email: form.email.trim(),
      p_notes: form.notes.trim() || undefined, p_channel: "manual",
      p_professional_id: professionalId || undefined,
    });
    setSaving(false);
    if (error) { setError(error.message); return; }
    setOk((data as any).locator);
    setTimeout(() => nav("/app/agenda"), 1200);
  }

  const valid = serviceId && slot && form.name.trim() && form.phone.trim();
  if (ok) return <Done locator={ok} />;

  return (
    <div className="max-w-2xl">
      <PageHeader title="Nueva reserva" subtitle="Carga manual desde el panel" />
      <form onSubmit={submit} className="space-y-5">
        <div className="card p-5">
          <label className="label">Servicio</label>
          <select className="input" value={serviceId} onChange={(e) => { setServiceId(e.target.value); setProfessionalId(""); }} required>
            <option value="">Selecciona un servicio…</option>
            {services?.map((s) => <option key={s.id} value={s.id}>{s.name} · {formatDuration(s.duration_min)}</option>)}
          </select>
          {serviceId && serviceProfessionals.length > 1 && (
            <>
              <label className="label mt-4">Profesional</label>
              <select className="input" value={professionalId} onChange={(e) => setProfessionalId(e.target.value)}>
                <option value="">Cualquiera disponible</option>
                {serviceProfessionals.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </>
          )}
          {serviceId && (
            <>
              <label className="label mt-4">Fecha</label>
              <DateStrip tz={tz} date={date} setDate={setDate} available={avail.days} loading={avail.loading} failed={avail.failed} />
              <label className="label mt-2">Hora</label>
              {!date ? <p className="text-sm text-slate-400 dark:text-slate-500">Selecciona una fecha para ver los huecos.</p> : loadingSlots ? <Spinner /> : slots.length === 0 ? <p className="text-sm text-slate-400 dark:text-slate-500">No hay huecos ese día.</p> : (
                <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                  {slots.map((s) => (
                    <button type="button" key={s.slot_start} onClick={() => setSlot(s.slot_start)}
                      className={`rounded-lg border py-2 text-sm font-semibold ${slot === s.slot_start ? "bg-brand-500 text-white border-brand-500" : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700"}`}>
                      {formatTime(s.slot_start, tz)}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
        <CustomerFields form={form} setForm={setForm} />
        {error && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>}
        <button className="btn-primary" disabled={!valid || saving}>{saving ? "Guardando…" : "Crear reserva"}</button>
      </form>
    </div>
  );
}

/* ---------------------------- RESTAURANTE ---------------------------- */
function NuevaReservaRestaurante() {
  const { business } = useAuth();
  const bid = business?.id ?? "";
  const tz = business?.timezone ?? "Europe/Madrid";
  const nav = useNavigate();

  const [party, setParty] = useState(2);
  const [date, setDate] = useState(ymdInTz(new Date(), tz));
  const [slots, setSlots] = useState<{ slot_start: string; slot_end: string; shift_id: string; shift_name: string }[]>([]);
  const [slot, setSlot] = useState<{ slot_start: string; slot_end: string; shift_id: string } | null>(null);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [tableOptions, setTableOptions] = useState<{ id: string; name: string; zone_name: string | null; fits: boolean; is_free: boolean }[]>([]);
  const [tableId, setTableId] = useState<string>(""); // "" = automático
  const [form, setForm] = useState({ name: "", last_name: "", phone: "", email: "", notes: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const avail = useAvailableDays(tz, true, (from, to) => rpcDays("get_available_dining_days", {
    p_business_id: bid, p_date_from: from, p_date_to: to, p_party_size: party,
  }), date, setDate, [party, bid]);

  useEffect(() => {
    if (!date) { setSlots([]); return; }
    setLoadingSlots(true); setSlot(null);
    (async () => {
      // Canal "manual": el staff ve el aforo completo (sin límites de stock
      // online, antelación ni mín/máx de comensales pensados para la web).
      const { data } = await supabase.rpc("get_available_dining_slots", { p_business_id: bid, p_date: date, p_party_size: party, p_channel: "manual" });
      setSlots((data as any[]) ?? []); setLoadingSlots(false);
    })();
  }, [date, party, bid]);

  useEffect(() => {
    setTableId("");
    if (!slot) { setTableOptions([]); return; }
    (async () => {
      const { data } = await supabase.rpc("get_dining_table_options", {
        p_business_id: bid, p_shift_id: slot.shift_id, p_starts_at: slot.slot_start, p_ends_at: slot.slot_end, p_party_size: party,
      });
      setTableOptions((data as any[]) ?? []);
    })();
  }, [slot, party, bid]);

  const grouped = Object.values(
    slots.reduce((acc: Record<string, { name: string; slots: typeof slots }>, s) => {
      (acc[s.shift_id] ??= { name: s.shift_name, slots: [] }).slots.push(s);
      return acc;
    }, {})
  );

  async function submit(e: React.FormEvent) {
    e.preventDefault(); if (!slot) return;
    setError(null); setSaving(true);
    const { data, error } = await supabase.rpc("create_public_dining_booking", {
      p_business_id: bid, p_shift_id: slot.shift_id, p_starts_at: slot.slot_start, p_party_size: party,
      p_name: form.name.trim(), p_last_name: form.last_name.trim(),
      p_phone: form.phone.trim(), p_email: form.email.trim(),
      p_notes: form.notes.trim() || undefined, p_channel: "manual",
      p_table_id: tableId || undefined,
    });
    setSaving(false);
    if (error) { setError(error.message); return; }
    setOk((data as any).locator);
    setTimeout(() => nav("/app/agenda"), 1200);
  }

  const valid = slot && form.name.trim() && form.phone.trim();
  if (ok) return <Done locator={ok} />;

  return (
    <div className="max-w-2xl">
      <PageHeader title="Nueva reserva" subtitle="Carga manual de mesa" />
      <form onSubmit={submit} className="space-y-5">
        <div className="card p-5">
          <label className="label">Comensales</label>
          <div className="flex flex-wrap gap-2">
            {PARTY_OPTIONS.map((n) => (
              <button type="button" key={n} onClick={() => setParty(n)}
                className={`w-11 h-11 rounded-lg border font-semibold ${party === n ? "bg-brand-500 text-white border-brand-500" : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700"}`}>{n}</button>
            ))}
          </div>

          <label className="label mt-4">Fecha</label>
          <DateStrip tz={tz} date={date} setDate={setDate} available={avail.days} loading={avail.loading} failed={avail.failed} />

          <label className="label mt-2">Hora</label>
          {!date ? <p className="text-sm text-slate-400 dark:text-slate-500">Selecciona una fecha para ver las mesas.</p> : loadingSlots ? <Spinner /> : grouped.length === 0 ? <p className="text-sm text-slate-400 dark:text-slate-500">No hay mesas ese día para {party} comensales.</p> : (
            grouped.map((g) => (
              <div key={g.name} className="mb-3">
                <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">{g.name}</div>
                <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                  {g.slots.map((s) => (
                    <button type="button" key={s.slot_start} onClick={() => setSlot(s)}
                      className={`rounded-lg border py-2 text-sm font-semibold ${slot?.slot_start === s.slot_start ? "bg-brand-500 text-white border-brand-500" : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700"}`}>
                      {formatTime(s.slot_start, tz)}
                    </button>
                  ))}
                </div>
              </div>
            ))
          )}

          {slot && !!tableOptions.length && (
            <div className="mt-4 border-t pt-4">
              <label className="label">Mesa</label>
              <select className="input" value={tableId} onChange={(e) => setTableId(e.target.value)}>
                <option value="">Automático (mejor mesa disponible)</option>
                {tableOptions.map((t) => (
                  <option key={t.id} value={t.id} disabled={!t.is_free}>
                    {t.name}{t.zone_name ? ` · ${t.zone_name}` : ""}{!t.fits ? " (no encaja)" : ""}{!t.is_free ? " — ocupada" : ""}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
        <CustomerFields form={form} setForm={setForm} />
        {error && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>}
        <button className="btn-primary" disabled={!valid || saving}>{saving ? "Guardando…" : "Crear reserva"}</button>
      </form>
    </div>
  );
}
