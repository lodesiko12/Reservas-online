import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import {
  useBusinessId, useDiningZones, useDiningTables, useDiningTableCombos, useDiningShifts,
  useBookings, useBookingsRealtime, useWaitlist, type Booking, type WaitlistEntry,
} from "./hooks";
import { ymdInTz, zonedDayRange, weekdayInTz, minutesOfDayInTz, formatTime, waitlistEntrySchema, PARTY_SIZE_OPTIONS } from "@reservas/shared";
import { PageHeader, Spinner, Modal, EmptyState } from "../components/ui";

type Row = Booking & { dining_tables: { name: string } | null; dining_table_combos: { name: string | null } | null };

const PARTY_OPTIONS = PARTY_SIZE_OPTIONS;

type Health = "libre" | "reservada_pronto" | "reservada_ahora" | "retrasada" | "sentada" | "a_punto_terminar";

const HEALTH_STYLE: Record<Health, { bg: string; border: string; text: string; label: string }> = {
  libre: { bg: "bg-white dark:bg-slate-800", border: "border-slate-200 dark:border-slate-700", text: "text-slate-400 dark:text-slate-500", label: "Libre" },
  reservada_pronto: { bg: "bg-sky-50", border: "border-sky-300", text: "text-sky-700", label: "Reservada" },
  reservada_ahora: { bg: "bg-blue-50", border: "border-blue-400", text: "text-blue-700", label: "Debería llegar" },
  retrasada: { bg: "bg-red-50", border: "border-red-400", text: "text-red-700", label: "Retrasada" },
  sentada: { bg: "bg-emerald-50", border: "border-emerald-400", text: "text-emerald-700", label: "Sentada" },
  a_punto_terminar: { bg: "bg-amber-50", border: "border-amber-400", text: "text-amber-700", label: "A punto de terminar" },
};

