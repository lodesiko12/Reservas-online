import type React from "react";
import { interpolate } from "remotion";
import { BRAND } from "../brand";
import { clamp } from "../lib/anim";
import { FONT } from "../theme";

/**
 * Pantallas del panel de psicólogo (Seguimiento, formulario de sesión, historial del paciente),
 * reconstruidas con los textos y estilos reales de la app. Sin estado: reciben lo que hay que mostrar
 * (texto ya "tecleado", escala de pulsación) para poder usarlas en vídeo y en carrusel.
 */

const INK = "#0F2A2A";
const MUTED = "#64748B";
const LINE = "#D9E4E2";

export type Appointment = { name: string; service: string; time: string; pro: string };

/** Toque (punto + anillo) centrado en su contenedor; `t` = frames desde el toque (negativo = el dedo se acerca). */
export const Ripple: React.FC<{ t: number }> = ({ t }) => {
  if (t < -4 || t > 16) return null;
  const dot = interpolate(t, [-4, 0, 6, 12], [0, 1, 1, 0], clamp);
  const ring = interpolate(t, [0, 16], [0.4, 1.8], clamp);
  return (
    <>
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          width: 68,
          height: 68,
          marginLeft: -34,
          marginTop: -34,
          borderRadius: 999,
          background: "rgba(255,107,74,0.35)",
          border: `4px solid ${BRAND.accent}`,
          opacity: dot,
          scale: String(interpolate(t, [-4, 0, 3], [1.4, 0.9, 1], clamp)),
        }}
      />
      {t >= 0 ? (
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            width: 120,
            height: 120,
            marginLeft: -60,
            marginTop: -60,
            borderRadius: 999,
            border: `6px solid ${BRAND.accent}`,
            scale: String(ring),
            opacity: interpolate(t, [0, 16], [0.9, 0], clamp),
          }}
        />
      ) : null}
    </>
  );
};

const Btn: React.FC<{ label: string; primary?: boolean; press?: number; w?: number; ripple?: number }> = ({ label, primary, press = 1, w, ripple }) => (
  <div style={{ position: "relative", display: "inline-block" }}>
  <div
    style={{
      display: "inline-grid",
      placeItems: "center",
      height: 72,
      minWidth: w,
      padding: "0 34px",
      boxSizing: "border-box",
      borderRadius: 36,
      fontFamily: FONT,
      fontSize: 31,
      fontWeight: 800,
      background: primary ? BRAND.color : "#fff",
      color: primary ? "#fff" : INK,
      border: primary ? "none" : `3px solid ${LINE}`,
      scale: String(press),
    }}
  >
    {label}
  </div>
  {ripple !== undefined ? <Ripple t={ripple} /> : null}
  </div>
);

const ApptCard: React.FC<{ a: Appointment; button: React.ReactNode }> = ({ a, button }) => (
  <div style={{ borderRadius: 30, background: "#fff", border: `2px solid #E6EEEC`, boxShadow: "0 4px 18px rgba(15,42,42,0.07)", padding: "30px 34px 32px" }}>
    <div style={{ fontSize: 44, fontWeight: 800, color: INK, lineHeight: 1.1 }}>{a.name}</div>
    <div style={{ fontSize: 31, color: "#4A6362", marginTop: 8 }}>
      {a.service} · {a.time}
    </div>
    <div style={{ fontSize: 25, color: "#8CA3A1", marginTop: 6 }}>{a.pro}</div>
    <div style={{ marginTop: 22 }}>{button}</div>
  </div>
);

/** Pantalla "Seguimiento": la cita en curso y la siguiente. */
export const SeguimientoScreen: React.FC<{ current: Appointment; next: Appointment; pressStart?: number; rippleStart?: number; style?: React.CSSProperties }> = ({
  current,
  next,
  pressStart = 1,
  rippleStart,
  style,
}) => (
  <div
    style={{
      width: 900,
      boxSizing: "border-box",
      borderRadius: 40,
      background: "#F3F7F6",
      padding: "40px 40px 44px",
      fontFamily: FONT,
      boxShadow: "0 2px 4px rgba(15,42,42,0.12), 0 40px 100px rgba(0,0,0,0.45)",
      ...style,
    }}
  >
    <div style={{ fontSize: 56, fontWeight: 900, color: INK, letterSpacing: -0.5 }}>Seguimiento</div>
    <div style={{ fontSize: 30, color: "#4A6362", marginTop: 2 }}>La cita en curso y la siguiente</div>
    <div style={{ fontSize: 29, color: "#4A6362", marginTop: 30, marginBottom: 12, fontWeight: 600 }}>En curso</div>
    <ApptCard a={current} button={<Btn label="Empezar cita" primary press={pressStart} ripple={rippleStart} />} />
    <div style={{ fontSize: 29, color: "#4A6362", marginTop: 30, marginBottom: 12, fontWeight: 600 }}>Siguiente</div>
    <ApptCard a={next} button={<Btn label="Apuntar notas" />} />
  </div>
);

