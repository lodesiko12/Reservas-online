import { Audio } from "@remotion/media";
import type React from "react";
import { AbsoluteFill, interpolate, Sequence, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { AgendaDay } from "../../components/AgendaDay";
import { Sfx } from "../../components/AudioLayers";
import { Background } from "../../components/Background";
import { GhostNumber, HAND, StepChip } from "../../components/CarouselKit";
import { EndCard } from "../../components/EndCard";
import { LightLayer } from "../../components/LightLayer";
import { Punch } from "../../components/Punch";
import { Sticker } from "../../components/Sticker";
import { TwoLine } from "../../components/TwoLine";
import { BRAND } from "../../brand";
import { EASE_OUT, clamp, pop, springIn } from "../../lib/anim";
import { makeBeats, useBeats, type Beats } from "../../lib/beats";
import { TRACK_DROP28 } from "../../music/track";
import { COLORS, FONT, STATUS, VIDEO } from "../../theme";
import { P14_BEATS as b, P14_DATA as D, P14_ERROR_AT as ERR, P14_TEXT as T } from "./script";

const TRACK = TRACK_DROP28;
export const P14_DURATION = makeBeats(TRACK, VIDEO.fps).frame(b.total);

const HEAD = { top: 290, size: 124 } as const;
const SHEET = { left: 110, top: 700, w: 860, h: 800 } as const;
const INK_BLUE = "#1F3A7A";
/** Rojo legible sobre papel y sobre fondo oscuro. */
const RED = "#E5483A";

// ───────────────────────── La libreta ─────────────────────────

/** Hoja de libreta con espiral, margen y renglones; los hijos se colocan en coordenadas de la hoja. */
const Libreta: React.FC<{ children: React.ReactNode; enterAt?: number; rot?: number }> = ({ children, enterAt = 0, rot = -1.5 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = springIn(frame, fps, enterAt, { damping: 14, stiffness: 130, mass: 0.9 });
  return (
    <div
      style={{
        position: "absolute",
        left: SHEET.left,
        top: SHEET.top,
        width: SHEET.w,
        height: SHEET.h,
        borderRadius: 18,
        background: "#FFFDF7",
        boxShadow: "0 3px 0 rgba(0,0,0,0.08), 0 40px 90px rgba(0,0,0,0.55)",
        backgroundImage: "repeating-linear-gradient(180deg, transparent 0 92px, rgba(31,58,122,0.18) 92px 96px)",
        backgroundPosition: "0 52px",
        translate: `0px ${interpolate(p, [0, 1], [1100, 0])}px`,
        rotate: `${interpolate(p, [0, 1], [8, rot])}deg`,
        opacity: interpolate(p, [0, 0.15], [0, 1], clamp),
      }}
    >
      <div style={{ position: "absolute", left: 96, top: 0, bottom: 0, width: 4, background: "rgba(229,72,58,0.45)" }} />
      {Array.from({ length: 7 }).map((_, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: -22,
            top: 38 + i * 110,
            width: 62,
            height: 26,
            borderRadius: 14,
            background: "linear-gradient(180deg, #D9DEE3, #8E98A3)",
            boxShadow: "0 4px 6px rgba(0,0,0,0.35)",
          }}
        />
      ))}
      {children}
    </div>
  );
};

