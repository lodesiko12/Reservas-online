import { Audio } from "@remotion/media";
import { loadFont } from "@remotion/google-fonts/Caveat";
import type React from "react";
import {
  AbsoluteFill,
  Easing,
  interpolate,
  Sequence,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { BRAND } from "../../brand";
import { Sfx } from "../../components/AudioLayers";
import { Background } from "../../components/Background";
import { Burst } from "../../components/Burst";
import { EndCard } from "../../components/EndCard";
import { LogoMark } from "../../components/Logo";
import { Punch } from "../../components/Punch";
import { WhatsAppBubble } from "../../components/WhatsAppChat";
import {
  EASE_IN,
  EASE_OUT,
  clamp,
  pop,
  pulse,
  springIn,
  whip,
} from "../../lib/anim";
import { makeBeats, useBeats } from "../../lib/beats";
import { TRACK_DROP4 } from "../../music/track";
import { COLORS, FONT, RADIUS, STATUS, VIDEO } from "../../theme";
import {
  P05_BEATS as b,
  P05_KO,
  P05_R1,
  P05_R2,
  P05_R3,
  P05_ROUNDS,
} from "./script";

const { fontFamily: HAND } = loadFont("normal", {
  weights: ["600", "700"],
  subsets: ["latin", "latin-ext"],
});

const TRACK = TRACK_DROP4;
export const P05_DURATION = makeBeats(TRACK, VIDEO.fps).frame(b.total);

type F = (n: number) => number;

const W = 1080;
const MID = 540;
/** Centro de cada mitad y ancho útil de su contenido. */
const LC = 270;
const RC = 810;
const COL_W = 460;
const STAGE_TOP = 480;
const RED = STATUS.noShow.solid;
const GREEN = STATUS.confirmed.solid;
/** Coral oscuro para texto sobre claro (contraste). */
const CORAL_INK = "#C8401F";
const PAPER = "#F6EFD9";
const PEN = "#1F3A93";

// ───────────────────────── Iconos ─────────────────────────

const NotebookIcon: React.FC<{ size: number }> = ({ size }) => (
  <svg width={size} height={size} viewBox="0 0 100 100">
    <rect x="18" y="8" width="66" height="84" rx="8" fill={PAPER} />
    <rect
      x="18"
      y="8"
      width="66"
      height="84"
      rx="8"
      fill="none"
      stroke="#D8C9A3"
      strokeWidth="3"
    />
    {[30, 44, 58, 72].map((y) => (
      <line
        key={y}
        x1="32"
        x2="74"
        y1={y}
        y2={y}
        stroke="#9DB4E0"
        strokeWidth="3"
        strokeLinecap="round"
      />
    ))}
    <line x1="30" x2="30" y1="14" y2="86" stroke="#E07B6A" strokeWidth="2.5" />
    {[20, 36, 52, 68, 84].map((y) => (
      <rect
        key={y}
        x="10"
        y={y - 4}
        width="16"
        height="7"
        rx="3.5"
        fill="#B8C4C3"
      />
    ))}
  </svg>
);

const PhoneIcon: React.FC<{ size: number; color: string }> = ({
  size,
  color,
}) => (
  <svg width={size} height={size} viewBox="0 0 24 24">
    <path
      d="M6.6 10.8a15.1 15.1 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.25 11.4 11.4 0 0 0 3.6.57 1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.25.2 2.45.57 3.57a1 1 0 0 1-.25 1z"
      fill={color}
    />
    <path
      d="M15 3l6 6M21 3l-6 6"
      stroke={color}
      strokeWidth="2.2"
      strokeLinecap="round"
    />
  </svg>
);

const CheckIcon: React.FC<{ size: number }> = ({ size }) => (
  <svg width={size} height={size} viewBox="0 0 24 24">
    <circle cx="12" cy="12" r="11" fill={GREEN} />
    <path
      d="M7 12.5l3.2 3.2L17 9"
      fill="none"
      stroke="#fff"
      strokeWidth="2.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

// ───────────────────────── Piezas comunes ─────────────────────────

/** Entrada con muelle desde un lado + salida rápida hacia abajo. Sobre él va todo el contenido de una ronda. */
const RoundStage: React.FC<{
  from: number;
  to: number;
  side: "left" | "right";
  children: React.ReactNode;
}> = ({ from, to, side, children }) => {
  const frame = useCurrentFrame();
  if (frame < from || frame >= to) return null;
  const enter = whip(frame, from, "in", side, 9, 620);
  const exit = interpolate(frame, [to - 5, to], [0, 1], {
    ...clamp,
    easing: EASE_IN,
  });
  return (
    <AbsoluteFill
      style={{
        ...enter,
        translate: `${enter.translate.split(" ")[0]} ${exit * 160}px`,
        opacity: 1 - exit,
      }}
    >
      {children}
    </AbsoluteFill>
  );
};

/** Chip de veredicto que cae al final de cada mitad. */
const Verdict: React.FC<{
  text: string;
  at: number;
  good: boolean;
  x: number;
  y: number;
}> = ({ text, at, good, x, y }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  if (frame < at) return null;
  const p = pop(frame, fps, at);
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        translate: "-50% 0",
        padding: "16px 34px",
        borderRadius: RADIUS.pill,
        background: good ? GREEN : RED,
        color: "#fff",
        fontFamily: FONT,
        fontWeight: 900,
        fontSize: 42,
        whiteSpace: "nowrap",
        rotate: `${good ? 2 : -3}deg`,
        scale: String(interpolate(p, [0, 1], [2, 1])),
        opacity: interpolate(p, [0, 0.3], [0, 1], clamp),
        boxShadow: "0 18px 40px rgba(0,0,0,0.35)",
      }}
    >
      {text}
    </div>
  );
};

