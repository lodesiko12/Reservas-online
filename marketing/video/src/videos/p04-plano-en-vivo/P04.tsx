import { Audio } from "@remotion/media";
import type React from "react";
import { AbsoluteFill, interpolate, Sequence, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { BRAND } from "../../brand";
import { Sfx } from "../../components/AudioLayers";
import { Background } from "../../components/Background";
import { EndCard } from "../../components/EndCard";
import { LightLayer } from "../../components/LightLayer";
import { Punch } from "../../components/Punch";
import { Sticker } from "../../components/Sticker";
import { TableCards, cardRect, type CardTap, type ZoneSpec } from "../../components/TableCards";
import { TwoLine } from "../../components/TwoLine";
import { EASE_OUT, clamp, pop, springIn } from "../../lib/anim";
import { makeBeats, useBeats } from "../../lib/beats";
import { TRACK } from "../../music/track";
import { FONT, STATUS, VIDEO } from "../../theme";
import { P04_BEATS as b, P04_PLAN, P04_TEXT as T } from "./script";

export const P04_DURATION = makeBeats(TRACK, VIDEO.fps).frame(b.total);

/** Esquina superior izquierda del plano en el lienzo (vista general). */
const PX = 60;
const PY = 480;
/** Punto del lienzo donde queda centrada la mesa enfocada. */
const FOCUS = { x: 540, y: 1060 };
const ZOOM = 2.25;

type Cam = { z: number; tx: number; ty: number };
const OVERVIEW: Cam = { z: 1, tx: 0, ty: 0 };

/** Cámara que encuadra una tarjeta: escala `z` con origen arriba-izquierda y la lleva a FOCUS. */
const focusOn = (zones: ZoneSpec[], zone: number, table: number, z = ZOOM): Cam => {
  const r = cardRect(zones, zone, table);
  return { z, tx: FOCUS.x - PX - (r.x + r.w / 2) * z, ty: FOCUS.y - PY - (r.y + r.h / 2) * z };
};

/** Interpola la cámara entre fotogramas clave (cada movimiento dura `dur` frames con EASE_OUT). */
const camAt = (frame: number, keys: { at: number; cam: Cam }[], dur = 12): Cam => {
  let cam = keys[0].cam;
  for (let i = 1; i < keys.length; i++) {
    const k = keys[i];
    if (frame < k.at) break;
    const p = interpolate(frame, [k.at, k.at + dur], [0, 1], { ...clamp, easing: EASE_OUT });
    cam = { z: cam.z + (k.cam.z - cam.z) * p, tx: cam.tx + (k.cam.tx - cam.tx) * p, ty: cam.ty + (k.cam.ty - cam.ty) * p };
  }
  return cam;
};

// ───────────────────────── Contador "Reservas hoy" ─────────────────────────

const Counter: React.FC<{ beatFrames: number; from: number; steps: number; exitAt: number }> = ({ beatFrames, from, steps, exitAt }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = pop(frame, fps, 0);
  const exit = interpolate(frame, [exitAt, exitAt + 6], [0, 1], clamp);
  // Sube uno en cada beat, a la vez que se pinta la mesa.
  const n = Math.min(steps, Math.floor(frame / beatFrames) + 1);
  const bump = interpolate(frame % beatFrames, [0, 3, 9], [1.18, 1.18, 1], clamp);
  return (
    <div
      style={{
        position: "absolute",
        right: 70,
        top: PY - 46,
        display: "flex",
        alignItems: "center",
        gap: 18,
        padding: "14px 18px 14px 30px",
        borderRadius: 999,
        background: BRAND.accent,
        color: "#fff",
        fontFamily: FONT,
        fontWeight: 900,
        fontSize: 34,
        boxShadow: "0 18px 40px rgba(255,107,74,0.45)",
        scale: String(interpolate(enter, [0, 1], [0.3, 1]) * (1 - exit * 0.4)),
        opacity: interpolate(enter, [0, 0.3], [0, 1], clamp) * (1 - exit),
        rotate: "2deg",
        zIndex: 5,
      }}
    >
      {T.counter}
      <span
        style={{
          minWidth: 76,
          height: 64,
          borderRadius: 999,
          background: "#fff",
          color: BRAND.accent,
          display: "grid",
          placeItems: "center",
          fontSize: 42,
          fontVariantNumeric: "tabular-nums",
          scale: String(bump),
        }}
      >
        {from + n}
      </span>
    </div>
  );
};

// ───────────────────────── Pieza ─────────────────────────

/** P04 — plano de sala en vivo (T5, S32, restaurantes). Sin voz; cortes sobre los golpes. */
export const P04PlanoEnVivo: React.FC = () => {
  const { frame: f, span, framesPerBeat, trimBefore } = useBeats(TRACK);
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const seq = (from: number, to: number) => ({ from: f(from), durationInFrames: f(to) - f(from) });

  const zones: ZoneSpec[] = P04_PLAN.zones.map((z) => ({
    name: z.name,
    tables: z.tables.map((t) => ({
      name: t.name,
      cap: t.cap,
      states: t.states.map((s) => ({
        at: f(s.beat),
        health: s.health,
        booking: s.who ? { who: s.who, time: s.time ?? "" } : undefined,
        next: s.next,
      })),
    })),
  }));

  const taps: CardTap[] = [
    { zone: 0, table: 1, button: 0, at: f(b.tapSeat) },
    { zone: 0, table: 4, button: 1, at: f(b.tapNoShow) },
    { zone: 0, table: 4, button: 0, at: f(b.tapWalkIn) },
  ];

  // Vista general con un empuje lento → drop: dentro de la Mesa 2 → Mesa 5 → vuelta a la sala.
  const cam = camAt(frame, [
    { at: 0, cam: OVERVIEW },
    { at: f(b.arrive), cam: focusOn(zones, 0, 1) },
    { at: f(b.late), cam: focusOn(zones, 0, 4) },
    { at: f(b.result), cam: OVERVIEW },
  ]);
  const drift = interpolate(frame, [0, f(b.arrive)], [0, 0.035], clamp);
  const enter = springIn(frame, fps, 0, { damping: 15, stiffness: 120 });

  const THUDS = [f(2), f(b.arrive), f(b.result), f(b.end)];

  return (
    <AbsoluteFill>
      <Background />
      <LightLayer openAt={f(b.arrive)} closeAt={f(b.end)} y={FOCUS.y} />

      <Punch
        hits={[
          { at: f(2), zoom: 0.03, shake: 8 },
          { at: f(b.arrive), zoom: 0.06, shake: 16 },
          { at: f(b.late), zoom: 0.03, shake: 10 },
          { at: f(b.result), zoom: 0.06, shake: 14 },
        ]}
      >
        {/* ── El plano (toda la pieza hasta la EndCard) ── */}
        <Sequence name="Plano de sala" durationInFrames={f(b.end)}>
          <AbsoluteFill
            style={{
              translate: `${cam.tx}px ${cam.ty + interpolate(enter, [0, 1], [1400, 0])}px`,
              scale: String(cam.z * (1 + drift)),
              transformOrigin: `${PX}px ${PY}px`,
              rotate: `${interpolate(enter, [0, 1], [6, 0])}deg`,
            }}
          >
            <TableCards zones={zones} business={P04_PLAN.business} shift={P04_PLAN.shift} taps={taps} style={{ left: PX, top: PY }} />
          </AbsoluteFill>
        </Sequence>

        {/* Velo superior para que el titular se lea cuando la cámara está dentro del plano */}
        <Sequence name="Velo titular" {...seq(b.arrive, b.result)}>
          <TopVeil />
        </Sequence>

        <Sequence name="Contador" {...seq(b.fill, b.arrive)}>
          <Counter beatFrames={framesPerBeat} from={P04_PLAN.counterFrom} steps={8} exitAt={span(b.arrive - b.fill) - 6} />
        </Sequence>

        {/* ── Titulares ── */}
        <Sequence name="Titular gancho" {...seq(b.hook, b.fill)}>
          <TwoLine l1={T.hook.l1} l2={T.hook.l2} dur={span(b.fill)} l2At={f(2)} accent={BRAND.accent} />
        </Sequence>
        <Sequence name="Titular reservas" {...seq(b.fill, b.arrive)}>
          <TwoLine l1={T.fill.l1} l2={T.fill.l2} dur={span(b.arrive - b.fill)} l2At={span(1)} accent={BRAND.accent} />
        </Sequence>
        <Sequence name="Titular llegan" {...seq(b.arrive, b.late)}>
          <TwoLine l1={T.arrive.l1} l2={T.arrive.l2} dur={span(b.late - b.arrive)} l2At={span(b.tapSeat - b.arrive)} light accent={STATUS.confirmed.solid} />
        </Sequence>
        <Sequence name="Titular no-show" {...seq(b.late, b.result)}>
          <TwoLine l1={T.late.l1} l2={T.late.l2} dur={span(b.result - b.late)} l2At={span(b.tapNoShow - b.late)} light accent={BRAND.color} />
        </Sequence>
        <Sequence name="Walk-in" {...seq(b.tapWalkIn, b.result)}>
          <Sticker text={T.walkIn} at={4} x={540} y={1460} rot={-4} fontSize={68} outAt={span(b.result - b.tapWalkIn) - 8} />
        </Sequence>
        <Sequence name="Titular resultado" {...seq(b.result, b.end)}>
          <TwoLine l1={T.result.l1} l2={T.result.l2} dur={span(b.end - b.result)} l2At={span(1)} light accent={BRAND.color} />
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
          return duck * interpolate(fr, [P04_DURATION - 36, P04_DURATION], [TRACK.volume, 0], clamp);
        }}
      />

      {/* ── Efectos ── */}
      <Sfx name="whoosh" from={0} volume={0.45} />
      <Sfx name="thud" from={f(2)} volume={0.5} />
      {[4, 5, 6, 7, 8, 9, 10, 11].map((n) => (
        <Sfx key={n} name="tick" from={f(n)} volume={0.35 + (n - 4) * 0.04} />
      ))}
      {[4, 6, 8, 10].map((n) => (
        <Sfx key={`p${n}`} name="pop" from={f(n)} volume={0.35} />
      ))}
      <Sfx name="thud" from={f(b.arrive)} volume={0.6} />
      <Sfx name="whoosh" from={f(b.arrive)} volume={0.4} />
      <Sfx name="pop" from={f(b.tapSeat)} volume={0.6} />
      <Sfx name="chime" from={f(b.tapSeat) + 2} volume={0.45} />
      <Sfx name="whoosh" from={f(b.late)} volume={0.35} />
      <Sfx name="thud" from={f(b.late)} volume={0.4} />
      <Sfx name="pop" from={f(b.tapNoShow)} volume={0.6} />
      <Sfx name="pop" from={f(b.tapWalkIn)} volume={0.6} />
      <Sfx name="ding" from={f(b.tapWalkIn) + 2} volume={0.4} />
      <Sfx name="whoosh" from={f(b.result)} volume={0.4} />
      <Sfx name="thud" from={f(b.result)} volume={0.55} />
      <Sfx name="whoosh" from={f(b.end) - 3} volume={0.5} />
      <Sfx name="thud" from={f(b.end)} volume={0.6} />
      <Sfx name="pop" from={f(b.cta)} volume={0.7} />
    </AbsoluteFill>
  );
};

/** Degradado claro arriba (zona del titular) mientras la cámara está dentro del plano. */
const TopVeil: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill
      style={{
        background: "linear-gradient(180deg, #F3F7F6 0%, #F3F7F6 35%, rgba(243,247,246,0.8) 39%, rgba(243,247,246,0) 45%)",
        opacity: interpolate(frame, [0, 8], [0, 1], clamp),
      }}
    />
  );
};
