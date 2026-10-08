import type React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { BRAND } from "../../brand";
import { Background } from "../../components/Background";
import { BookingWidget } from "../../components/BookingWidget";
import { LogoFull } from "../../components/Logo";
import { PhoneFrame } from "../../components/PhoneFrame";
import { TableCards, type ZoneSpec } from "../../components/TableCards";
import { WA, WhatsAppBubble } from "../../components/WhatsAppChat";
import { COLORS, FONT, SAFE, STATUS } from "../../theme";
import { P06_DATA, P06_TEXT } from "./script";

/**
 * Carrusel P06 "¿Qué es Turnigo?". Las pantallas imitan la app real (widget, plano de sala en tarjetas)
 * con datos ficticios; los componentes animados se "congelan" pasando frames de acción en el pasado.
 */

const LIGHT_BG = "#F3F7F6";
const ACCENT_ON_LIGHT = "#C8401F";
const PAST = -1000;
const NEVER = 1e9;

/* ───────────────────────── piezas comunes ───────────────────────── */

const Headline: React.FC<{ l1: string; l2: string; size?: number; top?: number; light?: boolean }> = ({
  l1,
  l2,
  size = 112,
  top = SAFE.top + 120,
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
    }}
  >
    <div>{l1}</div>
    <div style={{ color: light ? ACCENT_ON_LIGHT : BRAND.accent }}>{l2}</div>
  </div>
);

const Sub: React.FC<{ text: string; top: number; light?: boolean }> = ({ text, top, light }) => (
  <div
    style={{
      position: "absolute",
      top,
      left: SAFE.side,
      right: SAFE.side,
      textAlign: "center",
      fontFamily: FONT,
      fontWeight: 700,
      fontSize: 42,
      color: light ? COLORS.inkMuted : "#9FBDB9",
    }}
  >
    {text}
  </div>
);

/** Fondo claro de "solución": gris verdoso con resplandor teal y puntos (versión clara del de los vídeos). */
const LightBackground: React.FC = () => (
  <AbsoluteFill style={{ background: LIGHT_BG }}>
    <AbsoluteFill
      style={{ background: `radial-gradient(circle at 50% 62%, color-mix(in srgb, ${BRAND.color} 20%, transparent), transparent 58%)` }}
    />
    <AbsoluteFill style={{ backgroundImage: "radial-gradient(rgba(11,110,106,0.10) 2px, transparent 2px)", backgroundSize: "48px 48px" }} />
  </AbsoluteFill>
);

/** "Función N de 3" arriba + número gigante hueco al fondo. */
const FeatureChrome: React.FC<{ n: number }> = ({ n }) => (
  <>
    <div
      style={{
        position: "absolute",
        right: -50,
        top: 520,
        fontFamily: FONT,
        fontWeight: 900,
        fontSize: 1100,
        lineHeight: 1,
        color: "rgba(11,110,106,0.06)",
      }}
    >
      {n}
    </div>
    <div style={{ position: "absolute", top: SAFE.top + 30, left: 0, right: 0, display: "flex", justifyContent: "center" }}>
      <div
        style={{
          padding: "12px 30px",
          borderRadius: 999,
          border: `3px solid color-mix(in srgb, ${BRAND.color} 30%, transparent)`,
          color: BRAND.colorDark,
          fontFamily: FONT,
          fontWeight: 800,
          fontSize: 36,
          letterSpacing: 3,
          textTransform: "uppercase",
          background: "rgba(255,255,255,0.6)",
        }}
      >
        Función <span style={{ color: ACCENT_ON_LIGHT }}>{n}</span> de 3
      </div>
    </div>
  </>
);

