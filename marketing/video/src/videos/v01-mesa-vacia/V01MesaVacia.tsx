import { Audio } from "@remotion/media";
import type React from "react";
import { AbsoluteFill, Sequence, staticFile, useVideoConfig } from "remotion";
import { BackgroundMusic, Sfx } from "../../components/AudioLayers";
import { Background } from "../../components/Background";
import { Caption } from "../../components/Caption";
import { EndCard } from "../../components/EndCard";
import { OnScreenText } from "../../components/OnScreenText";
import { BRAND } from "../../brand";
import { buildTimeline, wordFrame } from "../../lib/voice";
import { STATUS, VIDEO } from "../../theme";
import { NoShowPart } from "./NoShowPart";
import { ReminderPart } from "./ReminderPart";
import { SCRIPT } from "./script";
import { TomorrowPart } from "./TomorrowPart";
import voice from "./voice.json";

/** Tiempos de escena derivados de la duración real de la locución. */
export const TIMELINE = buildTimeline(SCRIPT, voice, VIDEO.fps);

const RED = STATUS.noShow.solid;
const GREEN = STATUS.confirmed.solid;

/** Guion 1 — "Tu mesa vacía te cuesta dinero". */
export const V01MesaVacia: React.FC = () => {
  const { fps } = useVideoConfig();
  const { byId: S, captions, voiceRanges, scenes } = TIMELINE;

  // Golpes visuales sincronizados con la voz (frames absolutos)
  const w = (id: keyof typeof S, word: string, fallback: number) => S[id].from + wordFrame(S[id], word, fallback);
  const noAt = w("s1", "no", 20);
  const lostAt = w("s2", "perdida", 40);
  const whatsappAt = w("s3", "WhatsApp", 30);
  const soloAt = w("s3", "Solo", 70);
  const replyAt = S.s4.from + 2;
  const shrinkAt = S.s4.from + 12;
  const confirmAt = Math.max(w("s4", "confirma", 20), shrinkAt + 12);
  const cancelAt = w("s5", "cancela", 8);
  const freeAt = w("s5", "libre", 40);
  const bookedAt = w("s5", "otro", 60);
  const endAt = S.s6.from;
  const ctaAt = w("s6", "Comenta", 50);

  // Partes visuales
  const partA = { from: 0, to: S.s3.from + 10 };
  const partB = { from: S.s3.from - 2, to: S.s5.from + 10 };
  const partC = { from: shrinkAt, to: endAt + 8 };

  return (
    <AbsoluteFill>
      <Background />

      {/* ── Visuales ── */}
      <Sequence name="Escenas 1-2 · No-show" durationInFrames={partA.to} premountFor={fps}>
        <NoShowPart noAt={noAt} revealAt={S.s2.from} lostAt={lostAt} exitAt={S.s3.from - 4} />
      </Sequence>

      <Sequence name="Escenas 4-5 · Plano de mañana" from={partC.from} durationInFrames={partC.to - partC.from} premountFor={fps}>
        <TomorrowPart
          confirmAt={confirmAt - partC.from}
          rebookAt={S.s5.from - partC.from}
          cancelAt={cancelAt - partC.from}
          freeAt={freeAt - partC.from}
          bookedAt={bookedAt - partC.from}
          exitAt={endAt - 4 - partC.from}
        />
      </Sequence>

      <Sequence name="Escenas 3-4 · WhatsApp" from={partB.from} durationInFrames={partB.to - partB.from} premountFor={fps}>
        <ReminderPart
          messageAt={whatsappAt - partB.from}
          readAt={soloAt - partB.from}
          replyAt={replyAt - partB.from}
          shrinkAt={shrinkAt - partB.from}
          exitAt={S.s5.from - partB.from}
        />
      </Sequence>

      <Sequence name="Escena 6 · Cierre" from={endAt} premountFor={fps}>
        <EndCard ctaAt={ctaAt - endAt} />
      </Sequence>

      {/* ── Titulares de escena ── */}
      <Sequence name="Titular s1" durationInFrames={S.s1.durationInFrames}>
        <OnScreenText
          text={S.s1.onScreen}
          highlight="y no vino."
          highlightColor={RED}
          highlightAt={noAt - 2}
          outAt={S.s1.durationInFrames - 4}
        />
      </Sequence>
      <Sequence name="Titular s2" from={S.s2.from} durationInFrames={S.s2.durationInFrames}>
        <OnScreenText
          text={S.s2.onScreen}
          highlight="Cena perdida."
          highlightColor={RED}
          highlightAt={wordFrame(S.s2, "Cena", 20)}
          outAt={S.s2.durationInFrames - 4}
        />
      </Sequence>
      <Sequence name="Titular s3" from={S.s3.from} durationInFrames={S.s3.durationInFrames}>
        <OnScreenText
          text={S.s3.onScreen}
          highlight="Automático."
          highlightColor={BRAND.color}
          highlightAt={wordFrame(S.s3, "Solo", 60) - 2}
          outAt={S.s3.durationInFrames - 4}
        />
      </Sequence>
      <Sequence name="Titular s4" from={S.s4.from} durationInFrames={S.s4.durationInFrames}>
        <OnScreenText
          text={S.s4.onScreen}
          highlight="avisado ✓"
          highlightColor={GREEN}
          highlightAt={confirmAt - S.s4.from}
          outAt={S.s4.durationInFrames - 4}
        />
      </Sequence>
      <Sequence name="Titular s5" from={S.s5.from} durationInFrames={S.s5.durationInFrames}>
        <OnScreenText
          text={S.s5.onScreen}
          highlight="vuelve a venderse."
          highlightColor={GREEN}
          highlightAt={freeAt - S.s5.from}
          fontSize={80}
          outAt={S.s5.durationInFrames - 4}
        />
      </Sequence>

      {/* ── Subtítulos palabra a palabra ── */}
      <Caption captions={captions} />

      {/* ── Audio: la toma de voz, repartida por escenas ── */}
      {scenes.map((s) => (
        <Audio
          key={s.id}
          name={`Voz ${s.id}`}
          src={staticFile(s.audio.src)}
          from={s.audio.from}
          trimBefore={s.audio.trimBefore}
          durationInFrames={s.audio.durationInFrames}
          premountFor={fps}
        />
      ))}
      <Sfx name="ding" from={1} volume={0.5} />
      <Sfx name="thud" from={noAt} volume={0.8} />
      <Sfx name="whoosh" from={S.s2.from - 2} volume={0.5} />
      <Sfx name="tick" from={S.s2.from + 10} volume={0.3} />
      <Sfx name="tick" from={S.s2.from + 14} volume={0.3} />
      <Sfx name="tick" from={S.s2.from + 18} volume={0.3} />
      <Sfx name="thud" from={lostAt} volume={0.5} />
      <Sfx name="whoosh" from={S.s3.from - 5} volume={0.6} />
      <Sfx name="pop" from={whatsappAt} volume={0.7} />
      <Sfx name="tick" from={soloAt} volume={0.5} />
      <Sfx name="pop" from={replyAt} volume={0.7} />
      <Sfx name="whoosh" from={shrinkAt} volume={0.45} />
      <Sfx name="ding" from={confirmAt} volume={0.35} />
      <Sfx name="chime" from={cancelAt - 3} volume={0.35} />
      <Sfx name="whoosh" from={freeAt} volume={0.35} />
      <Sfx name="chime" from={bookedAt - 4} volume={0.45} />
      <Sfx name="whoosh" from={endAt - 4} volume={0.6} />
      <Sfx name="thud" from={endAt} volume={0.6} />
      <Sfx name="pop" from={ctaAt} volume={0.7} />
      <BackgroundMusic voiceRanges={voiceRanges} />
    </AbsoluteFill>
  );
};
