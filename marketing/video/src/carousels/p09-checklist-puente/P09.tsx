import type React from "react";
import { AbsoluteFill, Img, staticFile, useCurrentFrame } from "remotion";
import { BRAND } from "../../brand";
import { Background } from "../../components/Background";
import {
  CheckBadge,
  CtaPill,
  GhostNumber,
  HAND,
  Headline,
  KickerChip,
  LightBackground,
  StepChip,
  Sub,
  SwipeHint,
} from "../../components/CarouselKit";
import { WhatsAppBubble } from "../../components/WhatsAppChat";
import { FONT, SAFE, STATUS } from "../../theme";
import { P09_DATA, P09_TEXT } from "./script";

const INK = "#0F2A2A";
const MUTED = "#64748B";
const LINE = "#D9E4E2";

/* ───────────────────────── Portapapeles con la checklist ───────────────────────── */

const Clipboard: React.FC<{ checked: boolean; style?: React.CSSProperties }> = ({ checked, style }) => (
  <div
    style={{
      position: "absolute",
      width: 780,
      height: 820,
      borderRadius: 36,
      background: "linear-gradient(160deg, #A9764A, #7A5132)",
      boxShadow: "0 4px 0 #5E3D25, 0 50px 100px rgba(0,0,0,0.5)",
      ...style,
    }}
  >
    {/* papel */}
    <div
      style={{
        position: "absolute",
        inset: "70px 34px 34px",
        borderRadius: 12,
        background: "#FFFDF7",
        boxShadow: "0 2px 6px rgba(0,0,0,0.25)",
        padding: "70px 56px 0",
        fontFamily: FONT,
      }}
    >
      <div style={{ fontFamily: HAND, fontWeight: 700, fontSize: 66, color: "#1F3A7A", lineHeight: 1, rotate: "-2deg" }}>
        Puente del Pilar
      </div>
      <div style={{ height: 4, width: 420, background: "#1F3A7A", borderRadius: 4, marginTop: 6, rotate: "-2deg", opacity: 0.8 }} />
      <div style={{ marginTop: 50, display: "flex", flexDirection: "column", gap: 44 }}>
        {P09_TEXT.checklist.map((item, i) => (
          <div key={item} style={{ display: "flex", alignItems: "center", gap: 30 }}>
            <div
              style={{
                position: "relative",
                width: 76,
                height: 76,
                flexShrink: 0,
                borderRadius: 16,
                border: `6px solid ${checked ? STATUS.confirmed.solid : "#9AA7A6"}`,
                background: checked ? "#EAF6EF" : "#fff",
              }}
            >
              {checked ? (
                <svg width="110" height="100" viewBox="0 0 110 100" style={{ position: "absolute", left: -6, top: -34, overflow: "visible" }}>
                  <path
                    d={["M14 58 L40 84 L100 10", "M12 60 L42 82 L96 14", "M16 56 L38 86 L104 8"][i]}
                    fill="none"
                    stroke={STATUS.confirmed.solid}
                    strokeWidth="13"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              ) : null}
            </div>
            <div style={{ fontSize: 52, fontWeight: 800, color: INK, opacity: checked ? 1 : 0.9 }}>{item}</div>
          </div>
        ))}
      </div>
    </div>
    {/* pinza metálica */}
    <div
      style={{
        position: "absolute",
        left: "50%",
        top: 18,
        translate: "-50% 0",
        width: 300,
        height: 104,
        borderRadius: "26px 26px 18px 18px",
        background: "linear-gradient(180deg, #E3E8EC, #9AA3AD)",
        boxShadow: "0 8px 14px rgba(0,0,0,0.35), inset 0 2px 0 rgba(255,255,255,0.8)",
      }}
    >
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: -30,
          translate: "-50% 0",
          width: 120,
          height: 60,
          borderRadius: "60px 60px 0 0",
          border: "14px solid #B8C0C8",
          borderBottom: "none",
        }}
      />
    </div>
  </div>
);

/* ───────────────────────── Pantallas reales del panel (datos ficticios) ───────────────────────── */

const PanelCard: React.FC<{ children: React.ReactNode; style?: React.CSSProperties }> = ({ children, style }) => (
  <div
    style={{
      position: "absolute",
      left: 100,
      width: 880,
      boxSizing: "border-box",
      borderRadius: 32,
      background: "#fff",
      padding: "38px 40px 42px",
      fontFamily: FONT,
      color: INK,
      boxShadow: "0 2px 4px rgba(15,42,42,0.12), 0 40px 100px rgba(0,0,0,0.5)",
      ...style,
    }}
  >
    {children}
  </div>
);