// ───────────────────────── Título y marcador ─────────────────────────

/** Nombre de cada bando: entra de golpe en el título y viaja al marcador en el drop. */
const Contender: React.FC<{
  side: "left" | "right";
  at: number;
  morphAt: number;
  koAt: number;
}> = ({ side, at, morphAt, koAt }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  if (frame < at) return null;
  const left = side === "left";
  const slam = springIn(frame, fps, at, {
    damping: 12,
    stiffness: 240,
    mass: 0.7,
  });
  const m = interpolate(frame, [morphAt, morphAt + 10], [0, 1], {
    ...clamp,
    easing: Easing.bezier(0.65, 0, 0.35, 1),
  });
  const x = interpolate(m, [0, 1], [left ? LC : RC, left ? 170 : 910]);
  const y = interpolate(m, [0, 1], [820, 255]);
  const scale =
    interpolate(slam, [0, 1], [2.6, 1]) * interpolate(m, [0, 1], [1, 0.54]);
  // En el K.O. el bando perdedor se tacha y todo el marcador se va.
  const strike = left
    ? interpolate(frame, [koAt, koAt + 6], [0, 1], {
        ...clamp,
        easing: EASE_OUT,
      })
    : 0;
  const gone = interpolate(frame, [koAt + 4, koAt + 10], [1, 0], clamp);

  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        translate: "-50% -50%",
        scale: String(scale),
        opacity: interpolate(slam, [0, 0.25], [0, 1], clamp) * gone,
        filter: `blur(${interpolate(slam, [0, 0.5], [10, 0], clamp)}px)`,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 18,
      }}
    >
      {left ? <NotebookIcon size={180} /> : <LogoMark size={164} />}
      <div
        style={{
          position: "relative",
          fontFamily: FONT,
          fontWeight: 900,
          fontSize: 78,
          letterSpacing: 2,
          color: left ? COLORS.white : COLORS.ink,
        }}
      >
        {left ? "LIBRETA" : "TURNIGO"}
        {left ? (
          <span
            style={{
              position: "absolute",
              left: -10,
              top: "52%",
              height: 18,
              width: `calc(${strike} * (100% + 20px))`,
              background: RED,
              borderRadius: 9,
              rotate: "-4deg",
            }}
          />
        ) : null}
      </div>
    </div>
  );
};

