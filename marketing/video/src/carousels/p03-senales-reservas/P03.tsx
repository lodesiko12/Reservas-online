import type React from "react";
import { AbsoluteFill, Img, staticFile, useCurrentFrame } from "remotion";
import { loadFont } from "@remotion/google-fonts/Caveat";
import { BRAND } from "../../brand";
import { Background } from "../../components/Background";
import { PhoneFrame } from "../../components/PhoneFrame";
import { COLORS, FONT, SAFE, STATUS } from "../../theme";
import { P03_DATA, P03_TEXT } from "./script";

/** Letra a mano (libreta, comandas, pósit). */
const { fontFamily: HAND } = loadFont("normal", { weights: ["600", "700"], subsets: ["latin", "latin-ext"] });

const LIGHT_BG = "#F3F7F6";
const ACCENT_ON_LIGHT = "#C8401F";
const PEN = "#1F3A7A";
const PAPER = "#FBF6E8";
const POSTIT = "#FFE27A";
const RED = STATUS.noShow.solid;

/* ───────────────────────── piezas comunes ───────────────────────── */

const Headline: React.FC<{ l1: string; l2: string; size?: number; top?: number; light?: boolean }> = ({
  l1,
  l2,
  size = 104,
  top = SAFE.top + 70,
  light = false,
}) => (
  <div
    style={{
      position: "absolute",
      top,
      left: SAFE.side,
      right: SAFE.side,
      textAlign: "center",
      fontFamily: FONT,
      fontWeight: 900,
      fontSize: size,
      lineHeight: 1.04,
      letterSpacing: -1.5,
      color: light ? COLORS.ink : COLORS.white,
      textWrap: "balance",
    }}
  >
    <div>{l1}</div>
    <div style={{ color: light ? ACCENT_ON_LIGHT : BRAND.accent }}>{l2}</div>
  </div>
);

/** Pastilla "Desliza →" abajo a la derecha, dentro de la zona segura. */
const SwipeHint: React.FC = () => (
  <div
    style={{
      position: "absolute",
      right: SAFE.side,
      bottom: SAFE.bottom + 40,
      display: "flex",
      alignItems: "center",
      gap: 18,
      fontFamily: FONT,
      fontWeight: 800,
      fontSize: 40,
      color: "#CFE6E3",
    }}
  >
    {P03_TEXT.swipe}
    <div
      style={{
        width: 84,
        height: 84,
        borderRadius: 999,
        background: BRAND.accent,
        display: "grid",
        placeItems: "center",
        boxShadow: "0 12px 30px rgba(255,107,74,0.45)",
      }}
    >
      <svg width="42" height="42" viewBox="0 0 24 24" fill="none">
        <path d="M5 12h13M13 6l6 6-6 6" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  </div>
);

/** Nota adhesiva estática (el `Sticker` animado necesita tiempo; aquí es una foto). */
const PostIt: React.FC<{ text: string; x: number; y: number; rot: number; size?: number; color?: string }> = ({
  text,
  x,
  y,
  rot,
  size = 60,
  color = POSTIT,
}) => (
  <div
    style={{
      position: "absolute",
      left: x,
      top: y,
      rotate: `${rot}deg`,
      padding: "34px 40px 40px",
      background: color,
      color: "#2B2410",
      fontFamily: HAND,
      fontWeight: 700,
      fontSize: size,
      lineHeight: 1,
      whiteSpace: "pre",
      boxShadow: "0 3px 0 rgba(0,0,0,0.10), 0 28px 50px rgba(0,0,0,0.45)",
      borderBottomRightRadius: 28,
    }}
  >
    {/* cinta adhesiva */}
    <div
      style={{
        position: "absolute",
        top: -22,
        left: "50%",
        translate: "-50% 0",
        rotate: "-4deg",
        width: 150,
        height: 44,
        background: "rgba(255,255,255,0.55)",
        boxShadow: "0 1px 2px rgba(0,0,0,0.1)",
      }}
    />
    {text}
  </div>
);