/** Línea escrita a mano que entra en su beat (pop + se "escribe" de izquierda a derecha). */
const Handwritten: React.FC<{ text: string; row: number; at: number; color?: string; crossed?: number }> = ({ text, row, at, color = INK_BLUE, crossed }) => {
  const frame = useCurrentFrame();
  const reveal = interpolate(frame, [at, at + 10], [0, 1], { ...clamp, easing: EASE_OUT });
  const cross = crossed === undefined ? 0 : interpolate(frame, [crossed, crossed + 6], [0, 1], clamp);
  return (
    <div
      style={{
        position: "absolute",
        left: 120,
        top: 74 + row * 96,
        width: SHEET.w - 160,
        fontFamily: HAND,
        fontWeight: 700,
        fontSize: 47,
        lineHeight: "96px",
        height: 96,
        color,
        whiteSpace: "nowrap",
        clipPath: `inset(0 ${100 - reveal * 100}% 0 0)`,
        opacity: frame < at ? 0 : 1,
      }}
    >
      {text}
      {cross > 0 ? <span style={{ position: "absolute", left: 0, top: 48, height: 7, width: `${cross * 100}%`, background: RED, borderRadius: 4 }} /> : null}
    </div>
  );
};

/** Trazo rojo que se dibuja alrededor de algo (en coordenadas de la hoja). */
const RedLoop: React.FC<{ at: number; x: number; y: number; w: number; h: number }> = ({ at, x, y, w, h }) => {
  const frame = useCurrentFrame();
  const t = interpolate(frame, [at, at + 12], [0, 1], { ...clamp, easing: EASE_OUT });
  if (frame < at) return null;
  return (
    <svg width={w + 80} height={h + 80} viewBox={`0 0 ${w + 80} ${h + 80}`} style={{ position: "absolute", left: x - 40, top: y - 40, overflow: "visible" }}>
      <path
        d={`M${w * 0.5} 10 C ${w * 1.02} 0, ${w + 60} ${h * 0.5}, ${w * 0.9} ${h + 40} C ${w * 0.5} ${h + 70}, 10 ${h + 50}, 20 ${h * 0.5} C 30 20, ${w * 0.4} 4, ${w * 0.75} 24`}
        transform="translate(20 20)"
        fill="none"
        stroke={RED}
        strokeWidth="11"
        strokeLinecap="round"
        pathLength={1}
        strokeDasharray={1}
        strokeDashoffset={1 - t}
      />
    </svg>
  );
};

// ───────────────────────── Errores ─────────────────────────

/** Error 1: dos nombres para la misma mesa y la misma hora. */
const Error1: React.FC<{ beats: Beats }> = ({ beats }) => {
  const { span } = beats;
  const err = span(ERR);
  return (
    <>
      <Libreta enterAt={0}>
        {D.rows1.map((t, i) => (
          <Handwritten key={t} text={t} row={i} at={span(1 + i * 0.75)} />
        ))}
        <RedLoop at={err} x={110} y={74 + 96 + 12} w={640} h={170} />
      </Libreta>
      <Sticker text={T.errors[0].tag} at={err + 2} x={600} y={1440} rot={-5} bg={RED} ink="#fff" fontSize={72} />
    </>
  );
};

const pad = (n: number) => String(n).padStart(2, "0");

/** Reloj analógico que avanza de 21:30 a 22:15 (el cliente no aparece). */
const Clock: React.FC<{ mins: number; size: number; late: boolean }> = ({ mins, size, late }) => {
  const total = D.clock.from[0] * 60 + D.clock.from[1] + mins;
  const h = Math.floor(total / 60) % 12;
  const m = total % 60;
  const hourDeg = (h + m / 60) * 30;
  const minDeg = m * 6;
  const c = size / 2;
  return (
    <div style={{ position: "relative", width: size, height: size }}>
      <svg width={size} height={size} viewBox="0 0 100 100">
        <circle cx="50" cy="50" r="46" fill="#fff" stroke={late ? RED : INK_BLUE} strokeWidth="5" />
        {Array.from({ length: 12 }).map((_, i) => (
          <line key={i} x1="50" y1="8" x2="50" y2={i % 3 === 0 ? 17 : 13} stroke={INK_BLUE} strokeWidth={i % 3 === 0 ? 3 : 2} transform={`rotate(${i * 30} 50 50)`} />
        ))}
        <line x1="50" y1="50" x2="50" y2="26" stroke={INK_BLUE} strokeWidth="5" strokeLinecap="round" transform={`rotate(${minDeg} 50 50)`} />
        <line x1="50" y1="50" x2="50" y2="33" stroke={INK_BLUE} strokeWidth="6" strokeLinecap="round" transform={`rotate(${hourDeg} 50 50)`} />
        <circle cx="50" cy="50" r="4" fill={late ? RED : INK_BLUE} />
      </svg>
      <div style={{ position: "absolute", left: 0, right: 0, top: c * 2 + 6, textAlign: "center", fontFamily: FONT, fontWeight: 900, fontSize: 56, color: late ? RED : INK_BLUE }}>
        {pad(Math.floor(total / 60))}:{pad(m)}
      </div>
    </div>
  );
};

