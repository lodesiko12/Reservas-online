import { Audio } from "@remotion/media";
import type React from "react";
import { AbsoluteFill, interpolate, Sequence, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { BRAND } from "../../brand";
import { Sfx } from "../../components/AudioLayers";
import { Background } from "../../components/Background";
import { EndCard } from "../../components/EndCard";
import { LightLayer } from "../../components/LightLayer";
import { Punch } from "../../components/Punch";
import { HistoryEntry, HistoryPanel, SeguimientoScreen, SessionForm, type SessionFields } from "../../components/PsyScreens";
import { Sticker } from "../../components/Sticker";
import { TwoLine } from "../../components/TwoLine";
import { clamp, pop, springIn } from "../../lib/anim";
import { makeBeats, useBeats } from "../../lib/beats";
import { TRACK } from "../../music/track";
import { FONT, STATUS, VIDEO } from "../../theme";
import { P10_BEATS as b, P10_DATA as D, P10_STICKERS, P10_TEXT as T } from "./script";

export const P10_DURATION = makeBeats(TRACK, VIDEO.fps).frame(b.total);

const HEAD = { top: 290, size: 104 } as const;
const STAGE_Y = 700;

/** Suave "respiración" de cámara: un zoom lento que no se detiene durante la escena. */
const Drift: React.FC<{ children: React.ReactNode; amount?: number; frames: number }> = ({ children, amount = 0.04, frames }) => {
  const frame = useCurrentFrame();
  return <AbsoluteFill style={{ scale: String(1 + interpolate(frame, [0, frames], [0, amount], clamp)), transformOrigin: "50% 62%" }}>{children}</AbsoluteFill>;
};

// ───────────────────────── Escena 1: la mente (gancho) ─────────────────────────

const MindHeart: React.FC<{ framesPerBeat: number }> = ({ framesPerBeat }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = pop(frame, fps, 0);
  // Latido en cada beat (como una respiración que marca el compás).
  const beat = interpolate(frame % framesPerBeat, [0, 3, 10], [1.12, 1.12, 1], clamp);
  const chip = pop(frame, fps, 2);
  return (
    <AbsoluteFill>
      <div style={{ position: "absolute", left: 0, right: 0, top: 1060 - 330, height: 660 }}>
        {[0, 1, 2].map((i) => {
          const ph = ((frame + i * (framesPerBeat * 2)) % (framesPerBeat * 6)) / (framesPerBeat * 6);
          return (
            <div
              key={i}
              style={{
                position: "absolute",
                left: "50%",
                top: "50%",
                width: 700,
                height: 700,
                marginLeft: -350,
                marginTop: -350,
                borderRadius: "50%",
                border: `6px solid color-mix(in srgb, ${BRAND.colorLight} 80%, transparent)`,
                scale: String(0.45 + ph * 0.85),
                opacity: interpolate(ph, [0, 0.15, 1], [0, 0.7, 0], clamp),
              }}
            />
          );
        })}
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            width: 330,
            height: 330,
            marginLeft: -165,
            marginTop: -165,
            borderRadius: "50%",
            background: `radial-gradient(circle at 35% 30%, ${BRAND.colorLight}, ${BRAND.color})`,
            boxShadow: `0 0 120px color-mix(in srgb, ${BRAND.colorLight} 60%, transparent), 0 30px 70px rgba(0,0,0,0.5)`,
            display: "grid",
            placeItems: "center",
            scale: String(interpolate(enter, [0, 1], [0.2, 1]) * beat),
            opacity: interpolate(enter, [0, 0.25], [0, 1], clamp),
          }}
        >
          <svg width="170" height="170" viewBox="0 0 24 24" fill={BRAND.accent}>
            <path d="M12 21s-7.5-4.6-9.6-9.2C.9 8.4 2.7 4.8 6.2 4.5c2-.2 3.9.8 5.8 3 1.9-2.2 3.8-3.2 5.8-3 3.5.3 5.3 3.9 3.8 7.3C19.5 16.4 12 21 12 21z" />
          </svg>
        </div>
      </div>
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 1480,
          display: "flex",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            padding: "12px 34px",
            borderRadius: 999,
            border: "3px solid rgba(207,230,227,0.4)",
            color: "#CFE6E3",
            fontFamily: FONT,
            fontWeight: 800,
            fontSize: 38,
            letterSpacing: 2,
            opacity: interpolate(chip, [0, 0.3], [0, 1], clamp),
            scale: String(interpolate(chip, [0, 1], [0.5, 1])),
          }}
        >
          {T.chip}
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ───────────────────────── Escenas 3-5: el panel ─────────────────────────

