import type React from "react";
import { AbsoluteFill, Img, staticFile, useCurrentFrame } from "remotion";
import { BRAND } from "../../brand";
import { Background } from "../../components/Background";
import { CtaPill, HAND, Headline, KickerChip, LightBackground, StepChip, Sub, SwipeHint, GhostNumber } from "../../components/CarouselKit";
import {
  HistoryEntry,
  HistoryPanel,
  PagosScreen,
  PatientPayCard,
  PaymentDialog,
  SeguimientoScreen,
} from "../../components/PsyScreens";
import { FONT, SAFE } from "../../theme";
import { P12_DATA as D, P12_TEXT as T } from "./script";

/* ───────────────────────── Portada: la pila de papeles ───────────────────────── */

const Sheet: React.FC<{ style: React.CSSProperties; lines?: number; children?: React.ReactNode }> = ({ style, lines = 9, children }) => (
  <div
    style={{
      position: "absolute",
      width: 640,
      height: 780,
      borderRadius: 10,
      background: "#FFFDF7",
      boxShadow: "0 3px 0 rgba(0,0,0,0.08), 0 30px 60px rgba(0,0,0,0.45)",
      padding: "60px 50px",
      boxSizing: "border-box",
      backgroundImage: "repeating-linear-gradient(180deg, transparent 0 58px, rgba(31,58,122,0.16) 58px 61px)",
      backgroundPosition: "0 40px",
      ...style,
    }}
  >
    {children}
    <div style={{ position: "absolute", left: 66, top: 0, bottom: 0, width: 3, background: "rgba(255,107,74,0.45)" }} />
    <div style={{ display: "none" }}>{lines}</div>
  </div>
);

const Scribble: React.FC<{ text: string; style?: React.CSSProperties }> = ({ text, style }) => (
  <div style={{ fontFamily: HAND, fontWeight: 700, fontSize: 54, color: "#1F3A7A", lineHeight: 1.05, position: "absolute", ...style }}>{text}</div>
);

const Sticky: React.FC<{ text: string; bg: string; style: React.CSSProperties }> = ({ text, bg, style }) => (
  <div
    style={{
      position: "absolute",
      width: 330,
      padding: "34px 30px 38px",
      background: bg,
      boxShadow: "0 3px 0 rgba(0,0,0,0.1), 0 24px 44px rgba(0,0,0,0.45)",
      fontFamily: HAND,
      fontWeight: 700,
      fontSize: 56,
      lineHeight: 1,
      color: "#2B2410",
      ...style,
    }}
  >
    {text}
  </div>
);

const PaperPile: React.FC = () => (
  <>
    <Sheet style={{ left: 120, top: 660, rotate: "-9deg" }} />
    <Sheet style={{ left: 250, top: 700, rotate: "5deg" }}>
      <Scribble text="Sesión 14 oct" style={{ left: 90, top: 70 }} />
      <Scribble text="¿pautas?" style={{ left: 130, top: 190, fontSize: 48 }} />
    </Sheet>
    <Sheet style={{ left: 190, top: 770, rotate: "-3deg" }}>
      <Scribble text="Notas de Marta" style={{ left: 90, top: 70 }} />
      <Scribble text="— respiración" style={{ left: 110, top: 190, fontSize: 48 }} />
      <Scribble text="— ¿pagó?" style={{ left: 110, top: 310, fontSize: 48 }} />
    </Sheet>
    <Sticky text="¿Quién me debe sesión?" bg="#FFB4A1" style={{ left: 600, top: 650, rotate: "7deg" }} />
    <Sticky text="Cita sin apuntar" bg="#FFE27A" style={{ left: 90, top: 1340, rotate: "-6deg" }} />
  </>
);

/* ───────────────────────── Diapositivas ───────────────────────── */

const Cover: React.FC = () => {
  const t = T.cover;
  return (
    <AbsoluteFill>
      <Background />
      <KickerChip text={t.kicker} />
      <Headline l1={t.l1} l2={t.l2} size={124} top={SAFE.top + 150} />
      <PaperPile />
      <SwipeHint />
    </AbsoluteFill>
  );
};

const PANEL_LEFT = 90;

const Step: React.FC<{ i: 0 | 1 | 2 }> = ({ i }) => {
  const t = T.steps[i];
  return (
    <AbsoluteFill>
      <Background />
      <GhostNumber n={i + 1} />
      <StepChip label="Con Turnigo" n={i + 1} of={3} />
      <Headline l1={t.l1} l2={t.l2} />
      <Sub text={t.sub} />
      {i === 0 ? (
        <SeguimientoScreen
          current={D.current}
          next={D.next}
          rippleStart={9}
          style={{ position: "absolute", left: PANEL_LEFT, top: 650, scale: "0.82", transformOrigin: "50% 0", rotate: "-1deg" }}
        />
      ) : null}
      {i === 1 ? (
        <HistoryPanel
          name={D.current.name}
          style={{ position: "absolute", left: PANEL_LEFT, top: 650, height: 740, overflow: "hidden", rotate: "1deg" }}
          entries={
            <>
              <HistoryEntry when={D.history[0].when} fields={D.history[0].fields} />
              <HistoryEntry when={D.history[1].when} fields={D.history[1].fields} />
            </>
          }
        />
      ) : null}
      {i === 2 ? (
        <>
          <PagosScreen
            stats={D.pagos.stats}
            patients={D.pagos.patients}
            style={{ position: "absolute", left: PANEL_LEFT, top: 650, scale: "0.9", transformOrigin: "50% 0", rotate: "-1deg" }}
          />
          <div
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              top: 1440,
              textAlign: "center",
              fontFamily: FONT,
              fontWeight: 700,
              fontSize: 32,
              color: "#9FBDB9",
            }}
          >
            {T.example}
          </div>
        </>
      ) : null}
      <SwipeHint />
    </AbsoluteFill>
  );
};

const Close: React.FC = () => {
  const t = T.close;
  return (
    <AbsoluteFill>
      <LightBackground glowY="55%" />
      <div style={{ position: "absolute", top: SAFE.top + 30, left: 0, right: 0, display: "flex", justifyContent: "center" }}>
        <Img src={staticFile("brand/turnigo-logo-principal.svg")} style={{ width: 340, height: (340 * 120) / 474.8 }} />
      </div>
      <Headline l1={t.l1} l2={t.l2} size={118} top={SAFE.top + 150} light accent={BRAND.color} />
      <PatientPayCard
        p={D.pagos.patients[0]}
        rippleFirst={9}
        style={{ position: "absolute", left: 100, top: 640, width: 880, rotate: "-1.5deg", boxShadow: "0 2px 4px rgba(15,42,42,0.12), 0 30px 70px rgba(15,42,42,0.25)" }}
      />
      <PaymentDialog tapped={9} style={{ position: "absolute", left: 150, top: 870, rotate: "1deg", boxShadow: "0 50px 100px rgba(15,42,42,0.35)" }} />
      <CtaPill cta={t.cta} sub={t.ctaSub} top={1325} />
    </AbsoluteFill>
  );
};

/** Carrusel P12: el fotograma N es la diapositiva N+1 (`remotion still … --frame N`). */
export const P12ConsultaSinPapeles: React.FC = () => {
  const frame = useCurrentFrame();
  if (frame === 0) return <Cover />;
  if (frame === 1) return <Step i={0} />;
  if (frame === 2) return <Step i={1} />;
  if (frame === 3) return <Step i={2} />;
  return <Close />;
};
