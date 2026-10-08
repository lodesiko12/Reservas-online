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
import { Punch } from "../../components/Punch";
import { Sticker } from "../../components/Sticker";
import { TableCards, cardRect, type ZoneSpec } from "../../components/TableCards";
import { TwoLine } from "../../components/TwoLine";
import { WaitlistPanel } from "../../components/WaitlistPanel";
import { WA, WhatsAppBubble } from "../../components/WhatsAppChat";
import { EASE_IN, clamp, pop, springIn } from "../../lib/anim";
import { makeBeats, useBeats } from "../../lib/beats";
import { TRACK_DROP4 } from "../../music/track";
import { FONT, STATUS, VIDEO } from "../../theme";
import { P08_BEATS as b, P08_DATA, P08_TEXT as T } from "./script";

const TRACK = TRACK_DROP4;
export const P08_DURATION = makeBeats(TRACK, VIDEO.fps).frame(b.total);

type F = (n: number) => number;
const PANEL = { left: 60, top: 470, width: 960 };
const PLAN = { left: 60, top: 560 };
const STAGE = { x: 540, y: 1010 };

// ───────────────────────── Ventana de escena ─────────────────────────

/** Muestra su contenido entre `from` y `to`: entra desde abajo con muelle y sale rápido hacia arriba. */
const Window: React.FC<{ from: number; to: number; children: React.ReactNode }> = ({ from, to, children }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  if (frame < from || frame >= to) return null;
  const enter = springIn(frame, fps, from, { damping: 15, stiffness: 160 });
  const exit = interpolate(frame, [to - 6, to], [0, 1], { ...clamp, easing: EASE_IN });
  return (
    <AbsoluteFill style={{ translate: `0px ${interpolate(enter, [0, 1], [900, 0]) - exit * 1200}px`, opacity: 1 - exit * 0.6 }}>
      {children}
    </AbsoluteFill>
  );
};

// ───────────────────────── Gancho: cartel y pareja ─────────────────────────

const FullSign: React.FC<{ leaveAt: number }> = ({ leaveAt }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const drop = springIn(frame, fps, 0, { damping: 9, stiffness: 200, mass: 0.8 });
  // Balanceo amortiguado del cartel colgado.
  const swing = Math.sin(frame / 5) * 5 * Math.exp(-frame / 40);
  const flicker = frame % 23 === 7 || frame % 31 === 12 ? 0.55 : 1;
  const out = interpolate(frame, [leaveAt + 26, leaveAt + 32], [1, 0], clamp);
  return (
    <div
      style={{
        position: "absolute",
        left: 540 - 400,
        top: interpolate(drop, [0, 1], [-700, 470]),
        width: 800,
        transformOrigin: "50% -80px",
        rotate: `${swing}deg`,
        opacity: out,
      }}
    >
      {/* cuerdas */}
      <svg width="800" height="90" style={{ position: "absolute", top: -90, left: 0 }}>
        <path d="M150 90 L400 0 L650 90" fill="none" stroke="#8CA3A1" strokeWidth="6" />
        <circle cx="400" cy="6" r="10" fill="#8CA3A1" />
      </svg>
      <div
        style={{
          height: 300,
          borderRadius: 28,
          background: "linear-gradient(180deg, #3B2A1E, #2A1D14)",
          border: "10px solid #5A4130",
          boxShadow: "0 40px 90px rgba(0,0,0,0.55), inset 0 0 0 4px rgba(0,0,0,0.25)",
          display: "grid",
          placeItems: "center",
        }}
      >
        <div
          style={{
            fontFamily: FONT,
            fontWeight: 900,
            fontSize: 150,
            letterSpacing: 8,
            color: "#FF5A4A",
            opacity: flicker,
            textShadow: "0 0 18px rgba(255,90,74,0.9), 0 0 60px rgba(255,90,74,0.6)",
          }}
        >
          {T.sign}
        </div>
      </div>
    </div>
  );
};

const Person: React.FC<{ color: string; height: number; walk: number; phase: number }> = ({ color, height, walk, phase }) => {
  const bob = walk > 0 ? Math.abs(Math.sin(walk * 0.9 + phase)) * -14 : 0;
  const lean = walk > 0 ? 4 : 0;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", translate: `0px ${bob}px`, rotate: `${lean}deg` }}>
      <div style={{ width: height * 0.3, height: height * 0.3, borderRadius: 999, background: "#F2D2BD", border: `6px solid ${color}` }} />
      <div style={{ width: height * 0.46, height: height * 0.62, marginTop: 8, borderRadius: `${height * 0.2}px ${height * 0.2}px 22px 22px`, background: color }} />
    </div>
  );
};