const ptap = (frame: number, at: number) => interpolate(frame, [at - 2, at, at + 6], [1, 0.9, 1], clamp);

/** Seguimiento → el toque en "Empezar cita" abre el formulario → se rellena → "Guardar sesión". */
const PanelFlow: React.FC<{ beats: ReturnType<typeof makeBeats>; from: number }> = ({ beats, from }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const l = (n: number) => beats.frame(n) - from;
  const enter = springIn(frame, fps, 0, { damping: 15, stiffness: 150, mass: 0.8 });
  const tapStart = l(b.tapStart);
  const tapSave = l(b.tapSave);

  // Modal: aparece en `form` y se va en `saved`.
  const formP = springIn(frame, fps, l(b.form), { damping: 13, stiffness: 190, mass: 0.7 });
  const formOut = interpolate(frame, [tapSave + 3, tapSave + 8], [0, 1], clamp);
  const dim = interpolate(frame, [l(b.form), l(b.form) + 6], [0, 1], clamp) * (1 - formOut);

  // Texto tecleado: cada campo ocupa su porción del tramo type → typeEnd.
  const keys = [D.form.objective, D.form.notes, D.form.followUp, D.form.tasks];
  const t0 = l(b.type);
  const per = (l(b.typeEnd) - t0) / 4;
  const typedOf = (i: number) => {
    const p = interpolate(frame, [t0 + per * i, t0 + per * (i + 1) - 1], [0, 1], clamp);
    return keys[i].slice(0, Math.floor(keys[i].length * p));
  };
  const typed: SessionFields = { objective: typedOf(0), notes: typedOf(1), followUp: typedOf(2), tasks: typedOf(3) };
  const active = [0, 1, 2, 3].find((i) => frame >= t0 + per * i && frame < t0 + per * (i + 1)) ?? (frame >= t0 + per * 4 ? 3 : -1);

  return (
    <AbsoluteFill>
      <SeguimientoScreen
        current={D.current}
        next={D.next}
        pressStart={ptap(frame, tapStart)}
        rippleStart={frame - tapStart}
        style={{
          position: "absolute",
          left: 90,
          top: STAGE_Y,
          scale: String(0.86 * interpolate(enter, [0, 1], [0.7, 1])),
          transformOrigin: "50% 0",
          translate: `0px ${interpolate(enter, [0, 1], [900, 0])}px`,
          rotate: `${interpolate(enter, [0, 1], [5, 0])}deg`,
        }}
      />
      {dim > 0 ? <AbsoluteFill style={{ background: `rgba(10,29,29,${0.5 * dim})` }} /> : null}
      {formP > 0.001 && formOut < 1 ? (
        <SessionForm
          firstName="Marta"
          typed={typed}
          activeField={active}
          pressSave={ptap(frame, tapSave)}
          rippleSave={frame - tapSave}
          style={{
            position: "absolute",
            left: 110,
            top: 690,
            scale: String(0.97 * interpolate(formP, [0, 1], [0.6, 1]) * (1 - formOut * 0.15)),
            transformOrigin: "50% 0",
            opacity: interpolate(formP, [0, 0.25], [0, 1], clamp) * (1 - formOut),
          }}
        />
      ) : null}
    </AbsoluteFill>
  );
};