export type SessionFields = { objective: string; notes: string; followUp: string; tasks: string };

const TextArea: React.FC<{ label: string; placeholder: string; value: string; height: number; active?: boolean }> = ({
  label,
  placeholder,
  value,
  height,
  active,
}) => (
  <div style={{ marginTop: 16 }}>
    <div style={{ fontSize: 26, fontWeight: 600, color: INK, marginBottom: 6 }}>{label}</div>
    <div
      style={{
        height,
        boxSizing: "border-box",
        borderRadius: 18,
        border: `3px solid ${active ? BRAND.color : LINE}`,
        boxShadow: active ? `0 0 0 6px color-mix(in srgb, ${BRAND.color} 22%, transparent)` : undefined,
        padding: "10px 20px",
        fontSize: 28,
        lineHeight: 1.25,
        fontWeight: value ? 700 : 600,
        color: value ? INK : "#9AA7A6",
        overflow: "hidden",
      }}
    >
      {value || placeholder}
      {active && value ? <span style={{ color: BRAND.color }}>|</span> : null}
    </div>
  </div>
);

/** Modal "Sesión · <nombre>" con los cuatro campos del historial. */
export const SessionForm: React.FC<{
  firstName: string;
  typed: SessionFields;
  /** Campo con el cursor (0-3) o -1. */
  activeField?: number;
  pressSave?: number;
  rippleSave?: number;
  style?: React.CSSProperties;
}> = ({ firstName, typed, activeField = -1, pressSave = 1, rippleSave, style }) => {
  const filled = typed.objective.length > 0;
  return (
    <div
      style={{
        width: 860,
        boxSizing: "border-box",
        borderRadius: 40,
        background: "#fff",
        padding: "40px 44px 44px",
        fontFamily: FONT,
        boxShadow: "0 50px 120px rgba(0,0,0,0.5)",
        ...style,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontSize: 48, fontWeight: 800, color: INK }}>Sesión · {firstName}</div>
        <div style={{ fontSize: 50, color: MUTED, lineHeight: 1 }}>×</div>
      </div>
      <TextArea label="Objetivo" placeholder="Objetivo de la sesión…" value={typed.objective} height={80} active={activeField === 0} />
      <TextArea label="Notas de sesión" placeholder="Notas sobre la cita…" value={typed.notes} height={100} active={activeField === 1} />
      <TextArea label="Seguimiento" placeholder="Qué revisar en próximas sesiones…" value={typed.followUp} height={80} active={activeField === 2} />
      <TextArea label="Tareas/Pautas" placeholder="Ejercicios o pautas para el cliente…" value={typed.tasks} height={80} active={activeField === 3} />
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 18, marginTop: 24 }}>
        <Btn label="Cancelar" />
        <div style={{ opacity: filled ? 1 : 0.55 }}>
          <Btn label="Guardar sesión" primary press={pressSave} ripple={rippleSave} />
        </div>
      </div>
    </div>
  );
};

const HistField: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div style={{ marginTop: 14 }}>
    <div style={{ fontSize: 24, fontWeight: 700, color: MUTED }}>{label}</div>
    <div style={{ fontSize: 31, fontWeight: 600, color: INK, lineHeight: 1.25 }}>{value}</div>
  </div>
);

/** Una sesión en "Historial de sesiones" de la ficha del paciente. */
export const HistoryEntry: React.FC<{ when: string; fields: SessionFields; style?: React.CSSProperties }> = ({ when, fields, style }) => (
  <div style={{ borderRadius: 28, border: `2px solid #E6EEEC`, background: "#fff", padding: "26px 32px 30px", fontFamily: FONT, ...style }}>
    <div style={{ fontSize: 26, color: "#8CA3A1", fontWeight: 600 }}>{when}</div>
    <HistField label="Objetivo" value={fields.objective} />
    <HistField label="Notas" value={fields.notes} />
    <HistField label="Seguimiento" value={fields.followUp} />
    <HistField label="Tareas/Pautas" value={fields.tasks} />
  </div>
);