const Couple: React.FC<{ leaveAt: number; leaveFrames: number }> = ({ leaveAt, leaveFrames }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = springIn(frame, fps, 4, { damping: 14, stiffness: 140 });
  const t = Math.max(0, frame - leaveAt);
  const x = interpolate(frame, [leaveAt, leaveAt + leaveFrames], [0, 820], { ...clamp, easing: EASE_IN });
  const turn = frame >= leaveAt ? -1 : 1;
  return (
    <div
      style={{
        position: "absolute",
        left: 540,
        top: 1040,
        translate: `calc(-50% + ${x}px) ${interpolate(enter, [0, 1], [500, 0])}px`,
        display: "flex",
        gap: 26,
        alignItems: "flex-end",
        scale: `${turn} 1`,
      }}
    >
      <Person color={BRAND.accent} height={300} walk={t} phase={0} />
      <Person color={BRAND.colorLight} height={330} walk={t} phase={1.4} />
    </div>
  );
};

// ───────────────────────── Plano: se libera la mesa 3 ─────────────────────────

const PlanScene: React.FC<{ f: F }> = ({ f }) => {
  const free = f(b.tableFree);
  const zones: ZoneSpec[] = [
    {
      name: "Interior",
      tables: [
        { name: "Mesa 1", cap: "2", states: [{ at: 0, health: "sentada", booking: { who: "Nerea · 2 pers.", time: "20:30 – 22:00" } }] },
        { name: "Mesa 2", cap: "2–4", states: [{ at: 0, health: "sentada", booking: { who: "Andrés · 4 pers.", time: "21:00 – 22:45" } }] },
        {
          name: "Mesa 3",
          cap: "2–4",
          states: [
            { at: 0, health: "reservada", booking: { who: "Sr. Pérez · 2 pers.", time: "21:45 – 23:15" } },
            { at: free, health: "libre", next: "Sin reservas próximas" },
          ],
        },
      ],
    },
    {
      name: "Terraza",
      tables: [
        { name: "Terraza 1", cap: "2", states: [{ at: 0, health: "sentada", booking: { who: "Carmen · 2 pers.", time: "20:45 – 22:15" } }] },
        { name: "Terraza 2", cap: "2–4", states: [{ at: 0, health: "sentada", booking: { who: "Pablo · 4 pers.", time: "21:00 – 22:45" } }] },
        { name: "Terraza 3", cap: "2–4", states: [{ at: 0, health: "sentada", booking: { who: "Irene · 3 pers.", time: "21:15 – 22:45" } }] },
      ],
    },
  ];
  const r = cardRect(zones, 0, 2);
  const mesa3 = { x: PLAN.left + r.x + r.w / 2, y: PLAN.top + r.y + r.h / 2 };
  return (
    <>
      <Camera
        keys={[
          { at: f(b.freed), scale: 1, focus: STAGE },
          { at: f(b.cancelSticker), scale: 1, focus: STAGE },
          { at: free, scale: 1.3, focus: mesa3 },
          { at: f(15), scale: 1.3, focus: mesa3 },
          { at: f(b.notify), scale: 1, focus: STAGE },
        ]}
        center={STAGE}
        fadeTop={430}
        shakes={[{ at: free, intensity: 12 }]}
      >
        <TableCards zones={zones} business={P08_DATA.business} shift="Cena" style={{ left: PLAN.left, top: PLAN.top }} />
      </Camera>
      <Sticker text={T.cancelSticker} at={f(b.cancelSticker)} x={700} y={640} rot={4} bg="#FFFFFF" fontSize={52} strikeAt={f(b.tableFree) - 2} outAt={f(14)} />
    </>
  );
};

// ───────────────────────── Aviso por WhatsApp + sentar ─────────────────────────