/** Ficha del paciente → Historial: la sesión recién guardada entra arriba. */
const Saved: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = springIn(frame, fps, 0, { damping: 14, stiffness: 170, mass: 0.8 });
  const entry = springIn(frame, fps, 4, { damping: 12, stiffness: 200, mass: 0.7 });
  const badge = springIn(frame, fps, 8, { damping: 9, stiffness: 240, mass: 0.6 });
  const glow = interpolate(frame, [4, 8, 24], [0, 1, 0], clamp);
  return (
    <AbsoluteFill>
      <HistoryPanel
        name={D.current.name}
        style={{
          position: "absolute",
          left: 90,
          top: STAGE_Y,
          height: 800,
          overflow: "hidden",
          scale: String(interpolate(enter, [0, 1], [0.85, 1])),
          opacity: interpolate(enter, [0, 0.25], [0, 1], clamp),
        }}
        entries={
          <>
            <HistoryEntry
              when="9 oct, 16:00"
              fields={{ objective: D.form.objective, notes: D.form.notes, followUp: D.form.followUp, tasks: D.form.tasks }}
              style={{
                borderColor: STATUS.confirmed.solid,
                boxShadow: `0 0 0 ${10 * glow}px color-mix(in srgb, ${STATUS.confirmed.solid} 28%, transparent)`,
                opacity: interpolate(entry, [0, 0.3], [0, 1], clamp),
                translate: `0px ${interpolate(entry, [0, 1], [-120, 0])}px`,
              }}
            />
            <HistoryEntry
              when="2 oct, 16:00"
              fields={{ objective: "Poner nombre a lo que siento", notes: "Primera toma de contacto y expectativas", followUp: "Valorar el ritmo de las sesiones", tasks: "Apuntar tres momentos del día" }}
            />
          </>
        }
      />
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: STAGE_Y - 90,
          display: "flex",
          justifyContent: "center",
          opacity: interpolate(badge, [0, 0.3], [0, 1], clamp),
          scale: String(interpolate(badge, [0, 1], [0.3, 1])),
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            padding: "12px 34px 12px 16px",
            borderRadius: 999,
            background: STATUS.confirmed.solid,
            color: "#fff",
            fontFamily: FONT,
            fontWeight: 900,
            fontSize: 40,
            boxShadow: "0 18px 40px rgba(31,138,76,0.4)",
          }}
        >
          <svg width="52" height="52" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="11" fill="#fff" />
            <path d="M6.5 12.5l4 4 7-8" stroke={STATUS.confirmed.solid} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Sesión guardada
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ───────────────────────── Pieza ─────────────────────────

