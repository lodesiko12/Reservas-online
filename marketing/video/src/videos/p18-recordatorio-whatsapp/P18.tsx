import { Audio } from "@remotion/media";
import type React from "react";
import { AbsoluteFill, interpolate, Sequence, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { BRAND } from "../../brand";
import { Sfx } from "../../components/AudioLayers";
import { Background } from "../../components/Background";
import { Burst } from "../../components/Burst";
import { Camera } from "../../components/Camera";
import { EndCard } from "../../components/EndCard";
import { LightLayer } from "../../components/LightLayer";
import { PhoneFrame } from "../../components/PhoneFrame";
import { hexAlpha } from "../../components/ProChips";
import { Punch } from "../../components/Punch";
import { TwoLine } from "../../components/TwoLine";
import { DoubleCheck, WA, WhatsAppChat } from "../../components/WhatsAppChat";
import { EASE_IN, clamp, pop, springIn } from "../../lib/anim";
import { makeBeats, useBeats } from "../../lib/beats";
import { TRACK_DROP4 } from "../../music/track";
import { COLORS, FONT, LAYOUT, VIDEO } from "../../theme";
// Mismo equipo ficticio (y colores de la paleta real) que P16/P17.
import { PROS } from "../p16-agenda-por-colores/script";
import { P18_BEATS as b, P18_DATA as D, P18_TEXT as T, type AgendaRowData } from "./script";

const TRACK = TRACK_DROP4;
export const P18_DURATION = makeBeats(TRACK, VIDEO.fps).frame(b.total);

type F = (n: number) => number;

const STAGE = { x: 540, y: 1010 };
const PHONE_W = 820;
const PHONE_LEFT = (VIDEO.width - PHONE_W) / 2;
const PHONE_TOP = LAYOUT.stageTop - 30;

/** Badges de estado reales de la app (ui.tsx: STATUS_STYLES / STATUS_TEXT). */
const BADGE = {
  confirmada: { bg: "#CFE6E3", ink: "#095A57", label: "Confirmada" },
  ausente: { bg: "#FEE2E2", ink: "#B91C1C", label: "Ausente" },
  completada: { bg: "#DCFCE7", ink: "#15803D", label: "Completada" },
} as const;
type Kind = keyof typeof BADGE;

// ───────────────────────── Ventana de escena ─────────────────────────

const Window: React.FC<{ from: number; to: number; children: React.ReactNode }> = ({ from, to, children }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  if (frame < from || frame >= to) return null;
  const enter = from === 0 ? 1 : springIn(frame, fps, from, { damping: 15, stiffness: 160 });
  const exit = interpolate(frame, [to - 6, to], [0, 1], { ...clamp, easing: EASE_IN });
  return (
    <AbsoluteFill style={{ translate: `0px ${interpolate(enter, [0, 1], [900, 0]) - exit * 1200}px`, opacity: 1 - exit * 0.6 }}>
      {children}
    </AbsoluteFill>
  );
};

// ───────────────────────── Agenda del día (tarjeta del panel) ─────────────────────────

const ROW_H = 122;

/** Vista Día de la agenda de citas a tamaño de vídeo: filas teñidas por profesional y badge de estado que cambia. */
const AgendaCard: React.FC<{
  date: string;
  rows: AgendaRowData[];
  /** Estado inicial de cada fila y, opcionalmente, el estado al que cambia en `at`. */
  status: (i: number) => { from: Kind; to?: Kind; at?: number };
  enterAt?: number;
  style?: React.CSSProperties;
}> = ({ date, rows, status, enterAt = 0, style }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <div style={{ position: "absolute", left: 60, width: 960, fontFamily: FONT, ...style }}>
      <div
        style={{
          borderRadius: 40,
          overflow: "hidden",
          background: COLORS.card,
          border: "2px solid #E2E8F0",
          boxShadow: "0 2px 4px rgba(15,42,42,0.10), 0 40px 90px rgba(0,0,0,0.35)",
        }}
      >
        <div style={{ padding: "26px 36px 22px", borderBottom: "2px solid #EEF2F4", display: "flex", alignItems: "baseline", gap: 18 }}>
          <span style={{ fontSize: 46, fontWeight: 900, color: COLORS.ink }}>Agenda</span>
          <span style={{ fontSize: 30, fontWeight: 600, color: COLORS.inkMuted }}>{date}</span>
        </div>
        {rows.map((r, i) => {
          const st = status(i);
          const changed = st.to !== undefined && st.at !== undefined && frame >= st.at;
          const kind: Kind = changed ? st.to! : st.from;
          const badge = BADGE[kind];
          const stamp = changed ? pop(frame, fps, st.at!) : 1;
          const p = pop(frame, fps, enterAt + i * 2);
          const color = PROS[r.pro].color;
          const flash = changed ? interpolate(frame, [st.at!, st.at! + 4, st.at! + 24], [0, 1, 0.35], clamp) : 0;
          const flashColor = kind === "ausente" ? "#EF4444" : "#22C55E";
          return (
            <div
              key={i}
              style={{
                position: "relative",
                height: ROW_H,
                display: "flex",
                alignItems: "center",
                gap: 22,
                padding: "0 30px",
                borderTop: i ? "2px solid #F1F5F9" : undefined,
                borderLeft: `9px solid ${color}`,
                background: flash > 0 ? `color-mix(in srgb, ${flashColor} ${Math.round(flash * 22)}%, ${hexAlpha(color, 0.1)})` : hexAlpha(color, 0.1),
                opacity: interpolate(p, [0, 0.3], [0, 1], clamp),
                translate: `${interpolate(p, [0, 1], [140, 0])}px 0px`,
              }}
            >
              <div style={{ width: 104, lineHeight: 1.15 }}>
                <div style={{ fontSize: 36, fontWeight: 900, color: BRAND.color }}>{r.start}</div>
                <div style={{ fontSize: 24, color: "#94A3B8" }}>{r.end}</div>
              </div>
              <div style={{ flex: 1, minWidth: 0, lineHeight: 1.2 }}>
                <div style={{ fontSize: 34, fontWeight: 700, color: COLORS.ink, whiteSpace: "nowrap" }}>{r.name}</div>
                <div style={{ fontSize: 24, color: "#64748B" }}>{r.service}</div>
              </div>
              <span style={{ borderRadius: 999, padding: "6px 18px", fontSize: 26, fontWeight: 700, background: hexAlpha(color, 0.35), color: "#0F172A" }}>
                {PROS[r.pro].name}
              </span>
              <span
                style={{
                  width: 190,
                  textAlign: "center",
                  borderRadius: 999,
                  padding: "6px 0",
                  fontSize: 26,
                  fontWeight: 800,
                  background: badge.bg,
                  color: badge.ink,
                  scale: String(interpolate(stamp, [0, 1], [1.7, 1])),
                  rotate: `${changed ? interpolate(stamp, [0, 1], [-12, 0]) : 0}deg`,
                  boxShadow: changed ? `0 0 0 ${Math.round(flash * 5)}px ${badge.ink}` : undefined,
                }}
              >
                {badge.label}
              </span>
              {changed ? <Burst at={st.at!} color={badge.ink} size={120} spread={110} sparks={10} x={835} y={ROW_H / 2} /> : null}
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ───────────────────────── Chat ─────────────────────────

const ChatScene: React.FC<{ f: F }> = ({ f }) => {
  const bubble = { x: STAGE.x, y: 1000 };
  return (
    <Camera
      keys={[
        { at: f(b.chat), scale: 1, focus: STAGE },
        { at: f(b.read), scale: 1, focus: STAGE },
        { at: f(b.read) + 10, scale: 1.12, focus: bubble },
        { at: f(b.typing), scale: 1.12, focus: bubble },
        { at: f(b.reply) + 6, scale: 1.18, focus: { x: STAGE.x, y: 1010 } },
        { at: f(b.result), scale: 1.24, focus: { x: STAGE.x, y: 1010 } },
      ]}
      center={STAGE}
      fadeTop={470}
    >
      <PhoneFrame width={PHONE_W} time="16:30" lightStatusBar screenColor={WA.header} style={{ left: PHONE_LEFT, top: PHONE_TOP }}>
        <WhatsAppChat
          contactName="Clara Vidal"
          avatarColor="#E8A87C"
          dayLabel={D.dayLabel}
          scale={1.5}
          messages={[
            { from: "me", text: D.message, time: "16:30", at: f(b.message), readAt: f(b.read) },
            { from: "them", text: D.reply, time: "16:42", at: f(b.reply), typingFrom: f(b.typing) },
          ]}
        />
      </PhoneFrame>
    </Camera>
  );
};

/** Píldora "Lo envía Turnigo solo" con un reloj que gira. */
const AutoChip: React.FC<{ at: number; outAt: number }> = ({ at, outAt }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  if (frame < at) return null;
  const p = pop(frame, fps, at);
  const out = interpolate(frame, [outAt, outAt + 6], [0, 1], { ...clamp, easing: EASE_IN });
  const hand = (frame - at) * 14;
  return (
    <div
      style={{
        position: "absolute",
        left: 540,
        top: 1360,
        translate: "-50% -50%",
        display: "flex",
        alignItems: "center",
        gap: 20,
        padding: "22px 40px 22px 24px",
        borderRadius: 999,
        background: BRAND.color,
        color: "#fff",
        fontFamily: FONT,
        fontWeight: 900,
        fontSize: 54,
        whiteSpace: "nowrap",
        rotate: "-3deg",
        scale: String(interpolate(p, [0, 1], [0.4, 1]) * (1 - out * 0.4)),
        opacity: interpolate(p, [0, 0.3], [0, 1], clamp) * (1 - out),
        boxShadow: `0 0 0 6px ${BRAND.accent}, 0 30px 70px rgba(11,110,106,0.45)`,
      }}
    >
      <svg width="76" height="76" viewBox="0 0 40 40">
        <circle cx="20" cy="20" r="17" fill="#fff" />
        <line x1="20" y1="20" x2="20" y2="9" stroke={BRAND.color} strokeWidth="3.4" strokeLinecap="round" transform={`rotate(${hand} 20 20)`} />
        <line x1="20" y1="20" x2="27" y2="20" stroke={BRAND.accent} strokeWidth="3.4" strokeLinecap="round" transform={`rotate(${hand / 12} 20 20)`} />
        <circle cx="20" cy="20" r="2.4" fill={BRAND.color} />
      </svg>
      {T.autoChip}
    </div>
  );
};

/** Sello de "avisado": doble check azul gigante. */
const NotifiedBadge: React.FC<{ at: number; outAt: number }> = ({ at, outAt }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  if (frame < at) return null;
  const p = springIn(frame, fps, at, { damping: 10, stiffness: 240, mass: 0.7 });
  const out = interpolate(frame, [outAt, outAt + 6], [0, 1], { ...clamp, easing: EASE_IN });
  return (
    <div style={{ position: "absolute", left: 860, top: 1405 }}>
      <Burst at={at} color={WA.tickBlue} size={210} spread={150} sparks={16} />
      <div
        style={{
          position: "absolute",
          width: 210,
          height: 210,
          translate: "-50% -50%",
          borderRadius: "50%",
          background: "#fff",
          display: "grid",
          placeItems: "center",
          boxShadow: `0 0 0 10px ${WA.tickBlue}, 0 34px 80px rgba(0,0,0,0.3)`,
          scale: String(interpolate(p, [0, 1], [2.4, 1]) * (1 - out)),
          opacity: interpolate(p, [0, 0.2], [0, 1], clamp),
        }}
      >
        <DoubleCheck color={WA.tickBlue} size={120} />
      </div>
    </div>
  );
};

// ───────────────────────── Pieza ─────────────────────────

/** P18 — "Hoy, 3 huecos vacíos.": recordatorio automático por WhatsApp 24 h antes (T9, S32, citas). Sin voz. */
export const P18RecordatorioWhatsApp: React.FC = () => {
  const { frame: f, span, trimBefore } = useBeats(TRACK);
  const seq = (from: number, to: number) => ({ from: f(from), durationInFrames: f(to) - f(from) });
  const THUDS = [f(b.chat), f(b.notified), f(b.result), f(b.end)];
  const absentAt = (i: number) => {
    const k = (D.absent as readonly number[]).indexOf(i);
    return k < 0 ? undefined : f(b.absent[k]);
  };
  const doneAt = (i: number) => {
    const k = (D.absent as readonly number[]).indexOf(i);
    return k < 0 ? undefined : f(b.done[k]);
  };

  return (
    <AbsoluteFill>
      <Background />

      <Sequence name="Combate" durationInFrames={f(b.end)}>
        <Punch
          hits={[
            ...b.absent.map((a) => ({ at: f(a), zoom: 0.04, shake: 12 })),
            { at: f(b.chat), zoom: 0.06, shake: 16 },
            { at: f(b.notified), zoom: 0.05, shake: 12 },
            { at: f(b.result), zoom: 0.04, shake: 8 },
          ]}
        >
          {/* ── Gancho (oscuro): tres "Ausente" en la agenda ── */}
          <Window from={0} to={f(b.chat)}>
            <AgendaCard
              date={D.before}
              rows={D.rows}
              status={(i) => (absentAt(i) === undefined ? { from: "confirmada" } : { from: "confirmada", to: "ausente", at: absentAt(i) })}
              enterAt={-12}
              style={{ top: 520 }}
            />
          </Window>
          <Sequence name="Titular gancho" {...seq(b.hook, b.chat)}>
            <TwoLine l1={T.hook.l1} l2={T.hook.l2} dur={span(b.chat - b.hook)} l2At={span(b.absent[0])} accent={BRAND.accent} fontSize={104} />
          </Sequence>

          {/* ── Drop: fondo claro y el chat ── */}
          <LightLayer openAt={f(b.chat)} y={900} />
          <Window from={f(b.chat)} to={f(b.result)}>
            <ChatScene f={f} />
            <AutoChip at={f(b.auto)} outAt={f(b.typing)} />
            <NotifiedBadge at={f(b.notified)} outAt={f(b.result) - 6} />
          </Window>
          <Sequence name="Titular chat" {...seq(b.chat, b.auto)}>
            <TwoLine l1={T.chat.l1} l2={T.chat.l2} dur={span(b.auto - b.chat)} l2At={span(b.message - b.chat)} light accent={BRAND.color} />
          </Sequence>
          <Sequence name="Titular automático" {...seq(b.auto, b.typing)}>
            <TwoLine l1={T.auto.l1} l2={T.auto.l2} dur={span(b.typing - b.auto)} l2At={span(1)} light accent={BRAND.color} />
          </Sequence>
          <Sequence name="Titular respuesta" {...seq(b.typing, b.notified)}>
            <TwoLine l1={T.reply.l1} l2={T.reply.l2} dur={span(b.notified - b.typing)} l2At={span(b.reply - b.typing)} light accent={WA.header} />
          </Sequence>
          <Sequence name="Titular avisado" {...seq(b.notified, b.result)}>
            <TwoLine l1={T.notified.l1} l2={T.notified.l2} dur={span(b.result - b.notified)} l2At={span(1)} light accent={BRAND.color} />
          </Sequence>

          {/* ── Resultado: la semana siguiente, los huecos se completan ── */}
          <Window from={f(b.result)} to={f(b.end) + 6}>
            <AgendaCard
              date={D.after}
              rows={D.rows}
              status={(i) => (doneAt(i) === undefined ? { from: "completada" } : { from: "confirmada", to: "completada", at: doneAt(i) })}
              enterAt={f(b.result)}
              style={{ top: 560 }}
            />
          </Window>
          <Sequence name="Titular resultado" {...seq(b.result, b.end)}>
            <TwoLine l1={T.result.l1} l2={T.result.l2} dur={span(b.end - b.result) + 4} l2At={span(b.done[0] - b.result)} light accent="#15803D" />
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
          return duck * interpolate(fr, [P18_DURATION - 36, P18_DURATION], [TRACK.volume, 0], clamp);
        }}
      />

      {/* ── Efectos ── */}
      <Sfx name="whoosh" from={0} volume={0.3} />
      {b.absent.map((a) => (
        <Sfx key={a} name="thud" from={f(a)} volume={0.45} />
      ))}
      <Sfx name="thud" from={f(b.chat)} volume={0.55} />
      <Sfx name="whoosh" from={f(b.chat)} volume={0.45} />
      <Sfx name="ding" from={f(b.message)} volume={0.5} />
      <Sfx name="tick" from={f(b.read)} volume={0.5} />
      <Sfx name="pop" from={f(b.auto)} volume={0.55} />
      <Sfx name="tick" from={f(b.typing)} volume={0.3} />
      <Sfx name="tick" from={f(b.typing + 0.5)} volume={0.3} />
      <Sfx name="pop" from={f(b.reply)} volume={0.55} />
      <Sfx name="thud" from={f(b.notified)} volume={0.5} />
      <Sfx name="chime" from={f(b.notified) + 2} volume={0.45} />
      <Sfx name="whoosh" from={f(b.result)} volume={0.45} />
      {b.done.map((d) => (
        <Sfx key={d} name="pop" from={f(d)} volume={0.5} />
      ))}
      <Sfx name="ding" from={f(b.done[2]) + 3} volume={0.4} />
      <Sfx name="whoosh" from={f(b.end) - 3} volume={0.5} />
      <Sfx name="thud" from={f(b.end)} volume={0.6} />
      <Sfx name="pop" from={f(b.cta)} volume={0.7} />
    </AbsoluteFill>
  );
};
