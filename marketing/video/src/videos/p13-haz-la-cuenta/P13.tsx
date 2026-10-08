import { Audio } from "@remotion/media";
import type React from "react";
import { AbsoluteFill, interpolate, Sequence, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { BRAND } from "../../brand";
import { Sfx } from "../../components/AudioLayers";
import { Background } from "../../components/Background";
import { Calculator } from "../../components/Calculator";
import { EndCard } from "../../components/EndCard";
import { LightLayer } from "../../components/LightLayer";
import { Punch } from "../../components/Punch";
import { TwoLine } from "../../components/TwoLine";
import { EASE_OUT, clamp, pop, springIn } from "../../lib/anim";
import { makeBeats, useBeats, type Beats } from "../../lib/beats";
import { TRACK } from "../../music/track";
import { COLORS, FONT, STATUS, VIDEO } from "../../theme";
import { P13_BEATS as b, P13_BLANKS, P13_NUMBERS as N, P13_TEXT as T, P13_TOOLS } from "./script";

export const P13_DURATION = makeBeats(TRACK, VIDEO.fps).frame(b.total);

const HEAD = { top: 230, size: 104 } as const;
const CALC_Y = 690;
/** Rojo que se lee sobre fondo oscuro. */
const RED = "#FF5C4D";

/** 1950 → "1.950". */
const fmt = (n: number) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ".");

// ───────────────────────── Escenas 1-2: la calculadora ─────────────────────────

/** Teclas que se pulsan: [tecla, beat]. Cada una lleva su tick. */
const PRESSES: [string, number][] = [
  ["3", 4],
  ["×", 5],
  ["2", 5.5],
  ["5", 6],
  ["=", 7],
  ["×", 8],
  ["2", 8.5],
  ["6", 9],
  ["=", 10],
];

const CalcScene: React.FC<{ beats: Beats }> = ({ beats }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { frame: f } = beats;
  const enter = springIn(frame, fps, 0, { damping: 14, stiffness: 110, mass: 0.9 });
  const fade = interpolate(frame, [f(b.hit), f(b.hit) + 4], [1, 0.07], clamp);

  // Pantalla según el momento de la cuenta.
  const at = (n: number) => frame >= f(n);
  let expr = "";
  let result = "0";
  if (at(4)) [expr, result] = ["3", "3"];
  if (at(5)) [expr, result] = ["3 ×", "3"];
  if (at(5.5)) [expr, result] = ["3 × 2", "2"];
  if (at(6)) [expr, result] = ["3 × 25 €", "25"];
  if (at(7)) [expr, result] = ["3 × 25 € =", `${N.perNight} €`];
  if (at(8)) [expr, result] = [`${N.perNight} € ×`, `${N.perNight} €`];
  if (at(8.5)) [expr, result] = [`${N.perNight} € × 2`, "2"];
  if (at(9)) [expr, result] = [`${N.perNight} € × ${N.nights}`, `${N.nights}`];
  if (at(b.rise)) {
    // Rampa que termina EXACTAMENTE en el golpe del drop (ease-out hacia 1.950).
    const p = interpolate(frame, [f(b.rise), f(b.hit)], [0, 1], { ...clamp, easing: EASE_OUT });
    expr = `${N.perNight} € × ${N.nights} =`;
    result = `${fmt(N.perNight + (N.total - N.perNight) * p)} €`;
  }

  const last = [...PRESSES].reverse().find(([, beat]) => frame >= f(beat));
  const lit = last ? last[0] : null;
  const litAge = last ? frame - f(last[1]) : 99;
  const bump = interpolate(frame % beats.span(0.5), [0, 3, 8], [1.02, 1.02, 1], clamp);

  return (
    <AbsoluteFill style={{ opacity: fade }}>
      <Calculator
        expr={expr}
        result={result}
        lit={lit}
        litAge={litAge}
        resultColor={at(b.rise) ? "#FFD2C8" : "#B8F5E4"}
        style={{
          left: (VIDEO.width - 780) / 2,
          top: CALC_Y,
          translate: `0px ${interpolate(enter, [0, 1], [1100, 0])}px`,
          rotate: `${interpolate(enter, [0, 1], [-8, 0])}deg`,
          scale: String(bump * (at(b.rise) ? 1 + 0.015 * Math.sin(frame * 1.3) : 1)),
        }}
      />
    </AbsoluteFill>
  );
};

// ───────────────────────── Escena 3: el golpe ─────────────────────────

