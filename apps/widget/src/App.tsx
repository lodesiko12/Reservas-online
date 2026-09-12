import { useEffect, useMemo, useState } from "react";
import {
  fetchBusiness, fetchServices, fetchSlots, createBooking,
  type PublicBusiness, type PublicService, type Slot, type BookingResult,
} from "./api";
import {
  formatCurrency, formatDuration, formatDate, formatTime,
  WEEKDAYS_SHORT_ES, ymdInTz, weekdayInTz,
} from "@reservas/shared";
import { Lookup } from "./Lookup";
import { RestaurantFlow } from "./RestaurantFlow";

type Props = { slug: string; initialView: "booking" | "lookup"; initialLocator: string };

function applyBranding(color: string) {
  document.documentElement.style.setProperty("--primary", color);
}

export default function App({ slug, initialView, initialLocator }: Props) {
  const [business, setBusiness] = useState<PublicBusiness | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [view, setView] = useState<"booking" | "lookup">(initialView);

  useEffect(() => {
    if (!slug) { setLoadErr("Falta el identificador del negocio (slug)."); return; }
    fetchBusiness(slug)
      .then((b) => {
        if (!b) { setLoadErr("Negocio no encontrado o inactivo."); return; }
        setBusiness(b);
        applyBranding(b.primary_color);
      })
      .catch((e) => setLoadErr(e.message ?? "Error al cargar el negocio."));
  }, [slug]);

  if (loadErr) return <div className="widget"><div className="error">{loadErr}</div></div>;
  if (!business) return <div className="widget center"><span className="spinner" /></div>;

  return (
    <div className="widget">
      <div className="brand">
        {business.logo_url && <img src={business.logo_url} alt={business.name} />}
        <div>
          <h1>{business.name}</h1>
          <p className="sub">{view === "lookup" ? "Consulta tu reserva" : "Reserva online"}</p>
        </div>
      </div>

      {view === "lookup" ? (
        <Lookup initialLocator={initialLocator} onBack={() => setView("booking")} />
      ) : business.type === "restaurante" ? (
        <RestaurantFlow business={business} onLookup={() => setView("lookup")} />
      ) : (
        <BookingFlow business={business} onLookup={() => setView("lookup")} />
      )}

      <p className="powered">Reservas · powered by tu SaaS</p>
    </div>
  );
}

type Step = "service" | "when" | "form" | "done";