/** P10 — "Cuidas la mente de los demás." (T4, S24, psicólogos). Sin voz; una frase por escena, cortes en los golpes. */
export const P10CuidasLaMente: React.FC = () => {
  const beats = useBeats(TRACK);
  const { frame: f, span, framesPerBeat, trimBefore } = beats;
  const seq = (from: number, to: number) => ({ from: f(from), durationInFrames: f(to) - f(from) });
  const THUDS = [f(b.question), f(b.panel), f(b.saved), f(b.end)];

  return (
    <AbsoluteFill>
      <Background />
      <LightLayer openAt={f(b.panel)} closeAt={f(b.end)} y={1050} />

      <Punch
        hits={[
          { at: f(b.question), zoom: 0.04, shake: 10 },
          { at: f(b.panel), zoom: 0.07, shake: 18 },
          { at: f(b.saved), zoom: 0.05, shake: 12 },
        ]}
      >
        {/* 1 · Cuidas la mente de los demás */}
        <Sequence name="Corazón" {...seq(b.hook, b.question)}>
          <Drift frames={span(4)} amount={0.05}>
            <MindHeart framesPerBeat={framesPerBeat} />
          </Drift>
        </Sequence>
        <Sequence name="T · Gancho" {...seq(b.hook, b.question)}>
          <TwoLine l1={T.hook.l1} l2={T.hook.l2} dur={span(4)} l2At={span(1)} accent={BRAND.accent} fontSize={HEAD.size} top={HEAD.top} />
        </Sequence>

        {/* 2 y 3 · ¿Quién cuida tu agenda? Notas por todas partes */}
        <Sequence name="Notas de caos" {...seq(b.question, b.panel)}>
          {P10_STICKERS.map((s) => (
            <Sticker
              key={s.text}
              text={s.text}
              at={f(s.beat) - f(b.question)}
              x={s.x}
              y={s.y}
              rot={s.rot}
              bg={s.bg}
              fontSize={50}
              strikeAt={f(s.beat + 3) - f(b.question) > span(8) - 6 ? undefined : f(s.beat + 3) - f(b.question)}
              outAt={span(8) - 3}
            />
          ))}
        </Sequence>
        <Sequence name="T · Pregunta" {...seq(b.question, b.chaos)}>
          <TwoLine l1={T.question.l1} l2={T.question.l2} dur={span(4)} l2At={span(1)} accent={BRAND.accent} fontSize={HEAD.size + 24} top={HEAD.top} />
        </Sequence>
        <Sequence name="T · Caos" {...seq(b.chaos, b.panel)}>
          <TwoLine l1={T.chaos.l1} l2={T.chaos.l2} dur={span(4)} l2At={span(1)} accent="#FFB4A1" fontSize={HEAD.size + 24} top={HEAD.top} />
        </Sequence>

        {/* 4 · Drop: Seguimiento, empezar cita, rellenar y guardar */}
        <Sequence name="Panel" {...seq(b.panel, b.saved)}>
          <Drift frames={span(b.saved - b.panel)} amount={0.03}>
            <PanelFlow beats={beats} from={f(b.panel)} />
          </Drift>
        </Sequence>
        <Sequence name="T · Panel" {...seq(b.panel, b.panel + 4)}>
          <TwoLine l1={T.panel.l1} l2={T.panel.l2} dur={span(4)} l2At={span(1)} light accent={BRAND.color} fontSize={HEAD.size} top={HEAD.top} />
        </Sequence>

        {/* 5 · Historial */}
        <Sequence name="Historial" {...seq(b.saved, b.end)}>
          <Drift frames={span(b.end - b.saved)} amount={0.03}>
            <Saved />
          </Drift>
        </Sequence>
        <Sequence name="T · Guardada" {...seq(b.panel + 4, b.end)}>
          <TwoLine l1={T.saved.l1} l2={T.saved.l2} dur={f(b.end) - f(b.panel + 4)} l2At={span(1)} light accent={BRAND.color} fontSize={HEAD.size} top={HEAD.top} />
        </Sequence>
      </Punch>

      <Sequence name="EndCard" from={f(b.end)} premountFor={30}>
        <EndCard tagline={T.tagline} ctaAt={f(b.cta) - f(b.end)} />
      </Sequence>

      <Audio
        name="Música"
        src={staticFile(TRACK.src)}
        trimBefore={trimBefore || undefined}
        volume={(fr) => {
          const duck = THUDS.reduce((g, at) => g * interpolate(fr, [at - 1, at, at + 4, at + 12], [1, 0.55, 0.55, 1], clamp), 1);
          return duck * interpolate(fr, [P10_DURATION - 30, P10_DURATION], [TRACK.volume, 0], clamp);
        }}
      />

      {/* ── Efectos ── */}
      <Sfx name="pop" from={0} volume={0.5} />
      <Sfx name="pop" from={f(1)} volume={0.4} />
      <Sfx name="thud" from={f(b.question)} volume={0.55} />
      <Sfx name="whoosh" from={f(b.question) - 3} volume={0.4} />
      {P10_STICKERS.map((s) => (
        <Sfx key={s.text} name="pop" from={f(s.beat)} volume={0.5} />
      ))}
      <Sfx name="whoosh" from={f(b.panel) - 3} volume={0.45} />
      <Sfx name="thud" from={f(b.panel)} volume={0.7} />
      <Sfx name="pop" from={f(b.tapStart)} volume={0.6} />
      <Sfx name="pop" from={f(b.form)} volume={0.5} />
      {[0, 1, 2, 3].map((i) => (
        <Sfx key={`k${i}`} name="tick" from={f(b.type + (i * (b.typeEnd - b.type)) / 4)} volume={0.35} />
      ))}
      <Sfx name="pop" from={f(b.tapSave)} volume={0.6} />
      <Sfx name="thud" from={f(b.saved)} volume={0.55} />
      <Sfx name="ding" from={f(b.saved) + 4} volume={0.5} />
      <Sfx name="whoosh" from={f(b.end) - 3} volume={0.5} />
      <Sfx name="thud" from={f(b.end)} volume={0.6} />
      <Sfx name="pop" from={f(b.cta)} volume={0.7} />
    </AbsoluteFill>
  );
};
