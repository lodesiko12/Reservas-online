import { Audio } from "@remotion/media";
import type React from "react";
import { AbsoluteFill, interpolate, interpolateColors, Sequence, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { BRAND } from "../../brand";
import { Sfx } from "../../components/AudioLayers";
import { Background } from "../../components/Background";
import { Burst } from "../../components/Burst";
import { Camera } from "../../components/Camera";
import { CitasWidget } from "../../components/CitasWidget";
import { EndCard } from "../../components/EndCard";
import { LightLayer } from "../../components/LightLayer";
import { PANEL, PanelButton, PanelMobile } from "../../components/PanelMobile";
import { PhoneFrame } from "../../components/PhoneFrame";
import { Ripple } from "../../components/PsyScreens";
import { Punch } from "../../components/Punch";
import { Sticker } from "../../components/Sticker";
import { TwoLine } from "../../components/TwoLine";
import { EASE_IN, clamp, pop, pulse, springIn } from "../../lib/anim";
import { makeBeats, useBeats } from "../../lib/beats";
import { TRACK_DROP4 } from "../../music/track";
import { COLORS, FONT, LAYOUT, STATUS, VIDEO } from "../../theme";
import { P15_BEATS as b, P15_DATA as D, P15_TEXT as T } from "./script";

const TRACK = TRACK_DROP4;
export const P15_DURATION = makeBeats(TRACK, VIDEO.fps).frame(b.total);

type F = (n: number) => number;

const PHONE_W = 820;
const PHONE_LEFT = (VIDEO.width - PHONE_W) / 2;
const PHONE_TOP = LAYOUT.stageTop - 30;
const BEZEL = Math.round(PHONE_W * 0.028);
/** Escala pt → px: ancho útil de la pantalla / 390 pt. */
const S = (PHONE_W - 2 * BEZEL) / 390;
/** Origen (px del lienzo) del contenido de la pantalla, bajo la barra de estado. */
const SCREEN = { x: PHONE_LEFT + BEZEL, y: PHONE_TOP + BEZEL + Math.round(PHONE_W * 0.105) };
const STAGE = { x: 540, y: 1010 };

/** Texto que se "teclea" a 1,6 caracteres por frame, con cursor mientras escribe. */
const typed = (frame: number, at: number, text: string) => {
  const n = Math.max(0, Math.min(text.length, Math.floor((frame - at) * 1.6)));
  return { value: text.slice(0, n), typing: frame >= at && frame < at + text.length / 1.6 + 6 };
};

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

// ───────────────────────── Hoja de calendario (gancho y resultado) ─────────────────────────

const CalendarPage: React.FC<{ enterAt: number; exitAt?: number; drop?: boolean; pulses?: number[]; stampAt?: number }> = ({
  enterAt,
  exitAt,
  drop = false,
  pulses = [],
  stampAt,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  if (frame < enterAt) return null;
  const p = drop ? springIn(frame, fps, enterAt, { damping: 9, stiffness: 190, mass: 0.8 }) : pop(frame, fps, enterAt);
  // Balanceo amortiguado al caer, como una hoja colgada de las anillas.
  const swing = drop ? Math.sin((frame - enterAt) / 4.5) * 6 * Math.exp(-(frame - enterAt) / 30) : 0;
  const out = exitAt === undefined ? 0 : interpolate(frame, [exitAt, exitAt + 7], [0, 1], { ...clamp, easing: EASE_IN });
  const beat = pulses.reduce((g, at) => g * pulse(frame, at, 1.1, 10), 1);
  const stamp = stampAt === undefined ? 0 : springIn(frame, fps, stampAt, { damping: 12, stiffness: 260, mass: 0.7 });
  const red = "#E0473A";
  const dayInk = stampAt === undefined ? red : interpolateColors(frame, [stampAt, stampAt + 4], [red, STATUS.confirmed.solid]);

  return (
    <div
      style={{
        position: "absolute",
        left: 540 - 300,
        top: 560,
        width: 600,
        translate: drop ? `0px ${interpolate(p, [0, 1], [-1400, 0]) - out * 1500}px` : `0px ${-out * 1500}px`,
        scale: drop ? undefined : String(interpolate(p, [0, 1], [0.5, 1])),
        opacity: drop ? 1 : interpolate(p, [0, 0.3], [0, 1], clamp),
        rotate: `${swing + (drop ? -2 : 2)}deg`,
        transformOrigin: "50% 0%",
        fontFamily: FONT,
      }}
    >
      <div
        style={{
          borderRadius: 36,
          overflow: "hidden",
          background: "#FFFDF8",
          boxShadow: "0 4px 0 #E6DFD2, 0 8px 0 #D8CFBF, 0 50px 110px rgba(0,0,0,0.5)",
        }}
      >
        <div style={{ height: 150, background: red, display: "grid", placeItems: "center", color: "#fff", fontSize: 66, fontWeight: 900, letterSpacing: 10 }}>
          {D.page.month}
        </div>
        <div style={{ height: 380, display: "grid", placeItems: "center" }}>
          <div style={{ fontSize: 330, fontWeight: 900, color: dayInk, lineHeight: 1, letterSpacing: -12, scale: String(beat) }}>{D.page.day}</div>
        </div>
        <div style={{ textAlign: "center", paddingBottom: 46 }}>
          <div style={{ fontSize: 62, fontWeight: 900, color: COLORS.ink, letterSpacing: 6 }}>{D.page.dow}</div>
          <div style={{ fontSize: 38, fontWeight: 700, color: COLORS.inkMuted, marginTop: 6 }}>{D.page.note}</div>
        </div>
      </div>
      {/* Anillas */}
      {[150, 450].map((x) => (
        <div key={x} style={{ position: "absolute", left: x - 22, top: -34, width: 44, height: 82, borderRadius: 22, background: "linear-gradient(90deg,#6B7A80,#C9D3D6,#6B7A80)", border: "4px solid #3D484C" }} />
      ))}
      {/* Sello del resultado */}
      {stampAt !== undefined && frame >= stampAt ? (
        <>
          <div style={{ position: "absolute", left: 300, top: 600 }}>
            <Burst at={stampAt} color={STATUS.confirmed.solid} size={420} spread={200} sparks={18} />
          </div>
          <div
            style={{
              position: "absolute",
              left: 300,
              top: 600,
              translate: "-50% -50%",
              rotate: "-10deg",
              scale: String(interpolate(stamp, [0, 1], [2.6, 1])),
              opacity: interpolate(stamp, [0, 0.25], [0, 1], clamp),
              padding: "22px 40px",
              border: `12px solid ${STATUS.confirmed.solid}`,
              borderRadius: 26,
              color: STATUS.confirmed.solid,
              background: "rgba(234,246,239,0.92)",
              fontSize: 72,
              fontWeight: 900,
              letterSpacing: 6,
              whiteSpace: "nowrap",
              display: "flex",
              alignItems: "center",
              gap: 18,
              boxShadow: "0 18px 50px rgba(31,138,76,0.35)",
            }}
          >
            <svg width="76" height="76" viewBox="0 0 24 24" fill="none">
              <path d="M4.5 12.5l5 5L19.5 7" stroke={STATUS.confirmed.solid} strokeWidth="3.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {T.stamp}
          </div>
        </>
      ) : null}
    </div>
  );
};

// ───────────────────────── Panel: Bloqueos → Nuevo bloqueo ─────────────────────────

const Field: React.FC<{ label: string; value: string; typing: boolean; placeholder?: string; frame: number }> = ({ label, value, typing, placeholder, frame }) => (
  <div style={{ flex: 1, minWidth: 0 }}>
    <div style={{ fontSize: 14 * S, fontWeight: 600, color: "#334155", marginBottom: 4 * S }}>{label}</div>
    <div
      style={{
        height: 38 * S,
        borderRadius: 12 * S,
        border: `${1 * S}px solid ${typing ? BRAND.color : "#CBD5E1"}`,
        boxShadow: typing ? `0 0 0 ${2 * S}px color-mix(in srgb, ${BRAND.color} 40%, transparent)` : undefined,
        display: "flex",
        alignItems: "center",
        padding: `0 ${10 * S}px`,
        fontSize: 13 * S,
        color: value ? PANEL.ink : "#94A3B8",
        whiteSpace: "nowrap",
        overflow: "hidden",
      }}
    >
      {value || placeholder}
      {typing && Math.floor(frame / 6) % 2 === 0 ? <span style={{ width: 1.5 * S, height: 16 * S, background: PANEL.ink, marginLeft: 1 * S }} /> : null}
    </div>
  </div>
);

const BlockModal: React.FC<{ f: F }> = ({ f }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const open = f(b.modal);
  const close = f(b.closeModal);
  if (frame < open || frame >= close + 8) return null;
  const enter = springIn(frame, fps, open, { damping: 16, stiffness: 190 });
  const exit = interpolate(frame, [close, close + 7], [0, 1], { ...clamp, easing: EASE_IN });
  const done = frame >= f(b.created);
  const from = typed(frame, f(b.typeFrom), D.from);
  const to = typed(frame, f(b.typeTo), D.to);
  const reason = typed(frame, f(b.typeReason), D.reason);
  const tapCreate = f(b.tapCreate);

  return (
    <div style={{ position: "absolute", inset: 0, fontFamily: FONT }}>
      <div style={{ position: "absolute", inset: 0, background: "rgba(15,23,42,0.4)", opacity: interpolate(enter, [0, 1], [0, 1], clamp) * (1 - exit) }} />
      <div
        style={{
          position: "absolute",
          left: 16 * S,
          right: 16 * S,
          top: 170 * S,
          padding: 24 * S,
          borderRadius: 20 * S,
          background: PANEL.surface,
          border: `${1 * S}px solid #E2E8F0`,
          boxShadow: "0 30px 80px rgba(15,42,42,0.35)",
          translate: `0px ${interpolate(enter, [0, 1], [500, 0]) + exit * 600}px`,
          opacity: 1 - exit,
          color: PANEL.ink,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 * S }}>
          <div style={{ fontSize: 18 * S, fontWeight: 800 }}>Nuevo bloqueo</div>
          <div style={{ fontSize: 22 * S, color: "#94A3B8", lineHeight: 1 }}>×</div>
        </div>
        {done ? (
          <div style={{ textAlign: "center", padding: `${16 * S}px 0`, scale: String(interpolate(pop(frame, fps, f(b.created)), [0, 1], [0.7, 1])) }}>
            <div style={{ fontSize: 34 * S }}>🚫</div>
            <div style={{ marginTop: 8 * S, fontSize: 15 * S, fontWeight: 700 }}>Bloqueo creado.</div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 * S }}>
            <div>
              <div style={{ fontSize: 14 * S, fontWeight: 600, color: "#334155", marginBottom: 4 * S }}>Alcance</div>
              <div style={{ display: "flex", gap: 8 * S }}>
                <PanelButton s={S} label="Todo el negocio" />
                <PanelButton s={S} label="Un profesional" ghost />
              </div>
            </div>
            <div style={{ display: "flex", gap: 12 * S }}>
              <Field label="Desde" value={from.value} typing={from.typing} frame={frame} />
              <Field label="Hasta" value={to.value} typing={to.typing} frame={frame} />
            </div>
            <Field label="Motivo (opcional)" value={reason.value} typing={reason.typing} placeholder="Vacaciones, festivo…" frame={frame} />
            <div style={{ display: "flex", alignItems: "center", gap: 8 * S, fontSize: 14 * S, color: PANEL.ink }}>
              <div style={{ width: 16 * S, height: 16 * S, flexShrink: 0, borderRadius: 4 * S, background: "#2563EB", display: "grid", placeItems: "center" }}>
                <svg width={12 * S} height={12 * S} viewBox="0 0 24 24" fill="none">
                  <path d="M5 12.5l4.5 4.5L19 7.5" stroke="#fff" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              Cancelar automáticamente las reservas afectadas
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 * S }}>
              <PanelButton s={S} label="Cancelar" ghost />
              <PanelButton s={S} label="Crear bloqueo" press={1 / pulse(frame, tapCreate, 1.08, 8)}>
                <Ripple t={frame - tapCreate} />
              </PanelButton>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const BlocksList: React.FC<{ f: F }> = ({ f }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const rowAt = f(b.row);
  const card: React.CSSProperties = {
    marginTop: 24 * S,
    borderRadius: 20 * S,
    background: PANEL.surface,
    border: `${1 * S}px solid #E2E8F0`,
    boxShadow: "0 1px 2px rgba(15,42,42,.06), 0 4px 16px rgba(15,42,42,.05)",
  };
  if (frame < rowAt) {
    return (
      <div style={{ ...card, padding: `${44 * S}px ${24 * S}px`, textAlign: "center" }}>
        <div style={{ fontSize: 17 * S, fontWeight: 600 }}>Sin bloqueos</div>
        <div style={{ fontSize: 14 * S, color: PANEL.muted, marginTop: 6 * S }}>Crea uno para vacaciones, festivos o ausencias.</div>
      </div>
    );
  }
  const p = pop(frame, fps, rowAt);
  const glow = interpolate(frame, [rowAt, rowAt + 6, rowAt + 40], [0, 1, 0.3], clamp);
  return (
    <div
      style={{
        ...card,
        position: "relative",
        padding: `${12 * S}px ${20 * S}px`,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        background: `color-mix(in srgb, ${BRAND.accent} ${Math.round(glow * 12)}%, white)`,
        boxShadow: `0 0 0 ${glow * 3 * S}px ${BRAND.accent}, 0 4px 16px rgba(15,42,42,.05)`,
        scale: String(interpolate(p, [0, 1], [0.85, 1])),
        opacity: interpolate(p, [0, 0.3], [0, 1], clamp),
      }}
    >
      <div>
        <div style={{ fontSize: 15 * S, fontWeight: 600 }}>{D.row.when}</div>
        <div style={{ fontSize: 12 * S, color: "#64748B", marginTop: 2 * S }}>{D.row.scope}</div>
      </div>
      <PanelButton s={S} label="Eliminar" ghost style={{ height: 28 * S, fontSize: 12 * S, border: "none", padding: `0 ${8 * S}px` }} />
    </div>
  );
};

const PanelScene: React.FC<{ f: F }> = ({ f }) => {
  const frame = useCurrentFrame();
  const tapNew = f(b.tapNew);
  // Con el modal abierto la cámara sube para que el formulario quede en la zona segura.
  const formFocus = { x: STAGE.x, y: SCREEN.y + 380 * S };
  return (
    <Camera
      keys={[
        { at: f(b.modal), scale: 1, focus: STAGE },
        { at: f(b.modal) + 8, scale: 1.15, focus: formFocus },
        { at: f(b.closeModal), scale: 1.15, focus: formFocus },
        { at: f(b.closeModal) + 8, scale: 1, focus: STAGE },
      ]}
      center={STAGE}
      fadeTop={480}
    >
      <PhoneFrame width={PHONE_W} time="09:41" screenColor={PANEL.bg} style={{ left: PHONE_LEFT, top: PHONE_TOP }}>
        <PanelMobile
          s={S}
          business={D.business}
          title="Bloqueos"
          subtitle="Cierra días, horas o la agenda de un profesional"
          action={
            <PanelButton s={S} label="+ Nuevo bloqueo" press={1 / pulse(frame, tapNew, 1.08, 8)}>
              <Ripple t={frame - tapNew} />
            </PanelButton>
          }
        >
          <BlocksList f={f} />
        </PanelMobile>
        <BlockModal f={f} />
      </PhoneFrame>
    </Camera>
  );
};

// ───────────────────────── Widget del cliente ─────────────────────────

const WidgetScene: React.FC<{ f: F }> = ({ f }) => {
  const W = D.widget;
  // Centro de la tira de días en el lienzo (para el zoom y el estallido del día que sale).
  const strip = { x: STAGE.x, y: SCREEN.y + 175 * S };
  // Días + horas: lo que mira el cliente al volver a reservar.
  const grid = { x: STAGE.x, y: SCREEN.y + 195 * S };
  const dayX = SCREEN.x + (18 + 66 * W.blocked + 29) * S;
  return (
    <Camera
      keys={[
        { at: f(b.widget) + 6, scale: 1, focus: STAGE },
        { at: f(b.markDay), scale: 1.4, focus: { x: strip.x, y: strip.y - 70 } },
        { at: f(b.dropDay) + 10, scale: 1.4, focus: { x: strip.x, y: strip.y - 70 } },
        { at: f(b.rebook), scale: 1.25, focus: grid },
      ]}
      center={STAGE}
      fadeTop={480}
      shakes={[{ at: f(b.dropDay), intensity: 14 }]}
    >
      <PhoneFrame width={PHONE_W} time="10:12" style={{ left: PHONE_LEFT, top: PHONE_TOP }}>
        <CitasWidget
          s={S}
          business={D.business}
          brand={D.widgetBrand}
          subtitle={W.subtitle}
          days={W.days}
          remove={{ index: W.blocked, markAt: f(b.markDay), removeAt: f(b.dropDay) }}
          pick={{ index: W.picked, at: f(b.tapTuesday) }}
          times={W.times}
          timesAt={f(b.times)}
        />
      </PhoneFrame>
      <div style={{ position: "absolute", left: dayX, top: strip.y }}>
        <Burst at={f(b.dropDay)} color={STATUS.noShow.solid} size={120} spread={150} sparks={14} />
      </div>
    </Camera>
  );
};

// ───────────────────────── Pieza ─────────────────────────

/** P15 — "Festivo. Hoy cierras.": Bloqueos y el widget que deja de ofrecer ese día (T5, S32, general). Sin voz. */
export const P15FestivoBloqueos: React.FC = () => {
  const { frame: f, span, trimBefore } = useBeats(TRACK);
  const seq = (from: number, to: number) => ({ from: f(from), durationInFrames: f(to) - f(from) });
  const THUDS = [f(b.panel), f(b.dropDay), f(b.stamp), f(b.end)];

  return (
    <AbsoluteFill>
      <Background />

      <Sequence name="Combate" durationInFrames={f(b.end)}>
        <Punch
          hits={[
            { at: 5, zoom: 0.04, shake: 12 },
            { at: f(b.panel), zoom: 0.06, shake: 16 },
            { at: f(b.dropDay), zoom: 0.05, shake: 12 },
            { at: f(b.stamp), zoom: 0.07, shake: 16 },
          ]}
        >
          {/* ── Gancho (oscuro): la hoja del 12 cae y late en rojo ── */}
          <CalendarPage enterAt={0} exitAt={f(b.panel) - 3} drop pulses={[f(1), f(2), f(3)]} />
          <Sticker text={T.worry} at={f(b.worry)} x={540} y={1360} rot={-4} fontSize={64} outAt={f(b.panel) - 3} />
          <Sequence name="Titular gancho" {...seq(b.hook, b.panel)}>
            <TwoLine l1={T.hook.l1} l2={T.hook.l2} dur={span(b.panel - b.hook)} l2At={span(1)} accent={BRAND.accent} fontSize={104} />
          </Sequence>

          {/* ── Drop: fondo claro ── */}
          <LightLayer openAt={f(b.panel)} y={900} />

          {/* ── Panel: crear el bloqueo ── */}
          <Window from={f(b.panel)} to={f(b.widget)}>
            <PanelScene f={f} />
          </Window>
          <Sequence name="Titular Bloqueos" {...seq(b.panel, b.reason)}>
            <TwoLine l1={T.panel.l1} l2={T.panel.l2} dur={span(b.reason - b.panel)} l2At={span(b.typeFrom - b.panel)} light accent={BRAND.color} />
          </Sequence>
          <Sequence name="Titular motivo" {...seq(b.reason, b.widget)}>
            <TwoLine l1={T.reason.l1} l2={T.reason.l2} dur={span(b.widget - b.reason)} l2At={span(b.tapCreate - b.reason)} light accent={BRAND.color} />
          </Sequence>

          {/* ── Widget del cliente: el lunes 12 desaparece ── */}
          <Window from={f(b.widget)} to={f(b.result)}>
            <WidgetScene f={f} />
          </Window>
          <Sequence name="Titular widget" {...seq(b.widget, b.rebook)}>
            <TwoLine l1={T.widget.l1} l2={T.widget.l2} dur={span(b.rebook - b.widget)} l2At={span(b.dropDay - b.widget)} light accent={STATUS.noShow.solid} />
          </Sequence>
          <Sequence name="Titular otro día" {...seq(b.rebook, b.result)}>
            <TwoLine l1={T.rebook.l1} l2={T.rebook.l2} dur={span(b.result - b.rebook)} l2At={span(b.tapTuesday - b.rebook)} light accent={BRAND.color} />
          </Sequence>

          {/* ── Resultado: la hoja vuelve, sellada ── */}
          <Sequence name="Hoja sellada" from={f(b.result)} durationInFrames={f(b.end) - f(b.result) + 6}>
            <CalendarPage enterAt={0} stampAt={f(b.stamp) - f(b.result)} />
          </Sequence>
          <Sequence name="Titular resultado" {...seq(b.result, b.end)}>
            <TwoLine l1={T.result.l1} l2={T.result.l2} dur={span(b.end - b.result) + 4} l2At={span(b.stamp - b.result)} light accent={STATUS.confirmed.solid} fontSize={104} />
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
          return duck * interpolate(fr, [P15_DURATION - 36, P15_DURATION], [TRACK.volume, 0], clamp);
        }}
      />

      {/* ── Efectos ── */}
      <Sfx name="whoosh" from={0} volume={0.35} />
      <Sfx name="thud" from={5} volume={0.45} />
      <Sfx name="tick" from={f(1)} volume={0.4} />
      <Sfx name="tick" from={f(2)} volume={0.4} />
      <Sfx name="pop" from={f(b.worry)} volume={0.5} />
      <Sfx name="tick" from={f(3)} volume={0.4} />
      <Sfx name="thud" from={f(b.panel)} volume={0.55} />
      <Sfx name="whoosh" from={f(b.panel)} volume={0.4} />
      <Sfx name="pop" from={f(b.tapNew)} volume={0.55} />
      <Sfx name="whoosh" from={f(b.modal)} volume={0.3} />
      <Sfx name="tick" from={f(b.typeFrom)} volume={0.35} />
      <Sfx name="tick" from={f(b.typeTo)} volume={0.35} />
      <Sfx name="tick" from={f(b.typeReason)} volume={0.35} />
      <Sfx name="pop" from={f(b.tapCreate)} volume={0.55} />
      <Sfx name="chime" from={f(b.created)} volume={0.45} />
      <Sfx name="ding" from={f(b.row)} volume={0.35} />
      <Sfx name="whoosh" from={f(b.widget)} volume={0.4} />
      <Sfx name="tick" from={f(b.markDay)} volume={0.5} />
      <Sfx name="whoosh" from={f(b.dropDay) - 2} volume={0.45} />
      <Sfx name="thud" from={f(b.dropDay)} volume={0.5} />
      <Sfx name="pop" from={f(b.tapTuesday)} volume={0.55} />
      <Sfx name="ding" from={f(b.times)} volume={0.35} />
      <Sfx name="whoosh" from={f(b.result)} volume={0.4} />
      <Sfx name="thud" from={f(b.stamp)} volume={0.6} />
      <Sfx name="chime" from={f(b.stamp) + 2} volume={0.45} />
      <Sfx name="whoosh" from={f(b.end) - 3} volume={0.5} />
      <Sfx name="thud" from={f(b.end)} volume={0.6} />
      <Sfx name="pop" from={f(b.cta)} volume={0.7} />
    </AbsoluteFill>
  );
};