function BookingFlow({ business, onLookup }: { business: PublicBusiness; onLookup: () => void }) {
  const tz = business.timezone;
  const [step, setStep] = useState<Step>("service");
  const [services, setServices] = useState<PublicService[]>([]);
  const [service, setService] = useState<PublicService | null>(null);
  const [date, setDate] = useState<string>("");     // YYYY-MM-DD en tz del negocio
  const [slots, setSlots] = useState<Slot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slot, setSlot] = useState<Slot | null>(null);
  const [result, setResult] = useState<BookingResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Próximos 21 días como opciones de fecha.
  const dates = useMemo(() => {
    const out: { ymd: string; d: Date }[] = [];
    const now = new Date();
    for (let i = 0; i < 21; i++) {
      const d = new Date(now.getTime() + i * 86400000);
      out.push({ ymd: ymdInTz(d, tz), d });
    }
    // dedupe por si el offset de tz solapa
    const seen = new Set<string>();
    return out.filter((o) => (seen.has(o.ymd) ? false : (seen.add(o.ymd), true)));
  }, [tz]);

  useEffect(() => {
    fetchServices(business.id).then(setServices).catch((e) => setError(e.message));
  }, [business.id]);

  useEffect(() => {
    if (!service || !date) return;
    setSlotsLoading(true);
    setSlot(null);
    fetchSlots(business.id, service.id, date)
      .then(setSlots)
      .catch((e) => setError(e.message))
      .finally(() => setSlotsLoading(false));
  }, [service, date, business.id]);

  const stepIndex = { service: 0, when: 1, form: 2, done: 3 }[step];

  return (
    <>
      <div className="steps">
        {[0, 1, 2].map((i) => <div key={i} className={`dot ${i <= stepIndex ? "active" : ""}`} />)}
      </div>

      {error && <div className="error">{error}</div>}

      {step === "service" && (
        <>
          <p className="section-title">Elige un servicio</p>
          {services.length === 0 ? (
            <div className="empty"><span className="spinner" /></div>
          ) : (
            <div className="list">
              {services.map((s) => (
                <button
                  key={s.id}
                  className={`card-btn ${service?.id === s.id ? "selected" : ""}`}
                  onClick={() => { setService(s); setError(null); setStep("when"); }}
                >
                  <div>
                    <div className="name">{s.name}</div>
                    <div className="meta">
                      {formatDuration(s.duration_min)}
                      {s.professional_name ? ` · ${s.professional_name}` : ""}
                    </div>
                  </div>
                  {s.price != null && <div className="price">{formatCurrency(s.price)}</div>}
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {step === "when" && service && (
        <>
          <button className="back" onClick={() => setStep("service")}>← Cambiar servicio</button>
          <p className="section-title">Elige día y hora · {service.name}</p>
          <div className="dates">
            {dates.map(({ ymd, d }) => {
              const wd = weekdayInTz(d, tz);
              const dom = new Intl.DateTimeFormat("es-ES", { day: "numeric", timeZone: tz }).format(d);
              const mon = new Intl.DateTimeFormat("es-ES", { month: "short", timeZone: tz }).format(d);
              return (
                <button
                  key={ymd}
                  className={`date-pill ${date === ymd ? "selected" : ""}`}
                  onClick={() => setDate(ymd)}
                >
                  <div className="dow">{WEEKDAYS_SHORT_ES[wd]}</div>
                  <div className="dom">{dom}</div>
                  <div className="mon">{mon}</div>
                </button>
              );
            })}
          </div>

          {!date ? (
            <p className="hint" style={{ marginTop: 14 }}>Selecciona una fecha para ver los huecos disponibles.</p>
          ) : slotsLoading ? (
            <div className="empty"><span className="spinner" /></div>
          ) : slots.length === 0 ? (
            <div className="empty">No hay huecos disponibles ese día. Prueba otra fecha.</div>
          ) : (
            <div className="slots">
              {slots.map((s) => (
                <button
                  key={s.slot_start}
                  className={`slot ${slot?.slot_start === s.slot_start ? "selected" : ""}`}
                  onClick={() => { setSlot(s); setStep("form"); }}
                >
                  {formatTime(s.slot_start, tz)}
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {step === "form" && service && slot && (
        <FormStep
          business={business}
          service={service}
          slot={slot}
          onBack={() => setStep("when")}
          onError={setError}
          onDone={(r) => { setResult(r); setStep("done"); }}
        />
      )}

      {step === "done" && result && (
        <div className="center">
          <div className="ok-icon">✅</div>
          <p className="section-title" style={{ marginTop: 8 }}>¡Reserva confirmada!</p>
          <p className="hint">Te hemos enviado un email con los detalles.</p>
          <div className="locator">{result.locator}</div>
          <div className="summary" style={{ textAlign: "left" }}>
            <div className="line"><span className="k">Servicio</span><span>{result.service_name}</span></div>
            <div className="line"><span className="k">Fecha</span><span>{formatDate(result.starts_at, business.timezone)}</span></div>
            <div className="line"><span className="k">Hora</span><span>{formatTime(result.starts_at, business.timezone)}</span></div>
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

function FormStep({
  business, service, slot, onBack, onDone, onError,
}: {
  business: PublicBusiness;
  service: PublicService;
  slot: Slot;
  onBack: () => void;
  onDone: (r: BookingResult) => void;
  onError: (m: string | null) => void;
}) {
  const [name, setName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const valid = name.trim() && phone.trim() && /\S+@\S+\.\S+/.test(email);

  async function submit() {
    onError(null);
    setSaving(true);
    try {
      const r = await createBooking({
        business_id: business.id,
        service_id: service.id,
        starts_at: slot.slot_start,
        name: name.trim(),
        last_name: lastName.trim(),
        phone: phone.trim(),
        email: email.trim(),
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
        <div className="line"><span className="k">Servicio</span><span>{service.name}</span></div>
        <div className="line"><span className="k">Duración</span><span>{formatDuration(service.duration_min)}</span></div>
        <div className="line"><span className="k">Fecha</span><span>{formatDate(slot.slot_start, business.timezone)}</span></div>
        <div className="line"><span className="k">Hora</span><span>{formatTime(slot.slot_start, business.timezone)}</span></div>
      </div>

      <div className="row2">
        <div className="field">
          <label>Nombre *</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre" />
        </div>
        <div className="field">
          <label>Apellidos</label>
          <input value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Apellidos" />
        </div>
      </div>
      <div className="field">
        <label>Teléfono *</label>
        <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+34 600 000 000" inputMode="tel" />
      </div>
      <div className="field">
        <label>Email *</label>
        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tu@email.com" inputMode="email" />
      </div>
      <div className="field">
        <label>Notas (opcional)</label>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Algo que debamos saber" />
      </div>

      <button className="btn" disabled={!valid || saving} onClick={submit}>
        {saving ? "Confirmando…" : "Confirmar reserva"}
      </button>
    </>
  );
}