/** Error 2: la reserva de Pablo; el reloj corre y nadie sabe si vendrá. */
const Error2: React.FC<{ beats: Beats }> = ({ beats }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { span } = beats;
  const err = span(ERR);
  const mins = interpolate(frame, [span(1.5), span(ERR)], [0, 45], { ...clamp, easing: EASE_OUT });
  const late = frame >= err;
  const clock = pop(frame, fps, span(1.25));
  const stamp = springIn(frame, fps, err + 8, { damping: 8, stiffness: 260, mass: 0.6 });
  return (
    <>
      <Libreta enterAt={0} rot={1.2}>
        <Handwritten text={D.rows2[0]} row={0} at={span(1)} />
        <Handwritten text="— llamó para reservar" row={1} at={span(1.5)} color="#5A6B97" />
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: 340,
            display: "flex",
            justifyContent: "center",
            scale: String(interpolate(clock, [0, 1], [0.3, 1])),
            opacity: interpolate(clock, [0, 0.25], [0, 1], clamp),
          }}
        >
          <Clock mins={Math.round(mins)} size={230} late={late} />
        </div>
        {late ? (
          <div
            style={{
              position: "absolute",
              right: 24,
              top: 262,
              padding: "6px 26px",
              border: `9px solid ${RED}`,
              borderRadius: 14,
              color: RED,
              fontFamily: FONT,
              fontWeight: 900,
              fontSize: 54,
              letterSpacing: 2,
              textTransform: "uppercase",
              rotate: "-9deg",
              scale: String(interpolate(stamp, [0, 1], [2.4, 1])),
              opacity: interpolate(stamp, [0, 0.3], [0, 1], clamp),
              background: "rgba(255,253,247,0.85)",
            }}
          >
            Sin avisar
          </div>
        ) : null}
      </Libreta>
      <Sticker text={T.errors[1].tag} at={err + 2} x={420} y={1440} rot={-4} bg="#FFE27A" fontSize={72} />
    </>
  );
};

/** Error 3: el total de comensales cambia según a quién preguntes. */
const Error3: React.FC<{ beats: Beats }> = ({ beats }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { span } = beats;
  const err = span(ERR);
  const step = span(0.5);
  const idx = Math.floor(Math.max(0, frame - span(1)) / step);
  const guess = D.guesses[idx % D.guesses.length];
  const settled = frame >= err;
  const box = pop(frame, fps, span(1));
  const shake = settled ? Math.sin(frame * 2.4) * 9 * Math.max(0, 1 - (frame - err) / 26) : 0;
  return (
    <>
      <Libreta enterAt={0} rot={-1}>
        <Handwritten text="Sábado — comensales:" row={0} at={span(0.75)} />
        {D.guesses.slice(0, 3).map((g, i) => (
          <Handwritten key={g} text={`¿${g}? ${["(según Lola)", "(según Pablo)", "(según la libreta)"][i]}`} row={1 + i} at={span(1.5 + i * 0.75)} crossed={span(2.5 + i * 0.75)} color="#5A6B97" />
        ))}
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: 460,
            display: "flex",
            justifyContent: "center",
            opacity: interpolate(box, [0, 0.25], [0, 1], clamp),
            scale: String(interpolate(box, [0, 1], [0.3, 1])),
            translate: `${shake}px 0px`,
          }}
        >
          <div
            style={{
              minWidth: 360,
              padding: "10px 50px 16px",
              borderRadius: 30,
              background: "#fff",
              border: `7px solid ${settled ? RED : INK_BLUE}`,
              textAlign: "center",
              fontFamily: FONT,
              fontWeight: 900,
              color: settled ? RED : INK_BLUE,
              lineHeight: 1,
              boxShadow: "0 18px 40px rgba(15,42,42,0.25)",
            }}
          >
            <div style={{ fontSize: 34, fontWeight: 800, color: COLORS.inkMuted }}>Comensales</div>
            <div style={{ fontSize: 200, letterSpacing: -4, fontVariantNumeric: "tabular-nums" }}>{settled ? "?" : guess}</div>
          </div>
        </div>
      </Libreta>
      <Sticker text={T.errors[2].tag} at={err + 2} x={580} y={1440} rot={-4} bg={RED} ink="#fff" fontSize={66} />
    </>
  );
};