const SwipeHint: React.FC<{ light?: boolean }> = ({ light }) => (
  <div
    style={{
      position: "absolute",
      right: SAFE.side,
      bottom: SAFE.bottom + 30,
      display: "flex",
      alignItems: "center",
      gap: 18,
      fontFamily: FONT,
      fontWeight: 800,
      fontSize: 40,
      color: light ? COLORS.inkMuted : "#CFE6E3",
    }}
  >
    {P06_TEXT.swipe}
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

const CheckChip: React.FC<{ text: string; style?: React.CSSProperties }> = ({ text, style }) => (
  <div
    style={{
      position: "absolute",
      display: "flex",
      alignItems: "center",
      gap: 16,
      padding: "16px 30px 16px 16px",
      borderRadius: 999,
      background: "#fff",
      fontFamily: FONT,
      fontWeight: 900,
      fontSize: 38,
      color: COLORS.ink,
      whiteSpace: "nowrap",
      boxShadow: "0 2px 4px rgba(15,42,42,0.10), 0 24px 50px rgba(15,42,42,0.22)",
      ...style,
    }}
  >
    <div style={{ width: 54, height: 54, borderRadius: 999, background: STATUS.confirmed.solid, display: "grid", placeItems: "center" }}>
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
        <path d="M5 12.5l4.5 4.5L19 7.5" stroke="#fff" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
    {text}
  </div>
);

/* ───────────────────────── visuales ───────────────────────── */

/** Móvil con el widget real congelado en "elige día y hora" (sábado 10 · 21:00 marcados). */
const WidgetPhone: React.FC<{ width: number; style?: React.CSSProperties }> = ({ width, style }) => {
  const s = (width - 2 * Math.round(width * 0.028)) / 390;
  return (
    <PhoneFrame width={width} time="9:41" screenColor="#fff" style={{ position: "relative", ...style }}>
      <BookingWidget
        s={s}
        business={P06_DATA.business}
        {...P06_DATA.widget}
        days={[...P06_DATA.widget.days]}
        times={[...P06_DATA.widget.times]}
        at={{
          tapGuests: PAST,
          tapContinue: PAST,
          step2: PAST,
          tapDay: PAST,
          tapTime: PAST,
          step3: NEVER,
          typeName: NEVER,
          typePhone: NEVER,
          typeEmail: NEVER,
          tapConfirm: NEVER,
        }}
      />
    </PhoneFrame>
  );
};

/** Plano de sala real (tarjetas por zona) en un viernes con todos los estados a la vista. */
const ZONES: ZoneSpec[] = [
  {
    name: "Interior",
    tables: [
      { name: "Mesa 1", cap: "2-4", states: [{ at: 0, health: "sentada", booking: { who: "Lola · 2 pers.", time: "20:30" } }] },
      { name: "Mesa 2", cap: "2-4", states: [{ at: 0, health: "llegar", booking: { who: "Marta · 4 pers.", time: "21:00" } }] },
      { name: "Mesa 3", cap: "2", states: [{ at: 0, health: "libre", next: "Próxima reserva a las 22:00" }] },
      { name: "Mesa 4", cap: "4-6", states: [{ at: 0, health: "reservada", booking: { who: "Sr. Pérez · 6 pers.", time: "21:30" } }] },
      { name: "Mesa 5", cap: "2-4", states: [{ at: 0, health: "retrasada", booking: { who: "Nuria · 3 pers.", time: "20:45" } }] },
      { name: "Mesa 6", cap: "2-4", states: [{ at: 0, health: "sentada", booking: { who: "Andrés · 2 pers.", time: "20:15" } }] },
    ],
  },
  {
    name: "Terraza",
    tables: [
      { name: "Terraza 1", cap: "2", states: [{ at: 0, health: "libre" }] },
      { name: "Terraza 2", cap: "2-4", states: [{ at: 0, health: "sentada", booking: { who: "Carmen · 4 pers.", time: "20:30" } }] },
      { name: "Terraza 3", cap: "2", states: [{ at: 0, health: "reservada", booking: { who: "Pablo · 2 pers.", time: "22:15" } }] },
    ],
  },
];

/** Recordatorio de WhatsApp (burbujas genéricas, sin logo) y email de reseña (ficha genérica). */
const ReminderAndReview: React.FC = () => (
  <>
    <div
      style={{
        position: "absolute",
        left: 110,
        top: 640,
        width: 860,
        padding: "30px 30px 34px",
        borderRadius: 40,
        background: WA.chatBg,
        boxShadow: "0 2px 4px rgba(15,42,42,0.10), 0 34px 80px rgba(15,42,42,0.28)",
        display: "flex",
        flexDirection: "column",
        gap: 16,
        rotate: "-2deg",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 16, fontFamily: FONT, marginBottom: 6 }}>
        <div style={{ padding: "8px 20px", borderRadius: 999, background: WA.header, color: "#fff", fontSize: 30, fontWeight: 900 }}>
          WhatsApp · 24 h antes
        </div>
      </div>
      <WhatsAppBubble from="me" text={P06_DATA.reminder} time="21:00" ticks="read" scale={1.3} maxWidth="92%" />
      <WhatsAppBubble from="them" text={P06_DATA.reply} time="21:02" scale={1.3} />
    </div>
    <div
      style={{
        position: "absolute",
        left: 150,
        top: 1050,
        width: 800,
        padding: "34px 40px 38px",
        borderRadius: 36,
        background: "#fff",
        fontFamily: FONT,
        color: COLORS.ink,
        boxShadow: "0 2px 4px rgba(15,42,42,0.10), 0 34px 80px rgba(15,42,42,0.28)",
        rotate: "2deg",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 30, fontWeight: 800, color: COLORS.inkMuted }}>Email · después de la visita</span>
        <svg width="56" height="44" viewBox="0 0 28 22">
          <rect x="1" y="1" width="26" height="20" rx="4" fill={BRAND.color} />
          <path d="M3 4l11 8 11-8" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <div style={{ fontSize: 46, fontWeight: 900, marginTop: 10 }}>{P06_DATA.review.subject}</div>
      <div style={{ fontSize: 36, fontWeight: 700, color: COLORS.inkMuted, marginTop: 4 }}>{P06_DATA.review.body}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 24, marginTop: 24 }}>
        <div style={{ padding: "16px 34px", borderRadius: 18, background: BRAND.color, color: "#fff", fontSize: 36, fontWeight: 900 }}>
          {P06_DATA.review.button}
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {[0, 1, 2, 3, 4].map((i) => (
            <svg key={i} width="46" height="46" viewBox="0 0 24 24">
              <path d="M12 2.5l2.9 6.1 6.6.8-4.9 4.5 1.3 6.6L12 17.2l-5.9 3.3 1.3-6.6-4.9-4.5 6.6-.8z" fill="#F5B301" />
            </svg>
          ))}
        </div>
      </div>
    </div>
  </>
);

