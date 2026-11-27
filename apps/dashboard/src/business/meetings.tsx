// Reuniones de la Agenda: filas de `blocks` con kind = 'reunion', agrupadas por meeting_id.
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import { useBusinessId, useProfessionals } from "./hooks";
import { fromLocalInput, toLocalInput } from "../lib/datetime";
import { ymdInTz, formatTime, formatDate, blockReasonSchema, firstIssue } from "@reservas/shared";
import { Modal, ConfirmDialog } from "../components/ui";

export interface Meeting {
  id: string; // meeting_id
  title: string;
  starts_at: string;
  ends_at: string;
  allTeam: boolean;
  professionalIds: string[];
  rowIds: string[];
}

export function useMeetings(fromISO: string, toISO: string, enabled: boolean) {
  const bid = useBusinessId();
  return useQuery({
    queryKey: ["meetings", bid, fromISO, toISO],
    enabled: enabled && !!bid,
    queryFn: async () => {
      const { data, error } = await supabase.from("blocks")
        .select("id, meeting_id, reason, scope, professional_id, starts_at, ends_at")
        .eq("business_id", bid).eq("kind", "reunion")
        .lt("starts_at", toISO).gt("ends_at", fromISO).order("starts_at");
      if (error) throw error;
      const byId = new Map<string, Meeting>();
      for (const row of data) {
        const key = row.meeting_id ?? row.id;
        const m = byId.get(key) ?? {
          id: key, title: row.reason ?? "Reunión", starts_at: row.starts_at, ends_at: row.ends_at,
          allTeam: false, professionalIds: [], rowIds: [],
        };
        m.rowIds.push(row.id);
        if (row.scope === "business") m.allTeam = true;
        else if (row.professional_id) m.professionalIds.push(row.professional_id);
        byId.set(key, m);
      }
      return [...byId.values()];
    },
  });
}

export function attendeesLabel(m: Meeting, pros: { id: string; name: string }[] | undefined): string {
  if (m.allTeam) return "Todo el equipo";
  return m.professionalIds.map((id) => pros?.find((p) => p.id === id)?.name ?? "—").join(", ");
}