const VsBadge: React.FC<{ at: number; morphAt: number; koAt: number }> = ({
  at,
  morphAt,
  koAt,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  if (frame < at) return null;
  const slam = springIn(frame, fps, at, {
    damping: 9,
    stiffness: 260,
    mass: 0.7,
  });
  const m = interpolate(frame, [morphAt, morphAt + 10], [0, 1], {
    ...clamp,
    easing: Easing.bezier(0.65, 0, 0.35, 1),
  });
  const gone = interpolate(frame, [koAt + 2, koAt + 8], [1, 0], clamp);
  const size = 220;
  return (
    <div
      style={{
        position: "absolute",
        left: MID,
        top: interpolate(m, [0, 1], [820, 255]),
        translate: "-50% -50%",
        width: size,
        height: size,
        borderRadius: "50%",
        background: BRAND.accent,
        border: "12px solid #fff",
        boxSizing: "border-box",
        display: "grid",
        placeItems: "center",
        fontFamily: FONT,
        fontWeight: 900,
        fontSize: 108,
        color: "#fff",
        letterSpacing: -4,
        rotate: `${interpolate(slam, [0, 1], [-40, -8])}deg`,
        scale: String(
          interpolate(slam, [0, 1], [3.2, 1]) *
            interpolate(m, [0, 1], [1, 0.56]),
        ),
        opacity: interpolate(slam, [0, 0.2], [0, 1], clamp) * gone,
        boxShadow: `0 0 0 10px color-mix(in srgb, ${BRAND.accent} 35%, transparent), 0 30px 80px rgba(0,0,0,0.5)`,
        zIndex: 5,
      }}
    >
      VS
    </div>
  );
};

/** Marcador: 0 fijo para la libreta; Turnigo suma un punto al final de cada ronda. */
const Score: React.FC<{ showAt: number; points: number[]; koAt: number }> = ({
  showAt,
  points,
  koAt,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  if (frame < showAt) return null;
  const p = pop(frame, fps, showAt);
  const right = points.filter((at) => frame >= at).length;
  const last = [...points].reverse().find((at) => frame >= at);
  const gone = interpolate(frame, [koAt + 4, koAt + 10], [1, 0], clamp);
  const digit = (n: number, x: number, color: string, at?: number) => (
    <div
      style={{
        position: "absolute",
        left: x,
        top: 255,
        translate: "-50% -50%",
        fontFamily: FONT,
        fontWeight: 900,
        fontSize: 104,
        fontVariantNumeric: "tabular-nums",
        color,
        scale: String(
          interpolate(p, [0, 1], [0.3, 1]) *
            (at === undefined ? 1 : pulse(frame, at, 1.45, 14)),
        ),
        opacity: interpolate(p, [0, 0.3], [0, 1], clamp) * gone,
      }}
    >
      {n}
    </div>
  );
  return (
    <>
      {digit(0, 400, "rgba(255,255,255,0.55)")}
      {digit(right, 680, GREEN, last)}
      {points.map((at) => (
        <Burst
          key={at}
          at={at}
          color={GREEN}
          size={90}
          spread={120}
          sparks={12}
          x={680}
          y={255}
        />
      ))}
      {points.map((at) =>
        frame >= at && frame < at + 22 ? (
          <div
            key={`plus-${at}`}
            style={{
              position: "absolute",
              left: 760,
              top:
                230 -
                interpolate(frame, [at, at + 22], [0, 70], {
                  easing: EASE_OUT,
                }),
              fontFamily: FONT,
              fontWeight: 900,
              fontSize: 54,
              color: GREEN,
              opacity: interpolate(
                frame,
                [at, at + 4, at + 16, at + 22],
                [0, 1, 1, 0],
                clamp,
              ),
            }}
          >
            +1
          </div>
        ) : null,
      )}
    </>
  );
};

/** Rótulo de ronda centrado sobre la división, con campanazo. */
const RoundChip: React.FC<{ text: string; from: number; to: number }> = ({
  text,
  from,
  to,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  if (frame < from || frame >= to) return null;
  const p = pop(frame, fps, from);
  const out = interpolate(frame, [to - 5, to], [1, 0], clamp);
  return (
    <div
      style={{
        position: "absolute",
        left: MID,
        top: 392,
        translate: "-50% -50%",
        padding: "14px 36px",
        borderRadius: RADIUS.pill,
        background: COLORS.ink,
        color: "#fff",
        border: `5px solid ${BRAND.accent}`,
        fontFamily: FONT,
        fontWeight: 900,
        fontSize: 40,
        letterSpacing: 1,
        whiteSpace: "nowrap",
        scale: String(interpolate(p, [0, 1], [0.4, 1])),
        opacity: interpolate(p, [0, 0.3], [0, 1], clamp) * out,
        boxShadow: "0 14px 34px rgba(0,0,0,0.35)",
        zIndex: 6,
      }}
    >
      {text}
    </div>
  );
};

// ───────────────────────── Ronda 1 ─────────────────────────

const RowCard: React.FC<{
  at: number;
  dark: boolean;
  icon: React.ReactNode;
  title: string;
  sub: string;
  accent: string;
  /** Vibra como un teléfono sonando al entrar. */
  ring?: boolean;
}> = ({ at, dark, icon, title, sub, accent, ring }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  if (frame < at) return null;
  const p = springIn(frame, fps, at, {
    damping: 13,
    stiffness: 230,
    mass: 0.6,
  });
  const t = frame - at;
  const buzz = ring && t < 10 ? Math.sin(t * 3.1) * 9 * (1 - t / 10) : 0;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 20,
        height: 112,
        padding: "0 24px",
        borderRadius: 22,
        background: dark ? "rgba(255,255,255,0.07)" : COLORS.card,
        border: dark
          ? "2px solid rgba(255,255,255,0.10)"
          : `2px solid ${COLORS.cardBorder}`,
        borderLeft: `10px solid ${accent}`,
        boxShadow: dark ? "none" : "0 10px 26px rgba(15,42,42,0.12)",
        fontFamily: FONT,
        translate: `${interpolate(p, [0, 1], [dark ? -120 : 120, 0]) + buzz}px 0`,
        opacity: interpolate(p, [0, 0.35], [0, 1], clamp),
      }}
    >
      {icon}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          lineHeight: 1.15,
          minWidth: 0,
        }}
      >
        <span
          style={{
            fontSize: 37,
            fontWeight: 900,
            color: dark ? COLORS.white : COLORS.ink,
            whiteSpace: "nowrap",
          }}
        >
          {title}
        </span>
        <span
          style={{
            fontSize: 29,
            fontWeight: 700,
            color: dark ? COLORS.textMuted : BRAND.color,
          }}
        >
          {sub}
        </span>
      </div>
    </div>
  );
};

type Side = "left" | "right";

