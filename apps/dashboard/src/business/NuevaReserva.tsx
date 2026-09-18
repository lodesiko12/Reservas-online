import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import { useServices } from "./hooks";
import { ymdInTz, addDaysYmd, weekdayInTz, WEEKDAYS_SHORT_ES, formatTime, formatDuration } from "@reservas/shared";
import { PageHeader, Spinner } from "../components/ui";

const PARTY_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 10, 12];

export function NuevaReserva() {
  const { business } = useAuth();
  return business?.type === "restaurante" ? <NuevaReservaRestaurante /> : <NuevaReservaCitas />;
}

function DateStrip({ tz, date, setDate }: { tz: string; date: string; setDate: (d: string) => void }) {
  const dates = Array.from({ length: 21 }, (_, i) => addDaysYmd(ymdInTz(new Date(), tz), i));
  return (
    <div className="flex gap-2 overflow-x-auto pb-2">
      {dates.map((ymd) => {
        const d = new Date(ymd + "T12:00:00");
        return (
          <button type="button" key={ymd} onClick={() => setDate(ymd)}
            className={`shrink-0 rounded-lg border px-3 py-2 text-center ${date === ymd ? "bg-brand-500 text-white border-brand-500" : "bg-white border-slate-200"}`}>
            <div className="text-[10px] uppercase opacity-80">{WEEKDAYS_SHORT_ES[weekdayInTz(d, tz)]}</div>
            <div className="font-bold">{ymd.slice(8)}</div>
          </button>
        );
      })}
    </div>
  );
}

function CustomerFields({ form, setForm }: { form: any; setForm: (f: any) => void }) {
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

function Done({ locator }: { locator: string }) {
  return (
    <div className="grid place-items-center py-20 text-center">
      <div className="card p-8">
        <div className="text-4xl">✅</div>
        <p className="font-semibold mt-2">Reserva creada</p>
        <p className="text-brand-600 font-bold text-xl mt-1">{locator}</p>
        <p className="text-sm text-slate-400 mt-2">Redirigiendo a la agenda…</p>
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

  const [serviceId, setServiceId] = useState("");
  const [date, setDate] = useState(ymdInTz(new Date(), tz));
  const [slots, setSlots] = useState<{ slot_start: string }[]>([]);
  const [slot, setSlot] = useState("");
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [form, setForm] = useState({ name: "", last_name: "", phone: "", email: "", notes: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  useEffect(() => {
    if (!serviceId || !date) { setSlots([]); return; }
    setLoadingSlots(true); setSlot("");
    (async () => {
      // Canal "manual": el staff no está sujeto al límite de antelación máxima
      // pensado para reservas web.
      const { data } = await supabase.rpc("get_available_slots", { p_business_id: bid, p_service_id: serviceId, p_date: date, p_channel: "manual" });
      setSlots((data as any[]) ?? []); setLoadingSlots(false);
    })();
  }, [serviceId, date, bid]);

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setError(null); setSaving(true);
    const { data, error } = await supabase.rpc("create_public_booking", {
      p_business_id: bid, p_service_id: serviceId, p_starts_at: slot,
      p_name: form.name.trim(), p_last_name: form.last_name.trim(),
      p_phone: form.phone.trim(), p_email: form.email.trim(),
      p_notes: form.notes.trim() || undefined, p_channel: "manual",
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
          <select className="input" value={serviceId} onChange={(e) => setServiceId(e.target.value)} required>
            <option value="">Selecciona un servicio…</option>
            {services?.map((s) => <option key={s.id} value={s.id}>{s.name} · {formatDuration(s.duration_min)}</option>)}
          </select>
          {serviceId && (
            <>
              <label className="label mt-4">Fecha</label>
              <DateStrip tz={tz} date={date} setDate={setDate} />
              <label className="label mt-2">Hora</label>
              {loadingSlots ? <Spinner /> : slots.length === 0 ? <p className="text-sm text-slate-400">No hay huecos ese día.</p> : (
                <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                  {slots.map((s) => (
                    <button type="button" key={s.slot_start} onClick={() => setSlot(s.slot_start)}
                      className={`rounded-lg border py-2 text-sm font-semibold ${slot === s.slot_start ? "bg-brand-500 text-white border-brand-500" : "bg-white border-slate-200"}`}>
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
                className={`w-11 h-11 rounded-lg border font-semibold ${party === n ? "bg-brand-500 text-white border-brand-500" : "bg-white border-slate-200"}`}>{n}</button>
            ))}
          </div>

          <label className="label mt-4">Fecha</label>
          <DateStrip tz={tz} date={date} setDate={setDate} />

          <label className="label mt-2">Hora</label>
          {loadingSlots ? <Spinner /> : grouped.length === 0 ? <p className="text-sm text-slate-400">No hay mesas ese día para {party} comensales.</p> : (
            grouped.map((g) => (
              <div key={g.name} className="mb-3">
                <div className="text-xs font-semibold text-slate-500 mb-1">{g.name}</div>
                <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                  {g.slots.map((s) => (
                    <button type="button" key={s.slot_start} onClick={() => setSlot(s)}
                      className={`rounded-lg border py-2 text-sm font-semibold ${slot?.slot_start === s.slot_start ? "bg-brand-500 text-white border-brand-500" : "bg-white border-slate-200"}`}>
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