/** Crear (meeting = null), editar o borrar una reunión. Nunca toca las citas. */
export function MeetingModal({ meeting, defaultDay, tz, onClose }: {
  meeting: Meeting | null; defaultDay: string; tz: string; onClose: () => void;
}) {
  const bid = useBusinessId();
  const qc = useQueryClient();
  const { business } = useAuth();
  const { data: pros } = useProfessionals();
  const active = (pros ?? []).filter((p) => p.is_active);

  const startLocal = meeting ? toLocalInput(meeting.starts_at, tz) : "";
  const [title, setTitle] = useState(meeting?.title ?? "");
  const [day, setDay] = useState(meeting ? ymdInTz(new Date(meeting.starts_at), tz) : defaultDay);
  const [from, setFrom] = useState(meeting ? startLocal.slice(11) : "");
  const [to, setTo] = useState(meeting ? toLocalInput(meeting.ends_at, tz).slice(11) : "");
  const [allTeam, setAllTeam] = useState(meeting?.allTeam ?? true);
  const [ids, setIds] = useState<string[]>(meeting?.professionalIds ?? []);
  const [clashes, setClashes] = useState<string[]>([]);
  const [confirming, setConfirming] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startISO = day && from ? fromLocalInput(`${day}T${from}`, tz) : "";
  const endISO = day && to ? fromLocalInput(`${day}T${to}`, tz) : "";
  const validRange = !!startISO && !!endISO && endISO > startISO;
  const attendees = allTeam ? [] : ids;

  /** Citas activas de quienes asisten que coinciden con la reunión. */
  async function findClashes(): Promise<string[]> {
    if (!validRange || (!allTeam && attendees.length === 0)) return [];
    let q = supabase.from("bookings").select("starts_at, ends_at, customer_name, professionals(name)")
      .eq("business_id", bid).in("status", ["pendiente", "confirmada"])
      .lt("starts_at", endISO).gt("ends_at", startISO).order("starts_at");
    if (!allTeam) q = q.in("professional_id", attendees);
    const { data, error } = await q;
    if (error) return ["No se ha podido comprobar si coincide con alguna cita."];
    return (data as any[]).map((b) =>
      `${formatTime(b.starts_at, tz)}–${formatTime(b.ends_at, tz)} ${b.customer_name}${b.professionals?.name ? ` (${b.professionals.name})` : ""}`);
  }

  useEffect(() => {
    let cancelled = false;
    setClashes([]);
    findClashes().then((c) => { if (!cancelled) setClashes(c); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startISO, endISO, allTeam, ids.join(",")]);

  function validate(): string | null {
    if (!title.trim()) return "Escribe un título.";
    const parsed = blockReasonSchema.safeParse(title.trim());
    if (!parsed.success) return firstIssue(parsed.error);
    if (!validRange) return "Indica el día y una hora de fin posterior a la de inicio.";
    if (!allTeam && ids.length === 0) return "Marca quién asiste.";
    return null;
  }

  async function submit() {
    const problem = validate();
    setError(problem);
    if (problem) return;
    setBusy(true);
    const found = await findClashes();
    setBusy(false);
    setClashes(found);
    if (found.length > 0) { setConfirming(true); return; }
    await save();
  }

  function done() {
    qc.invalidateQueries();
    onClose();
  }

  async function save() {
    setConfirming(false); setBusy(true); setError(null);
    const base = {
      business_id: bid, kind: "reunion", meeting_id: meeting?.id ?? crypto.randomUUID(),
      reason: title.trim(), starts_at: startISO, ends_at: endISO, cancels_affected: false,
    };
    const targets: (string | null)[] = allTeam ? [null] : ids;
    const rows = targets.map((id) => ({
      ...base, scope: (id === null ? "business" : "professional") as "business" | "professional", professional_id: id,
    }));
    // Primero se crean las filas nuevas y después se borran las antiguas: si algo falla no se pierde la reunión.
    const { error: insErr } = await supabase.from("blocks").insert(rows);
    if (insErr) { setBusy(false); setError(insErr.message); return; }
    if (meeting) {
      const { error: delErr } = await supabase.from("blocks").delete().in("id", meeting.rowIds);
      if (delErr) { setBusy(false); setError(`Se ha guardado, pero no se pudo quitar la versión anterior: ${delErr.message}`); qc.invalidateQueries(); return; }
    }
    done();
  }

  async function remove() {
    if (!meeting) return;
    setRemoving(false); setBusy(true);
    const { error } = await supabase.from("blocks").delete().in("id", meeting.rowIds);
    if (error) { setBusy(false); setError(error.message); return; }
    done();
  }

  const psychology = business?.type === "psicologo";

  return (
    <Modal open onClose={onClose} title={meeting ? "Reunión" : "Nueva reunión"}>
      <div className="space-y-4">
        <div>
          <label className="label">Título</label>
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Reunión de equipo" />
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
            También se ve en el calendario de Google de quienes asisten{psychology ? ": no escribas nombres ni datos de pacientes" : ""}.
          </p>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div><label className="label">Día</label><input type="date" className="input" value={day} onChange={(e) => setDay(e.target.value)} /></div>
          <div><label className="label">Desde</label><input type="time" className="input" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
          <div><label className="label">Hasta</label><input type="time" className="input" value={to} onChange={(e) => setTo(e.target.value)} /></div>
        </div>
        {active.length > 0 && (
          <fieldset>
            <legend className="label">Quién asiste</legend>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={allTeam} onChange={(e) => setAllTeam(e.target.checked)} /> Todo el equipo
            </label>
            {!allTeam && (
              <div className="grid sm:grid-cols-2 gap-1.5 mt-2 pl-6">
                {active.map((p) => (
                  <label key={p.id} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={ids.includes(p.id)}
                      onChange={() => setIds((cur) => (cur.includes(p.id) ? cur.filter((x) => x !== p.id) : [...cur, p.id]))} />
                    {p.name}
                  </label>
                ))}
              </div>
            )}
          </fieldset>
        )}
        {validRange && <p className="text-xs text-slate-500 dark:text-slate-400">{formatDate(startISO, tz)} · ese horario no se podrá reservar con quienes asisten.</p>}
        {clashes.length > 0 && (
          <div className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            <div className="font-semibold">Coincide con citas (no se cancelan):</div>
            <ul>{clashes.map((c) => <li key={c}>{c}</li>)}</ul>
          </div>
        )}
        {error && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>}
        <div className="flex justify-between gap-2">
          {meeting ? <button type="button" className="btn-danger" disabled={busy} onClick={() => setRemoving(true)}>Eliminar</button> : <span />}
          <div className="flex gap-2">
            <button type="button" className="btn-ghost" onClick={onClose}>Cancelar</button>
            <button type="button" className="btn-primary" disabled={busy} onClick={submit}>{busy ? "Guardando…" : meeting ? "Guardar cambios" : "Crear reunión"}</button>
          </div>
        </div>
      </div>
      <ConfirmDialog
        open={confirming}
        title="Coincide con citas"
        message={`Hay ${clashes.length} cita(s) a esa hora. No se cancelarán.`}
        confirmLabel="Guardar de todos modos"
        onConfirm={save}
        onCancel={() => setConfirming(false)}
      />
      <ConfirmDialog
        open={removing}
        title="Eliminar reunión"
        message="¿Eliminar esta reunión? El horario volverá a estar disponible."
        onConfirm={remove}
        onCancel={() => setRemoving(false)}
      />
    </Modal>
  );
}
