import { loadFont } from "@remotion/google-fonts/Caveat";
import { Audio } from "@remotion/media";
import type React from "react";
import { AbsoluteFill, interpolate, Sequence, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { BRAND } from "../../brand";
import { Sfx } from "../../components/AudioLayers";
import { Background } from "../../components/Background";
import { Camera } from "../../components/Camera";
import { EndCard } from "../../components/EndCard";
import { ProChips, hexAlpha } from "../../components/ProChips";
import { Punch } from "../../components/Punch";
import { TwoLine } from "../../components/TwoLine";
import { EASE_IN, EASE_OUT, clamp, pop, springIn } from "../../lib/anim";
import { makeBeats, useBeats } from "../../lib/beats";
import { TRACK_DROP4 } from "../../music/track";
import { COLORS, FONT, STATUS, VIDEO } from "../../theme";
import { P16_BEATS as b, P16_BOOKINGS, P16_DAYS, P16_NOTES, P16_PAULA_COUNT, P16_TEXT as T, PROS } from "./script";

const { fontFamily: HAND } = loadFont("normal", { weights: ["700"], subsets: ["latin", "latin-ext"] });

const TRACK = TRACK_DROP4;
export const P16_DURATION = makeBeats(TRACK, VIDEO.fps).frame(b.total);

type F = (n: number) => number;

const STAGE = { x: 540, y: 1010 };
const RED = STATUS.noShow.solid;

// Tablero de la semana (px del lienzo).
const BOARD = { left: 60, top: 470, width: 960 };
const GRID_TOP = BOARD.top + 100;
const HEAD_H = 100;
const TIME_W = 100;
const COL_W = (BOARD.width - TIME_W) / 3;
const HOUR_H = 74;
const FIRST_HOUR = 9;
const LAST_HOUR = 20;
const BOARD_H = 100 + HEAD_H + (LAST_HOUR - FIRST_HOUR) * HOUR_H + 16;
const BOARD_CENTER = { x: BOARD.left + BOARD.width / 2, y: BOARD.top + BOARD_H / 2 };

const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};

// ───────────────────────── Libreta (gancho) ─────────────────────────

const LINE_H = 118;
const PAPER = "#F6EFD9";
const PEN = "#1F3A93";

const Notebook: React.FC<{ f: F }> = ({ f }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = springIn(frame, fps, 0, { damping: 12, stiffness: 170 });
  // Cada garabato sacude un poco la libreta (boli apretando).
  const jolt = b.scribble.reduce((acc, at) => {
    const t = frame - f(at);
    return t >= 0 && t < 6 ? acc + Math.sin(t * 3) * 4 * (1 - t / 6) : acc;
  }, 0);
  const strike = interpolate(frame, [f(b.strike), f(b.strike) + 6], [0, 1], clamp);
  const circle = interpolate(frame, [f(b.circle), f(b.circle) + 9], [0, 1], { ...clamp, easing: EASE_OUT });

  return (
    <div
      style={{
        position: "absolute",
        left: 110,
        top: 520,
        width: 860,
        height: 820,
        borderRadius: 18,
        background: PAPER,
        backgroundImage: `repeating-linear-gradient(to bottom, transparent 0, transparent ${LINE_H - 3}px, #A9BDE3 ${LINE_H - 3}px, #A9BDE3 ${LINE_H}px)`,
        backgroundPosition: "0 60px",
        boxShadow: "0 40px 90px rgba(0,0,0,0.55)",
        rotate: `${interpolate(enter, [0, 1], [-14, -3]) + jolt * 0.2}deg`,
        translate: `${jolt}px ${interpolate(enter, [0, 1], [900, 0])}px`,
      }}
    >
      <div style={{ position: "absolute", left: 92, top: 0, bottom: 0, width: 4, background: "#E07B6A" }} />
      {/* Mancha de café */}
      <div
        style={{
          position: "absolute",
          right: 40,
          top: 420,
          width: 210,
          height: 210,
          borderRadius: "50%",
          border: "14px solid rgba(120,72,30,0.28)",
          boxShadow: "inset 0 0 30px rgba(120,72,30,0.18)",
          rotate: "20deg",
        }}
      />
      {P16_NOTES.map((n, i) => {
        const at = f(b.scribble[i]);
        const write = interpolate(frame, [at, at + 8], [0, 100], clamp);
        const y = 60 + (i + 1) * LINE_H - 92;
        const hasStrike = "strike" in n && n.strike;
        const hasCircle = "circle" in n && n.circle;
        return (
          <div key={i} style={{ position: "absolute", left: 120, top: y, width: 700, height: 92 }}>
            <div
              style={{
                fontFamily: HAND,
                fontWeight: 700,
                fontSize: 68,
                lineHeight: "92px",
                color: PEN,
                whiteSpace: "nowrap",
                rotate: `${(i % 2 ? 1 : -1) * 1.4}deg`,
                clipPath: `inset(0 ${100 - write}% 0 0)`,
                opacity: hasStrike ? 1 - strike * 0.35 : 1,
              }}
            >
              {n.text}
            </div>
            {hasStrike && strike > 0 ? (
              <svg width={640} height={92} style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }}>
                <path
                  d="M0 50 L60 36 L120 56 L180 34 L240 54 L300 36 L360 56 L420 36 L480 52 L540 38 L620 48"
                  fill="none"
                  stroke={RED}
                  strokeWidth={8}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  pathLength={1}
                  strokeDasharray={1}
                  strokeDashoffset={1 - strike}
                />
              </svg>
            ) : null}
            {hasCircle && circle > 0 ? (
              <svg width={720} height={140} style={{ position: "absolute", left: -40, top: -24, overflow: "visible" }}>
                <ellipse
                  cx={360}
                  cy={70}
                  rx={350}
                  ry={62}
                  fill="none"
                  stroke={RED}
                  strokeWidth={8}
                  pathLength={1}
                  strokeDasharray={1}
                  strokeDashoffset={1 - circle}
                  transform="rotate(-3 360 70)"
                />
              </svg>
            ) : null}
          </div>
        );
      })}
    </div>
  );
};

