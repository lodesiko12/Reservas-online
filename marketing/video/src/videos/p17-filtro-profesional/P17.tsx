import { Audio } from "@remotion/media";
import type React from "react";
import { AbsoluteFill, interpolate, Sequence, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { BRAND } from "../../brand";
import { Sfx } from "../../components/AudioLayers";
import { Background } from "../../components/Background";
import { Camera } from "../../components/Camera";
import { EndCard } from "../../components/EndCard";
import { LightLayer } from "../../components/LightLayer";
import { PANEL, PanelMobile } from "../../components/PanelMobile";
import { PhoneFrame } from "../../components/PhoneFrame";
import { ProChips, hexAlpha } from "../../components/ProChips";
import { Punch } from "../../components/Punch";
import { TwoLine } from "../../components/TwoLine";
import { EASE_IN, clamp, pop, springIn } from "../../lib/anim";
import { makeBeats, useBeats } from "../../lib/beats";
import { TRACK as DEFAULT_TRACK } from "../../music/track";
import { LAYOUT, VIDEO } from "../../theme";
// Mismo equipo ficticio (y colores de la paleta real) que P16.
import { PROS } from "../p16-agenda-por-colores/script";
import { P17_BEATS as b, P17_DATA as D, P17_TEXT as T } from "./script";

const TRACK = DEFAULT_TRACK;
export const P17_DURATION = makeBeats(TRACK, VIDEO.fps).frame(b.total);

type F = (n: number) => number;

const PHONE_W = 700;
const PHONE_LEFT = (VIDEO.width - PHONE_W) / 2;
const PHONE_TOP = LAYOUT.stageTop - 30;
const BEZEL = Math.round(PHONE_W * 0.028);
const S = (PHONE_W - 2 * BEZEL) / 390;
const SCREEN = { x: PHONE_LEFT + BEZEL, y: PHONE_TOP + BEZEL + Math.round(PHONE_W * 0.105) };
const STAGE = { x: 540, y: 1010 };
const ROW_H = 58;
const PAULA = 1;

// ───────────────────────── Filas de la vista Día ─────────────────────────

const DayList: React.FC<{ f: F }> = ({ f }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const tap = f(b.tap);
  let gone = 0;
  let kept = 0;
  return (
    <div
      style={{
        marginTop: 12 * S,
        borderRadius: 20 * S,
        overflow: "hidden",
        background: PANEL.surface,
        border: `${1 * S}px solid #E2E8F0`,
        boxShadow: "0 1px 2px rgba(15,42,42,.06), 0 4px 16px rgba(15,42,42,.05)",
      }}
    >
      {D.rows.map(([start, end, name, service, pro], i) => {
        const inAt = f(b.rowsFrom + i * 0.5);
        if (frame < inAt) return null;
        const p = pop(frame, fps, inAt);
        const color = PROS[pro].color;
        const isPaula = pro === PAULA;
        // Con el filtro, las filas de las demás se pliegan una tras otra; las de Paula suben solas.
        const k = isPaula ? kept++ : gone++;
        const fold = isPaula ? 0 : interpolate(frame, [tap + 1 + k * 1.2, tap + 8 + k * 1.2], [0, 1], { ...clamp, easing: EASE_IN });
        const flash = interpolate(frame, [f(b.proPulses[pro]), f(b.proPulses[pro]) + 4, f(b.proPulses[pro]) + 14], [0, 1, 0], clamp);
        const glow = isPaula ? interpolate(frame, [tap + 8 + k * 2, tap + 12 + k * 2, tap + 40], [0, 1, 0.25], clamp) : 0;
        return (
          <div
            key={i}
            style={{
              height: ROW_H * S * (1 - fold),
              overflow: "hidden",
              borderTop: i ? `${1 * S}px solid #F1F5F9` : undefined,
              opacity: 1 - fold,
            }}
          >
            <div
              style={{
                height: ROW_H * S,
                display: "flex",
                alignItems: "center",
                gap: 12 * S,
                padding: `0 ${14 * S}px`,
                borderLeft: `${5 * S}px solid ${color}`,
                background: hexAlpha(color, 0.1 + flash * 0.22 + glow * 0.12),
                opacity: interpolate(p, [0, 0.3], [0, 1], clamp),
                translate: `${interpolate(p, [0, 1], [120, 0]) - fold * 60}px 0px`,
              }}
            >
              <div style={{ width: 46 * S, flexShrink: 0, lineHeight: 1.2 }}>
                <div style={{ fontSize: 15 * S, fontWeight: 800, color: BRAND.color }}>{start}</div>
                <div style={{ fontSize: 11 * S, color: "#94A3B8" }}>{end}</div>
              </div>
              <div style={{ flex: 1, minWidth: 0, lineHeight: 1.25 }}>
                <div style={{ fontSize: 14 * S, fontWeight: 600, color: PANEL.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{name}</div>
                <div style={{ fontSize: 11 * S, color: "#64748B", whiteSpace: "nowrap" }}>{service}</div>
              </div>
              <span style={{ borderRadius: 999, padding: `${2 * S}px ${9 * S}px`, fontSize: 11 * S, fontWeight: 700, background: hexAlpha(color, 0.35), color: "#0F172A" }}>
                {PROS[pro].name}
              </span>
              <span style={{ borderRadius: 999, padding: `${2 * S}px ${9 * S}px`, fontSize: 11 * S, fontWeight: 700, background: "#D5ECE8", color: BRAND.colorDark }}>
                Confirmada
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
};

/** Botonera Día / Semana / Mes (con Día activo) y navegación, como en la captura. */
const ViewTabs: React.FC = () => {
  const seg = (label: string, on: boolean) => (
    <div style={{ padding: `0 ${12 * S}px`, height: 32 * S, display: "grid", placeItems: "center", background: on ? BRAND.color : "#fff", color: on ? "#fff" : PANEL.muted, fontSize: 13 * S, fontWeight: 600 }}>
      {label}
    </div>
  );
  const btn = (label: string) => (
    <div style={{ height: 32 * S, minWidth: 40 * S, padding: `0 ${10 * S}px`, borderRadius: 12 * S, border: `${1 * S}px solid ${PANEL.border}`, background: "#fff", display: "grid", placeItems: "center", fontSize: 13 * S, fontWeight: 700 }}>
      {label}
    </div>
  );
  return (
    <div style={{ display: "flex", gap: 8 * S, marginTop: 14 * S }}>
      <div style={{ display: "flex", borderRadius: 10 * S, overflow: "hidden", border: `${1 * S}px solid ${PANEL.border}` }}>
        {seg("Día", true)}
        {seg("Semana", false)}
        {seg("Mes", false)}
      </div>
      {btn("←")}
      {btn("Hoy")}
      {btn("→")}
    </div>
  );
};

const AgendaPhone: React.FC<{ f: F }> = ({ f }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = springIn(frame, fps, f(b.phone), { damping: 15, stiffness: 150 });
  const exit = interpolate(frame, [f(b.end) - 5, f(b.end)], [0, 1], { ...clamp, easing: EASE_IN });
  if (frame < f(b.phone)) return null;
  const chipsY = SCREEN.y + 150 * S;
  const listFocus = { x: STAGE.x, y: SCREEN.y + 262 * S };
  return (
    <Camera
      keys={[
        { at: f(b.phone), scale: 1, focus: STAGE },
        { at: f(b.proPulses[0]), scale: 1, focus: STAGE },
        // Antes del toque, la cámara se acerca a la leyenda (adónde va el dedo).
        { at: f(b.tap) - 4, scale: 1.3, focus: { x: STAGE.x, y: chipsY + 120 } },
        { at: f(b.tap) + 10, scale: 1.3, focus: { x: STAGE.x, y: chipsY + 120 } },
        { at: f(b.tap) + 22, scale: 1.3, focus: listFocus },
        { at: f(b.oneTap), scale: 1.3, focus: listFocus },
        { at: f(b.oneTap) + 8, scale: 1.48, focus: listFocus },
        { at: f(b.end), scale: 1.54, focus: listFocus },
      ]}
      center={STAGE}
      fadeTop={470}
      shakes={[{ at: f(b.tap), intensity: 10 }]}
    >
      <PhoneFrame
        width={PHONE_W}
        time="09:41"
        screenColor={PANEL.bg}
        style={{
          left: PHONE_LEFT,
          top: PHONE_TOP,
          translate: `0px ${interpolate(enter, [0, 1], [1300, 0]) - exit * 1400}px`,
          rotate: `${interpolate(enter, [0, 1], [8, 0])}deg`,
        }}
      >
        <PanelMobile s={S} business={D.business} title="Agenda" subtitle={D.date}>
          <ViewTabs />
          <ProChips pros={PROS} fontSize={13 * S} pick={{ index: PAULA, at: f(b.tap) }} count={D.count} pulses={b.proPulses.map(f)} style={{ marginTop: 14 * S }} />
          <DayList f={f} />
        </PanelMobile>
      </PhoneFrame>
    </Camera>
  );
};

// ───────────────────────── Gancho: la leyenda en grande ─────────────────────────

const HookChips: React.FC<{ f: F }> = ({ f }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = springIn(frame, fps, f(b.chipsIn), { damping: 10, stiffness: 180, mass: 0.7 });
  const out = interpolate(frame, [f(b.phone) - 4, f(b.phone) + 3], [0, 1], { ...clamp, easing: EASE_IN });
  if (frame < f(b.chipsIn) || out >= 1) return null;
  return (
    <AbsoluteFill>
      <div
        style={{
          position: "absolute",
          left: 540,
          top: 960,
          translate: `-50% calc(-50% + ${interpolate(p, [0, 1], [700, 0]) - out * 900}px)`,
          scale: String(interpolate(out, [0, 1], [1, 0.4])),
        }}
      >
        <ProChips
          pros={PROS}
          fontSize={64}
          pulses={[f(b.chipsIn) + 4, f(b.paulaPulse), f(b.chipsIn) + 8]}
          style={{ width: 780, justifyContent: "center", rowGap: 36, padding: "48px 40px", borderRadius: 56, background: PANEL.bg, boxShadow: "0 40px 90px rgba(0,0,0,0.5)" }}
        />
      </div>
    </AbsoluteFill>
  );
};

// ───────────────────────── Pieza ─────────────────────────

/** P17 — "¿Solo la agenda de Paula?": filtro por profesional en la vista Día (T5, S32, citas). Sin voz. */
export const P17FiltroProfesional: React.FC = () => {
  const { frame: f, span, trimBefore } = useBeats(TRACK);
  const seq = (from: number, to: number) => ({ from: f(from), durationInFrames: f(to) - f(from) });
  const THUDS = [f(b.tap), f(b.oneTap), f(b.end)];

  return (
    <AbsoluteFill>
      <Background />

      <Sequence name="Combate" durationInFrames={f(b.end)}>
        <Punch
          hits={[
            { at: f(b.chipsIn), zoom: 0.03, shake: 8 },
            { at: f(b.paulaPulse), zoom: 0.04, shake: 10 },
            { at: f(b.phone), zoom: 0.03, shake: 6 },
            { at: f(b.tap), zoom: 0.07, shake: 16 },
            { at: f(b.oneTap), zoom: 0.05, shake: 10 },
          ]}
        >
          {/* ── Gancho (oscuro) ── */}
          <HookChips f={f} />
          <Sequence name="Titular gancho" {...seq(b.hook, b.phone)}>
            <TwoLine l1={T.hook.l1} l2={T.hook.l2} dur={span(b.phone - b.hook)} l2At={span(1)} accent={BRAND.accent} fontSize={100} />
          </Sequence>

          {/* ── Drop: fondo claro al pulsar "Paula" ── */}
          <LightLayer openAt={f(b.tap)} y={760} />

          {/* ── Agenda del día en el móvil ── */}
          <AgendaPhone f={f} />

          <Sequence name="Titular mezclada" {...seq(b.phone, b.tap)}>
            <TwoLine l1={T.mixed.l1} l2={T.mixed.l2} dur={span(b.tap - b.phone)} l2At={span(1)} accent={BRAND.accent} />
          </Sequence>
          <Sequence name="Titular filtrada" {...seq(b.tap, b.oneTap)}>
            <TwoLine l1={T.filtered.l1} l2={T.filtered.l2} dur={span(b.oneTap - b.tap)} l2At={span(1)} light accent={PROS[1].color} />
          </Sequence>
          <Sequence name="Titular un toque" {...seq(b.oneTap, b.end)}>
            <TwoLine l1={T.oneTap.l1} l2={T.oneTap.l2} dur={span(b.end - b.oneTap) + 4} l2At={span(2)} light accent={BRAND.color} fontSize={100} />
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
          return duck * interpolate(fr, [P17_DURATION - 36, P17_DURATION], [TRACK.volume, 0], clamp);
        }}
      />

      {/* ── Efectos ── */}
      <Sfx name="whoosh" from={0} volume={0.3} />
      <Sfx name="pop" from={f(b.chipsIn)} volume={0.5} />
      <Sfx name="thud" from={f(b.paulaPulse)} volume={0.45} />
      <Sfx name="whoosh" from={f(b.phone) - 3} volume={0.4} />
      {D.rows.map((_, i) => (i % 2 === 0 ? <Sfx key={i} name="tick" from={f(b.rowsFrom + i * 0.5)} volume={0.3} /> : null))}
      {b.proPulses.map((p) => (
        <Sfx key={p} name="pop" from={f(p)} volume={0.4} />
      ))}
      <Sfx name="pop" from={f(b.tap)} volume={0.65} />
      <Sfx name="thud" from={f(b.tap)} volume={0.55} />
      <Sfx name="whoosh" from={f(b.tap) + 2} volume={0.4} />
      <Sfx name="chime" from={f(b.tap) + 10} volume={0.45} />
      <Sfx name="whoosh" from={f(b.oneTap)} volume={0.35} />
      <Sfx name="thud" from={f(b.oneTap)} volume={0.45} />
      <Sfx name="whoosh" from={f(b.end) - 3} volume={0.5} />
      <Sfx name="thud" from={f(b.end)} volume={0.6} />
      <Sfx name="pop" from={f(b.cta)} volume={0.7} />
    </AbsoluteFill>
  );
};