/** Rayajo de boli por encima de un texto. */
const Scribble: React.FC<{ color?: string }> = ({ color = PEN }) => (
  <svg
    viewBox="0 0 100 20"
    preserveAspectRatio="none"
    style={{ position: "absolute", left: -6, right: -6, top: "28%", height: "50%", width: "calc(100% + 12px)", overflow: "visible" }}
  >
    <path
      d="M0 12 C 10 4, 18 16, 28 8 S 46 14, 56 6 S 76 16, 86 7 S 96 12, 100 9 M2 15 C 20 8, 40 16, 60 9 S 90 14, 99 11"
      fill="none"
      stroke={color}
      strokeWidth="3.2"
      strokeLinecap="round"
      vectorEffect="non-scaling-stroke"
    />
  </svg>
);

/* ───────────────────────── visuales de cada señal ───────────────────────── */

/** Libreta de reservas: espiral, renglones, tachones, mancha de café. */
const Notebook: React.FC<{ style?: React.CSSProperties }> = ({ style }) => {
  const { notebook } = P03_DATA;
  const W = 780;
  const H = 700;
  const lineGap = 92;
  return (
    <div style={{ position: "absolute", width: W, height: H, ...style }}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: 18,
          background: PAPER,
          backgroundImage: `repeating-linear-gradient(to bottom, transparent 0 ${lineGap - 3}px, rgba(70,110,170,0.28) ${lineGap - 3}px ${lineGap}px)`,
          backgroundPosition: "0 118px",
          boxShadow: "0 4px 0 #E6DCC2, 0 8px 0 #D8CCAE, 0 40px 90px rgba(0,0,0,0.55)",
          overflow: "hidden",
        }}
      >
        {/* margen rojo */}
        <div style={{ position: "absolute", left: 118, top: 0, bottom: 0, width: 4, background: "rgba(214,72,72,0.45)" }} />
        {/* mancha de café */}
        <div
          style={{
            position: "absolute",
            left: -90,
            bottom: -110,
            width: 300,
            height: 300,
            borderRadius: 999,
            border: "22px solid rgba(140,90,40,0.20)",
            boxShadow: "inset 0 0 0 6px rgba(140,90,40,0.10)",
          }}
        />
        <div style={{ position: "absolute", left: 150, right: 40, top: 54, fontFamily: HAND, color: PEN }}>
          <div style={{ fontSize: 66, fontWeight: 700, lineHeight: `${lineGap}px`, height: lineGap }}>
            <span style={{ borderBottom: `4px solid ${PEN}`, paddingBottom: 2 }}>{notebook.day}</span>
          </div>
          {notebook.rows.map((r, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                gap: 26,
                fontSize: 64,
                fontWeight: 600,
                lineHeight: `${lineGap}px`,
                height: lineGap,
                rotate: `${[-1, 0.8, -0.6, 1.4][i]}deg`,
                translate: `${[0, 10, -4, 14][i]}px 0`,
              }}
            >
              <span style={{ fontWeight: 700 }}>{r.time}</span>
              <span style={{ position: "relative" }}>
                {r.who}
                {"fix" in r ? <Scribble /> : null}
              </span>
              {"fix" in r ? (
                <span style={{ color: "#B23A2E", rotate: "-6deg", translate: "-10px -18px", display: "inline-block" }}>
                  {r.fix}
                </span>
              ) : null}
              <span style={{ opacity: 0.85 }}>{r.n}</span>
            </div>
          ))}
        </div>
        {/* círculo a boli alrededor del "¿6 o 7?" */}
        <svg style={{ position: "absolute", left: 560, top: 476, width: 230, height: 120, overflow: "visible" }} viewBox="0 0 230 120">
          <path
            d="M20 64 C 18 20, 200 6, 214 52 C 226 100, 40 118, 12 74 C 4 56, 30 34, 60 28"
            fill="none"
            stroke="#B23A2E"
            strokeWidth="5"
            strokeLinecap="round"
          />
        </svg>
      </div>
      {/* espiral */}
      <div style={{ position: "absolute", top: -26, left: 60, right: 60, display: "flex", justifyContent: "space-between" }}>
        {Array.from({ length: 11 }).map((_, i) => (
          <div
            key={i}
            style={{
              width: 26,
              height: 64,
              borderRadius: 14,
              border: "6px solid #9AA3AD",
              borderBottomColor: "#6B737C",
              background: "transparent",
              boxShadow: "0 3px 4px rgba(0,0,0,0.35)",
            }}
          />
        ))}
      </div>
    </div>
  );
};

