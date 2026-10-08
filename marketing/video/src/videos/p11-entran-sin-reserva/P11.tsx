import { Audio } from "@remotion/media";
import type React from "react";
import { AbsoluteFill, interpolate, Sequence, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { BRAND } from "../../brand";
import { Sfx } from "../../components/AudioLayers";
import { Background } from "../../components/Background";
import { EndCard } from "../../components/EndCard";
import { LightLayer } from "../../components/LightLayer";
import { Punch } from "../../components/Punch";
import { TableCards, cardRect, type CardTap, type ZoneSpec } from "../../components/TableCards";
import { TwoLine } from "../../components/TwoLine";
import { WalkinModal } from "../../components/WalkinModal";
import { EASE_IN, EASE_OUT, clamp, pop, springIn } from "../../lib/anim";
import { makeBeats, useBeats } from "../../lib/beats";
import { OVERVIEW, camAt, focusOn } from "../../lib/planoCam";
import { TRACK } from "../../music/track";
import { FONT, STATUS, VIDEO } from "../../theme";
import { P11_BEATS as b, P11_FREE, P11_PLAN, P11_PROTECTED, P11_SEAT, P11_TEXT as T } from "./script";

export const P11_DURATION = makeBeats(TRACK, VIDEO.fps).frame(b.total);

/** Esquina superior izquierda del plano en el lienzo (vista general). */
const PLAN = { x: 60, y: 480 };
/** Punto del lienzo donde queda centrada la mesa enfocada. */
const FOCUS = { x: 540, y: 1060 };

// ───────────────────────── Gancho: llegan dos personas ─────────────────────────

const Person: React.FC<{ color: string; at: number; x: number; h: number; framesPerBeat: number }> = ({ color, at, x, h, framesPerBeat }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = springIn(frame, fps, at, { damping: 10, stiffness: 150, mass: 0.8 });
  // Rebote al caminar: un saltito por beat.
  const bob = frame >= at + 6 ? Math.abs(Math.sin(((frame - at) / framesPerBeat) * Math.PI)) * 14 : 0;
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: 950,
        translate: `${interpolate(p, [0, 1], [520, 0])}px ${-bob}px`,
        opacity: interpolate(p, [0, 0.2], [0, 1], clamp),
      }}
    >
      <svg width={h * 0.62} height={h} viewBox="0 0 62 100" style={{ filter: "drop-shadow(0 26px 30px rgba(0,0,0,0.5))" }}>
        <circle cx="31" cy="19" r="17" fill={color} />
        <path d="M5 98V62c0-14 11-24 26-24s26 10 26 24v36z" fill={color} />
      </svg>
    </div>
  );
};

/** Dos personas en la puerta del local. */
const Arrivals: React.FC<{ framesPerBeat: number; outAt: number }> = ({ framesPerBeat, outAt }) => {
  const frame = useCurrentFrame();
  const out = interpolate(frame, [outAt, outAt + 6], [0, 1], { ...clamp, easing: EASE_IN });
  const door = springIn(frame, useVideoConfig().fps, 0, { damping: 16, stiffness: 120 });
  return (
    <AbsoluteFill style={{ opacity: 1 - out, translate: `0px ${out * 220}px`, scale: String(1 - out * 0.2) }}>
      {/* La puerta: un hueco cálido de luz */}
      <div
        style={{
          position: "absolute",
          left: 190,
          top: 700,
          width: 700,
          height: 800,
          borderRadius: "340px 340px 36px 36px",
          background: "linear-gradient(180deg, rgba(255,226,170,0.18), rgba(255,226,170,0.04))",
          border: "6px solid rgba(255,226,170,0.45)",
          boxShadow: "0 0 140px rgba(255,200,120,0.25), inset 0 0 90px rgba(255,200,120,0.18)",
          scale: String(interpolate(door, [0, 1], [0.85, 1])),
          opacity: interpolate(door, [0, 0.3], [0, 1], clamp),
        }}
      />
      <Person color={BRAND.accent} at={0} x={350} h={470} framesPerBeat={framesPerBeat} />
      <Person color="#9FCFC9" at={6} x={560} h={430} framesPerBeat={framesPerBeat} />
    </AbsoluteFill>
  );
};

// ───────────────────────── Etiqueta "Walk-in · 2 pers." ─────────────────────────

