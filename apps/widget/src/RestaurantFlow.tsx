import { useEffect, useMemo, useState } from "react";
import {
  fetchDiningSlots, createBooking,
  type PublicBusiness, type DiningSlot, type BookingResult,
} from "./api";
import { formatDate, formatTime, WEEKDAYS_SHORT_ES, ymdInTz, weekdayInTz } from "@reservas/shared";

type Step = "party" | "when" | "form" | "done";
const PARTY_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 10, 12];

export function RestaurantFlow({ business, onLookup }: { business: PublicBusiness; onLookup: () => void }) {
  const tz = business.timezone;
  const [step, setStep] = useState<Step>("party");
  const [party, setParty] = useState(2);
  const [date, setDate] = useState("");
  const [slots, setSlots] = useState<DiningSlot[]>([]);
  const [loading, setLoading] = useState(false);
  const [slot, setSlot] = useState<DiningSlot | null>(null);
  const [result, setResult] = useState<BookingResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const dates = useMemo(() => {
    const out: { ymd: string; d: Date }[] = [];
    const now = new Date();
    const seen = new Set<string>();
    for (let i = 0; i < 21; i++) {
      const d = new Date(now.getTime() + i * 86400000);
      const ymd = ymdInTz(d, tz);
      if (!seen.has(ymd)) { seen.add(ymd); out.push({ ymd, d }); }
    }
    return out;
  }, [tz]);

  useEffect(() => {
    if (!date) return;
    setLoading(true); setSlot(null);
    fetchDiningSlots(business.id, date, party)
      .then(setSlots)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [date, party, business.id]);

  // Agrupa huecos por franja para mostrarlos con su nombre (Comida / Cena).
  const grouped = useMemo(() => {
    const map = new Map<string, { name: string; slots: DiningSlot[] }>();
    for (const s of slots) {
      if (!map.has(s.shift_id)) map.set(s.shift_id, { name: s.shift_name, slots: [] });
      map.get(s.shift_id)!.slots.push(s);
    }
    return [...map.values()];
  }, [slots]);

  const stepIndex = { party: 0, when: 1, form: 2, done: 3 }[step];

  return (
    <>
      <div className="steps">
        {[0, 1, 2].map((i) => <div key={i} className={`dot ${i <= stepIndex ? "active" : ""}`} />)}
      </div>
      {error && <div className="error">{error}</div>}

      {step === "party" && (
        <>
          <p className="section-title">¿Cuántos comensales?</p>
          <div className="slots">
            {PARTY_OPTIONS.map((n) => (
              <button key={n} className={`slot ${party === n ? "selected" : ""}`} onClick={() => setParty(n)}>
                {n}
              </button>
            ))}
          </div>
          <button className="btn" style={{ marginTop: 16 }} onClick={() => { setDate(dates[0].ymd); setStep("when"); }}>
            Continuar con {party} {party === 1 ? "persona" : "personas"}
          </button>
        </>
      )}

      {step === "when" && (
        <>
          <button className="back" onClick={() => setStep("party")}>← {party} comensales</button>
          <p className="section-title">Elige día y hora</p>
          <div className="dates">
            {dates.map(({ ymd, d }) => (
              <button key={ymd} className={`date-pill ${date === ymd ? "selected" : ""}`} onClick={() => setDate(ymd)}>
                <div className="dow">{WEEKDAYS_SHORT_ES[weekdayInTz(d, tz)]}</div>
                <div className="dom">{new Intl.DateTimeFormat("es-ES", { day: "numeric", timeZone: tz }).format(d)}</div>
                <div className="mon">{new Intl.DateTimeFormat("es-ES", { month: "short", timeZone: tz }).format(d)}</div>
              </button>
            ))}
          </div>

          {loading ? (
            <div className="empty"><span className="spinner" /></div>
          ) : grouped.length === 0 ? (
            <div className="empty">No hay mesas disponibles ese día para {party} comensales.</div>
          ) : (
            grouped.map((g) => (
              <div key={g.name} style={{ marginTop: 14 }}>
                <p className="hint" style={{ margin: "0 0 6px", fontWeight: 600 }}>{g.name}</p>
                <div className="slots">
                  {g.slots.map((s) => (
                    <button key={s.slot_start} className={`slot ${slot?.slot_start === s.slot_start ? "selected" : ""}`}
                      onClick={() => { setSlot(s); setStep("form"); }}>
                      {formatTime(s.slot_start, tz)}
                    </button>
                  ))}
                </div>
              </div>
            ))
          )}
        </>
      )}

      {step === "form" && slot && (
        <DiningForm
          business={business} party={party} slot={slot}
          onBack={() => setStep("when")} onError={setError}
          onDone={(r) => { setResult(r); setStep("done"); }}
        />
      )}

      {step === "done" && result && (
        <div className="center">
          <div className="ok-icon">✅</div>
          <p className="section-title" style={{ marginTop: 8 }}>¡Mesa reservada!</p>
          <p className="hint">Te hemos enviado un email con los detalles.</p>
          <div className="locator">{result.locator}</div>
          <div className="summary" style={{ textAlign: "left" }}>
            <div className="line"><span className="k">Comensales</span><span>{party}</span></div>
            <div className="line"><span className="k">Fecha</span><span>{formatDate(result.starts_at, tz)}</span></div>
            <div className="line"><span className="k">Hora</span><span>{formatTime(result.starts_at, tz)}</span></div>
          </div>
          <p className="hint">Guarda tu código localizador para consultar o cancelar tu reserva.</p>
        </div>
      )}

      {step !== "done" && (
        <div className="footer-link">
          <button onClick={onLookup}>¿Ya tienes una reserva? Consúltala aquí</button>
        </div>
      )}
    </>
  );
}

function DiningForm({ business, party, slot, onBack, onDone, onError }: {
  business: PublicBusiness; party: number; slot: DiningSlot;
  onBack: () => void; onDone: (r: BookingResult) => void; onError: (m: string | null) => void;
}) {
  const [name, setName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const valid = name.trim() && phone.trim() && /\S+@\S+\.\S+/.test(email);

  async function submit() {
    onError(null); setSaving(true);
    try {
      const r = await createBooking({
        business_id: business.id,
        dining_shift_id: slot.shift_id,
        party_size: party,
        starts_at: slot.slot_start,
        name: name.trim(), last_name: lastName.trim(),
        phone: phone.trim(), email: email.trim(),
        notes: notes.trim() || undefined,
      });
      onDone(r);
    } catch (e: any) {
      onError(e.message ?? "No se pudo completar la reserva.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <button className="back" onClick={onBack}>← Cambiar hora</button>
      <div className="summary">
        <div className="line"><span className="k">Comensales</span><span>{party}</span></div>
        <div className="line"><span className="k">Franja</span><span>{slot.shift_name}</span></div>
        <div className="line"><span className="k">Fecha</span><span>{formatDate(slot.slot_start, business.timezone)}</span></div>
        <div className="line"><span className="k">Hora</span><span>{formatTime(slot.slot_start, business.timezone)}</span></div>
      </div>
      <div className="row2">
        <div className="field"><label>Nombre *</label><input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre" /></div>
        <div className="field"><label>Apellidos</label><input value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Apellidos" /></div>
      </div>
      <div className="field"><label>Teléfono *</label><input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+34 600 000 000" inputMode="tel" /></div>
      <div className="field"><label>Email *</label><input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tu@email.com" inputMode="email" /></div>
      <div className="field"><label>Notas (opcional)</label><textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Alergias, trona, celebración…" /></div>
      <button className="btn" disabled={!valid || saving} onClick={submit}>{saving ? "Reservando…" : "Confirmar reserva"}</button>
    </>
  );
}
