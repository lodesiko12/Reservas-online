import { Audio } from "@remotion/media";
import type React from "react";
import { AbsoluteFill, interpolate, Sequence, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { BRAND } from "../../brand";
import { Sfx } from "../../components/AudioLayers";
import { Background } from "../../components/Background";
import { Burst } from "../../components/Burst";
import { Camera } from "../../components/Camera";
import { EndCard } from "../../components/EndCard";
import { FloorPlan } from "../../components/FloorPlan";
import { LightLayer } from "../../components/LightLayer";
import { Notification } from "../../components/Notification";
import { PHONE_ASPECT, PhoneFrame } from "../../components/PhoneFrame";
import { Punch } from "../../components/Punch";
import { Sticker } from "../../components/Sticker";
import { TwoLine } from "../../components/TwoLine";
import { WA, WhatsAppChat } from "../../components/WhatsAppChat";
import { EASE_IN, clamp, springIn, whip } from "../../lib/anim";
import { makeBeats, useBeats } from "../../lib/beats";
import { TRACK } from "../../music/track";
import { LAYOUT, STATUS, VIDEO } from "../../theme";
import { FIXTURES, PLAN_BOX, TABLES, tableCenter } from "../v01-mesa-vacia/layout";
import { P01_BEATS as b, P01_CHAT, P01_STICKERS, P01_TEXT as T } from "./script";

export const P01_DURATION = makeBeats(TRACK, VIDEO.fps).frame(b.total);

/** Con `center` en este punto, enfocarlo a escala 1 deja el plano en su sitio. */
const STAGE = { x: 540, y: 1010 };
const PHONE_W = 640;

// ───────────────────────── Gancho + caos: plano de sala ─────────────────────────

const ChaosPlan: React.FC<{ f: (n: number) => number }> = ({ f }) => {
  const frame = useCurrentFrame();
  const t4 = tableCenter("T4");
  // El gancho encuadra la mesa desplazada hacia abajo para no pisar el titular de dos líneas.
  const hook = { x: t4.x, y: t4.y - 130 };
  // Atenúa el plano al empezar el caos para que las notas se lean.
  const dim = interpolate(frame, [f(b.chaos) - 4, f(b.chaos)], [1, 0.55], clamp);

  return (
    <AbsoluteFill style={{ filter: `brightness(${dim})` }}>
      <Camera
        keys={[
          { at: 0, scale: 1.5, focus: hook },
          { at: f(2), scale: 1.5, focus: hook },
          { at: f(2) + 6, scale: 1.72, focus: hook },
          { at: f(b.chaos) - 5, scale: 1.72, focus: hook },
          { at: f(b.chaos), scale: 1, focus: STAGE },
          { at: f(b.pivot), scale: 1.06, focus: STAGE },
        ]}
        center={STAGE}
        fadeTop={420}
        shakes={[{ at: f(2), intensity: 26 }]}
      >
        <FloorPlan
          width={PLAN_BOX.width}
          height={PLAN_BOX.height}
          subtitle="Viernes · 21:00"
          fixtures={FIXTURES}
          style={{ left: PLAN_BOX.left, top: PLAN_BOX.top }}
          tables={[
            { ...TABLES.T1, status: "seated" },
            { ...TABLES.T2, status: "seated" },
            { ...TABLES.T3, status: "seated" },
            {
              ...TABLES.T4,
              status: "confirmed",
              changes: [{ at: f(2), to: "noShow", burst: true }],
              blink: { from: f(2), to: f(b.pivot) + 20 },
              tags: [
                { text: "Marta · 4 pers · 21:00", dot: "confirmed", from: 3, to: f(2) },
                { text: "No vino", dot: "noShow", from: f(2) + 2 },
              ],
            },
            { ...TABLES.T5, status: "seated" },
            { ...TABLES.T6, status: "seated" },
            { ...TABLES.T7, status: "seated" },
            { ...TABLES.T8, status: "seated" },
            { ...TABLES.T9, status: "seated" },
          ]}
        />
      </Camera>
    </AbsoluteFill>
  );
};

// ───────────────────────── Función 1-2: el móvil con WhatsApp ─────────────────────────

type PhoneProps = { messageAt: number; readAt: number; typingAt: number; replyAt: number; exitAt: number };

const ReminderPhone: React.FC<PhoneProps> = ({ messageAt, readAt, typingAt, replyAt, exitAt }) => {
  const frame = useCurrentFrame();
  const { fps, width } = useVideoConfig();
  const enter = springIn(frame, fps, 0, { damping: 14, stiffness: 150 });
  const exit = interpolate(frame, [exitAt, exitAt + 8], [0, 1], { ...clamp, easing: EASE_IN });

  return (
    <PhoneFrame
      width={PHONE_W}
      time="21:00"
      screenColor={WA.header}
      lightStatusBar
      style={{
        left: (width - PHONE_W) / 2,
        top: LAYOUT.stageTop - 40,
        translate: `${interpolate(enter, [0, 1], [900, 0])}px ${-exit * 1100}px`,
        rotate: `${interpolate(enter, [0, 1], [14, 0])}deg`,
        filter: enter < 0.6 ? `blur(${(0.6 - enter) * 20}px)` : undefined,
      }}
    >
      <WhatsAppChat
        contactName={P01_CHAT.contact}
        avatarColor={BRAND.accent}
        dayLabel="HOY"
        scale={1.25}
        messages={[
          { from: "me", text: P01_CHAT.reminder, time: "21:00", at: messageAt, readAt },
          { from: "them", text: P01_CHAT.reply, time: "21:02", at: replyAt, typingFrom: typingAt },
        ]}
      />
      <Burst at={readAt} color={WA.tickBlue} size={40} spread={70} sparks={8} x={PHONE_W - 110} y={PHONE_W * PHONE_ASPECT * 0.3} />
    </PhoneFrame>
  );
};

// ───────────────────────── Función 2-3 + resultado: el plano de mañana ─────────────────────────

type PlanProps = { f: (n: number) => number };

const TomorrowPlan: React.FC<PlanProps> = ({ f }) => {
  const frame = useCurrentFrame();
  const { width } = useVideoConfig();
  const o = f(b.reply + 2); // inicio de esta secuencia (beat 22)
  const r = (n: number) => f(n) - o;
  const t4 = tableCenter("T4");
  const t6 = tableCenter("T6");
  const confirm = r(23);
  const cancel = r(26);
  const free = r(28);
  const booked = r(30);
  const full = r(32);

  return (
    <AbsoluteFill>
      <AbsoluteFill style={whip(frame, 0, "in", "down", 10, 1400)}>
        <Camera
          keys={[
            { at: 0, scale: 1.3, focus: t4 },
            { at: r(25), scale: 1.3, focus: t4 },
            { at: cancel, scale: 1.35, focus: t6 },
            { at: r(31), scale: 1.35, focus: t6 },
            { at: full, scale: 1, focus: STAGE },
          ]}
          center={STAGE}
          fadeTop={430}
          shakes={[
            { at: confirm, intensity: 10 },
            { at: cancel, intensity: 16 },
            { at: booked, intensity: 10 },
          ]}
        >
          <FloorPlan
            width={PLAN_BOX.width}
            height={PLAN_BOX.height}
            subtitle="Mañana · 21:00"
            fixtures={FIXTURES}
            style={{ left: PLAN_BOX.left, top: PLAN_BOX.top }}
            tables={[
              { ...TABLES.T1, status: "confirmed" },
              { ...TABLES.T2, status: "free", changes: [{ at: full, to: "confirmed", burst: true }] },
              { ...TABLES.T3, status: "pending", changes: [{ at: full + 4, to: "confirmed" }] },
              {
                ...TABLES.T4,
                status: "pending",
                changes: [{ at: confirm, to: "confirmed", burst: true }],
                tags: [
                  { text: "Marta · 4 pers · 21:00", dot: "pending", from: 4, to: confirm },
                  { text: "Marta · Confirmada ✓", dot: "confirmed", from: confirm + 1, to: r(25) + 6 },
                ],
              },
              { ...TABLES.T5, status: "confirmed" },
              {
                ...TABLES.T6,
                status: "confirmed",
                changes: [
                  { at: cancel, to: "cancelled", burst: true },
                  { at: free, to: "free" },
                  { at: booked, to: "confirmed", burst: true },
                ],
                tags: [
                  { text: "Cancelada", dot: "cancelled", from: cancel + 1, to: free },
                  { text: "¡Libre otra vez!", from: free + 1, to: booked },
                  { text: "Lucía · 2 pers · 21:30", dot: "confirmed", from: booked + 1, to: full },
                ],
              },
              { ...TABLES.T7, status: "confirmed" },
              { ...TABLES.T8, status: "free", changes: [{ at: full + 7, to: "confirmed", burst: true }] },
              { ...TABLES.T9, status: "pending", changes: [{ at: full + 10, to: "confirmed" }] },
            ]}
          />
        </Camera>
      </AbsoluteFill>
      <Notification
        title="Reserva cancelada"
        body="Mesa 6 · mañana 21:30 · 2 pers."
        status="cancelled"
        at={cancel}
        hideAt={free}
        width={920}
        style={{ left: (width - 920) / 2, top: PLAN_BOX.top - 90 }}
      />
      <Notification
        title="Nueva reserva"
        body="Lucía · Mesa 6 · mañana 21:30 · 2 pers."
        status="confirmed"
        at={booked}
        hideAt={full}
        width={920}
        style={{ left: (width - 920) / 2, top: PLAN_BOX.top - 90 }}
      />
    </AbsoluteFill>
  );
};

// ───────────────────────── Pieza ─────────────────────────

/** P01 — "Reservó… y no vino." (T1 caos→solución, S40, restaurantes). Sin voz: música + efectos. */
export const P01ReservoYNoVino: React.FC = () => {
  const { frame: f, span, trimBefore } = useBeats();
  const seq = (from: number, to: number) => ({ from: f(from), durationInFrames: f(to) - f(from) });
  const GREEN = STATUS.confirmed.solid;

  /** Golpes graves (`thud`): la música se atenúa en ellos. */
  const THUDS = [f(2), f(b.pivot), f(b.result), f(b.end)];

  const phoneFrom = f(b.reminder);
  const phoneTo = f(b.reply + 2) + 10;

  return (
    <AbsoluteFill>
      <Background />

      <Punch
        hits={[
          { at: f(b.pivot), zoom: 0.06, shake: 16 },
          { at: f(b.result), zoom: 0.05, shake: 12 },
        ]}
      >
        {/* ── Caos (fondo oscuro): plano y notas ── */}
        <Sequence name="Gancho + caos · plano" durationInFrames={f(b.pivot) + 12} premountFor={30}>
          <ChaosPlan f={f} />
        </Sequence>
        <Sequence name="Caos · notas" durationInFrames={f(b.pivot) + 12} premountFor={30}>
          {P01_STICKERS.map((s) => (
            <Sticker
              key={s.text}
              text={s.text}
              at={f(s.beat)}
              x={s.x}
              y={s.y}
              rot={s.rot}
              bg={s.bg}
              strikeAt={"strikeBeat" in s ? f(s.strikeBeat) : undefined}
            />
          ))}
        </Sequence>

        {/* ── Titulares del bloque oscuro ── */}
        <Sequence name="Titular gancho" {...seq(b.hook, b.chaos)}>
          <TwoLine l1={T.hook.l1} l2={T.hook.l2} dur={f(b.chaos)} l2At={f(2)} accent={BRAND.accent} />
        </Sequence>
        <Sequence name="Titular caos" {...seq(b.chaos, b.pivot)}>
          <TwoLine l1={T.chaos.l1} dur={span(b.pivot - b.chaos)} accent={BRAND.accent} fontSize={120} />
        </Sequence>

        {/* ── El giro: el fondo claro se abre en el kick ── */}
        <LightLayer openAt={f(b.pivot)} closeAt={f(b.end)} />

        <Sequence name="Titular giro" {...seq(b.pivot, b.reminder)}>
          <TwoLine l1={T.pivot.l1} l2={T.pivot.l2} dur={span(b.reminder - b.pivot)} l2At={4} light accent={BRAND.color} fontSize={170} top={640} />
        </Sequence>

        {/* ── Función 1-2: recordatorio y respuesta ── */}
        <Sequence name="Móvil WhatsApp" from={phoneFrom} durationInFrames={phoneTo - phoneFrom} premountFor={30}>
          <ReminderPhone
            messageAt={f(b.reminder + 1) - phoneFrom}
            readAt={f(b.reminder + 3) - phoneFrom}
            typingAt={f(b.reply) - phoneFrom}
            replyAt={f(b.reply + 1) - phoneFrom}
            exitAt={f(b.reply + 2) - phoneFrom}
          />
        </Sequence>
        <Sequence name="Titular recordatorio" {...seq(b.reminder, b.reply)}>
          <TwoLine l1={T.reminder.l1} l2={T.reminder.l2} dur={span(b.reply - b.reminder)} l2At={f(b.reminder + 2) - f(b.reminder)} light accent={BRAND.color} />
        </Sequence>
        <Sequence name="Titular respuesta" {...seq(b.reply, b.resale)}>
          <TwoLine l1={T.reply.l1} l2={T.reply.l2} dur={span(b.resale - b.reply)} l2At={f(b.reply + 3) - f(b.reply)} light accent={GREEN} />
        </Sequence>

        {/* ── Función 2-3 y resultado: el plano de mañana ── */}
        <Sequence name="Plano de mañana" {...seq(b.reply + 2, b.end)} premountFor={30}>
          <TomorrowPlan f={f} />
        </Sequence>
        <Sequence name="Titular reventa" {...seq(b.resale, b.result)}>
          <TwoLine l1={T.resale.l1} l2={T.resale.l2} dur={span(b.result - b.resale)} l2At={f(b.resale + 2) - f(b.resale)} light accent={BRAND.color} />
        </Sequence>
        <Sequence name="Titular resultado" {...seq(b.result, b.end)}>
          <TwoLine l1={T.result.l1} l2={T.result.l2} dur={span(b.end - b.result)} l2At={span(0.5)} light accent={GREEN} />
        </Sequence>
      </Punch>

      {/* ── Cierre: fondo oscuro de marca, logo en el primer beat y CTA al final ── */}
      <Sequence name="EndCard" from={f(b.end)} premountFor={30}>
        <EndCard ctaAt={f(b.end + 4) - f(b.end)} />
      </Sequence>

      {/* ── Música: el beat 0 de la pieza es el primer tiempo de la pista ── */}
      <Audio
        name="Música"
        src={staticFile(TRACK.src)}
        trimBefore={trimBefore || undefined}
        volume={(fr) => {
          // Ducking: la música baja ~5 dB en cada `thud` para que el golpe se note y no sature.
          const duck = THUDS.reduce((g, at) => g * interpolate(fr, [at - 1, at, at + 4, at + 12], [1, 0.55, 0.55, 1], clamp), 1);
          return duck * interpolate(fr, [P01_DURATION - 36, P01_DURATION], [TRACK.volume, 0], clamp);
        }}
      />

      {/* ── Efectos: confirman cada evento, siempre sobre un beat ── */}
      <Sfx name="pop" from={3} volume={0.5} />
      <Sfx name="thud" from={f(2)} volume={0.8} />
      <Sfx name="whoosh" from={f(b.chaos) - 4} volume={0.45} />
      {P01_STICKERS.map((s) => (
        <Sfx key={s.text} name="pop" from={f(s.beat)} volume={0.6} />
      ))}
      <Sfx name="tick" from={f(7)} volume={0.5} />
      <Sfx name="thud" from={f(b.pivot)} volume={0.7} />
      <Sfx name="whoosh" from={f(b.pivot)} volume={0.35} />
      <Sfx name="whoosh" from={f(b.reminder)} volume={0.45} />
      <Sfx name="ding" from={f(b.reminder + 1)} volume={0.35} />
      <Sfx name="tick" from={f(b.reminder + 3)} volume={0.5} />
      <Sfx name="pop" from={f(b.reply + 1)} volume={0.6} />
      <Sfx name="whoosh" from={f(b.reply + 2)} volume={0.45} />
      <Sfx name="ding" from={f(23)} volume={0.45} />
      <Sfx name="thud" from={f(b.resale)} volume={0.5} />
      <Sfx name="whoosh" from={f(28)} volume={0.3} />
      <Sfx name="chime" from={f(30)} volume={0.5} />
      <Sfx name="thud" from={f(b.result)} volume={0.6} />
      <Sfx name="ding" from={f(b.result)} volume={0.3} />
      <Sfx name="whoosh" from={f(b.end) - 3} volume={0.5} />
      <Sfx name="thud" from={f(b.end)} volume={0.7} />
      <Sfx name="pop" from={f(b.end + 4)} volume={0.7} />
    </AbsoluteFill>
  );
};