const Field: React.FC<{ label: string; value: string; flex?: number; ring?: boolean }> = ({ label, value, flex = 1, ring }) => (
  <div style={{ flex }}>
    <div style={{ fontSize: 25, fontWeight: 700, color: MUTED, marginBottom: 10 }}>{label}</div>
    <div
      style={{
        height: 76,
        borderRadius: 16,
        border: `3px solid ${ring ? BRAND.accent : LINE}`,
        boxShadow: ring ? `0 0 0 8px rgba(255,107,74,0.25)` : undefined,
        display: "flex",
        alignItems: "center",
        padding: "0 22px",
        fontSize: 34,
        fontWeight: 800,
      }}
    >
      {value}
    </div>
  </div>
);

/** Modal "Editar franja" de Franjas y aforo (Franjas.tsx). */
const ShiftCard: React.FC = () => {
  const s = P09_DATA.shift;
  return (
    <PanelCard style={{ top: 660, rotate: "-1.5deg" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontSize: 44, fontWeight: 900 }}>Editar franja</div>
        <div style={{ fontSize: 44, color: MUTED }}>×</div>
      </div>
      <div style={{ display: "flex", gap: 22, marginTop: 26 }}>
        <Field label="Nombre" value={s.name} flex={1.3} />
        <Field label="Inicio" value={s.start} />
        <Field label="Fin" value={s.end} />
      </div>
      <div style={{ display: "flex", gap: 22, marginTop: 22, alignItems: "flex-end" }}>
        <Field label="Aforo" value={String(s.covers)} />
        <div style={{ flex: 2.4 }}>
          <div style={{ fontSize: 25, fontWeight: 700, color: MUTED, marginBottom: 10 }}>Días activos</div>
          <div style={{ display: "flex", gap: 10 }}>
            {s.days.map((d, i) => {
              const on = (s.active as readonly number[]).includes(i);
              return (
                <div
                  key={i}
                  style={{
                    width: 62,
                    height: 76,
                    borderRadius: 14,
                    display: "grid",
                    placeItems: "center",
                    fontSize: 30,
                    fontWeight: 800,
                    background: on ? BRAND.color : "#fff",
                    color: on ? "#fff" : MUTED,
                    border: on ? "none" : `3px solid ${LINE}`,
                  }}
                >
                  {d}
                </div>
              );
            })}
          </div>
        </div>
      </div>
      <div style={{ borderTop: `2px solid ${LINE}`, marginTop: 30, paddingTop: 26 }}>
        <div style={{ width: 360 }}>
          <Field label="Stock online (opcional)" value={String(s.online)} ring />
        </div>
        <div style={{ fontSize: 24, color: MUTED, marginTop: 14, lineHeight: 1.3 }}>{P09_DATA.onlineHint}</div>
      </div>
    </PanelCard>
  );
};

/** Configuración → Integraciones → "Activar recordatorio 24h antes" (IntegrationsForm.tsx). */
const ReminderCard: React.FC = () => (
  <>
    <PanelCard style={{ top: 650, rotate: "1.5deg" }}>
      <div style={{ fontSize: 26, fontWeight: 800, color: MUTED, letterSpacing: 1 }}>Configuración</div>
      <div style={{ fontSize: 42, fontWeight: 900, marginTop: 6 }}>Integraciones (email y WhatsApp)</div>
      <div style={{ fontSize: 31, fontWeight: 800, marginTop: 34, color: "#334155" }}>Recordatorios por WhatsApp</div>
      <div
        style={{
          marginTop: 20,
          display: "flex",
          alignItems: "center",
          gap: 24,
          padding: "22px 26px",
          borderRadius: 20,
          border: `3px solid ${BRAND.accent}`,
          boxShadow: "0 0 0 8px rgba(255,107,74,0.22)",
        }}
      >
        <div style={{ width: 64, height: 64, borderRadius: 14, background: BRAND.color, display: "grid", placeItems: "center", flexShrink: 0 }}>
          <svg width="42" height="42" viewBox="0 0 24 24" fill="none">
            <path d="M5 12.5l4.5 4.5L19 7.5" stroke="#fff" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <div style={{ fontSize: 40, fontWeight: 900 }}>Activar recordatorio 24h antes</div>
      </div>
    </PanelCard>
    <div style={{ position: "absolute", left: 150, right: 70, top: 1130, display: "flex", flexDirection: "column", rotate: "-2deg" }}>
      <WhatsAppBubble from="me" text={P09_DATA.reminder} time="21:00" ticks="read" scale={1.55} maxWidth="100%" style={{ boxShadow: "0 30px 70px rgba(0,0,0,0.45)" }} />
    </div>
  </>
);

const SmallBtn: React.FC<{ label: string }> = ({ label }) => (
  <div style={{ padding: "10px 16px", borderRadius: 12, border: `2px solid ${LINE}`, fontSize: 23, fontWeight: 800, color: INK }}>{label}</div>
);