// ───────────────────────── Rótulo de cada error ─────────────────────────

const Rotulo: React.FC<{ n: 1 | 2 | 3; err: (typeof T.errors)[number]; dur: number }> = ({ n, err, dur }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const chip = pop(frame, fps, 0);
  const out = interpolate(frame, [dur - 4, dur], [1, 0], clamp);
  return (
    <>
      <GhostNumber n={n} />
      <AbsoluteFill style={{ opacity: Math.min(1, interpolate(chip, [0, 0.3], [0, 1], clamp)) * out, scale: String(interpolate(chip, [0, 1], [0.6, 1])) }}>
        <StepChip label="Error" n={n} of={3} />
      </AbsoluteFill>
      <TwoLine l1={err.l1} l2={err.l2} dur={dur} l2At={6} accent={BRAND.accent} fontSize={HEAD.size} top={HEAD.top} />
    </>
  );
};

// ───────────────────────── Pieza ─────────────────────────

/** P14 — "3 errores de la libreta" (T6, restaurantes). Sin voz; cada error remata en un golpe, la solución abre en el drop. */
export const P14ErroresLibreta: React.FC = () => {
  const beats = useBeats(TRACK);
  const { frame: f, span, trimBefore } = beats;
  const seq = (from: number, to: number) => ({ from: f(from), durationInFrames: f(to) - f(from) });
  const errAt = [b.e1, b.e2, b.e3].map((e) => f(e + ERR));
  const THUDS = [f(2), ...errAt, f(b.fix), f(b.end)];

  return (
    <AbsoluteFill>
      <Background />
      <LightLayer openAt={f(b.fix)} closeAt={f(b.end)} y={1000} />

      <Punch
        hits={[
          { at: f(2), zoom: 0.04, shake: 10 },
          ...errAt.map((at) => ({ at, zoom: 0.06, shake: 16 })),
          { at: f(b.fix), zoom: 0.07, shake: 16 },
        ]}
      >
        {/* Título: 3 */}
        <Sequence name="T · Título" {...seq(b.title, b.e1)}>
          <TitleCard dur={span(4)} />
        </Sequence>

        {/* Errores */}
        <Sequence name="Error 1" {...seq(b.e1, b.e2)}>
          <Rotulo n={1} err={T.errors[0]} dur={span(8)} />
          <Error1 beats={beats} />
        </Sequence>
        <Sequence name="Error 2" {...seq(b.e2, b.e3)}>
          <Rotulo n={2} err={T.errors[1]} dur={span(8)} />
          <Error2 beats={beats} />
        </Sequence>
        <Sequence name="Error 3" {...seq(b.e3, b.fix)}>
          <Rotulo n={3} err={T.errors[2]} dur={span(8)} />
          <Error3 beats={beats} />
        </Sequence>

        {/* Solución: fondo claro, agenda ordenada */}
        <Sequence name="Agenda" {...seq(b.fix, b.end)}>
          <AgendaDay
            title="Agenda"
            date={D.agendaDate}
            width={900}
            style={{ left: 90, top: 740 }}
            rows={D.agenda.map((r, i) => ({ ...r, insertAt: span(0.5 + i * 0.75) }))}
          />
        </Sequence>
        <Sequence name="T · Solución" {...seq(b.fix, b.end)}>
          <TwoLine l1={T.fix.l1} l2={T.fix.l2} dur={span(4)} l2At={span(1)} light accent={BRAND.color} fontSize={HEAD.size} top={HEAD.top - 60} />
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
          return duck * interpolate(fr, [P14_DURATION - 36, P14_DURATION], [TRACK.volume, 0], clamp);
        }}
      />

      {/* ── Efectos ── */}
      <Sfx name="whoosh" from={0} volume={0.45} />
      <Sfx name="pop" from={f(1)} volume={0.45} />
      <Sfx name="thud" from={f(2)} volume={0.55} />
      {[b.e1, b.e2, b.e3].map((e, i) => (
        <Sfx key={`w${i}`} name="whoosh" from={f(e) - 3} volume={0.4} />
      ))}
      {[b.e1, b.e2, b.e3].map((e, i) => (
        <Sfx key={`c${i}`} name="pop" from={f(e)} volume={0.5} />
      ))}
      {/* Libreta escribiéndose */}
      {[b.e1, b.e2, b.e3].flatMap((e, i) => [1, 1.75, 2.5].map((n) => <Sfx key={`t${i}${n}`} name="tick" from={f(e + n)} volume={0.3} />))}
      {errAt.map((at, i) => (
        <Sfx key={`e${i}`} name="thud" from={at} volume={0.65} />
      ))}
      <Sfx name="ding" from={errAt[0] + 4} volume={0.25} />
      <Sfx name="whoosh" from={f(b.fix) - 3} volume={0.5} />
      <Sfx name="thud" from={f(b.fix)} volume={0.7} />
      {[0.5, 1.25, 2].map((n) => (
        <Sfx key={`a${n}`} name="chime" from={f(b.fix + n) + 3} volume={0.35} />
      ))}
      <Sfx name="whoosh" from={f(b.end) - 3} volume={0.5} />
      <Sfx name="thud" from={f(b.end)} volume={0.6} />
      <Sfx name="pop" from={f(b.cta)} volume={0.7} />
    </AbsoluteFill>
  );
};