const Round1: React.FC<{ f: F; side: Side }> = ({ f, side }) =>
  side === "left" ? (
    <RoundStage from={f(b.r1)} to={f(b.r2)} side="left">
      <div
        style={{
          position: "absolute",
          left: LC - COL_W / 2,
          top: STAGE_TOP,
          width: COL_W,
          display: "flex",
          flexDirection: "column",
          gap: 18,
        }}
      >
        {P05_R1.missed.map((time, i) => (
          <RowCard
            key={i}
            at={f(5 + i)}
            dark
            ring
            icon={<PhoneIcon size={52} color={RED} />}
            title="Llamada perdida"
            sub={`sábado · ${time}`}
            accent={RED}
          />
        ))}
      </div>
      <Verdict
        text={P05_R1.verdictLeft}
        at={f(10)}
        good={false}
        x={LC}
        y={1150}
      />
    </RoundStage>
  ) : (
    <RoundStage from={f(b.r1)} to={f(b.r2)} side="right">
      <div
        style={{
          position: "absolute",
          left: RC - COL_W / 2,
          top: STAGE_TOP,
          width: COL_W,
          display: "flex",
          flexDirection: "column",
          gap: 18,
        }}
      >
        {P05_R1.booked.map((r, i) => (
          <RowCard
            key={i}
            at={f(5.5 + i)}
            dark={false}
            icon={<CheckIcon size={52} />}
            title={r.name}
            sub={r.sub}
            accent={GREEN}
          />
        ))}
      </div>
      <Verdict text={P05_R1.verdictRight} at={f(10.5)} good x={RC} y={1150} />
    </RoundStage>
  );

// ───────────────────────── Ronda 2 ─────────────────────────

const LINE_H = 92;

const Notebook: React.FC<{ f: F }> = ({ f }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = springIn(frame, fps, f(b.r2), { damping: 14, stiffness: 160 });
  const qAt = f(18);
  const q = frame >= qAt ? pop(frame, fps, qAt) : 0;
  return (
    <div
      style={{
        position: "absolute",
        left: LC - COL_W / 2,
        top: STAGE_TOP + 10,
        width: COL_W,
        height: 700,
        rotate: `${interpolate(enter, [0, 1], [-12, -2.5])}deg`,
        translate: `0px ${interpolate(enter, [0, 1], [500, 0])}px`,
        borderRadius: 14,
        background: PAPER,
        backgroundImage: `repeating-linear-gradient(to bottom, transparent 0, transparent ${LINE_H - 3}px, #A9BDE3 ${LINE_H - 3}px, #A9BDE3 ${LINE_H}px)`,
        backgroundPosition: "0 40px",
        boxShadow: "0 30px 70px rgba(0,0,0,0.5)",
        overflow: "visible",
      }}
    >
      {/* Margen rojo y anillas */}
      <div
        style={{
          position: "absolute",
          left: 66,
          top: 0,
          bottom: 0,
          width: 3,
          background: "#E07B6A",
        }}
      />
      {P05_R2.notes.map((n, i) => {
        const at = f(n.beat);
        const write = interpolate(frame, [at, at + 9], [0, 100], clamp);
        const strike =
          n.strikeBeat === undefined
            ? 0
            : interpolate(
                frame,
                [f(n.strikeBeat), f(n.strikeBeat) + 6],
                [0, 1],
                clamp,
              );
        const circle =
          n.circleBeat === undefined
            ? 0
            : interpolate(
                frame,
                [f(n.circleBeat), f(n.circleBeat) + 9],
                [0, 1],
                { ...clamp, easing: EASE_OUT },
              );
        const y = 40 + (i + 1) * LINE_H - 70;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: 84,
              top: y,
              width: COL_W - 100,
              height: 70,
            }}
          >
            <div
              style={{
                fontFamily: HAND,
                fontWeight: 700,
                fontSize: 58,
                lineHeight: "70px",
                color: PEN,
                whiteSpace: "nowrap",
                rotate: `${(i % 2 ? 1 : -1) * 1.2}deg`,
                clipPath: `inset(0 ${100 - write}% 0 0)`,
                opacity: 1 - strike * 0.35,
              }}
            >
              {n.text}
            </div>
            {strike > 0 ? (
              <svg
                width={COL_W - 100}
                height={70}
                style={{
                  position: "absolute",
                  left: -6,
                  top: 0,
                  overflow: "visible",
                }}
              >
                <path
                  d="M0 38 L40 28 L80 44 L120 26 L160 42 L200 28 L240 44 L280 30 L320 40 L350 32"
                  fill="none"
                  stroke={RED}
                  strokeWidth={7}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  pathLength={1}
                  strokeDasharray={1}
                  strokeDashoffset={1 - strike}
                />
              </svg>
            ) : null}
            {circle > 0 ? (
              <svg
                width={COL_W - 60}
                height={110}
                style={{
                  position: "absolute",
                  left: -30,
                  top: -20,
                  overflow: "visible",
                }}
              >
                <ellipse
                  cx={(COL_W - 60) / 2}
                  cy={55}
                  rx={(COL_W - 60) / 2}
                  ry={48}
                  fill="none"
                  stroke={RED}
                  strokeWidth={7}
                  pathLength={1}
                  strokeDasharray={1}
                  strokeDashoffset={1 - circle}
                  transform={`rotate(-3 ${(COL_W - 60) / 2} 55)`}
                />
              </svg>
            ) : null}
          </div>
        );
      })}
      {q > 0 ? (
        <div
          style={{
            position: "absolute",
            right: 12,
            top: 300,
            fontFamily: HAND,
            fontWeight: 700,
            fontSize: 170,
            color: RED,
            rotate: "12deg",
            scale: String(interpolate(q, [0, 1], [2.2, 1])),
            opacity: interpolate(q, [0, 0.3], [0, 1], clamp),
            textShadow: "0 8px 24px rgba(0,0,0,0.25)",
          }}
        >
          ¿?
        </div>
      ) : null}
    </div>
  );
};