/** Ficha del paciente → pestaña Historial (sin Informe ni Recibo en pantalla: solo se enseña Historial). */
export const HistoryPanel: React.FC<{ name: string; entries: React.ReactNode; style?: React.CSSProperties }> = ({ name, entries, style }) => (
  <div
    style={{
      width: 900,
      boxSizing: "border-box",
      borderRadius: 40,
      background: "#fff",
      padding: "38px 40px 40px",
      fontFamily: FONT,
      boxShadow: "0 2px 4px rgba(15,42,42,0.12), 0 40px 100px rgba(0,0,0,0.45)",
      ...style,
    }}
  >
    <div style={{ fontSize: 48, fontWeight: 800, color: INK }}>{name}</div>
    <div style={{ display: "flex", gap: 36, marginTop: 20, borderBottom: `3px solid ${LINE}`, fontSize: 30, fontWeight: 700 }}>
      <div style={{ color: BRAND.color, paddingBottom: 14, borderBottom: `5px solid ${BRAND.color}`, marginBottom: -3 }}>Historial</div>
      <div style={{ color: "#4A6362" }}>Editar</div>
    </div>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 26 }}>
      <div style={{ fontSize: 34, fontWeight: 700, color: INK }}>Historial de sesiones</div>
      <div style={{ padding: "10px 22px", borderRadius: 14, border: `3px solid ${LINE}`, fontSize: 25, fontWeight: 800, color: INK }}>+ Añadir sesión</div>
    </div>
    <div style={{ display: "flex", flexDirection: "column", gap: 20, marginTop: 22 }}>{entries}</div>
  </div>
);

// ───────────────────────── Pagos ─────────────────────────

export type PayRow = { when: string; service: string; price: string };
export type PayPatient = { name: string; summary: string; rows: readonly PayRow[] };

const StatCard: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div style={{ flex: 1, borderRadius: 26, background: "#fff", border: `2px solid #E6EEEC`, padding: "20px 22px 22px", boxShadow: "0 4px 18px rgba(15,42,42,0.06)" }}>
    <div style={{ fontSize: 23, color: "#4A6362", fontWeight: 600, whiteSpace: "nowrap" }}>{label}</div>
    <div style={{ fontSize: 46, fontWeight: 900, color: INK, lineHeight: 1.15, marginTop: 4, whiteSpace: "nowrap" }}>{value}</div>
  </div>
);

const MiniBtn: React.FC<{ label: string; primary?: boolean; ripple?: number; press?: number }> = ({ label, primary, ripple, press = 1 }) => (
  <div style={{ position: "relative", display: "inline-block", flexShrink: 0 }}>
    <div
      style={{
        padding: "11px 20px",
        borderRadius: 16,
        fontSize: 24,
        fontWeight: 800,
        background: primary ? BRAND.color : "#fff",
        color: primary ? "#fff" : INK,
        border: primary ? "none" : `3px solid ${LINE}`,
        scale: String(press),
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </div>
    {ripple !== undefined ? <Ripple t={ripple} /> : null}
  </div>
);

/** Tarjeta de un paciente en Pagos: nombre, resumen, "Marcar todas pagadas" y sus sesiones con "Pagada". */
export const PatientPayCard: React.FC<{ p: PayPatient; rippleFirst?: number; style?: React.CSSProperties }> = ({ p, rippleFirst, style }) => (
  <div style={{ borderRadius: 26, background: "#fff", border: `2px solid #E6EEEC`, boxShadow: "0 4px 18px rgba(15,42,42,0.06)", overflow: "hidden", fontFamily: FONT, ...style }}>
    <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "18px 26px", borderBottom: `2px solid #EEF3F2` }}>
      <div style={{ fontSize: 31, fontWeight: 800, color: INK, whiteSpace: "nowrap" }}>{p.name}</div>
      <div style={{ fontSize: 22, color: "#64748B", whiteSpace: "nowrap" }}>{p.summary}</div>
      <div style={{ marginLeft: "auto" }}>
        <MiniBtn label="Marcar todas pagadas" primary />
      </div>
    </div>
    {p.rows.map((r, ri) => (
      <div key={r.when} style={{ display: "flex", alignItems: "center", gap: 16, padding: "16px 26px" }}>
        <div style={{ flex: 1, fontSize: 25, color: "#4A6362", lineHeight: 1.2 }}>
          <span style={{ fontWeight: 800, color: INK }}>{r.when}</span> · {r.service}
        </div>
        <div style={{ fontSize: 26, color: "#4A6362" }}>{r.price}</div>
        <MiniBtn label="Pagada" ripple={ri === 0 ? rippleFirst : undefined} />
      </div>
    ))}
  </div>
);