const ChatCard: React.FC<{ f: F; hideAt: number }> = ({ f, hideAt }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const msgAt = f(b.message);
  if (frame < msgAt - 2) return null;
  const p = pop(frame, fps, msgAt - 2);
  const out = interpolate(frame, [hideAt, hideAt + 6], [1, 0], clamp);
  return (
    <div
      style={{
        position: "absolute",
        left: 90,
        top: 1010,
        width: 900,
        padding: "26px 28px 30px",
        borderRadius: 40,
        background: WA.chatBg,
        boxShadow: "0 2px 4px rgba(15,42,42,0.10), 0 34px 80px rgba(15,42,42,0.28)",
        display: "flex",
        flexDirection: "column",
        gap: 14,
        rotate: "-1.5deg",
        opacity: interpolate(p, [0, 0.3], [0, 1], clamp) * out,
        scale: String(interpolate(p, [0, 1], [0.8, 1])),
      }}
    >
      <div style={{ alignSelf: "flex-start", padding: "8px 20px", borderRadius: 999, background: WA.header, color: "#fff", fontFamily: FONT, fontSize: 30, fontWeight: 900 }}>
        WhatsApp · mesa lista
      </div>
      <WhatsAppBubble
        from="me"
        text={P08_DATA.message}
        time="21:58"
        ticks="sent"
        readProgress={interpolate(frame, [f(b.read), f(b.read) + 6], [0, 1], clamp)}
        appear={pop(frame, fps, msgAt)}
        scale={1.3}
        maxWidth="92%"
      />
      {frame >= f(b.reply) ? <WhatsAppBubble from="them" text={P08_DATA.reply} time="21:59" appear={pop(frame, fps, f(b.reply))} scale={1.3} /> : null}
    </div>
  );
};

const SeatedChip: React.FC<{ at: number }> = ({ at }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  if (frame < at) return null;
  const p = pop(frame, fps, at);
  return (
    <div style={{ position: "absolute", left: 540, top: 1180, translate: "-50% -50%" }}>
      <Burst at={at} color={STATUS.confirmed.solid} size={300} spread={160} sparks={16} />
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 22,
          padding: "26px 46px 26px 26px",
          borderRadius: 999,
          background: STATUS.confirmed.solid,
          color: "#fff",
          fontFamily: FONT,
          fontWeight: 900,
          fontSize: 64,
          whiteSpace: "nowrap",
          translate: "-50% -50%",
          position: "absolute",
          scale: String(interpolate(p, [0, 1], [1.8, 1])),
          opacity: interpolate(p, [0, 0.25], [0, 1], clamp),
          boxShadow: "0 30px 70px rgba(31,138,76,0.45)",
        }}
      >
        <div style={{ width: 84, height: 84, borderRadius: 999, background: "#fff", display: "grid", placeItems: "center" }}>
          <svg width="50" height="50" viewBox="0 0 24 24" fill="none">
            <path d="M5 12.5l4.5 4.5L19 7.5" stroke={STATUS.confirmed.solid} strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        {T.seatedChip}
      </div>
    </div>
  );
};

// ───────────────────────── Pieza ─────────────────────────