const BigNumber: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const land = springIn(frame, fps, 0, { damping: 7, stiffness: 260, mass: 0.7 });
  // Temblor de impacto que se amortigua y un temblor suave y continuo después.
  const t = frame;
  const hit = t < 12 ? Math.sin(t * 3.1) * 22 * (1 - t / 12) ** 2 : 0;
  const tremble = Math.sin(t * 1.9) * 3.5;
  const label = springIn(frame, fps, 8);
  return (
    <AbsoluteFill style={{ alignItems: "center", fontFamily: FONT }}>
      <div style={{ position: "absolute", top: 700, left: 0, right: 0, textAlign: "center", translate: `${hit + tremble}px 0px` }}>
        <div
          style={{
            fontSize: 262,
            fontWeight: 900,
            lineHeight: 1,
            letterSpacing: -10,
            color: RED,
            fontVariantNumeric: "tabular-nums",
            textShadow: "0 0 90px rgba(255,92,77,0.55), 0 24px 0 rgba(0,0,0,0.25)",
            scale: String(interpolate(land, [0, 1], [1.7, 1])),
            opacity: interpolate(land, [0, 0.2], [0, 1], clamp),
          }}
        >
          {fmt(N.total)}
          <span style={{ fontSize: 160, letterSpacing: -4 }}> €</span>
        </div>
        <div
          style={{
            fontSize: 120,
            fontWeight: 900,
            color: "#FFD2C8",
            marginTop: 6,
            opacity: label,
            translate: `0px ${(1 - label) * 40}px`,
          }}
        >
          {T.unit}
        </div>
        <div style={{ fontSize: 56, fontWeight: 800, color: COLORS.textMuted, marginTop: 24, opacity: label }}>{T.example}</div>
      </div>
    </AbsoluteFill>
  );
};

const RedVignette: React.FC = () => {
  const frame = useCurrentFrame();
  const a = interpolate(frame, [0, 2, 30], [0.7, 0.7, 0.3], clamp);
  return <AbsoluteFill style={{ background: `radial-gradient(ellipse at 50% 50%, transparent 40%, rgba(192,57,43,${a}) 100%)` }} />;
};

// ───────────────────────── Escena 4: tres ayudas ─────────────────────────

const Icon: React.FC<{ kind: (typeof P13_TOOLS)[number]["icon"] }> = ({ kind }) => {
  const common = { fill: "none", stroke: "#fff", strokeWidth: 2.2, strokeLinecap: "round", strokeLinejoin: "round" } as const;
  return (
    <svg width="78" height="78" viewBox="0 0 24 24">
      {kind === "chat" ? (
        <>
          <path d="M4 5h16v11H9l-5 4z" {...common} />
          <path d="M8 9.5h8M8 12.5h5" {...common} />
        </>
      ) : null}
      {kind === "list" ? (
        <>
          <circle cx="12" cy="12" r="8.5" {...common} />
          <path d="M12 7v5l3.5 2" {...common} />
        </>
      ) : null}
      {kind === "globe" ? (
        <>
          <circle cx="12" cy="12" r="8.5" {...common} />
          <path d="M3.5 12h17M12 3.5c-3 3-3 14 0 17M12 3.5c3 3 3 14 0 17" {...common} />
        </>
      ) : null}
    </svg>
  );
};