// ───────────────────────── Agenda Semana ─────────────────────────

const WeekBoard: React.FC<{ f: F }> = ({ f }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const tap = f(b.tapPaula);
  // Orden de cada cita dentro de su profesional (para la cascada) y entre las que desaparecen.
  const seen = [0, 0, 0];
  let gone = 0;

  return (
    <div style={{ position: "absolute", left: BOARD.left, top: BOARD.top, width: BOARD.width, fontFamily: FONT }}>
      <ProChips pros={PROS} fontSize={36} pick={{ index: 1, at: tap }} count={P16_PAULA_COUNT} pulses={b.cascade.map(f)} />
      <div
        style={{
          position: "absolute",
          top: GRID_TOP - BOARD.top,
          left: 0,
          width: BOARD.width,
          height: BOARD_H - 100,
          borderRadius: 40,
          background: COLORS.card,
          border: "2px solid #E2E8F0",
          boxShadow: "0 2px 4px rgba(15,42,42,0.08), 0 30px 70px rgba(15,42,42,0.16)",
          overflow: "hidden",
        }}
      >
        {/* Cabecera de días */}
        {P16_DAYS.map((d, i) => {
          const today = "today" in d && d.today;
          return (
            <div
              key={d.day}
              style={{
                position: "absolute",
                left: TIME_W + i * COL_W,
                top: 0,
                width: COL_W,
                height: HEAD_H,
                background: today ? "#E8F4F3" : undefined,
                borderLeft: "2px solid #E2E8F0",
                borderBottom: "2px solid #E2E8F0",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                lineHeight: 1.1,
              }}
            >
              <span style={{ fontSize: 26, fontWeight: 600, color: "#64748B" }}>{d.dow}</span>
              <span style={{ fontSize: 40, fontWeight: 800, color: today ? BRAND.colorDark : "#1E293B" }}>{d.day}</span>
            </div>
          );
        })}
        {/* Horas */}
        {Array.from({ length: LAST_HOUR - FIRST_HOUR + 1 }, (_, i) => (
          <div key={i} style={{ position: "absolute", left: 0, right: 0, top: HEAD_H + i * HOUR_H, height: 0, borderTop: i ? "2px solid #EEF2F4" : undefined }}>
            <span style={{ position: "absolute", left: 14, top: -14, fontSize: 22, fontWeight: 600, color: "#94A3B8", background: "#fff", padding: "0 4px" }}>
              {String(FIRST_HOUR + i).padStart(2, "0")}:00
            </span>
          </div>
        ))}
        {[0, 1, 2].map((i) => (
          <div key={i} style={{ position: "absolute", left: TIME_W + i * COL_W, top: HEAD_H, bottom: 0, borderLeft: "2px solid #E2E8F0" }} />
        ))}
        {/* Citas */}
        {P16_BOOKINGS.map(([day, start, mins, pro, name], i) => {
          const order = seen[pro]++;
          const inAt = f(b.cascade[pro]) + order * 1.5;
          if (frame < inAt) return null;
          const p = pop(frame, fps, inAt);
          // Con el filtro de Paula, las citas de las demás desaparecen una tras otra.
          const out = pro === 1 ? 0 : interpolate(frame, [tap + 2 + gone * 0.6, tap + 8 + gone++ * 0.6], [0, 1], { ...clamp, easing: EASE_IN });
          if (out >= 1) return null;
          const top = HEAD_H + ((toMin(start) - FIRST_HOUR * 60) / 60) * HOUR_H + 2;
          const h = (mins / 60) * HOUR_H - 4;
          const color = PROS[pro].color;
          const short = mins < 60;
          return (
            <div
              key={i}
              style={{
                position: "absolute",
                left: TIME_W + day * COL_W + 6,
                top,
                width: COL_W - 12,
                height: h,
                borderRadius: 12,
                background: `linear-gradient(${hexAlpha(color, 0.28)}, ${hexAlpha(color, 0.28)}), #fff`,
                borderLeft: `8px solid ${color}`,
                padding: short ? "0 12px" : "6px 12px",
                display: "flex",
                flexDirection: short ? "row" : "column",
                alignItems: short ? "center" : "flex-start",
                gap: short ? 10 : 0,
                color: "#0F172A",
                lineHeight: 1.1,
                overflow: "hidden",
                whiteSpace: "nowrap",
                opacity: interpolate(p, [0, 0.3], [0, 1], clamp) * (1 - out),
                scale: String(interpolate(p, [0, 1], [0.6, 1]) * (1 - out * 0.3)),
                translate: `0px ${interpolate(p, [0, 1], [-30, 0])}px`,
              }}
            >
              <span style={{ fontSize: 26, fontWeight: 800 }}>{start}</span>
              <span style={{ fontSize: 26, fontWeight: 600 }}>{name}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ───────────────────────── Pantalla partida ─────────────────────────

/** Mitad clara que entra desde la derecha en el drop (`vs`) y luego ocupa toda la pantalla (`full`). */
const LightSplit: React.FC<{ vs: number; full: number; children: React.ReactNode }> = ({ vs, full, children }) => {
  const frame = useCurrentFrame();
  if (frame < vs) return null;
  const x =
    frame < full
      ? interpolate(frame, [vs, vs + 7], [VIDEO.width, VIDEO.width / 2], { ...clamp, easing: EASE_OUT })
      : interpolate(frame, [full, full + 8], [VIDEO.width / 2, 0], { ...clamp, easing: EASE_OUT });
  // El tablero viaja de media pantalla (escala 0,5 centrado en la mitad derecha) a pantalla completa.
  const grow = interpolate(frame, [full, full + 10], [0, 1], { ...clamp, easing: EASE_OUT });
  const sc = interpolate(grow, [0, 1], [0.52, 1]);
  const cx = interpolate(grow, [0, 1], [810, BOARD_CENTER.x]);
  return (
    <AbsoluteFill style={{ clipPath: `inset(0 0 0 ${x}px)` }}>
      <AbsoluteFill
        style={{
          background: [
            `radial-gradient(circle at 50% 18%, color-mix(in srgb, ${BRAND.colorLight} 22%, transparent) 0%, transparent 55%)`,
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
      <AbsoluteFill style={{ transformOrigin: `${BOARD_CENTER.x}px ${BOARD_CENTER.y}px`, scale: String(sc), translate: `${cx - BOARD_CENTER.x}px 0px` }}>
        {children}
      </AbsoluteFill>
      {/* Filo coral de la división */}
      {frame < full + 8 ? <div style={{ position: "absolute", left: x - 5, top: 0, bottom: 0, width: 10, background: BRAND.accent }} /> : null}
    </AbsoluteFill>
  );
};

const VsBits: React.FC<{ at: number; outAt: number }> = ({ at, outAt }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  if (frame < at || frame >= outAt + 6) return null;
  const p = pop(frame, fps, at);
  const out = interpolate(frame, [outAt, outAt + 6], [0, 1], { ...clamp, easing: EASE_IN });
  const label = (text: string, x: number, bg: string, delay: number) => {
    const q = pop(frame, fps, at + delay);
    return (
      <div
        style={{
          position: "absolute",
          left: x,
          top: 260,
          translate: "-50% 0",
          padding: "16px 40px",
          borderRadius: 999,
          background: bg,
          color: "#fff",
          fontFamily: FONT,
          fontWeight: 900,
          fontSize: 60,
          letterSpacing: 4,
          scale: String(interpolate(q, [0, 1], [0.4, 1])),
          opacity: interpolate(q, [0, 0.3], [0, 1], clamp) * (1 - out),
          boxShadow: "0 20px 50px rgba(0,0,0,0.35)",
        }}
      >
        {text}
      </div>
    );
  };
  return (
    <AbsoluteFill>
      {label(T.vsLeft, 270, RED, 0)}
      {label(T.vsRight, 810, BRAND.color, 4)}
      <div
        style={{
          position: "absolute",
          left: 540,
          top: 980,
          width: 190,
          height: 190,
          translate: "-50% -50%",
          borderRadius: "50%",
          background: BRAND.accent,
          border: "10px solid #fff",
          display: "grid",
          placeItems: "center",
          color: "#fff",
          fontFamily: FONT,
          fontWeight: 900,
          fontSize: 92,
          fontStyle: "italic",
          scale: String(interpolate(p, [0, 1], [3, 1]) * (1 - out)),
          rotate: `${interpolate(p, [0, 1], [-40, -8])}deg`,
          boxShadow: "0 24px 60px rgba(0,0,0,0.45)",
        }}
      >
        VS
      </div>
    </AbsoluteFill>
  );
};

/** La libreta: a pantalla completa en el gancho, encogida en la mitad izquierda en el VS y fuera al abrirse la agenda. */
const NotebookStage: React.FC<{ f: F }> = ({ f }) => {
  const frame = useCurrentFrame();
  const shrink = interpolate(frame, [f(b.vs), f(b.vs) + 8], [0, 1], { ...clamp, easing: EASE_OUT });
  const leave = interpolate(frame, [f(b.board), f(b.board) + 7], [0, 1], { ...clamp, easing: EASE_IN });
  if (leave >= 1) return null;
  return (
    <AbsoluteFill
      style={{
        transformOrigin: "540px 930px",
        scale: String(interpolate(shrink, [0, 1], [1, 0.5])),
        translate: `${interpolate(shrink, [0, 1], [0, -270]) - leave * 700}px ${interpolate(shrink, [0, 1], [0, 60])}px`,
        rotate: `${leave * -12}deg`,
      }}
    >
      <Notebook f={f} />
    </AbsoluteFill>
  );
};

// ───────────────────────── Pieza ─────────────────────────

/** P16 — "Tu agenda de papel un sábado.": agenda Semana con un color por profesional y filtro (T2, S32, citas). Sin voz. */
export const P16AgendaPorColores: React.FC = () => {
  const { frame: f, span, trimBefore } = useBeats(TRACK);
  const seq = (from: number, to: number) => ({ from: f(from), durationInFrames: f(to) - f(from) });
  const THUDS = [f(b.vs), f(b.board), f(b.tapPaula), f(b.end)];
  const satFocus = { x: BOARD.left + TIME_W + COL_W * 2.5 - 40, y: GRID_TOP + HEAD_H + 3.8 * HOUR_H };

  return (
    <AbsoluteFill>
      <Background />

      <Sequence name="Combate" durationInFrames={f(b.end)}>
        <Punch
          hits={[
            { at: 4, zoom: 0.03, shake: 10 },
            { at: f(b.vs), zoom: 0.07, shake: 18 },
            { at: f(b.board), zoom: 0.04, shake: 8 },
            ...b.cascade.map((c) => ({ at: f(c), zoom: 0.025, shake: 5 })),
            { at: f(b.tapPaula), zoom: 0.04, shake: 8 },
          ]}
        >
          {/* ── Gancho (oscuro): la libreta se llena de tachones ── */}
          <NotebookStage f={f} />
          <Sequence name="Titular gancho" {...seq(b.hook, b.vs)}>
            <TwoLine l1={T.hook.l1} l2={T.hook.l2} dur={span(b.vs - b.hook)} l2At={span(1)} accent={BRAND.accent} fontSize={96} />
          </Sequence>

          {/* ── Drop: papel VS Turnigo, y la agenda se queda la pantalla ── */}
          <LightSplit vs={f(b.vs)} full={f(b.board)}>
            <Camera
              keys={[
                { at: f(b.saturday), scale: 1, focus: STAGE },
                { at: f(b.saturday) + 10, scale: 1.45, focus: satFocus },
                { at: f(b.filter), scale: 1.45, focus: satFocus },
                { at: f(b.filter) + 8, scale: 1, focus: STAGE },
                { at: f(b.filtered) + 6, scale: 1, focus: STAGE },
                { at: f(b.end), scale: 1.06, focus: STAGE },
              ]}
              center={STAGE}
              fadeTop={460}
            >
              <WeekBoard f={f} />
            </Camera>
          </LightSplit>
          <VsBits at={f(b.vs)} outAt={f(b.board)} />

          <Sequence name="Titular colores" {...seq(b.board, b.saturday)}>
            <TwoLine l1={T.board.l1} l2={T.board.l2} dur={span(b.saturday - b.board)} l2At={span(b.cascade[0] - b.board)} light accent={BRAND.color} />
          </Sequence>
          <Sequence name="Titular sábado" {...seq(b.saturday, b.filter)}>
            <TwoLine l1={T.saturday.l1} l2={T.saturday.l2} dur={span(b.filter - b.saturday)} l2At={span(1)} light accent={BRAND.color} />
          </Sequence>
          <Sequence name="Titular filtro" {...seq(b.filter, b.end)}>
            <TwoLine l1={T.filter.l1} l2={T.filter.l2} dur={span(b.end - b.filter) + 4} l2At={span(b.filtered - b.filter)} light accent={PROS[1].color} />
          </Sequence>
        </Punch>
      </Sequence>

      <Sequence name="EndCard" from={f(b.end)} premountFor={30}>
        <EndCard tagline={T.tagline} ctaAt={f(b.cta) - f(b.end)} />
      </Sequence>

      <Audio
        name="Música"
        src={staticFile(TRACK.src)}
        trimBefore={trimBefore || undefined}
        volume={(fr) => {
          const duck = THUDS.reduce((g, at) => g * interpolate(fr, [at - 1, at, at + 4, at + 12], [1, 0.55, 0.55, 1], clamp), 1);
          return duck * interpolate(fr, [P16_DURATION - 36, P16_DURATION], [TRACK.volume, 0], clamp);
        }}
      />

      {/* ── Efectos ── */}
      <Sfx name="whoosh" from={0} volume={0.35} />
      <Sfx name="thud" from={4} volume={0.4} />
      {b.scribble.map((s) => (
        <Sfx key={s} name="tick" from={f(s)} volume={0.35} />
      ))}
      <Sfx name="whoosh" from={f(b.strike)} volume={0.3} />
      <Sfx name="pop" from={f(b.circle)} volume={0.45} />
      <Sfx name="thud" from={f(b.vs)} volume={0.6} />
      <Sfx name="whoosh" from={f(b.vs)} volume={0.45} />
      <Sfx name="whoosh" from={f(b.board)} volume={0.45} />
      {b.cascade.map((c) => (
        <Sfx key={c} name="pop" from={f(c)} volume={0.5} />
      ))}
      <Sfx name="chime" from={f(b.cascade[2]) + 4} volume={0.4} />
      <Sfx name="whoosh" from={f(b.saturday)} volume={0.35} />
      <Sfx name="whoosh" from={f(b.filter)} volume={0.35} />
      <Sfx name="pop" from={f(b.tapPaula)} volume={0.6} />
      <Sfx name="whoosh" from={f(b.tapPaula) + 2} volume={0.35} />
      <Sfx name="ding" from={f(b.filtered)} volume={0.4} />
      <Sfx name="whoosh" from={f(b.end) - 3} volume={0.5} />
      <Sfx name="thud" from={f(b.end)} volume={0.6} />
      <Sfx name="pop" from={f(b.cta)} volume={0.7} />
    </AbsoluteFill>
  );
};
