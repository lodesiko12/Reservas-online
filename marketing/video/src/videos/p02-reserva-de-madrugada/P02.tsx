import { Audio } from "@remotion/media";
import type React from "react";
import { AbsoluteFill, interpolate, Sequence, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { BRAND } from "../../brand";
import { AgendaDay } from "../../components/AgendaDay";
import { Sfx } from "../../components/AudioLayers";
import { Background } from "../../components/Background";
import { BookingWidget } from "../../components/BookingWidget";
import { EndCard } from "../../components/EndCard";
import { LightLayer } from "../../components/LightLayer";
import { PhoneFrame } from "../../components/PhoneFrame";
import { Punch } from "../../components/Punch";
import { Sticker } from "../../components/Sticker";
import { Stopwatch } from "../../components/Stopwatch";
import { TwoLine } from "../../components/TwoLine";
import { EASE_IN, EASE_OUT, clamp, springIn } from "../../lib/anim";
import { makeBeats, useBeats } from "../../lib/beats";
import { TRACK_DROP16 } from "../../music/track";
import { COLORS, FONT, LAYOUT, STATUS, VIDEO } from "../../theme";
import { P02_AGENDA, P02_BEATS as b, P02_TEXT as T, P02_WIDGET } from "./script";

const TRACK = TRACK_DROP16;
export const P02_DURATION = makeBeats(TRACK, VIDEO.fps).frame(b.total);

const PHONE_W = 820;
const PHONE_TOP = LAYOUT.stageTop - 30;
/** Escala del widget: ancho útil de la pantalla / 390 pt. */
const WIDGET_S = (PHONE_W - 2 * Math.round(PHONE_W * 0.028)) / 390;

// ───────────────────────── Gancho: reloj de madrugada ─────────────────────────

const NightClock: React.FC<{ beatFrames: number; exitAt: number }> = ({ beatFrames, exitAt }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = springIn(frame, fps, 0, { damping: 12, stiffness: 180 });
  const exit = interpolate(frame, [exitAt, exitAt + 8], [0, 1], { ...clamp, easing: EASE_IN });
  // Los dos puntos parpadean con el pulso de la canción.
  const colonOn = frame % beatFrames < beatFrames / 2;
  const glow = BRAND.accent;

  return (
    <AbsoluteFill
      style={{
        alignItems: "center",
        justifyContent: "center",
        paddingTop: 220,
        translate: `0px ${-exit * 1200}px`,
        opacity: 1 - exit,
      }}
    >
      <svg width={150} height={150} viewBox="0 0 24 24" style={{ marginBottom: 10, opacity: interpolate(enter, [0, 1], [0, 0.95]) }}>
        <path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5z" fill="#FFE27A" />
      </svg>
      <div
        style={{
          fontFamily: FONT,
          fontWeight: 900,
          fontSize: 330,
          lineHeight: 1,
          letterSpacing: -6,
          fontVariantNumeric: "tabular-nums",
          color: glow,
          textShadow: `0 0 40px color-mix(in srgb, ${glow} 70%, transparent), 0 0 120px color-mix(in srgb, ${glow} 45%, transparent)`,
          scale: String(interpolate(enter, [0, 1], [1.6, 1])),
          opacity: interpolate(enter, [0, 0.3], [0, 1], clamp),
        }}
      >
        03<span style={{ opacity: colonOn ? 1 : 0.15 }}>:</span>12
      </div>
      <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 48, color: COLORS.textMuted, letterSpacing: 8, marginTop: 10 }}>AM</div>
    </AbsoluteFill>
  );
};

// ───────────────────────── El móvil con el widget ─────────────────────────

const WidgetPhone: React.FC<{ rel: (n: number) => number; exitAt: number }> = ({ rel, exitAt }) => {
  const frame = useCurrentFrame();
  const { fps, width } = useVideoConfig();
  const enter = springIn(frame, fps, 0, { damping: 15, stiffness: 140 });
  const exit = interpolate(frame, [exitAt, exitAt + 6], [0, 1], { ...clamp, easing: EASE_IN });
  // Al confirmar, el móvil se aleja un poco y la habitación vuelve a quedar a oscuras.
  const settle = interpolate(frame, [rel(b.asleep), rel(b.asleep) + 8], [1, 0.9], { ...clamp, easing: EASE_OUT });

  return (
    <AbsoluteFill style={{ opacity: 1 - exit }}>
      {/* Resplandor de la pantalla en la habitación oscura */}
      <div
        style={{
          position: "absolute",
          left: width / 2 - 600,
          top: PHONE_TOP - 100,
          width: 1200,
          height: 1400,
          background: "radial-gradient(closest-side, rgba(170,180,255,0.30), transparent)",
          opacity: enter * settle,
        }}
      />
      <PhoneFrame
        width={PHONE_W}
        time="03:12"
        screenColor="#FFFFFF"
        style={{
          left: (width - PHONE_W) / 2,
          top: PHONE_TOP,
          translate: `0px ${interpolate(enter, [0, 1], [1300, 0])}px`,
          rotate: `${interpolate(enter, [0, 1], [-10, 0])}deg`,
          scale: String(settle),
          transformOrigin: "50% 30%",
        }}
      >
        <BookingWidget
          s={WIDGET_S}
          {...P02_WIDGET}
          at={{
            tapGuests: rel(b.tapGuests),
            tapContinue: rel(b.tapContinue),
            step2: rel(b.step2),
            tapDay: rel(b.tapDay),
            tapTime: rel(b.tapTime),
            step3: rel(b.step3),
            typeName: rel(b.typeName),
            typePhone: rel(b.typePhone),
            typeEmail: rel(b.typeEmail),
            tapConfirm: rel(b.tapConfirm),
          }}
          scroll={{ at: rel(b.typePhone), px: 390 }}
        />
      </PhoneFrame>
      <Stopwatch at={2} stopAt={rel(b.tapConfirm)} style={{ left: "50%", top: 205, translate: "-50% 0" }} />
      <Sticker text={T.asleep} at={rel(b.asleep)} x={width / 2} y={1080} rot={-4} fontSize={80} />
    </AbsoluteFill>
  );
};