/** P08 — "Sábado. Completo.": lista de espera con aviso por WhatsApp (T9, S32, restaurantes). Sin voz. */
export const P08ListaDeEspera: React.FC = () => {
  const { frame: f, span, trimBefore } = useBeats(TRACK);
  const seq = (from: number, to: number) => ({ from: f(from), durationInFrames: f(to) - f(from) });
  const THUDS = [f(b.waitlist), f(b.tableFree), f(b.end)];
  const [ruiz, lucia] = P08_DATA.waitlist;

  return (
    <AbsoluteFill>
      <Background />

      <Sequence name="Combate" durationInFrames={f(b.end)}>
        <Punch
          hits={[
            { at: 5, zoom: 0.04, shake: 14 },
            { at: f(b.waitlist), zoom: 0.06, shake: 16 },
            { at: f(b.seat), zoom: 0.04, shake: 10 },
          ]}
        >
          {/* ── Gancho (oscuro): cartel COMPLETO y la pareja que se va ── */}
          <Sequence name="Cartel + pareja" durationInFrames={f(b.waitlist) + 12}>
            <FullSign leaveAt={f(b.coupleLeaves)} />
            <Couple leaveAt={f(b.coupleLeaves)} leaveFrames={span(2)} />
            <Sticker text={T.leaves} at={f(b.coupleLeaves + 0.5)} x={540} y={960} rot={-4} fontSize={58} />
          </Sequence>
          <Sequence name="Titular gancho" {...seq(b.hook, b.waitlist)}>
            <TwoLine l1={T.hook.l1} dur={f(b.waitlist)} accent={BRAND.accent} fontSize={104} />
          </Sequence>

          {/* ── Drop: fondo claro ── */}
          <LightLayer openAt={f(b.waitlist)} y={900} />

          {/* ── Lista de espera: se apunta la pareja ── */}
          <Window from={f(b.waitlist)} to={f(b.freed)}>
            <WaitlistPanel
              width={PANEL.width}
              style={{ left: PANEL.left, top: PANEL.top + 140 }}
              rows={[ruiz, { ...lucia, addAt: f(b.added) }]}
              taps={[{ row: -1, button: "add", at: f(b.tapAdd) }]}
            />
          </Window>
          <Sequence name="Titular lista" {...seq(b.waitlist, b.freed)}>
            <TwoLine l1={T.waitlist.l1} l2={T.waitlist.l2} dur={span(b.freed - b.waitlist)} l2At={span(0.5)} light accent={BRAND.color} />
          </Sequence>

          {/* ── Se libera una mesa ── */}
          <Window from={f(b.freed)} to={f(b.notify)}>
            <PlanScene f={f} />
          </Window>
          <Sequence name="Titular mesa libre" {...seq(b.freed, b.notify)}>
            <TwoLine l1={T.freed.l1} l2={T.freed.l2} dur={span(b.notify - b.freed)} l2At={span(b.tableFree - b.freed)} light accent={STATUS.confirmed.solid} />
          </Sequence>

          {/* ── Aviso por WhatsApp y sentar ── */}
          <Window from={f(b.notify)} to={f(b.end) + 6}>
            <WaitlistPanel
              width={PANEL.width}
              style={{ left: PANEL.left, top: PANEL.top }}
              rows={[ruiz, { ...lucia, notifyAt: f(b.tapNotify) + 2, seatAt: f(b.seat) }]}
              taps={[
                { row: 1, button: "avisar", at: f(b.tapNotify) },
                { row: 1, button: "sentar", at: f(b.seat) },
              ]}
            />
            <ChatCard f={f} hideAt={f(b.seat)} />
            <SeatedChip at={f(b.seatedChip)} />
          </Window>
          <Sequence name="Titular aviso" {...seq(b.notify, b.seat)}>
            <TwoLine l1={T.notify.l1} l2={T.notify.l2} dur={span(b.seat - b.notify)} l2At={span(1)} light accent={BRAND.color} />
          </Sequence>
          <Sequence name="Titular sentar" {...seq(b.seat, b.end)}>
            <TwoLine l1={T.seat.l1} l2={T.seat.l2} dur={span(b.end - b.seat) + 4} l2At={span(0.5)} light accent={STATUS.confirmed.solid} />
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
          return duck * interpolate(fr, [P08_DURATION - 36, P08_DURATION], [TRACK.volume, 0], clamp);
        }}
      />

      {/* ── Efectos ── */}
      <Sfx name="whoosh" from={0} volume={0.35} />
      <Sfx name="thud" from={5} volume={0.45} />
      <Sfx name="whoosh" from={f(b.coupleLeaves)} volume={0.35} />
      <Sfx name="pop" from={f(b.coupleLeaves + 0.5)} volume={0.5} />
      <Sfx name="thud" from={f(b.waitlist)} volume={0.55} />
      <Sfx name="whoosh" from={f(b.waitlist)} volume={0.4} />
      <Sfx name="pop" from={f(b.tapAdd)} volume={0.55} />
      <Sfx name="chime" from={f(b.added) + 2} volume={0.4} />
      <Sfx name="whoosh" from={f(b.freed)} volume={0.4} />
      <Sfx name="pop" from={f(b.cancelSticker)} volume={0.5} />
      <Sfx name="tick" from={f(b.tableFree) - 2} volume={0.5} />
      <Sfx name="thud" from={f(b.tableFree)} volume={0.4} />
      <Sfx name="ding" from={f(b.tableFree) + 2} volume={0.4} />
      <Sfx name="whoosh" from={f(b.notify)} volume={0.4} />
      <Sfx name="pop" from={f(b.tapNotify)} volume={0.55} />
      <Sfx name="ding" from={f(b.message)} volume={0.4} />
      <Sfx name="tick" from={f(b.read)} volume={0.5} />
      <Sfx name="pop" from={f(b.reply)} volume={0.5} />
      <Sfx name="pop" from={f(b.seat)} volume={0.55} />
      <Sfx name="chime" from={f(b.seatedChip)} volume={0.5} />
      <Sfx name="whoosh" from={f(b.end) - 3} volume={0.5} />
      <Sfx name="thud" from={f(b.end)} volume={0.6} />
      <Sfx name="pop" from={f(b.cta)} volume={0.7} />
    </AbsoluteFill>
  );
};