/* ───────────────────────── iconos del cierre ───────────────────────── */

const ICON_PATHS: React.ReactNode[] = [
  // Restaurantes: cubiertos
  <g key="r" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round">
    <path d="M7 3v8M5 3v5a2 2 0 0 0 4 0V3M7 11v10" />
    <path d="M17 21V3c-2 1.5-3 4-3 7h3" />
  </g>,
  // Peluquerías y estética: tijeras
  <g key="p" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round">
    <circle cx="6" cy="18" r="3" />
    <circle cx="6" cy="6" r="3" />
    <path d="M8.5 7.5L20 18M8.5 16.5L20 6" />
  </g>,
  // Consultas: bocadillo con corazón
  <g key="c" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinejoin="round">
    <path d="M4 5h16v11H9l-5 4z" />
    <path d="M12 13.5s-3-1.8-3-3.8a1.6 1.6 0 0 1 3-.8 1.6 1.6 0 0 1 3 .8c0 2-3 3.8-3 3.8z" fill="#fff" stroke="none" />
  </g>,
  // Autónomos: maletín
  <g key="a" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinejoin="round">
    <rect x="3" y="7" width="18" height="13" rx="2" />
    <path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M3 12h18" />
  </g>,
];

/* ───────────────────────── diapositivas ───────────────────────── */

const Cover: React.FC = () => {
  const t = P06_TEXT.cover;
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
      <Headline l1={t.l1} l2={t.l2} size={168} top={SAFE.top + 150} />
      <Sub text={t.sub} top={SAFE.top + 520} />
      {/* collage: plano de sala detrás, móvil con el widget delante, burbuja de WhatsApp encima */}
      <div style={{ position: "absolute", left: 470, top: 860, rotate: "6deg", scale: "0.5", transformOrigin: "top left" }}>
        <TableCards zones={ZONES} business={P06_DATA.business} shift="Cena" style={{ position: "relative" }} />
      </div>
      <div style={{ position: "absolute", left: 110, top: 820, rotate: "-6deg" }}>
        <WidgetPhone width={400} />
      </div>
      <div style={{ position: "absolute", left: 440, top: 1250, width: 560, rotate: "3deg", display: "flex", flexDirection: "column" }}>
        <WhatsAppBubble from="me" text="Te recordamos tu reserva de mañana a las 21:00." time="21:00" ticks="read" scale={1.15} maxWidth="100%" />
      </div>
      <SwipeHint />
    </AbsoluteFill>
  );
};