/** Pantalla "Pagos" → Pendientes: KPIs y sesiones agrupadas por paciente. `rippleFirst` toca la primera "Pagada". */
export const PagosScreen: React.FC<{
  stats: { sessions: string; patients: string; total: string };
  patients: readonly PayPatient[];
  rippleFirst?: number;
  style?: React.CSSProperties;
}> = ({ stats, patients, rippleFirst, style }) => (
  <div
    style={{
      width: 900,
      boxSizing: "border-box",
      borderRadius: 40,
      background: "#F3F7F6",
      padding: "38px 38px 40px",
      fontFamily: FONT,
      boxShadow: "0 2px 4px rgba(15,42,42,0.12), 0 40px 100px rgba(0,0,0,0.45)",
      ...style,
    }}
  >
    <div style={{ fontSize: 56, fontWeight: 900, color: INK, letterSpacing: -0.5 }}>Pagos</div>
    <div style={{ fontSize: 29, color: "#4A6362", marginTop: 2 }}>Quién te debe sesiones y cuáles has cobrado</div>
    <div style={{ display: "flex", gap: 14, marginTop: 26 }}>
      <div style={{ padding: "14px 30px", borderRadius: 999, background: BRAND.color, color: "#fff", fontSize: 28, fontWeight: 800 }}>Pendientes</div>
      <div style={{ padding: "14px 30px", borderRadius: 999, background: "#fff", border: `3px solid ${LINE}`, color: INK, fontSize: 28, fontWeight: 800 }}>Cobradas (30 días)</div>
    </div>
    <div style={{ display: "flex", gap: 16, marginTop: 24 }}>
      <StatCard label="Sesiones pendientes" value={stats.sessions} />
      <StatCard label="Pacientes" value={stats.patients} />
      <StatCard label="Total pendiente" value={stats.total} />
    </div>
    <div style={{ display: "flex", flexDirection: "column", gap: 18, marginTop: 22 }}>
      {patients.map((p, pi) => (
        <PatientPayCard key={p.name} p={p} rippleFirst={pi === 0 ? rippleFirst : undefined} />
      ))}
    </div>
  </div>
);

/** Diálogo "¿Cómo se ha pagado?" (PaymentMethodDialog): el método es obligatorio. `tapped` toca Bizum. */
export const PaymentDialog: React.FC<{ tapped?: number; style?: React.CSSProperties }> = ({ tapped, style }) => (
  <div
    style={{
      width: 780,
      boxSizing: "border-box",
      borderRadius: 40,
      background: "#fff",
      padding: "44px 48px 40px",
      fontFamily: FONT,
      boxShadow: "0 50px 120px rgba(0,0,0,0.5)",
      ...style,
    }}
  >
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <div style={{ fontSize: 48, fontWeight: 800, color: INK }}>¿Cómo se ha pagado?</div>
      <div style={{ fontSize: 50, color: MUTED, lineHeight: 1 }}>×</div>
    </div>
    <div style={{ fontSize: 30, color: "#475569", marginTop: 16 }}>Elige el método de pago de la sesión.</div>
    <div style={{ display: "flex", gap: 20, marginTop: 30 }}>
      <div style={{ flex: 1 }}>
        <Btn label="Bizum" primary w={324} ripple={tapped} press={tapped === undefined ? 1 : interpolate(tapped, [-2, 0, 6], [1, 0.92, 1], clamp)} />
      </div>
      <div style={{ flex: 1 }}>
        <Btn label="Efectivo" primary w={324} />
      </div>
    </div>
    <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 22 }}>
      <Btn label="Cancelar" />
    </div>
  </div>
);