const MiniAgenda: React.FC<{ f: F }> = ({ f }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <div
      style={{
        position: "absolute",
        left: RC - COL_W / 2,
        top: STAGE_TOP + 10,
        width: COL_W,
        borderRadius: RADIUS.lg,
        background: COLORS.card,
        border: `2px solid ${COLORS.cardBorder}`,
        boxShadow: "0 24px 60px rgba(15,42,42,0.16)",
        overflow: "hidden",
        fontFamily: FONT,
      }}
    >
      <div
        style={{
          padding: "26px 30px 18px",
          borderBottom: `2px solid ${COLORS.cardBorder}`,
        }}
      >
        <div style={{ fontSize: 46, fontWeight: 900, color: COLORS.ink }}>
          Agenda
        </div>
        <div style={{ fontSize: 30, fontWeight: 700, color: COLORS.inkMuted }}>
          sábado · cena
        </div>
      </div>
      {P05_R2.agenda.map((r, i) => {
        const at = f(r.beat);
        const open = interpolate(frame, [at, at + 6], [0, 1], {
          ...clamp,
          easing: EASE_OUT,
        });
        const p = pop(frame, fps, at + 1);
        const glow = interpolate(
          frame,
          [at + 1, at + 6, at + 26],
          [0, 1, 0],
          clamp,
        );
        return (
          <div
            key={i}
            style={{
              height: 120 * open,
              overflow: "hidden",
              borderTop: i === 0 ? undefined : `2px solid ${COLORS.cardBorder}`,
              background: `color-mix(in srgb, ${GREEN} ${Math.round(glow * 12)}%, white)`,
            }}
          >
            <div
              style={{
                height: 120,
                display: "flex",
                alignItems: "center",
                gap: 22,
                padding: "0 30px",
                opacity: interpolate(p, [0, 0.4], [0, 1], clamp),
                scale: String(interpolate(p, [0, 1], [0.85, 1])),
              }}
            >
              <span
                style={{
                  fontSize: 40,
                  fontWeight: 900,
                  color: BRAND.colorDark,
                  width: 112,
                }}
              >
                {r.time}
              </span>
              <div
                style={{
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  lineHeight: 1.15,
                }}
              >
                <span
                  style={{ fontSize: 37, fontWeight: 900, color: COLORS.ink }}
                >
                  {r.name}
                </span>
                <span
                  style={{
                    fontSize: 29,
                    fontWeight: 700,
                    color: COLORS.inkMuted,
                  }}
                >
                  {r.pax} pers.
                </span>
              </div>
              <span
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: "50%",
                  background: GREEN,
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
};

const Round2: React.FC<{ f: F; side: Side }> = ({ f, side }) =>
  side === "left" ? (
    <RoundStage from={f(b.r2)} to={f(b.r3)} side="left">
      <Notebook f={f} />
    </RoundStage>
  ) : (
    <RoundStage from={f(b.r2)} to={f(b.r3)} side="right">
      <MiniAgenda f={f} />
      <Verdict text={P05_R2.verdictRight} at={f(18.5)} good x={RC} y={1240} />
    </RoundStage>
  );

// ───────────────────────── Ronda 3 ─────────────────────────

const TableCard: React.FC<{
  at: number;
  dark: boolean;
  turnAt: number;
  to: "noShow" | "confirmed";
  clock?: { from: number; to: number };
}> = ({ at, dark, turnAt, to, clock }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  if (frame < at) return null;
  const p = pop(frame, fps, at);
  const turned = frame >= turnAt;
  const st = turned ? STATUS[to] : STATUS.pending;
  const blink =
    turned && to === "noShow"
      ? (Math.sin(((frame - turnAt) / fps) * Math.PI * 2 * 2.2) + 1) / 2
      : 0;
  const minutes = clock
    ? Math.round(interpolate(frame, [clock.from, clock.to], [0, 47], clamp))
    : 0;
  return (
    <div
      style={{
        position: "relative",
        width: COL_W,
        padding: "30px 34px",
        boxSizing: "border-box",
        borderRadius: RADIUS.lg,
        background: turned ? st.tint : COLORS.card,
        border: `6px solid ${st.solid}`,
        fontFamily: FONT,
        color: COLORS.ink,
        scale: String(
          interpolate(p, [0, 1], [0.6, 1]) * pulse(frame, turnAt, 1.08, 12),
        ),
        opacity: interpolate(p, [0, 0.3], [0, 1], clamp) * (dark ? 0.98 : 1),
        boxShadow:
          blink > 0
            ? `0 0 0 ${8 + blink * 18}px color-mix(in srgb, ${RED} ${Math.round(25 + blink * 40)}%, transparent)`
            : "0 18px 44px rgba(0,0,0,0.25)",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <span style={{ fontSize: 54, fontWeight: 900 }}>Mesa 4</span>
        {clock ? (
          <span
            style={{
              fontSize: 40,
              fontWeight: 900,
              color: turned ? RED : COLORS.inkMuted,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            21:{String(minutes).padStart(2, "0")}
          </span>
        ) : null}
      </div>
      <div
        style={{
          fontSize: 36,
          fontWeight: 700,
          color: COLORS.inkMuted,
          margin: "6px 0 18px",
        }}
      >
        Marta · 4 pers. · 21:00
      </div>
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 12,
          fontSize: 34,
          fontWeight: 900,
          padding: "8px 22px",
          borderRadius: RADIUS.pill,
          background: turned ? st.solid : STATUS.pending.tint,
          color: turned ? "#fff" : STATUS.pending.ink,
        }}
      >
        {turned ? (to === "noShow" ? "No vino" : "Confirmada ✓") : "Pendiente"}
      </span>
      {turned && to === "confirmed" ? (
        <Burst
          at={turnAt}
          color={GREEN}
          size={COL_W * 0.6}
          spread={120}
          sparks={14}
          x={COL_W / 2}
          y={110}
        />
      ) : null}
    </div>
  );
};

const Stamp: React.FC<{ text: string; at: number; x: number; y: number }> = ({
  text,
  at,
  x,
  y,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  if (frame < at) return null;
  const p = springIn(frame, fps, at, {
    damping: 10,
    stiffness: 300,
    mass: 0.6,
  });
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        translate: "-50% -50%",
        padding: "10px 30px",
        border: `8px solid ${RED}`,
        borderRadius: 16,
        color: RED,
        fontFamily: FONT,
        fontWeight: 900,
        fontSize: 64,
        letterSpacing: 4,
        whiteSpace: "nowrap",
        rotate: "-10deg",
        background: "rgba(10,29,29,0.55)",
        scale: String(interpolate(p, [0, 1], [2.4, 1])),
        opacity: interpolate(p, [0, 0.2], [0, 1], clamp),
      }}
    >
      {text}
    </div>
  );
};

const Round3: React.FC<{ f: F; side: Side }> = ({ f, side }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const readAt = f(21.5);
  if (side === "left") {
    return (
      <RoundStage from={f(b.r3)} to={f(b.ko) + 12} side="left">
        <div
          style={{
            position: "absolute",
            left: LC - COL_W / 2,
            top: STAGE_TOP + 120,
          }}
        >
          <TableCard
            at={f(b.r3)}
            dark
            turnAt={f(22)}
            to="noShow"
            clock={{ from: f(b.r3), to: f(22) }}
          />
        </div>
        <Stamp text="MESA VACÍA" at={f(23)} x={LC} y={STAGE_TOP + 560} />
      </RoundStage>
    );
  }
  return (
    <RoundStage from={f(b.r3)} to={f(b.ko) + 6} side="right">
      <div
        style={{
          position: "absolute",
          left: RC - COL_W / 2,
          top: STAGE_TOP,
          width: COL_W,
          display: "flex",
          flexDirection: "column",
          gap: 16,
        }}
      >
        {frame >= f(20.5) ? (
          <WhatsAppBubble
            from="me"
            text={P05_R3.reminder}
            time="20:00"
            ticks="sent"
            readProgress={interpolate(
              frame,
              [readAt, readAt + 6],
              [0, 1],
              clamp,
            )}
            appear={pop(frame, fps, f(20.5))}
            scale={1.2}
            maxWidth="100%"
          />
        ) : null}
        {frame >= f(22.5) ? (
          <WhatsAppBubble
            from="them"
            text={P05_R3.reply}
            time="20:02"
            appear={pop(frame, fps, f(22.5))}
            scale={1.2}
          />
        ) : null}
      </div>
      <div
        style={{
          position: "absolute",
          left: RC - COL_W / 2,
          top: STAGE_TOP + 470,
        }}
      >
        <TableCard at={f(23.5)} dark={false} turnAt={f(24)} to="confirmed" />
      </div>
    </RoundStage>
  );
};

// ───────────────────────── K.O. ─────────────────────────

const KoTitle: React.FC<{ f: F }> = ({ f }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const a1 = f(b.ko + 0.5);
  const a2 = f(b.ko + 1);
  if (frame < a1) return null;
  const p1 = springIn(frame, fps, a1, {
    damping: 12,
    stiffness: 260,
    mass: 0.6,
  });
  const p2 =
    frame >= a2
      ? springIn(frame, fps, a2, { damping: 12, stiffness: 260, mass: 0.6 })
      : 0;
  const strike = interpolate(frame, [a2 + 6, a2 + 12], [0, 1], {
    ...clamp,
    easing: EASE_OUT,
  });
  const line = (
    text: string,
    p: number,
    color: string,
    top: number,
    s?: number,
  ) => (
    <div
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        top,
        textAlign: "center",
        fontFamily: FONT,
        fontWeight: 900,
        fontSize: 170,
        letterSpacing: -3,
        color,
        scale: String(interpolate(p, [0, 1], [1.9, 1])),
        opacity: interpolate(p, [0, 0.25], [0, 1], clamp),
      }}
    >
      <span style={{ position: "relative" }}>
        {text}
        {s !== undefined ? (
          <span
            style={{
              position: "absolute",
              left: -12,
              top: "54%",
              height: 22,
              width: `calc(${s} * (100% + 24px))`,
              background: RED,
              borderRadius: 11,
              rotate: "-3deg",
            }}
          />
        ) : null}
      </span>
    </div>
  );
  return (
    <>
      {line(P05_KO.l1, p1, COLORS.ink, 600)}
      {p2 > 0 ? line(P05_KO.l2, p2, CORAL_INK, 790, strike) : null}
    </>
  );
};

// ───────────────────────── Pieza ─────────────────────────

/** P05 — "Libreta VS Turnigo" (T2, S32, general): combate a 3 rondas en pantalla partida. Sin voz. */
export const P05LibretaVsTurnigo: React.FC = () => {
  const frame = useCurrentFrame();
  const { frame: f, trimBefore } = useBeats(TRACK);
  const koAt = f(b.ko);
  const THUDS = [f(b.vs), koAt, f(b.end)];

  // La división se dibuja al empezar y en el K.O. barre la libreta fuera de la pantalla.
  const divX = interpolate(frame, [koAt, koAt + 10], [MID, 0], {
    ...clamp,
    easing: Easing.bezier(0.7, 0, 0.3, 1),
  });
  const divDraw = interpolate(frame, [0, 8], [0, 1], {
    ...clamp,
    easing: EASE_OUT,
  });
  const flash =
    interpolate(frame, [f(b.vs), f(b.vs) + 6], [0.75, 0], clamp) *
    (frame >= f(b.vs) ? 1 : 0);
  // En el K.O. la mitad derecha se recentra mientras crece.
  const rightShift = (divX - MID) / 2;
  const leftFall = interpolate(frame, [koAt, koAt + 10], [0, 1], {
    ...clamp,
    easing: EASE_IN,
  });

  return (
    <AbsoluteFill>
      <Background />

      {/* El combate termina en el cierre: el EndCard va sobre el fondo oscuro. */}
      <Sequence name="Combate" durationInFrames={f(b.end)}>
        <Punch
          hits={[
            { at: f(b.vs), zoom: 0.07, shake: 22 },
            { at: f(b.r1), zoom: 0.03, shake: 8 },
            { at: koAt, zoom: 0.06, shake: 18 },
          ]}
        >
          {/* ── Mitad izquierda: el mundo de la libreta (oscuro) ── */}
          <AbsoluteFill
            style={{
              clipPath: `inset(0 ${W - divX}px 0 0)`,
              filter: `grayscale(${leftFall}) brightness(${1 - leftFall * 0.4})`,
              translate: `0px ${leftFall * 80}px`,
              rotate: `${-leftFall * 3}deg`,
            }}
          >
            <Round1 f={f} side="left" />
            <Round2 f={f} side="left" />
            <Round3 f={f} side="left" />
          </AbsoluteFill>

          {/* ── Mitad derecha: Turnigo (claro) ── */}
          <AbsoluteFill style={{ clipPath: `inset(0 0 0 ${divX}px)` }}>
            <AbsoluteFill
              style={{
                background: [
                  `radial-gradient(circle at 80% 15%, color-mix(in srgb, ${BRAND.colorLight} 24%, transparent) 0%, transparent 55%)`,
                  `linear-gradient(180deg, ${COLORS.cardAlt}, #E3EFED)`,
                ].join(", "),
              }}
            >
              <AbsoluteFill
                style={{
                  backgroundImage: `radial-gradient(color-mix(in srgb, ${BRAND.color} 14%, transparent) 2px, transparent 2px)`,
                  backgroundSize: "48px 48px",
                  backgroundPosition: `${(frame * 0.6) % 48}px ${(frame * 0.3) % 48}px`,
                }}
              />
            </AbsoluteFill>
            <AbsoluteFill style={{ translate: `${rightShift}px 0px` }}>
              <Round1 f={f} side="right" />
              <Round2 f={f} side="right" />
              <Round3 f={f} side="right" />
            </AbsoluteFill>
            <KoTitle f={f} />
          </AbsoluteFill>

          {/* ── Línea divisoria ── */}
          <div
            style={{
              position: "absolute",
              left: divX - 4,
              top: 0,
              width: 8,
              height: `${divDraw * 100}%`,
              background: "#FFFFFF",
              boxShadow: `0 0 24px 6px color-mix(in srgb, ${BRAND.accent} 70%, transparent)`,
              opacity: interpolate(frame, [koAt + 8, koAt + 12], [1, 0], clamp),
            }}
          />

          {/* ── Título → marcador ── */}
          <Contender
            side="left"
            at={f(b.titleLeft)}
            morphAt={f(b.r1)}
            koAt={koAt}
          />
          <Contender
            side="right"
            at={f(b.titleRight)}
            morphAt={f(b.r1)}
            koAt={koAt}
          />
          <VsBadge at={f(b.vs)} morphAt={f(b.r1)} koAt={koAt} />
          <Score
            showAt={f(b.r1) + 8}
            points={[f(b.r1Point), f(b.r2Point), f(b.r3Point)]}
            koAt={koAt}
          />
          <RoundChip text={P05_ROUNDS[0]} from={f(b.r1)} to={f(b.r2)} />
          <RoundChip text={P05_ROUNDS[1]} from={f(b.r2)} to={f(b.r3)} />
          <RoundChip text={P05_ROUNDS[2]} from={f(b.r3)} to={koAt} />

          <AbsoluteFill
            style={{
              background: "#FFFFFF",
              opacity: flash,
              pointerEvents: "none",
            }}
          />
        </Punch>
      </Sequence>

      <Sequence name="EndCard" from={f(b.end)} premountFor={30}>
        <EndCard ctaAt={f(b.cta) - f(b.end)} />
      </Sequence>

      <Audio
        name="Música"
        src={staticFile(TRACK.src)}
        trimBefore={trimBefore || undefined}
        volume={(fr) => {
          const duck = THUDS.reduce(
            (g, at) =>
              g *
              interpolate(
                fr,
                [at - 1, at, at + 4, at + 12],
                [1, 0.55, 0.55, 1],
                clamp,
              ),
            1,
          );
          return (
            duck *
            interpolate(
              fr,
              [P05_DURATION - 36, P05_DURATION],
              [TRACK.volume, 0],
              clamp,
            )
          );
        }}
      />

      {/* ── Efectos: la izquierda suena en el beat, la derecha en el contratiempo ── */}
      <Sfx name="whoosh" from={0} volume={0.4} />
      <Sfx name="thud" from={f(b.titleLeft) + 1} volume={0.45} />
      <Sfx name="thud" from={f(b.titleRight)} volume={0.45} />
      <Sfx name="thud" from={f(b.vs)} volume={0.5} />
      <Sfx name="pop" from={f(b.vs)} volume={0.3} />
      {[b.r1, b.r2, b.r3].map((n) => (
        <Sfx key={`bell-${n}`} name="chime" from={f(n)} volume={0.5} />
      ))}
      <Sfx name="whoosh" from={f(b.r1)} volume={0.45} />
      {P05_R1.missed.map((_, i) => (
        <Sfx key={`m${i}`} name="tick" from={f(5 + i)} volume={0.55} />
      ))}
      {P05_R1.booked.map((_, i) => (
        <Sfx key={`b${i}`} name="pop" from={f(5.5 + i)} volume={0.5} />
      ))}
      <Sfx name="thud" from={f(10)} volume={0.35} />
      <Sfx name="pop" from={f(10.5)} volume={0.45} />
      <Sfx name="whoosh" from={f(b.r2)} volume={0.4} />
      {P05_R2.notes.map((n, i) => (
        <Sfx key={`n${i}`} name="tick" from={f(n.beat)} volume={0.35} />
      ))}
      <Sfx name="tick" from={f(16)} volume={0.5} />
      <Sfx name="thud" from={f(18)} volume={0.4} />
      {P05_R2.agenda.map((r, i) => (
        <Sfx key={`a${i}`} name="pop" from={f(r.beat)} volume={0.45} />
      ))}
      <Sfx name="whoosh" from={f(b.r3)} volume={0.4} />
      <Sfx name="pop" from={f(20.5)} volume={0.5} />
      <Sfx name="tick" from={f(21.5)} volume={0.5} />
      <Sfx name="thud" from={f(22)} volume={0.55} />
      <Sfx name="pop" from={f(22.5)} volume={0.5} />
      <Sfx name="thud" from={f(23)} volume={0.35} />
      <Sfx name="chime" from={f(24)} volume={0.45} />
      {[b.r1Point, b.r2Point, b.r3Point].map((n) => (
        <Sfx key={`pt-${n}`} name="ding" from={f(n)} volume={0.45} />
      ))}
      <Sfx name="whoosh" from={koAt} volume={0.6} />
      <Sfx name="thud" from={koAt} volume={0.65} />
      <Sfx name="pop" from={f(b.ko + 0.5)} volume={0.5} />
      <Sfx name="tick" from={f(b.ko + 1) + 6} volume={0.55} />
      <Sfx name="whoosh" from={f(b.end) - 3} volume={0.5} />
      <Sfx name="thud" from={f(b.end)} volume={0.6} />
      <Sfx name="pop" from={f(b.cta)} volume={0.7} />
    </AbsoluteFill>
  );
};
