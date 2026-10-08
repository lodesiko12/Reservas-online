import { Audio } from "@remotion/media";
import type React from "react";
import { AbsoluteFill, interpolate, interpolateColors, Sequence, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { BRAND } from "../../brand";
import { Sfx } from "../../components/AudioLayers";
import { Background } from "../../components/Background";
import { EndCard } from "../../components/EndCard";
import { LightLayer } from "../../components/LightLayer";
import { Punch } from "../../components/Punch";
import { HEALTH } from "../../components/TableCards";
import { TwoLine } from "../../components/TwoLine";
import { WhatsAppBubble } from "../../components/WhatsAppChat";
import { EASE_OUT, clamp, pop, springIn } from "../../lib/anim";
import { makeBeats, useBeats, type Beats } from "../../lib/beats";
import { TRACK } from "../../music/track";
import { COLORS, FONT, VIDEO } from "../../theme";
import { P07_BEATS as b, P07_COUNT, P07_DAYS, P07_NO_SHOWS, P07_REMINDER, P07_TEXT as T } from "./script";

export const P07_DURATION = makeBeats(TRACK, VIDEO.fps).frame(b.total);

/** Titular cinético: grande y alto, el visual va debajo. */
const HEAD = { top: 290, size: 150 } as const;
const STAGE_Y = 800;

// ───────────────────────── Escena 1: los cuatro días del puente ─────────────────────────

const DayStrip: React.FC<{ beats: Beats }> = ({ beats }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const W = 200;
  const GAP = 24;
  const x0 = (1080 - (4 * W + 3 * GAP)) / 2;
  const mark = beats.frame(2);
  const bracket = interpolate(frame, [mark, mark + 8], [0, 1], { ...clamp, easing: EASE_OUT });
  return (
    <AbsoluteFill>
      {P07_DAYS.map((d, i) => {
        const at = beats.frame(i * 0.5);
        const p = pop(frame, fps, at);
        const hol = "holiday" in d && d.holiday;
        const lit = hol ? interpolate(frame, [mark, mark + 4], [0, 1], clamp) : 0;
        return (
          <div
            key={d.day}
            style={{
              position: "absolute",
              left: x0 + i * (W + GAP),
              top: STAGE_Y + 60,
              width: W,
              height: 240,
              borderRadius: 32,
              background: interpolateColors(lit, [0, 1], ["#FFFFFF", BRAND.accent]),
              color: interpolateColors(lit, [0, 1], [COLORS.ink, "#FFFFFF"]),
              fontFamily: FONT,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 30px 60px rgba(0,0,0,0.45)",
              opacity: interpolate(p, [0, 0.3], [0, 1], clamp),
              translate: `0px ${interpolate(p, [0, 1], [-160, 0])}px`,
              rotate: `${interpolate(p, [0, 1], [i % 2 ? 10 : -10, i % 2 ? 2 : -2])}deg`,
              scale: String(hol ? 1 + 0.1 * interpolate(frame, [mark, mark + 3, mark + 12], [0, 1, 0], clamp) : 1),
            }}
          >
            <div style={{ fontSize: 40, fontWeight: 800, opacity: 0.7, letterSpacing: 2 }}>{d.dow}</div>
            <div style={{ fontSize: 120, fontWeight: 900, lineHeight: 1 }}>{d.day}</div>
            <div style={{ fontSize: 30, fontWeight: 800, opacity: 0.7 }}>{hol ? "Festivo" : "oct"}</div>
          </div>
        );
      })}
      {/* Llave que abarca los cuatro días */}
      <div
        style={{
          position: "absolute",
          left: x0,
          top: STAGE_Y + 340,
          width: 4 * W + 3 * GAP,
          height: 16,
          borderRadius: 999,
          background: BRAND.accent,
          transformOrigin: "0 50%",
          scale: `${bracket} 1`,
          boxShadow: `0 0 30px ${BRAND.accent}`,
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: STAGE_Y + 390,
          textAlign: "center",
          fontFamily: FONT,
          fontWeight: 900,
          fontSize: 60,
          color: BRAND.accent,
          opacity: bracket,
          translate: `0px ${(1 - bracket) * 30}px`,
        }}
      >
        4 días seguidos
      </div>
    </AbsoluteFill>
  );
};

// ───────────────────────── Escenas 2 y 4: la sala (cuadrícula de mesas) ─────────────────────────

const COLS = 4;
const TILE_W = 200;
const TILE_H = 150;
const TILE_GAP = 24;
/** Orden en el que se llenan las mesas (no de izquierda a derecha: más orgánico). */
const FILL_ORDER = [5, 0, 10, 3, 7, 1, 8, 11, 2, 6, 9, 4];

type Tiles = {
  /** Frame en el que se reserva cada mesa (`undefined` = ya reservada al empezar). */
  fillAt?: (i: number) => number;
  /** Frame en el que cada mesa "no vino" (solo las de `P07_NO_SHOWS`). */
  noShowAt?: (i: number) => number | undefined;
};

const TableGrid: React.FC<Tiles> = ({ fillAt, noShowAt }) => {
  const frame = useCurrentFrame();
  const x0 = (1080 - (COLS * TILE_W + (COLS - 1) * TILE_GAP)) / 2;
  const free = HEALTH.libre;
  const res = HEALTH.reservada;
  const late = HEALTH.retrasada;
  return (
    <AbsoluteFill>
      {Array.from({ length: 12 }).map((_, i) => {
        const fa = fillAt ? fillAt(i) : -100;
        const filled = interpolate(frame, [fa, fa + 4], [0, 1], clamp);
        const flash = interpolate(frame, [fa, fa + 2, fa + 10], [0, 1, 0], clamp);
        const na = noShowAt?.(i);
        const red = na === undefined ? 0 : interpolate(frame, [na, na + 3], [0, 1], clamp);
        const t = na === undefined ? -1 : frame - na;
        const shake = t >= 0 && t < 14 ? Math.sin(t * 2.6) * 14 * (1 - t / 14) : 0;
        const label = red > 0.5 ? T.noShowTag : filled > 0.5 ? res.label : free.label;
        const ink = red > 0.5 ? late.text : filled > 0.5 ? res.text : "rgba(255,255,255,0.55)";
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: x0 + (i % COLS) * (TILE_W + TILE_GAP),
              top: STAGE_Y + 40 + Math.floor(i / COLS) * (TILE_H + TILE_GAP),
              width: TILE_W,
              height: TILE_H,
              boxSizing: "border-box",
              borderRadius: 26,
              border: `4px solid ${interpolateColors(red, [0, 1], [interpolateColors(filled, [0, 1], ["rgba(255,255,255,0.22)", res.border]), late.border])}`,
              background: interpolateColors(red, [0, 1], [interpolateColors(filled, [0, 1], ["rgba(255,255,255,0.05)", res.bg]), late.bg]),
              fontFamily: FONT,
              padding: "16px 18px",
              scale: String(1 + 0.12 * flash + 0.1 * interpolate(t, [0, 3, 12], [0, 1, 0], clamp)),
              translate: `${shake}px 0px`,
              boxShadow:
                red > 0
                  ? `0 0 ${40 * red}px rgba(248,113,113,${0.7 * red})`
                  : filled > 0
                    ? `0 0 ${30 * flash}px ${res.border}`
                    : undefined,
            }}
          >
            <div style={{ fontSize: 34, fontWeight: 900, color: filled > 0.5 || red > 0.5 ? "#0F172A" : "rgba(255,255,255,0.75)" }}>
              Mesa {i + 1}
            </div>
            <div style={{ fontSize: 26, fontWeight: 800, color: ink, marginTop: 10 }}>{label}</div>
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

// ───────────────────────── Escena 3: la cuenta ─────────────────────────

const BigCount: React.FC<{ endAt: number }> = ({ endAt }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = interpolate(frame, [0, endAt], [0, 1], { ...clamp, easing: EASE_OUT });
  const n = Math.round(P07_COUNT * p);
  const land = springIn(frame, fps, endAt, { damping: 9, stiffness: 240, mass: 0.6 });
  const labelIn = springIn(frame, fps, 4);
  return (
    <AbsoluteFill style={{ alignItems: "center", fontFamily: FONT }}>
      <div
        style={{
          position: "absolute",
          top: STAGE_Y - 20,
          fontSize: 400,
          fontWeight: 900,
          lineHeight: 1,
          letterSpacing: -12,
          fontVariantNumeric: "tabular-nums",
          color: BRAND.accent,
          textShadow: `0 0 80px color-mix(in srgb, ${BRAND.accent} 45%, transparent)`,
          scale: String(1 + 0.12 * interpolate(land, [0, 0.5, 1], [0, 1, 0])),
        }}
      >
        {n}
      </div>
      <div
        style={{
          position: "absolute",
          top: STAGE_Y + 420,
          fontSize: 56,
          fontWeight: 800,
          color: "#CFE6E3",
          opacity: labelIn,
          translate: `0px ${(1 - labelIn) * 30}px`,
        }}
      >
        {T.countLabel}
      </div>
      <div style={{ position: "absolute", top: STAGE_Y + 500, fontSize: 40, fontWeight: 700, color: COLORS.textMuted, opacity: labelIn }}>
        {T.example}
      </div>
    </AbsoluteFill>
  );
};

// ───────────────────────── Escena 5: el recordatorio ─────────────────────────

const Reminder: React.FC<{ beats: Beats }> = ({ beats }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const chip = pop(frame, fps, beats.frame(0.5));
  const bubble = springIn(frame, fps, beats.frame(1), { damping: 12, stiffness: 200, mass: 0.7 });
  const read = interpolate(frame, [beats.frame(2.5), beats.frame(2.5) + 6], [0, 1], clamp);
  return (
    <AbsoluteFill>
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: STAGE_Y,
          display: "flex",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            padding: "14px 30px",
            borderRadius: 999,
            background: BRAND.color,
            color: "#fff",
            fontFamily: FONT,
            fontWeight: 900,
            fontSize: 40,
            boxShadow: "0 16px 40px rgba(11,110,106,0.35)",
            opacity: interpolate(chip, [0, 0.3], [0, 1], clamp),
            scale: String(interpolate(chip, [0, 1], [0.4, 1])),
          }}
        >
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="9" stroke="#fff" strokeWidth="2.6" />
            <path d="M12 7v5l3.5 2" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" />
          </svg>
          {T.reminderChip}
        </div>
      </div>
      <div style={{ position: "absolute", left: 70, right: 70, top: STAGE_Y + 160, display: "flex", flexDirection: "column" }}>
        <WhatsAppBubble
          from="me"
          text={P07_REMINDER}
          time="21:00"
          ticks="sent"
          readProgress={read}
          appear={bubble}
          scale={2.05}
          maxWidth="100%"
          style={{ boxShadow: "0 30px 70px rgba(15,42,42,0.25)" }}
        />
      </div>
    </AbsoluteFill>
  );
};

// ───────────────────────── Pieza ─────────────────────────

/** P07 — "Puente del Pilar." (T4, S24, restaurantes). Sin voz; una frase por escena, cortes en los golpes. */
export const P07PuenteDelPilar: React.FC = () => {
  const beats = useBeats(TRACK);
  const { frame: f, span, trimBefore } = beats;
  const seq = (from: number, to: number) => ({ from: f(from), durationInFrames: f(to) - f(from) });
  const THUDS = [f(2), f(b.count + 3), f(b.noShow), f(b.reminder), f(b.end)];

  // Escena 2: las 12 mesas se llenan en 4 beats (3 por beat). Escena 4: ya llenas; 3 fallan, una por beat.
  const fillAt = (i: number) => span(FILL_ORDER.indexOf(i) / 3);
  const noShowAt = (i: number) => {
    const k = (P07_NO_SHOWS as readonly number[]).indexOf(i);
    return k < 0 ? undefined : span(k);
  };

  return (
    <AbsoluteFill>
      <Background />
      <LightLayer openAt={f(b.reminder)} closeAt={f(b.end)} y={1000} />

      <Punch
        hits={[
          { at: f(2), zoom: 0.05, shake: 12 },
          { at: f(b.count + 3), zoom: 0.06, shake: 14 },
          { at: f(b.noShow), zoom: 0.07, shake: 18 },
          { at: f(b.reminder), zoom: 0.05, shake: 10 },
        ]}
      >
        {/* 1 · Puente del Pilar */}
        <Sequence name="Días del puente" {...seq(b.bridge, b.full)}>
          <DayStrip beats={beats} />
        </Sequence>
        <Sequence name="T · Puente" {...seq(b.bridge, b.full)}>
          <TwoLine l1={T.bridge.l1} l2={T.bridge.l2} dur={span(4)} l2At={span(2)} accent={BRAND.accent} fontSize={HEAD.size} top={HEAD.top} />
        </Sequence>

        {/* 2 · Sala llena */}
        <Sequence name="Mesas se llenan" {...seq(b.full, b.count)}>
          <TableGrid fillAt={fillAt} />
        </Sequence>
        <Sequence name="T · Sala llena" {...seq(b.full, b.count)}>
          <TwoLine l1={T.full.l1} l2={T.full.l2} dur={span(4)} l2At={span(2)} accent={HEALTH.reservada.border} fontSize={HEAD.size + 20} top={HEAD.top} />
        </Sequence>

        {/* 3 · La cuenta */}
        <Sequence name="Contador" {...seq(b.count, b.noShow)}>
          <BigCount endAt={span(3)} />
        </Sequence>
        <Sequence name="T · Reservas" {...seq(b.count, b.noShow)}>
          <TwoLine l1={T.count.l1} l2={T.count.l2} dur={span(4)} l2At={span(1)} accent={BRAND.accent} fontSize={130} top={HEAD.top - 40} />
        </Sequence>

        {/* 4 · Drop: los que no aparecen */}
        <Sequence name="Mesas que fallan" {...seq(b.noShow, b.reminder)}>
          <RedVignette />
          <TableGrid noShowAt={noShowAt} />
        </Sequence>
        <Sequence name="T · No aparecen" {...seq(b.noShow, b.reminder)}>
          <TwoLine l1={T.noShow.l1} l2={T.noShow.l2} dur={span(4)} l2At={span(1)} accent={HEALTH.retrasada.border} fontSize={HEAD.size - 20} top={HEAD.top} />
        </Sequence>

        {/* 5 · Fondo claro: el recordatorio */}
        <Sequence name="Recordatorio" {...seq(b.reminder, b.end)}>
          <Reminder beats={beats} />
        </Sequence>
        <Sequence name="T · Recordatorios" {...seq(b.reminder, b.end)}>
          <TwoLine l1={T.reminder.l1} l2={T.reminder.l2} dur={span(4)} l2At={span(1)} light accent={BRAND.color} fontSize={104} top={HEAD.top} />
        </Sequence>
      </Punch>

      <Sequence name="EndCard" from={f(b.end)} premountFor={30}>
        <EndCard ctaAt={f(b.cta) - f(b.end)} />
      </Sequence>

      <Audio
        name="Música"
        src={staticFile(TRACK.src)}
        trimBefore={trimBefore || undefined}
        volume={(fr) => {
          const duck = THUDS.reduce((g, at) => g * interpolate(fr, [at - 1, at, at + 4, at + 12], [1, 0.55, 0.55, 1], clamp), 1);
          return duck * interpolate(fr, [P07_DURATION - 30, P07_DURATION], [TRACK.volume, 0], clamp);
        }}
      />

      {/* ── Efectos ── */}
      {[0, 0.5, 1, 1.5].map((n) => (
        <Sfx key={`d${n}`} name="pop" from={f(n)} volume={0.45} />
      ))}
      <Sfx name="thud" from={f(2)} volume={0.55} />
      <Sfx name="whoosh" from={f(b.full) - 3} volume={0.4} />
      {[0, 1, 2, 3].map((n) => (
        <Sfx key={`f${n}`} name="tick" from={f(b.full + n)} volume={0.45} />
      ))}
      <Sfx name="whoosh" from={f(b.count) - 3} volume={0.4} />
      {[0, 1, 2].map((n) => (
        <Sfx key={`c${n}`} name="tick" from={f(b.count + n)} volume={0.35 + n * 0.1} />
      ))}
      <Sfx name="thud" from={f(b.count + 3)} volume={0.6} />
      <Sfx name="thud" from={f(b.noShow)} volume={0.65} />
      {[1, 2].map((n) => (
        <Sfx key={`n${n}`} name="thud" from={f(b.noShow + n)} volume={0.4} />
      ))}
      <Sfx name="whoosh" from={f(b.reminder)} volume={0.4} />
      <Sfx name="pop" from={f(b.reminder + 1)} volume={0.6} />
      <Sfx name="ding" from={f(b.reminder + 2.5)} volume={0.4} />
      <Sfx name="whoosh" from={f(b.end) - 3} volume={0.5} />
      <Sfx name="thud" from={f(b.end)} volume={0.6} />
      <Sfx name="pop" from={f(b.cta)} volume={0.7} />
    </AbsoluteFill>
  );
};

/** Pulso rojo en los bordes durante el drop. */
const RedVignette: React.FC = () => {
  const frame = useCurrentFrame();
  const a = interpolate(frame, [0, 2, 20], [0.6, 0.6, 0.25], clamp);
  return <AbsoluteFill style={{ background: `radial-gradient(ellipse at 50% 55%, transparent 45%, rgba(192,57,43,${a}) 100%)` }} />;
};