export function PlanoSala() {
  const bid = useBusinessId();
  const { business } = useAuth();
  const tz = business?.timezone ?? "Europe/Madrid";
  const qc = useQueryClient();
  useBookingsRealtime();

  const { data: zones, isLoading: loadingZones } = useDiningZones();
  const { data: tables, isLoading: loadingTables } = useDiningTables();
  const { data: combos } = useDiningTableCombos();
  const { data: shifts } = useDiningShifts();

  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 5000);
    return () => clearInterval(id);
  }, []);

  const todayYmd = ymdInTz(now, tz);
  const [from, to] = zonedDayRange(todayYmd, tz);
  const { data: bookings, isLoading: loadingBookings } = useBookings(from, to);
  // Refresca el reloj en cuanto llegan datos nuevos (walk-in recién creado,
  // cambio de otro dispositivo vía realtime…) para no mostrar un estado
  // caducado por unos segundos.
  useEffect(() => { setNow(new Date()); }, [bookings]);

  const currentShift = useMemo(() => {
    if (!shifts) return null;
    const dow = weekdayInTz(now, tz);
    const nowMin = minutesOfDayInTz(now.toISOString(), tz);
    return shifts.find((s) => {
      if (!s.is_active || !s.active_weekdays.includes(dow)) return false;
      const [sh, sm] = s.start_time.split(":").map(Number);
      const [eh, em] = s.end_time.split(":").map(Number);
      return nowMin >= sh * 60 + sm && nowMin < eh * 60 + em;
    }) ?? null;
  }, [shifts, now, tz]);

  // Turno al que se asocia un walk-in. Si no hay ninguno en curso (p.ej. la comida
  // aún no ha empezado) se usa el siguiente del día, o el último ya terminado, y como
  // último recurso cualquier turno activo: sentar a mano debe ser posible siempre.
  const seatShift = useMemo(() => {
    if (currentShift) return currentShift;
    const active = (shifts ?? []).filter((s) => s.is_active);
    if (!active.length) return null;
    const dow = weekdayInTz(now, tz);
    const nowMin = minutesOfDayInTz(now.toISOString(), tz);
    const startMin = (s: (typeof active)[number]) => { const [h, m] = s.start_time.split(":").map(Number); return h * 60 + m; };
    const today = active.filter((s) => s.active_weekdays.includes(dow)).sort((a, b) => startMin(a) - startMin(b));
    return today.find((s) => startMin(s) > nowMin) ?? today[today.length - 1] ?? active[0];
  }, [shifts, currentShift, now, tz]);

  const { data: durationRules } = useQuery({
    queryKey: ["dining_duration_rules_all", bid],
    enabled: !!bid,
    queryFn: async () => {
      const { data, error } = await supabase.from("dining_duration_rules").select("dining_shift_id, duration_min");
      if (error) throw error;
      return data;
    },
  });

  // Minutos mínimos que necesita cualquier grupo sentado ahora (la duración más corta
  // del turno + limpieza). Si la siguiente reserva de una mesa empieza antes, no cabe
  // ningún walk-in y esa reserva ya se muestra para poder sentarla.
  const minSeatMinutes = useMemo(() => {
    if (!seatShift) return 30;
    const durations = [seatShift.booking_duration_min, ...(durationRules ?? []).filter((r) => r.dining_shift_id === seatShift.id).map((r) => r.duration_min)];
    return Math.min(...durations) + (seatShift.cleanup_min ?? 0);
  }, [seatShift, durationRules]);

  // Reservas activas (no canceladas/no-show) por mesa, incluidas las de combinaciones.
  const byTable = useMemo(() => {
    const map = new Map<string, Row[]>();
    for (const b of (bookings ?? []) as Row[]) {
      if (b.type !== "restaurante" || !["confirmada", "pendiente", "sentada"].includes(b.status)) continue;
      if (b.dining_table_id) {
        (map.get(b.dining_table_id) ?? map.set(b.dining_table_id, []).get(b.dining_table_id)!).push(b);
      } else if (b.table_combo_id) {
        const combo = combos?.find((c) => c.id === b.table_combo_id);
        for (const tid of combo?.table_ids ?? []) {
          (map.get(tid) ?? map.set(tid, []).get(tid)!).push(b);
        }
      }
    }
    for (const list of map.values()) list.sort((a, b) => a.starts_at.localeCompare(b.starts_at));
    return map;
  }, [bookings, combos]);

  function tableHealth(tableId: string): { health: Health; booking: Row | null; next?: Row | null } {
    const list = byTable.get(tableId) ?? [];
    const nowMs = now.getTime();
    const current = list.find((b) => new Date(b.starts_at).getTime() <= nowMs && nowMs < new Date(b.ends_at).getTime());
    if (current) {
      if (current.status === "sentada") {
        const minsLeft = (new Date(current.ends_at).getTime() - nowMs) / 60000;
        return { health: minsLeft <= 15 ? "a_punto_terminar" : "sentada", booking: current };
      }
      const minsLate = (nowMs - new Date(current.starts_at).getTime()) / 60000;
      return { health: minsLate > 15 ? "retrasada" : "reservada_ahora", booking: current };
    }
    const next = list.find((b) => new Date(b.starts_at).getTime() > nowMs) ?? null;
    if (next && (new Date(next.starts_at).getTime() - nowMs) / 60000 < minSeatMinutes) {
      return { health: "reservada_pronto", booking: next, next };
    }
    return { health: "libre", booking: null, next };
  }

  async function setStatus(booking: Row, status: Booking["status"]) {
    await supabase.from("bookings").update({ status }).eq("id", booking.id);
    qc.invalidateQueries({ queryKey: ["bookings", bid] });
  }

  const [walkinTable, setWalkinTable] = useState<{ id: string; name: string } | null>(null);

  const tablesByZone = new Map<string | null, typeof tables>();
  for (const t of tables ?? []) {
    if (!t.is_active) continue;
    tablesByZone.set(t.zone_id, [...(tablesByZone.get(t.zone_id) ?? []), t]);
  }

  const isLoading = loadingZones || loadingTables || loadingBookings;

  return (
    <div>
      <PageHeader title="Plano de sala" subtitle={`Estado en vivo · ${currentShift ? currentShift.name : "sin turno activo ahora"}`} />

      {isLoading ? (
        <div className="grid place-items-center py-20"><Spinner /></div>
      ) : !tables?.length ? (
        <EmptyState title="Sin mesas configuradas" hint="Da de alta tus mesas en “Mesas y zonas” para ver el plano en vivo." />
      ) : (
        <div className="space-y-6">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {seatShift
              ? "Toca una mesa libre para sentar a clientes sin reserva."
              : "El negocio no tiene ninguna franja de servicio activa, así que no se puede sentar a clientes sin reserva. Configúrala en “Franjas”."}
          </p>
          {[...(zones ?? []).map((z) => z.id), null].map((zoneId) => {
            const list = tablesByZone.get(zoneId) ?? [];
            if (!list.length) return null;
            const zoneName = zoneId ? zones?.find((z) => z.id === zoneId)?.name : "Sin zona";
            return (
              <div key={zoneId ?? "none"}>
                <h3 className="font-semibold text-sm text-slate-500 dark:text-slate-400 mb-2">{zoneName}</h3>
                <div className="grid sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                  {list.map((t) => {
                    const { health, booking, next } = tableHealth(t.id);
                    const st = HEALTH_STYLE[health];
                    const canSeatNow = health === "libre" && !!seatShift;
                    return (
                      <div key={t.id} className={`rounded-xl border-2 p-3 ${st.bg} ${st.border} ${canSeatNow ? "cursor-pointer hover:border-emerald-400" : ""}`}
                        onClick={canSeatNow ? () => setWalkinTable({ id: t.id, name: t.name }) : undefined}>
                        <div className="flex items-start justify-between">
                          <div className="font-semibold">{t.name}</div>
                          <span className={`text-[11px] font-semibold ${st.text}`}>{st.label}</span>
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">{t.cap_min === t.cap_max ? `${t.cap_min} pers.` : `${t.cap_min}–${t.cap_max} pers.`}</div>

                        {booking ? (
                          <div className="mt-2 text-xs">
                            <div className="font-medium truncate">{booking.customer_name} · {booking.party_size} pers.</div>
                            <div className="text-slate-500 dark:text-slate-400">{formatTime(booking.starts_at, tz)} – {formatTime(booking.ends_at, tz)}</div>
                          </div>
                        ) : (
                          <div className="mt-2 text-xs text-slate-400 dark:text-slate-500">{next ? `Próxima reserva a las ${formatTime(next.starts_at, tz)}` : "Sin reservas próximas"}</div>
                        )}

                        <div className="mt-3 flex flex-wrap gap-1.5" onClick={(e) => e.stopPropagation()}>
                          {booking && (booking.status === "confirmada" || booking.status === "pendiente") && (
                            <button className="btn-ghost text-xs" onClick={() => setStatus(booking, "sentada")}>Sentar</button>
                          )}
                          {booking && (booking.status === "confirmada" || booking.status === "pendiente") && (
                            <button className="btn-ghost text-xs" onClick={() => setStatus(booking, "no_show")}>No-show</button>
                          )}
                          {booking && booking.status === "sentada" && (
                            <button className="btn-ghost text-xs" onClick={() => setStatus(booking, "completada")}>Liberar mesa</button>
                          )}
                          {health === "libre" && (
                            <button className="btn-primary text-xs" disabled={!seatShift}
                              title={seatShift ? undefined : "El negocio no tiene ninguna franja de servicio activa"}
                              onClick={() => setWalkinTable({ id: t.id, name: t.name })}>Sentar clientes</button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {walkinTable && seatShift && (
        <WalkinModal
          bid={bid} shiftId={seatShift.id} table={walkinTable}
          onClose={() => setWalkinTable(null)}
          onDone={() => { qc.invalidateQueries({ queryKey: ["bookings", bid] }); setWalkinTable(null); }}
        />
      )}

      <WaitlistSection bid={bid} currentShiftId={seatShift?.id ?? null} />
    </div>
  );
}

function WaitlistSection({ bid, currentShiftId }: { bid: string; currentShiftId: string | null }) {
  const qc = useQueryClient();
  const { data: waitlist, isLoading } = useWaitlist();
  const { data: zones } = useDiningZones();
  const [adding, setAdding] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function invalidate() { qc.invalidateQueries({ queryKey: ["waitlist", bid] }); }

  async function notify(entry: WaitlistEntry) {
    setBusyId(entry.id); setError(null);
    const { error } = await supabase.functions.invoke("notify-waitlist", { body: { waitlist_id: entry.id } });
    setBusyId(null);
    if (error) {
      let msg = error.message;
      try {
        const ctx = (error as any).context;
        if (ctx && typeof ctx.json === "function") {
          const j = await ctx.json();
          if (j?.error) msg = j.error;
        }
      } catch { /* noop */ }
      setError(msg);
      return;
    }
    invalidate();
  }

  async function cancel(entry: WaitlistEntry) {
    setBusyId(entry.id);
    await supabase.from("waitlist").update({ status: "cancelado" }).eq("id", entry.id);
    setBusyId(null); invalidate();
  }

  async function seat(entry: WaitlistEntry) {
    if (!currentShiftId) return;
    setBusyId(entry.id); setError(null);
    const { data, error } = await supabase.rpc("create_walkin_booking", {
      p_business_id: bid, p_shift_id: currentShiftId, p_party_size: entry.party_size,
      p_name: entry.name, p_phone: entry.phone ?? undefined, p_notes: entry.notes ?? undefined,
    });
    if (error) { setBusyId(null); setError(error.message); return; }
    await supabase.from("waitlist").update({ status: "sentado", seated_booking_id: (data as any).id }).eq("id", entry.id);
    setBusyId(null); invalidate();
    qc.invalidateQueries({ queryKey: ["bookings", bid] });
  }

  return (
    <div className="mt-8">
      <PageHeader title="Lista de espera" subtitle="Clientes sin mesa libre ahora mismo"
        actions={<button className="btn-primary" onClick={() => setAdding(true)}>+ Añadir</button>} />
      {error && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-3">{error}</div>}
      {isLoading ? <Spinner /> : !waitlist?.length ? (
        <EmptyState title="Sin nadie en espera" />
      ) : (
        <div className="card divide-y divide-slate-100 dark:divide-slate-800">
          {waitlist.map((w) => (
            <div key={w.id} className="flex items-center gap-4 px-5 py-3">
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{w.name} · {w.party_size} pers.</div>
                <div className="text-xs text-slate-500 dark:text-slate-400">Zona: {(w.zone_id && zones?.find((z) => z.id === w.zone_id)?.name) || "cualquiera"} · {w.phone ?? "sin teléfono"}{w.notes ? ` · ${w.notes}` : ""}</div>
              </div>
              <span className={`badge text-[11px] ${w.status === "avisado" ? "bg-amber-100 text-amber-700" : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400"}`}>
                {w.status === "avisado" ? "Avisado" : "Esperando"}
              </span>
              <div className="flex gap-1.5 shrink-0">
                {w.phone && w.status === "esperando" && (
                  <button className="btn-ghost text-xs" disabled={busyId === w.id} onClick={() => notify(w)}>Avisar</button>
                )}
                <button className="btn-ghost text-xs" disabled={busyId === w.id || !currentShiftId} onClick={() => seat(w)}>Sentar</button>
                <button className="btn-ghost text-xs" disabled={busyId === w.id} onClick={() => cancel(w)}>Cancelar</button>
              </div>
            </div>
          ))}
        </div>
      )}
      {adding && <AddWaitlistModal bid={bid} zones={(zones ?? []).filter((z) => z.is_active)} onClose={() => setAdding(false)} onDone={() => { invalidate(); setAdding(false); }} />}
    </div>
  );
}

function AddWaitlistModal({ bid, zones, onClose, onDone }: { bid: string; zones: { id: string; name: string }[]; onClose: () => void; onDone: () => void }) {
  const [name, setName] = useState("");
  const [zoneId, setZoneId] = useState("");
  const [phone, setPhone] = useState("");
  const [party, setParty] = useState(2);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setError(null);
    const result = waitlistEntrySchema.safeParse({ name, phone, notes });
    if (!result.success) { setError(result.error.issues[0]?.message ?? "Revisa los datos."); return; }
    setBusy(true);
    const v = result.data;
    await supabase.from("waitlist").insert({
      business_id: bid, name: v.name ?? "Cliente", phone: v.phone ?? null,
      party_size: party, notes: v.notes ?? null, zone_id: zoneId || null,
    });
    setBusy(false); onDone();
  }

  return (
    <Modal open onClose={onClose} title="Añadir a la lista de espera">
      <div className="space-y-4">
        <div>
          <label className="label">Comensales</label>
          <div className="flex flex-wrap gap-2">
            {PARTY_OPTIONS.map((n) => (
              <button type="button" key={n} onClick={() => setParty(n)}
                className={`w-10 h-10 rounded-lg border font-semibold ${party === n ? "bg-brand-500 text-white border-brand-500" : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700"}`}>{n}</button>
            ))}
          </div>
        </div>
        {zones.length > 0 && (
          <div>
            <label className="label">Zona preferida</label>
            <select className="input" value={zoneId} onChange={(e) => setZoneId(e.target.value)}>
              <option value="">Cualquiera</option>
              {zones.map((z) => <option key={z.id} value={z.id}>{z.name}</option>)}
            </select>
          </div>
        )}
        <div><label className="label">Nombre</label><input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre del cliente" /></div>
        <div><label className="label">Teléfono (para avisar por WhatsApp)</label><input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
        <div><label className="label">Notas (opcional)</label><input className="input" value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
        {error && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>}
        <div className="flex justify-end gap-2"><button className="btn-ghost" onClick={onClose}>Cancelar</button><button className="btn-primary" disabled={busy} onClick={save}>Añadir</button></div>
      </div>
    </Modal>
  );
}

function WalkinModal({ bid, shiftId, table, onClose, onDone }: {
  bid: string; shiftId: string; table: { id: string; name: string }; onClose: () => void; onDone: () => void;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [details, setDetails] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Un toque en el número de comensales sienta al grupo en la mesa. Nombre y
  // teléfono son opcionales y quedan plegados para no frenar al camarero.
  async function seat(party: number) {
    setError(null);
    const result = waitlistEntrySchema.safeParse({ name, phone, notes: "" });
    if (!result.success) { setError(result.error.issues[0]?.message ?? "Revisa los datos."); setDetails(true); return; }
    setBusy(true);
    const v = result.data;
    const { error } = await supabase.rpc("create_walkin_booking", {
      p_business_id: bid, p_shift_id: shiftId, p_party_size: party,
      p_name: v.name ?? "Walk-in", p_phone: v.phone ?? undefined, p_table_id: table.id,
    });
    setBusy(false);
    if (error) { setError(error.message); return; }
    onDone();
  }

  return (
    <Modal open onClose={onClose} title={`Sentar clientes · ${table.name}`}>
      <div className="space-y-4">
        <div>
          <label className="label">¿Cuántos son? Toca un número para sentarlos</label>
          <div className="flex flex-wrap gap-2">
            {PARTY_OPTIONS.map((n) => (
              <button type="button" key={n} disabled={busy} onClick={() => seat(n)}
                className="w-12 h-12 rounded-lg border font-semibold text-lg bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:bg-emerald-50 hover:border-emerald-400 disabled:opacity-50">{n}</button>
            ))}
          </div>
        </div>
        {details ? (
          <>
            <div><label className="label">Nombre (opcional)</label><input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre del cliente" /></div>
            <div><label className="label">Teléfono (opcional)</label><input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
          </>
        ) : (
          <button type="button" className="text-xs text-brand-600 underline" onClick={() => setDetails(true)}>Añadir nombre o teléfono (opcional)</button>
        )}
        {error && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>}
        <div className="flex justify-end"><button className="btn-ghost" onClick={onClose}>Cancelar</button></div>
      </div>
    </Modal>
  );
}