const ToolCards: React.FC<{ beats: Beats; from: number }> = ({ beats, from }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <AbsoluteFill>
      {P13_TOOLS.map((tl, i) => {
        const at = beats.frame(tl.beat) - from;
        const p = springIn(frame, fps, at, { damping: 12, stiffness: 190, mass: 0.7 });
        const ok = springIn(frame, fps, at + beats.span(1), { damping: 9, stiffness: 240, mass: 0.6 });
        return (
          <div
            key={tl.title}
            style={{
              position: "absolute",
              left: 100,
              top: 640 + i * 262,
              width: 880,
              height: 220,
              boxSizing: "border-box",
              borderRadius: 40,
              background: "#fff",
              display: "flex",
              alignItems: "center",
              gap: 34,
              padding: "0 40px",
              fontFamily: FONT,
              boxShadow: "0 2px 4px rgba(15,42,42,0.12), 0 30px 70px rgba(15,42,42,0.25)",
              opacity: interpolate(p, [0, 0.25], [0, 1], clamp),
              translate: `${interpolate(p, [0, 1], [i % 2 ? 700 : -700, 0])}px 0px`,
              rotate: `${interpolate(p, [0, 1], [i % 2 ? 6 : -6, i % 2 ? 0.8 : -0.8])}deg`,
            }}
          >
            <div style={{ width: 130, height: 130, borderRadius: 36, background: BRAND.color, display: "grid", placeItems: "center", flexShrink: 0 }}>
              <Icon kind={tl.icon} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 54, fontWeight: 900, color: COLORS.ink, lineHeight: 1.05 }}>{tl.title}</div>
              <div style={{ fontSize: 33, fontWeight: 700, color: COLORS.inkMuted, marginTop: 8 }}>{tl.sub}</div>
            </div>
            <div
              style={{
                width: 86,
                height: 86,
                borderRadius: 999,
                background: STATUS.confirmed.solid,
                display: "grid",
                placeItems: "center",
                flexShrink: 0,
                scale: String(interpolate(ok, [0, 1], [0, 1])),
              }}
            >
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
                <path d="M5 12.5l4.5 4.5L19 7.5" stroke="#fff" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

// ───────────────────────── Escena 5: tu propia cuenta ─────────────────────────

const Blanks: React.FC<{ beats: Beats; from: number }> = ({ beats, from }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const eqAt = beats.frame(27) - from;
  const eq = pop(frame, fps, eqAt);
  return (
    <AbsoluteFill>
      {P13_BLANKS.map((bl, i) => {
        const at = beats.frame(bl.beat) - from;
        const p = pop(frame, fps, at);
        const wob = frame > at + 8 ? Math.sin((frame - at) * 0.35 + i) * 2.2 : 0;
        return (
          <div
            key={bl.label}
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              top: 640 + i * 190,
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              gap: 30,
              fontFamily: FONT,
              fontWeight: 900,
              fontSize: 76,
              color: COLORS.ink,
              opacity: interpolate(p, [0, 0.25], [0, 1], clamp),
              scale: String(interpolate(p, [0, 1], [0.4, 1])),
            }}
          >
            {i > 0 ? <span style={{ color: BRAND.color }}>×</span> : null}
            <span
              style={{
                width: 150,
                height: 130,
                borderRadius: 32,
                background: BRAND.accent,
                color: "#fff",
                display: "grid",
                placeItems: "center",
                fontSize: 100,
                boxShadow: "0 18px 40px rgba(255,107,74,0.45)",
                rotate: `${wob}deg`,
              }}
            >
              ?
            </span>
            {bl.label}
          </div>
        );
      })}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 640 + 3 * 190,
          display: "flex",
          justifyContent: "center",
          opacity: interpolate(eq, [0, 0.3], [0, 1], clamp),
          scale: String(interpolate(eq, [0, 1], [0.4, 1])),
        }}
      >
        <div
          style={{
            padding: "20px 54px",
            borderRadius: 999,
            background: BRAND.color,
            color: "#fff",
            fontFamily: FONT,
            fontWeight: 900,
            fontSize: 66,
            boxShadow: `0 0 0 8px ${BRAND.accent}, 0 24px 60px rgba(11,110,106,0.4)`,
          }}
        >
          = tu cifra al mes
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ───────────────────────── Pieza ─────────────────────────

/** P13 — "Haz la cuenta." (T3, S32, restaurantes). Sin voz; el total aterriza en el drop (beat 12). */
export const P13HazLaCuenta: React.FC = () => {
  const beats = useBeats(TRACK);
  const { frame: f, span, trimBefore } = beats;
  const seq = (from: number, to: number) => ({ from: f(from), durationInFrames: f(to) - f(from) });
  const THUDS = [f(2), f(b.hit), f(b.tools), f(b.end)];

  return (
    <AbsoluteFill>
      <Background />
      <LightLayer openAt={f(b.tools)} closeAt={f(b.end)} y={1000} />

      <Punch
        hits={[
          { at: f(2), zoom: 0.04, shake: 10 },
          { at: f(b.hit), zoom: 0.09, shake: 22 },
          { at: f(b.tools), zoom: 0.05, shake: 10 },
        ]}
      >
        {/* 1-2 · La calculadora (0-12) */}
        <Sequence name="Calculadora" {...seq(b.hook, b.tools)}>
          <CalcScene beats={beats} />
        </Sequence>
        <Sequence name="T · Gancho" {...seq(b.hook, b.perNight)}>
          <TwoLine l1={T.hook.l1} l2={T.hook.l2} dur={span(4)} l2At={span(1)} accent={BRAND.accent} fontSize={150} top={HEAD.top - 20} />
        </Sequence>
        <Sequence name="T · Por noche" {...seq(b.perNight, b.perMonth)}>
          <TwoLine l1={T.perNight.l1} l2={T.perNight.l2} dur={span(4)} l2At={span(1)} accent={BRAND.accent} fontSize={HEAD.size} top={HEAD.top} />
        </Sequence>
        <Sequence name="T · Por mes" {...seq(b.perMonth, b.hit)}>
          <TwoLine l1={T.perMonth.l1} l2={T.perMonth.l2} dur={span(4)} l2At={span(1)} accent={BRAND.accent} fontSize={HEAD.size} top={HEAD.top} />
        </Sequence>

        {/* 3 · El golpe: 1.950 €/mes (ejemplo) */}
        <Sequence name="Viñeta roja" {...seq(b.hit, b.tools)}>
          <RedVignette />
        </Sequence>
        <Sequence name="Total" {...seq(b.hit, b.tools)}>
          <BigNumber />
        </Sequence>
        <Sequence name="T · Esto se va" {...seq(b.hit, b.tools)}>
          <TwoLine l1={T.hit.l1} l2={T.hit.l2} dur={span(4)} l2At={span(1)} accent={RED} fontSize={HEAD.size + 10} top={HEAD.top} />
        </Sequence>

        {/* 4 · Fondo claro: tres ayudas */}
        <Sequence name="Ayudas" {...seq(b.tools, b.yourTurn)}>
          <ToolCards beats={beats} from={f(b.tools)} />
        </Sequence>
        <Sequence name="T · Ayudas" {...seq(b.tools, b.yourTurn)}>
          <TwoLine l1={T.tools.l1} l2={T.tools.l2} dur={span(b.yourTurn - b.tools)} l2At={span(1)} light accent={BRAND.color} fontSize={HEAD.size} top={HEAD.top} />
        </Sequence>

        {/* 5 · Tu propia cuenta */}
        <Sequence name="Huecos" {...seq(b.yourTurn, b.end)}>
          <Blanks beats={beats} from={f(b.yourTurn)} />
        </Sequence>
        <Sequence name="T · Tu cuenta" {...seq(b.yourTurn, b.end)}>
          <TwoLine l1={T.yourTurn.l1} l2={T.yourTurn.l2} dur={span(4)} l2At={span(1)} light accent={BRAND.color} fontSize={HEAD.size + 10} top={HEAD.top} />
        </Sequence>
      </Punch>

      <Sequence name="EndCard" from={f(b.end)} premountFor={30}>
        <EndCard tagline={T.tagline} cta={T.cta} hint={T.hint} ctaAt={f(b.cta) - f(b.end)} />
      </Sequence>

      <Audio
        name="Música"
        src={staticFile(TRACK.src)}
        trimBefore={trimBefore || undefined}
        volume={(fr) => {
          const duck = THUDS.reduce((g, at) => g * interpolate(fr, [at - 1, at, at + 4, at + 12], [1, 0.55, 0.55, 1], clamp), 1);
          return duck * interpolate(fr, [P13_DURATION - 36, P13_DURATION], [TRACK.volume, 0], clamp);
        }}
      />

      {/* ── Efectos ── */}
      <Sfx name="whoosh" from={0} volume={0.45} />
      <Sfx name="pop" from={f(1)} volume={0.4} />
      <Sfx name="thud" from={f(2)} volume={0.55} />
      {PRESSES.map(([k, beat], i) => (
        <Sfx key={`${k}${i}`} name="tick" from={f(beat)} volume={0.4} />
      ))}
      {/* Rampa del total: un tick por medio beat hasta el drop */}
      {[0, 0.5, 1, 1.5].map((n) => (
        <Sfx key={`r${n}`} name="tick" from={f(b.rise + n) + 3} volume={0.3 + n * 0.12} />
      ))}
      <Sfx name="thud" from={f(b.hit)} volume={0.75} />
      <Sfx name="whoosh" from={f(b.hit) - 3} volume={0.4} />
      <Sfx name="whoosh" from={f(b.tools) - 3} volume={0.45} />
      <Sfx name="thud" from={f(b.tools)} volume={0.5} />
      {P13_TOOLS.map((tl) => (
        <Sfx key={tl.title} name="pop" from={f(tl.beat)} volume={0.55} />
      ))}
      {P13_TOOLS.map((tl) => (
        <Sfx key={`ok${tl.title}`} name="ding" from={f(tl.beat + 1)} volume={0.35} />
      ))}
      <Sfx name="whoosh" from={f(b.yourTurn) - 3} volume={0.4} />
      {P13_BLANKS.map((bl) => (
        <Sfx key={bl.label} name="pop" from={f(bl.beat)} volume={0.5} />
      ))}
      <Sfx name="chime" from={f(27)} volume={0.45} />
      <Sfx name="whoosh" from={f(b.end) - 3} volume={0.5} />
      <Sfx name="thud" from={f(b.end)} volume={0.6} />
      <Sfx name="pop" from={f(b.cta)} volume={0.7} />
    </AbsoluteFill>
  );
};