/** Gancho: un 3 enorme y la libreta cerrada, antes del primer error. */
const TitleCard: React.FC<{ dur: number }> = ({ dur }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = springIn(frame, fps, 0, { damping: 9, stiffness: 150, mass: 0.8 });
  const out = interpolate(frame, [dur - 6, dur], [1, 0], clamp);
  return (
    <>
      <AbsoluteFill style={{ alignItems: "center", opacity: out }}>
        <div
          style={{
            position: "absolute",
            top: 640,
            fontFamily: FONT,
            fontWeight: 900,
            fontSize: 760,
            lineHeight: 1,
            color: STATUS.noShow.solid,
            textShadow: "0 0 120px rgba(255,92,77,0.45), 0 30px 0 rgba(0,0,0,0.3)",
            scale: String(interpolate(p, [0, 1], [2.2, 1])),
            opacity: interpolate(p, [0, 0.2], [0, 1], clamp),
            rotate: `${interpolate(p, [0, 1], [-10, -4])}deg`,
          }}
        >
          3
        </div>
      </AbsoluteFill>
      <TwoLine l1={T.title.l1} l2={T.title.l2} dur={dur} l2At={Math.round(dur / 4)} accent={BRAND.accent} fontSize={134} top={HEAD.top - 40} />
    </>
  );
};