/** Nace bajo las dos personas y viaja a la esquina del plano; desaparece cuando se sientan. */
const WalkInTag: React.FC<{ travelAt: number; seatedAt: number }> = ({ travelAt, seatedAt }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = pop(frame, fps, 30);
  const travel = springIn(frame, fps, travelAt, { damping: 14, stiffness: 140, mass: 0.9 });
  const exit = interpolate(frame, [seatedAt, seatedAt + 7], [0, 1], { ...clamp, easing: EASE_IN });
  const x = interpolate(travel, [0, 1], [540, 740]);
  const y = interpolate(travel, [0, 1], [1480, 452]);
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        translate: "-50% -50%",
        display: "flex",
        alignItems: "center",
        gap: 16,
        padding: "16px 34px 16px 22px",
        borderRadius: 999,
        background: BRAND.accent,
        color: "#fff",
        fontFamily: FONT,
        fontWeight: 900,
        fontSize: interpolate(travel, [0, 1], [50, 34]),
        whiteSpace: "nowrap",
        boxShadow: "0 18px 40px rgba(255,107,74,0.5)",
        rotate: `${interpolate(travel, [0, 1], [-3, 2])}deg`,
        scale: String(interpolate(enter, [0, 1], [0.3, 1]) * (1 - exit * 0.6)),
        opacity: interpolate(enter, [0, 0.3], [0, 1], clamp) * (1 - exit),
        zIndex: 6,
      }}
    >
      <svg width="42" height="42" viewBox="0 0 24 24" fill="#fff">
        <circle cx="12" cy="7" r="4" />
        <path d="M4 21v-3c0-3.3 3.6-5 8-5s8 1.7 8 5v3z" />
      </svg>
      {T.chip}
    </div>
  );
};

// ───────────────────────── Capas sobre el plano ─────────────────────────

/** Las mesas libres laten en cada golpe mientras se mira el plano (coordenadas del plano). */
const FreeGlow: React.FC<{ zones: ZoneSpec[]; from: number; to: number; framesPerBeat: number }> = ({ zones, from, to, framesPerBeat }) => {
  const frame = useCurrentFrame();
  if (frame < from || frame >= to) return null;
  const ph = ((frame - from) % framesPerBeat) / framesPerBeat;
  const a = interpolate(ph, [0, 0.12, 1], [0.95, 0.95, 0.15], clamp);
  const grow = interpolate(ph, [0, 1], [0, 16], { ...clamp, easing: EASE_OUT });
  const fadeIn = interpolate(frame, [from, from + 6], [0, 1], clamp);
  return (
    <div style={{ position: "absolute", left: PLAN.x, top: PLAN.y, width: 0, height: 0 }}>
      {P11_FREE.map(([z, t]) => {
        const r = cardRect(zones, z, t);
        return (
          <div
            key={`${z}-${t}`}
            style={{
              position: "absolute",
              left: r.x - 8 - grow / 2,
              top: r.y - 8 - grow / 2,
              width: r.w + 16 + grow,
              height: r.h + 16 + grow,
              boxSizing: "border-box",
              borderRadius: 30,
              border: `7px solid ${STATUS.confirmed.solid}`,
              boxShadow: `0 0 50px ${STATUS.confirmed.solid}`,
              opacity: a * fadeIn,
            }}
          />
        );
      })}
    </div>
  );
};