const Feature: React.FC<{ i: 0 | 1 | 2 }> = ({ i }) => {
  const t = P06_TEXT.features[i];
  return (
    <AbsoluteFill>
      <LightBackground />
      <FeatureChrome n={i + 1} />
      <Headline l1={t.l1} l2={t.l2} size={108} light />
      <Sub text={t.sub} top={SAFE.top + 365} light />
      {i === 0 ? (
        <>
          <div style={{ position: "absolute", left: 230, top: 650, rotate: "-3deg" }}>
            <WidgetPhone width={470} />
          </div>
          <CheckChip text={t.chips[0] ?? ""} style={{ left: 40, top: 1300, rotate: "-4deg" }} />
          <CheckChip text={t.chips[1] ?? ""} style={{ right: 30, top: 1010, rotate: "3deg" }} />
        </>
      ) : null}
      {i === 1 ? (
        <>
          <div style={{ position: "absolute", left: 194, top: 650, scale: "0.72", transformOrigin: "top left", rotate: "-1.5deg" }}>
            <TableCards zones={ZONES} business={P06_DATA.business} shift="Cena" style={{ position: "relative" }} />
          </div>
          <CheckChip text={t.chips[0] ?? ""} style={{ left: 60, top: 1370, rotate: "-2deg" }} />
        </>
      ) : null}
      {i === 2 ? <ReminderAndReview /> : null}
      <SwipeHint light />
    </AbsoluteFill>
  );
};

const Close: React.FC = () => {
  const t = P06_TEXT.close;
  const tileW = 440;
  return (
    <AbsoluteFill>
      <Background />
      <AbsoluteFill style={{ background: `radial-gradient(circle at 50% 38%, color-mix(in srgb, ${BRAND.color} 60%, transparent), transparent 60%)` }} />
      <div style={{ position: "absolute", top: SAFE.top + 40, left: 0, right: 0, display: "flex", justifyContent: "center" }}>
        <LogoFull width={520} />
      </div>
      <Headline l1={t.l1} l2={t.l2} size={118} top={SAFE.top + 230} />
      <div
        style={{
          position: "absolute",
          top: 720,
          left: (1080 - (tileW * 2 + 28)) / 2,
          width: tileW * 2 + 28,
          display: "grid",
          gridTemplateColumns: `repeat(2, ${tileW}px)`,
          gap: 28,
        }}
      >
        {t.tiles.map((label, i) => (
          <div
            key={label}
            style={{
              height: 220,
              borderRadius: 32,
              background: "rgba(255,255,255,0.08)",
              border: "2px solid rgba(255,255,255,0.14)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 18,
              rotate: `${[-2, 1.5, 1, -1.5][i]}deg`,
            }}
          >
            <div
              style={{
                width: 92,
                height: 92,
                borderRadius: 26,
                background: i % 2 ? BRAND.accent : BRAND.color,
                display: "grid",
                placeItems: "center",
                boxShadow: "0 12px 26px rgba(0,0,0,0.3)",
              }}
            >
              <svg width="56" height="56" viewBox="0 0 24 24">
                {ICON_PATHS[i]}
              </svg>
            </div>
            <div style={{ fontFamily: FONT, fontWeight: 900, fontSize: 40, color: "#fff", textAlign: "center", lineHeight: 1.1, padding: "0 16px" }}>
              {label}
            </div>
          </div>
        ))}
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: 1260, display: "flex", justifyContent: "center" }}>
        <div
          style={{
            padding: "26px 64px 30px",
            borderRadius: 999,
            background: "#fff",
            color: BRAND.color,
            fontFamily: FONT,
            textAlign: "center",
            boxShadow: `0 0 0 8px ${BRAND.accent}, 0 30px 70px rgba(0,0,0,0.5)`,
          }}
        >
          <div style={{ fontSize: 70, fontWeight: 900, lineHeight: 1.05 }}>{t.cta}</div>
          <div style={{ fontSize: 40, fontWeight: 800, color: COLORS.inkMuted }}>{t.ctaSub}</div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

/** Carrusel P06: el fotograma N es la diapositiva N+1 (`remotion still P06-QueEsTurnigo --frame N`). */
export const P06QueEsTurnigo: React.FC = () => {
  const frame = useCurrentFrame();
  if (frame === 0) return <Cover />;
  if (frame === 1) return <Feature i={0} />;
  if (frame === 2) return <Feature i={1} />;
  if (frame === 3) return <Feature i={2} />;
  return <Close />;
};