const PhoneIcon: React.FC<{ size: number; rot?: number }> = ({ size, rot = 0 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" style={{ rotate: `${rot}deg` }}>
    <path
      fill="#fff"
      d="M6.6 10.8a15.1 15.1 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.25 11.4 11.4 0 0 0 3.6.57 1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.25.2 2.45.57 3.57a1 1 0 0 1-.25 1z"
    />
  </svg>
);

/** Pantalla de llamada entrante (genérica, sin marca de terceros). */
const IncomingCall: React.FC = () => (
  <div
    style={{
      position: "absolute",
      inset: 0,
      background: "linear-gradient(180deg, #2B3A4A 0%, #182330 55%, #0E151D 100%)",
      color: "#fff",
      fontFamily: FONT,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      paddingTop: 70,
    }}
  >
    <div style={{ fontSize: 30, fontWeight: 700, opacity: 0.7 }}>Llamada entrante…</div>
    <div style={{ fontSize: 46, fontWeight: 900, marginTop: 14, whiteSpace: "nowrap" }}>+34 6•• •• ••</div>
    <div
      style={{
        marginTop: 70,
        width: 190,
        height: 190,
        borderRadius: 999,
        background: "linear-gradient(145deg, #5B6B7C, #3A4756)",
        display: "grid",
        placeItems: "center",
        fontSize: 110,
        fontWeight: 900,
        color: "rgba(255,255,255,0.85)",
        boxShadow: "0 0 0 18px rgba(255,255,255,0.06), 0 0 0 40px rgba(255,255,255,0.03)",
      }}
    >
      ?
    </div>
    <div style={{ position: "absolute", bottom: 120, left: 0, right: 0, display: "flex", justifyContent: "space-around" }}>
      {[
        { bg: "#E5483B", rot: 135 },
        { bg: "#2FB65A", rot: 0 },
      ].map((b) => (
        <div
          key={b.bg}
          style={{ width: 128, height: 128, borderRadius: 999, background: b.bg, display: "grid", placeItems: "center" }}
        >
          <PhoneIcon size={64} rot={b.rot} />
        </div>
      ))}
    </div>
  </div>
);

/** Arcos de vibración a los lados del móvil. */
const Buzz: React.FC<{ side: "left" | "right"; x: number; y: number }> = ({ side, x, y }) => (
  <svg width="120" height="260" viewBox="0 0 120 260" style={{ position: "absolute", left: x, top: y, scale: side === "left" ? "-1 1" : "1 1" }}>
    {[0, 1, 2].map((i) => (
      <path
        key={i}
        d={`M${20 + i * 34} ${60 - i * 22} Q ${70 + i * 34} 130, ${20 + i * 34} ${200 + i * 22}`}
        fill="none"
        stroke={BRAND.accent}
        strokeOpacity={1 - i * 0.28}
        strokeWidth="10"
        strokeLinecap="round"
      />
    ))}
  </svg>
);

/** Banner de "llamadas perdidas" (notificación genérica del sistema). */
const MissedCalls: React.FC<{ style?: React.CSSProperties; scale?: number }> = ({ style, scale = 1 }) => (
  <div
    style={{
      position: "absolute",
      display: "flex",
      alignItems: "center",
      gap: 26 * scale,
      padding: `${26 * scale}px ${36 * scale}px`,
      borderRadius: 34 * scale,
      background: "rgba(255,255,255,0.97)",
      fontFamily: FONT,
      color: COLORS.ink,
      boxShadow: "0 30px 70px rgba(0,0,0,0.5)",
      ...style,
    }}
  >
    <div
      style={{
        position: "relative",
        width: 92 * scale,
        height: 92 * scale,
        borderRadius: 24 * scale,
        background: "#2FB65A",
        display: "grid",
        placeItems: "center",
      }}
    >
      <PhoneIcon size={52 * scale} />
      <div
        style={{
          position: "absolute",
          top: -16 * scale,
          right: -16 * scale,
          minWidth: 50 * scale,
          height: 50 * scale,
          borderRadius: 999,
          background: "#E5483B",
          color: "#fff",
          fontSize: 32 * scale,
          fontWeight: 900,
          display: "grid",
          placeItems: "center",
          border: `${4 * scale}px solid #fff`,
        }}
      >
        5
      </div>
    </div>
    <div>
      <div style={{ fontSize: 30 * scale, fontWeight: 700, color: COLORS.inkMuted }}>Teléfono · ahora</div>
      <div style={{ fontSize: 44 * scale, fontWeight: 900 }}>5 llamadas perdidas</div>
    </div>
  </div>
);

/** Comanda/papelito de reserva escrito a mano. */
const Ticket: React.FC<{ t: (typeof P03_DATA.tickets)[number]; style?: React.CSSProperties }> = ({ t, style }) => (
  <div
    style={{
      position: "absolute",
      width: 560,
      padding: "46px 50px 54px",
      background: "#FFFFFF",
      backgroundImage: "linear-gradient(180deg, #FFFFFF, #F6F2E8)",
      fontFamily: HAND,
      color: PEN,
      boxShadow: "0 3px 0 rgba(0,0,0,0.08), 0 40px 80px rgba(0,0,0,0.55)",
      // borde inferior de papel arrancado
      clipPath:
        "polygon(0 0,100% 0,100% 94%,95% 100%,90% 95%,85% 100%,80% 95%,75% 100%,70% 95%,65% 100%,60% 95%,55% 100%,50% 95%,45% 100%,40% 95%,35% 100%,30% 95%,25% 100%,20% 95%,15% 100%,10% 95%,5% 100%,0 94%)",
      ...style,
    }}
  >
    <div style={{ fontFamily: FONT, fontSize: 30, fontWeight: 800, letterSpacing: 4, color: "#8C8573" }}>RESERVA</div>
    <div style={{ fontSize: 120, fontWeight: 700, lineHeight: 1, marginTop: 8 }}>{t.table}</div>
    <div style={{ fontSize: 64, fontWeight: 600, marginTop: 14 }}>{t.when}</div>
    <div style={{ fontSize: 60, fontWeight: 600, marginTop: 4 }}>{t.who}</div>
  </div>
);

/** Sello de goma rojo. */
const Stamp: React.FC<{ text: string; style?: React.CSSProperties }> = ({ text, style }) => (
  <div
    style={{
      position: "absolute",
      padding: "18px 44px",
      border: `12px solid ${RED}`,
      borderRadius: 20,
      color: RED,
      fontFamily: FONT,
      fontWeight: 900,
      fontSize: 112,
      letterSpacing: 10,
      lineHeight: 1,
      background: "rgba(255,240,236,0.92)",
      boxShadow: `inset 0 0 0 4px rgba(192,57,43,0.35)`,
      opacity: 0.94,
      ...style,
    }}
  >
    {text}
  </div>
);

/* ───────────────────────── pantalla Agenda (panel real, datos ficticios) ───────────────────────── */

const AgendaScreen: React.FC = () => {
  const { agenda, business } = P03_DATA;
  const teal = BRAND.color;
  return (
    <div style={{ position: "absolute", inset: 0, background: "#F3F7F6", fontFamily: FONT, color: "#0F2A2A" }}>
      {/* barra superior */}
      <div
        style={{
          height: 92,
          display: "flex",
          alignItems: "center",
          gap: 18,
          padding: "0 26px",
          background: "#fff",
          borderBottom: "2px solid #E3ECEA",
        }}
      >
        <div style={{ width: 54, height: 54, borderRadius: 14, border: "2px solid #E3ECEA", display: "grid", placeItems: "center" }}>
          <div style={{ width: 24, display: "grid", gap: 5 }}>
            {[0, 1, 2].map((i) => (
              <div key={i} style={{ height: 3, borderRadius: 2, background: "#4A6362" }} />
            ))}
          </div>
        </div>
        <Img src={staticFile(BRAND.icon)} style={{ width: 52, height: 52 }} />
        <div style={{ fontSize: 34, fontWeight: 800 }}>{business}</div>
      </div>
      <div style={{ padding: "26px 26px 0" }}>
        <div style={{ fontSize: 50, fontWeight: 900, letterSpacing: -0.5 }}>Agenda</div>
        <div style={{ fontSize: 27, color: "#4A6362", marginTop: 2 }}>{agenda.date}</div>
        <div style={{ display: "flex", marginTop: 22, gap: 12 }}>
          <div style={{ display: "flex", border: "2px solid #D9E4E2", borderRadius: 14, overflow: "hidden", background: "#fff" }}>
            {["Día", "Semana", "Mes"].map((l, i) => (
              <div
                key={l}
                style={{
                  padding: "12px 20px",
                  fontSize: 27,
                  fontWeight: 700,
                  background: i === 0 ? teal : "transparent",
                  color: i === 0 ? "#fff" : "#4A6362",
                }}
              >
                {l}
              </div>
            ))}
          </div>
          <div style={{ padding: "12px 22px", fontSize: 27, fontWeight: 800, border: "2px solid #D9E4E2", borderRadius: 14, background: "#fff" }}>
            Hoy
          </div>
        </div>
        <div style={{ marginTop: 24, background: "#fff", border: "2px solid #E3ECEA", borderRadius: 26, overflow: "hidden" }}>
          {agenda.rows.map((r, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 16,
                padding: "20px 20px",
                borderTop: i ? "2px solid #EEF3F2" : undefined,
              }}
            >
              <div style={{ width: 92 }}>
                <div style={{ fontSize: 32, fontWeight: 900, color: "#0A4F4C" }}>{r.start}</div>
                <div style={{ fontSize: 24, color: "#8CA3A1" }}>{r.end}</div>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 30, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.who}</div>
                <div style={{ fontSize: 24, color: "#6B8281", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.where}</div>
              </div>
              <div
                style={{
                  padding: "6px 14px",
                  borderRadius: 999,
                  fontSize: 23,
                  fontWeight: 800,
                  background: r.src === "web" ? "#E6F2F1" : "#ECEFEF",
                  color: r.src === "web" ? "#0A4F4C" : "#6B7A7A",
                }}
              >
                {r.src}
              </div>
              <div style={{ padding: "6px 14px", borderRadius: 999, fontSize: 23, fontWeight: 800, background: "#CFE6E3", color: "#0A4F4C" }}>
                Confirmada
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const CheckChip: React.FC<{ text: string; style?: React.CSSProperties }> = ({ text, style }) => (
  <div
    style={{
      position: "absolute",
      display: "flex",
      alignItems: "center",
      gap: 16,
      padding: "18px 30px 18px 18px",
      borderRadius: 999,
      background: "#fff",
      fontFamily: FONT,
      fontWeight: 900,
      fontSize: 40,
      color: COLORS.ink,
      whiteSpace: "nowrap",
      boxShadow: "0 2px 4px rgba(15,42,42,0.10), 0 24px 50px rgba(15,42,42,0.22)",
      ...style,
    }}
  >
    <div style={{ width: 58, height: 58, borderRadius: 999, background: STATUS.confirmed.solid, display: "grid", placeItems: "center" }}>
      <svg width="34" height="34" viewBox="0 0 24 24" fill="none">
        <path d="M5 12.5l4.5 4.5L19 7.5" stroke="#fff" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
    {text}
  </div>
);

/* ───────────────────────── diapositivas ───────────────────────── */

const Cover: React.FC = () => {
  const t = P03_TEXT.cover;
  return (
    <AbsoluteFill>
      <Background />
      <div style={{ position: "absolute", top: SAFE.top + 40, left: 0, right: 0, display: "flex", justifyContent: "center" }}>
        <div
          style={{
            padding: "14px 34px",
            borderRadius: 999,
            background: BRAND.accent,
            color: "#fff",
            fontFamily: FONT,
            fontWeight: 900,
            fontSize: 44,
            letterSpacing: 4,
            textTransform: "uppercase",
            rotate: "-2deg",
            boxShadow: "0 14px 34px rgba(255,107,74,0.4)",
          }}
        >
          {t.kicker}
        </div>
      </div>
      <Headline l1={t.l1} l2={t.l2} size={112} top={SAFE.top + 150} />
      {/* collage de las tres señales */}
      <Notebook style={{ left: 50, top: 740, scale: "0.66", transformOrigin: "top left", rotate: "-8deg" }} />
      <div style={{ position: "absolute", left: 630, top: 700, rotate: "8deg" }}>
        <PhoneFrame width={340} time="21:47" screenColor="#182330" lightStatusBar style={{ position: "relative" }}>
          <IncomingCall />
        </PhoneFrame>
      </div>
      <Buzz side="right" x={960} y={820} />
      <Ticket t={P03_DATA.tickets[1]} style={{ left: 200, top: 1150, rotate: "5deg", scale: "0.6", transformOrigin: "top left" }} />
      <Stamp text="DOBLE" style={{ left: 250, top: 1250, rotate: "-12deg", scale: "0.5", transformOrigin: "top left" }} />
      <SwipeHint />
    </AbsoluteFill>
  );
};

/** Número gigante hueco al fondo + chip "Señal N de 3". */
const SignalChrome: React.FC<{ n: number }> = ({ n }) => (
  <>
    <div
      style={{
        position: "absolute",
        right: -40,
        top: 420,
        fontFamily: FONT,
        fontWeight: 900,
        fontSize: 1100,
        lineHeight: 1,
        color: "rgba(255,107,74,0.08)",
      }}
    >
      {n}
    </div>
    <div style={{ position: "absolute", top: SAFE.top + 30, left: 0, right: 0, display: "flex", justifyContent: "center" }}>
      <div
        style={{
          padding: "12px 30px",
          borderRadius: 999,
          border: "3px solid rgba(207,230,227,0.35)",
          color: "#CFE6E3",
          fontFamily: FONT,
          fontWeight: 800,
          fontSize: 36,
          letterSpacing: 3,
          textTransform: "uppercase",
        }}
      >
        Señal <span style={{ color: BRAND.accent }}>{n}</span> de 3
      </div>
    </div>
  </>
);

const Sub: React.FC<{ text: string; top: number }> = ({ text, top }) => (
  <div
    style={{
      position: "absolute",
      top,
      left: SAFE.side,
      right: SAFE.side,
      textAlign: "center",
      fontFamily: FONT,
      fontWeight: 700,
      fontSize: 44,
      color: "#9FBDB9",
    }}
  >
    {text}
  </div>
);

const Signal: React.FC<{ i: 0 | 1 | 2 }> = ({ i }) => {
  const t = P03_TEXT.signals[i];
  return (
    <AbsoluteFill>
      <Background />
      <SignalChrome n={i + 1} />
      <Headline l1={t.l1} l2={t.l2} size={t.l1.length > 17 || t.l2.length > 17 ? 96 : 104} top={SAFE.top + 130} />
      {i === 0 ? (
        <>
          <Notebook style={{ left: 150, top: 700, rotate: "-4deg" }} />
          <PostIt text={P03_DATA.notebook.postIt} x={610} y={1180} rot={7} />
        </>
      ) : null}
      {i === 1 ? (
        <>
          <div style={{ position: "absolute", left: 345, top: 640, rotate: "5deg" }}>
            <PhoneFrame width={400} time="21:47" screenColor="#182330" lightStatusBar style={{ position: "relative" }}>
              <IncomingCall />
            </PhoneFrame>
          </div>
          <Buzz side="left" x={180} y={860} />
          <Buzz side="right" x={790} y={900} />
          <MissedCalls style={{ left: 90, top: 1200, rotate: "-3deg" }} />
        </>
      ) : null}
      {i === 2 ? (
        <>
          <Ticket t={P03_DATA.tickets[0]} style={{ left: 90, top: 650, rotate: "-7deg" }} />
          <Ticket t={P03_DATA.tickets[1]} style={{ left: 420, top: 960, rotate: "5deg" }} />
          <Stamp text="DOBLE" style={{ left: 60, top: 1230, rotate: "-12deg" }} />
        </>
      ) : null}
      <Sub text={t.sub} top={SAFE.top + 375} />
      <SwipeHint />
    </AbsoluteFill>
  );
};

const Close: React.FC = () => {
  const t = P03_TEXT.close;
  return (
    <AbsoluteFill style={{ background: LIGHT_BG }}>
      {/* resplandor teal y puntos, versión clara del fondo de los vídeos */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(circle at 50% 62%, color-mix(in srgb, ${BRAND.color} 22%, transparent), transparent 55%)`,
        }}
      />
      <AbsoluteFill
        style={{ backgroundImage: "radial-gradient(rgba(11,110,106,0.10) 2px, transparent 2px)", backgroundSize: "48px 48px" }}
      />
      <div style={{ position: "absolute", top: SAFE.top + 30, left: 0, right: 0, display: "flex", justifyContent: "center" }}>
        <Img src={staticFile("brand/turnigo-logo-principal.svg")} style={{ width: 340, height: (340 * 120) / 474.8 }} />
      </div>
      <Headline l1={t.l1} l2={t.l2} size={120} top={SAFE.top + 150} light />
      <div style={{ position: "absolute", left: 310, top: 600, rotate: "-3deg" }}>
        <PhoneFrame width={460} time="9:41" screenColor="#fff" style={{ position: "relative" }}>
          <div style={{ position: "absolute", left: 0, top: 0, width: 580, height: 1100, scale: String(406 / 580), transformOrigin: "top left" }}>
            <AgendaScreen />
          </div>
        </PhoneFrame>
      </div>
      <CheckChip text={t.chips[0]} style={{ left: 60, top: 980, rotate: "-4deg" }} />
      <CheckChip text={t.chips[1]} style={{ right: 70, top: 1120, rotate: "3deg" }} />
      <CheckChip text={t.chips[2]} style={{ left: 80, top: 1215, rotate: "-2deg" }} />
      {/* CTA */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 1325,
          display: "flex",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            padding: "26px 60px 30px",
            borderRadius: 999,
            background: BRAND.color,
            color: "#fff",
            fontFamily: FONT,
            textAlign: "center",
            boxShadow: `0 0 0 8px ${BRAND.accent}, 0 30px 70px rgba(11,110,106,0.45)`,
          }}
        >
          <div style={{ fontSize: 66, fontWeight: 900, lineHeight: 1.05 }}>{t.cta}</div>
          <div style={{ fontSize: 38, fontWeight: 800, color: "#CFE6E3" }}>{t.ctaSub}</div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

/** Carrusel P03: el fotograma N es la diapositiva N+1 (`remotion still … --frame N`). */
export const P03SenalesReservas: React.FC = () => {
  const frame = useCurrentFrame();
  if (frame === 0) return <Cover />;
  if (frame === 1) return <Signal i={0} />;
  if (frame === 2) return <Signal i={1} />;
  if (frame === 3) return <Signal i={2} />;
  return <Close />;
};