/** Escudo sobre la mesa reservada: no es un estado de la app, es una anotación del vídeo. */
const Shield: React.FC<{ at: number }> = ({ at }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = springIn(frame, fps, at, { damping: 9, stiffness: 230, mass: 0.6 });
  if (frame < at) return null;
  const beat = interpolate((frame - at) % 15, [0, 3, 10], [1.08, 1.08, 1], clamp);
  return (
    <div
      style={{
        position: "absolute",
        left: 838,
        top: 796,
        width: 190,
        height: 190,
        translate: "-50% -50%",
        borderRadius: 999,
        background: BRAND.color,
        border: "10px solid #fff",
        display: "grid",
        placeItems: "center",
        boxShadow: "0 24px 60px rgba(11,110,106,0.5)",
        scale: String(interpolate(p, [0, 1], [0.2, 1]) * (frame - at > 12 ? beat : 1)),
        rotate: `${interpolate(p, [0, 1], [-30, -6])}deg`,
        opacity: interpolate(p, [0, 0.25], [0, 1], clamp),
      }}
    >
      <svg width="104" height="104" viewBox="0 0 24 24" fill="none">
        <path d="M12 2.5l8 3v6.2c0 5-3.4 8.4-8 9.8-4.6-1.4-8-4.8-8-9.8V5.5z" fill="#fff" />
        <path d="M8.2 12.2l2.7 2.7 5-5.6" stroke={BRAND.color} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
};

/** Velo claro arriba para que el titular se lea con la cámara dentro del plano. */
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

// ───────────────────────── Pieza ─────────────────────────

/** P11 — "Entran 2 sin reserva." (T5, S32, restaurantes). Sin voz; cortes sobre los golpes. */
export const P11EntranSinReserva: React.FC = () => {
  const { frame: f, span, framesPerBeat, trimBefore } = useBeats(TRACK);
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const seq = (from: number, to: number) => ({ from: f(from), durationInFrames: f(to) - f(from) });

  const zones: ZoneSpec[] = P11_PLAN.zones.map((z, zi) => ({
    name: z.name,
    tables: z.tables.map((t, ti) => {
      const first = {
        at: 0,
        health: t.health,
        booking: t.who ? { who: t.who, time: t.time ?? "" } : undefined,
        next: t.next,
      };
      const isSeat = zi === P11_SEAT.zone && ti === P11_SEAT.table;
      return {
        name: t.name,
        cap: t.cap,
        states: isSeat
          ? [first, { at: f(b.seated), health: "sentada" as const, booking: { who: "Walk-in · 2 pers.", time: "21:15 – 22:45" } }]
          : [first],
      };
    }),
  }));

  const taps: CardTap[] = [{ zone: P11_SEAT.zone, table: P11_SEAT.table, button: 0, at: f(b.tapSeat) }];

  const cam = camAt(frame, [
    { at: 0, cam: OVERVIEW },
    { at: f(b.drop), cam: focusOn(zones, P11_SEAT.zone, P11_SEAT.table, PLAN, FOCUS) },
    { at: f(b.reserved), cam: focusOn(zones, P11_PROTECTED.zone, P11_PROTECTED.table, PLAN, FOCUS, 2.1) },
    { at: f(b.result), cam: OVERVIEW },
  ]);
  const drift = interpolate(frame, [f(b.plan), f(b.drop)], [0, 0.035], clamp);
  // Empuje lento continuo mientras se mira la mesa reservada (nada queda inmóvil).
  const drift2 = interpolate(frame, [f(b.reserved), f(b.result)], [0, 0.07], clamp);
  const enter = springIn(frame, fps, f(b.plan), { damping: 15, stiffness: 120 });

  // Modal "Sentar clientes · Mesa 3": entra tras el toque en la tarjeta y se cierra al tocar el número.
  const modalIn = springIn(frame, fps, f(b.modal), { damping: 12, stiffness: 200, mass: 0.7 });
  const modalOut = interpolate(frame, [f(b.seated), f(b.seated) + 6], [0, 1], { ...clamp, easing: EASE_IN });
  const modalOn = frame >= f(b.modal) && modalOut < 1;

  const THUDS = [f(2), f(b.drop), f(b.result), f(b.end)];

  return (
    <AbsoluteFill>
      <Background />
      <LightLayer openAt={f(b.drop)} closeAt={f(b.end)} y={FOCUS.y} />

      <Punch
        hits={[
          { at: f(2), zoom: 0.03, shake: 8 },
          { at: f(b.drop), zoom: 0.06, shake: 16 },
          { at: f(b.seated), zoom: 0.03, shake: 8 },
          { at: f(b.reserved + 1.5), zoom: 0.03, shake: 10 },
          { at: f(b.result), zoom: 0.06, shake: 14 },
        ]}
      >
        {/* ── Gancho: dos personas en la puerta ── */}
        <Sequence name="Entran dos" {...seq(b.hook, b.plan)}>
          <Arrivals framesPerBeat={framesPerBeat} outAt={span(b.plan - b.hook) - 6} />
        </Sequence>

        {/* ── El plano (desde el beat 4 hasta la EndCard) ── */}
        <Sequence name="Plano de sala" durationInFrames={f(b.end)}>
          <AbsoluteFill
            style={{
              translate: `${cam.tx}px ${cam.ty + interpolate(enter, [0, 1], [1400, 0])}px`,
              scale: String(cam.z * (1 + drift + drift2)),
              transformOrigin: `${PLAN.x}px ${PLAN.y}px`,
              rotate: `${interpolate(enter, [0, 1], [6, 0])}deg`,
              opacity: frame >= f(b.plan) ? 1 : 0,
            }}
          >
            <TableCards zones={zones} business={P11_PLAN.business} shift={P11_PLAN.shift} taps={taps} style={{ left: PLAN.x, top: PLAN.y }} />
            <FreeGlow zones={zones} from={f(b.plan) + 12} to={f(b.drop)} framesPerBeat={framesPerBeat} />
          </AbsoluteFill>
        </Sequence>

        <Sequence name="Velo titular" {...seq(b.drop, b.result)}>
          <TopVeil />
        </Sequence>

        {/* Escudo: la mesa reservada de 6 sigue a salvo */}
        <Sequence name="Escudo" {...seq(b.reserved, b.result)}>
          <Shield at={span(b.reserved + 1.5 - b.reserved)} />
        </Sequence>

        {/* Etiqueta que viaja de la puerta al plano y se va al sentarlos */}
        <Sequence name="Etiqueta walk-in" durationInFrames={f(b.seated) + 10}>
          <WalkInTag travelAt={f(b.plan)} seatedAt={f(b.seated)} />
        </Sequence>

        {/* ── Modal real: Sentar clientes · Mesa 3 → "2" ── */}
        {modalOn ? (
          <AbsoluteFill>
            <AbsoluteFill style={{ background: `rgba(10,29,29,${0.55 * interpolate(modalIn, [0, 1], [0, 1], clamp) * (1 - modalOut)})` }} />
            <WalkinModal
              table={P11_SEAT.name}
              tapped={{ n: 2, t: frame - f(b.tapParty) }}
              style={{
                position: "absolute",
                left: 120,
                top: 690,
                scale: String(interpolate(modalIn, [0, 1], [0.6, 1]) * (1 - modalOut * 0.25)),
                transformOrigin: "50% 40%",
                opacity: interpolate(modalIn, [0, 0.25], [0, 1], clamp) * (1 - modalOut),
              }}
            />
          </AbsoluteFill>
        ) : null}

        {/* ── Titulares ── */}
        <Sequence name="Titular gancho" {...seq(b.hook, b.plan)}>
          <TwoLine l1={T.hook.l1} l2={T.hook.l2} dur={span(b.plan - b.hook)} l2At={span(1.5)} accent={BRAND.accent} />
        </Sequence>
        <Sequence name="Titular plano" {...seq(b.plan, b.drop)}>
          <TwoLine l1={T.plan.l1} l2={T.plan.l2} dur={span(b.drop - b.plan)} l2At={span(2)} accent={BRAND.accent} />
        </Sequence>
        <Sequence name="Titular sentar" {...seq(b.drop, b.reserved)}>
          <TwoLine l1={T.drop.l1} l2={T.drop.l2} dur={span(b.reserved - b.drop)} l2At={span(b.tapParty - b.drop)} light accent={BRAND.color} />
        </Sequence>
        <Sequence name="Titular reservadas" {...seq(b.reserved, b.result)}>
          <TwoLine l1={T.reserved.l1} l2={T.reserved.l2} dur={span(b.result - b.reserved)} l2At={span(1.5)} light accent={BRAND.color} />
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
          return duck * interpolate(fr, [P11_DURATION - 36, P11_DURATION], [TRACK.volume, 0], clamp);
        }}
      />

      {/* ── Efectos ── */}
      <Sfx name="whoosh" from={0} volume={0.45} />
      <Sfx name="pop" from={f(0.5)} volume={0.45} />
      <Sfx name="pop" from={f(1)} volume={0.45} />
      <Sfx name="thud" from={f(2)} volume={0.5} />
      <Sfx name="whoosh" from={f(b.plan) - 3} volume={0.4} />
      {[4, 5, 6, 7, 8, 9, 10, 11].map((n) => (
        <Sfx key={n} name="tick" from={f(n)} volume={0.3 + (n - 4) * 0.04} />
      ))}
      <Sfx name="thud" from={f(b.drop)} volume={0.65} />
      <Sfx name="whoosh" from={f(b.drop)} volume={0.4} />
      <Sfx name="pop" from={f(b.tapSeat)} volume={0.6} />
      <Sfx name="pop" from={f(b.modal)} volume={0.5} />
      <Sfx name="pop" from={f(b.tapParty)} volume={0.6} />
      <Sfx name="chime" from={f(b.seated) + 1} volume={0.5} />
      <Sfx name="whoosh" from={f(b.reserved)} volume={0.35} />
      <Sfx name="thud" from={f(b.reserved + 1.5)} volume={0.55} />
      <Sfx name="ding" from={f(b.reserved + 1.5) + 3} volume={0.35} />
      <Sfx name="whoosh" from={f(b.result)} volume={0.4} />
      <Sfx name="thud" from={f(b.result)} volume={0.55} />
      <Sfx name="whoosh" from={f(b.end) - 3} volume={0.5} />
      <Sfx name="thud" from={f(b.end)} volume={0.6} />
      <Sfx name="pop" from={f(b.cta)} volume={0.7} />
    </AbsoluteFill>
  );
};