/** "Lista de espera" bajo el plano de sala (PlanoSala.tsx). */
const WaitlistCard: React.FC = () => (
  <PanelCard style={{ top: 660, rotate: "-1deg", padding: "38px 34px 20px" }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
      <div>
        <div style={{ fontSize: 46, fontWeight: 900 }}>Lista de espera</div>
        <div style={{ fontSize: 25, color: MUTED, marginTop: 2 }}>Clientes sin mesa libre ahora mismo</div>
      </div>
      <div
        style={{
          padding: "14px 24px",
          borderRadius: 14,
          background: BRAND.color,
          color: "#fff",
          fontSize: 28,
          fontWeight: 900,
          boxShadow: `0 0 0 6px rgba(255,107,74,0.35)`,
        }}
      >
        + Añadir
      </div>
    </div>
    <div style={{ marginTop: 26, borderTop: `2px solid #EEF3F2` }}>
      {P09_DATA.waitlist.map((w) => {
        const avisado = w.status === "Avisado";
        return (
          <div key={w.who} style={{ padding: "22px 0", borderBottom: `2px solid #EEF3F2` }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 33, fontWeight: 800, whiteSpace: "nowrap" }}>{w.who}</div>
                <div style={{ fontSize: 23, color: MUTED, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{w.meta}</div>
              </div>
              <div
                style={{
                  padding: "6px 16px",
                  borderRadius: 999,
                  fontSize: 22,
                  fontWeight: 800,
                  background: avisado ? "#FEF3C7" : "#F1F5F9",
                  color: avisado ? "#B45309" : MUTED,
                }}
              >
                {w.status}
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
              {!avisado ? <SmallBtn label="Avisar" /> : null}
              <SmallBtn label="Sentar" />
              <SmallBtn label="Cancelar" />
            </div>
          </div>
        );
      })}
    </div>
  </PanelCard>
);

/* ───────────────────────── Diapositivas ───────────────────────── */

const Cover: React.FC = () => {
  const t = P09_TEXT.cover;
  return (
    <AbsoluteFill>
      <Background />
      <KickerChip text={t.kicker} />
      <Headline l1={t.l1} l2={t.l2} size={124} top={SAFE.top + 150} />
      <Clipboard checked={false} style={{ left: 150, top: 640, rotate: "-4deg" }} />
      {/* lápiz */}
      <div
        style={{
          position: "absolute",
          left: 690,
          top: 1170,
          width: 420,
          height: 46,
          rotate: "-38deg",
          borderRadius: 8,
          background: "linear-gradient(90deg, #F6C343 0 80%, #F2D7B0 80% 93%, #333 93%)",
          boxShadow: "0 18px 30px rgba(0,0,0,0.45)",
        }}
      />
      <SwipeHint />
    </AbsoluteFill>
  );
};

const Step: React.FC<{ i: 0 | 1 | 2 }> = ({ i }) => {
  const t = P09_TEXT.steps[i];
  return (
    <AbsoluteFill>
      <Background />
      <GhostNumber n={i + 1} />
      <StepChip label="Revisa" n={i + 1} of={3} />
      <Headline l1={t.l1} l2={t.l2} />
      <Sub text={t.sub} />
      {i === 0 ? <ShiftCard /> : null}
      {i === 1 ? <ReminderCard /> : null}
      {i === 2 ? <WaitlistCard /> : null}
      <CheckBadge size={130} style={{ left: 50, top: 585, rotate: "-8deg" }} />
      <SwipeHint />
    </AbsoluteFill>
  );
};

const Close: React.FC = () => {
  const t = P09_TEXT.close;
  return (
    <AbsoluteFill>
      <LightBackground glowY="58%" />
      <div style={{ position: "absolute", top: SAFE.top + 30, left: 0, right: 0, display: "flex", justifyContent: "center" }}>
        <Img src={staticFile("brand/turnigo-logo-principal.svg")} style={{ width: 340, height: (340 * 120) / 474.8 }} />
      </div>
      <Headline l1={t.l1} l2={t.l2} size={120} top={SAFE.top + 150} light accent={BRAND.color} />
      <Clipboard checked style={{ left: 150, top: 570, rotate: "3deg", scale: "0.92" }} />
      <CtaPill cta={t.cta} sub={t.ctaSub} top={1325} />
    </AbsoluteFill>
  );
};

/** Carrusel P09: el fotograma N es la diapositiva N+1 (`remotion still … --frame N`). */
export const P09ChecklistPuente: React.FC = () => {
  const frame = useCurrentFrame();
  if (frame === 0) return <Cover />;
  if (frame === 1) return <Step i={0} />;
  if (frame === 2) return <Step i={1} />;
  if (frame === 3) return <Step i={2} />;
  return <Close />;
};