// ───────────────────────── Pieza ─────────────────────────

/** P02 — "03:12": reservas desde el widget a cualquier hora (T10, S32, general). Sin voz. */
export const P02ReservaDeMadrugada: React.FC = () => {
  const { frame: f, span, framesPerBeat, trimBefore } = useBeats(TRACK);
  const seq = (from: number, to: number) => ({ from: f(from), durationInFrames: f(to) - f(from) });
  const { width } = useVideoConfig();
  const THUDS = [f(2), f(b.agenda), f(b.result), f(b.end)];

  return (
    <AbsoluteFill>
      <Background />

      <Punch
        hits={[
          { at: f(b.agenda), zoom: 0.06, shake: 16 },
          { at: f(b.result), zoom: 0.06, shake: 14 },
        ]}
      >
        {/* ── Gancho (oscuro) ── */}
        <Sequence name="Reloj 03:12" durationInFrames={f(b.widget) + 10}>
          <NightClock beatFrames={framesPerBeat} exitAt={f(b.widget)} />
        </Sequence>
        <Sequence name="Titular gancho" {...seq(b.hook, b.widget)}>
          <TwoLine l1={T.hook.l1} l2={T.hook.l2} dur={f(b.widget)} l2At={f(2)} accent={BRAND.accent} />
        </Sequence>

        {/* ── El widget en el móvil, una acción por beat ── */}
        <Sequence name="Móvil · widget" {...seq(b.widget, b.agenda)} premountFor={30}>
          <WidgetPhone rel={(n) => f(n) - f(b.widget)} exitAt={span(b.agenda - b.widget)} />
        </Sequence>

        {/* ── Drop: fondo claro + la reserva aparece en la Agenda ── */}
        <LightLayer openAt={f(b.agenda)} closeAt={f(b.end)} y={1000} />
        <Sequence name="Agenda" {...seq(b.agenda, b.result)} premountFor={30}>
          <AgendaEnter>
            <AgendaDay
              width={920}
              date={P02_AGENDA.date}
              style={{ left: (width - 920) / 2, top: 500, scale: "1.1", transformOrigin: "50% 0" }}
              rows={P02_AGENDA.rows.map((r) => ({
                ...r,
                insertAt: "isNew" in r ? f(b.insert) - f(b.agenda) : undefined,
              }))}
            />
          </AgendaEnter>
        </Sequence>
        <Sequence name="Titular agenda" {...seq(b.agenda, b.result)}>
          <TwoLine l1={T.agenda.l1} l2={T.agenda.l2} dur={span(b.result - b.agenda)} l2At={span(1)} light accent={BRAND.color} />
        </Sequence>

        {/* ── Resultado ── */}
        <Sequence name="Titular resultado" {...seq(b.result, b.end)}>
          <TwoLine
            l1={T.result.l1}
            l2={T.result.l2}
            dur={span(b.end - b.result)}
            l2At={span(1)}
            light
            accent={STATUS.confirmed.solid}
            fontSize={118}
            top={720}
          />
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
          return duck * interpolate(fr, [P02_DURATION - 36, P02_DURATION], [TRACK.volume, 0], clamp);
        }}
      />

      {/* ── Efectos ── */}
      {[0, 1, 3].map((n) => (
        <Sfx key={n} name="tick" from={f(n)} volume={0.45} />
      ))}
      <Sfx name="thud" from={f(2)} volume={0.6} />
      <Sfx name="whoosh" from={f(b.widget)} volume={0.5} />
      {[b.tapGuests, b.tapContinue, b.tapDay, b.tapTime].map((n) => (
        <Sfx key={n} name="pop" from={f(n)} volume={0.55} />
      ))}
      <Sfx name="whoosh" from={f(b.step2)} volume={0.3} />
      <Sfx name="whoosh" from={f(b.step3)} volume={0.3} />
      {[b.typeName, b.typePhone, b.typeEmail].flatMap((n) =>
        [0, 3, 6].map((d) => <Sfx key={`${n}-${d}`} name="tick" from={f(n) + d} volume={0.3} />),
      )}
      <Sfx name="pop" from={f(b.tapConfirm)} volume={0.6} />
      <Sfx name="ding" from={f(b.tapConfirm) + 2} volume={0.35} />
      <Sfx name="pop" from={f(b.asleep)} volume={0.55} />
      <Sfx name="thud" from={f(b.agenda)} volume={0.6} />
      <Sfx name="whoosh" from={f(b.agenda)} volume={0.35} />
      <Sfx name="chime" from={f(b.insert) + 3} volume={0.5} />
      <Sfx name="thud" from={f(b.result)} volume={0.55} />
      <Sfx name="whoosh" from={f(b.end) - 3} volume={0.5} />
      <Sfx name="thud" from={f(b.end)} volume={0.6} />
      <Sfx name="pop" from={f(b.cta)} volume={0.7} />
    </AbsoluteFill>
  );
};

/** La agenda entra desde abajo con muelle. */
const AgendaEnter: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = springIn(frame, fps, 0, { damping: 15, stiffness: 150 });
  return <AbsoluteFill style={{ translate: `0px ${interpolate(p, [0, 1], [900, 0])}px` }}>{children}</AbsoluteFill>;
};
