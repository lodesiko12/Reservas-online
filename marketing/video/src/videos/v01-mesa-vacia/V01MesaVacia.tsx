import { Audio } from "@remotion/media";
import type React from "react";
import { AbsoluteFill, Sequence, staticFile, useVideoConfig } from "remotion";
import { BackgroundMusic, Sfx } from "../../components/AudioLayers";
import { Background } from "../../components/Background";
import { Caption } from "../../components/Caption";
import { EndCard } from "../../components/EndCard";
import { OnScreenText } from "../../components/OnScreenText";
import { buildTimeline } from "../../lib/voice";
import { STATUS, VIDEO } from "../../theme";
import { NoShowPart } from "./NoShowPart";
import { ReminderPart } from "./ReminderPart";
import { SCRIPT } from "./script";
import { TomorrowPart } from "./TomorrowPart";
import voice from "./voice.json";

/** Tiempos de escena derivados de la duración real de la locución. */
export const TIMELINE = buildTimeline(SCRIPT, voice, VIDEO.fps);

const RED = STATUS.noShow.color;
const GREEN = STATUS.confirmed.color;

/** Guion 1 — "Tu mesa vacía te cuesta dinero". */
export const V01MesaVacia: React.FC = () => {
  const { fps } = useVideoConfig();
  const { byId: S, captions, voiceRanges, scenes } = TIMELINE;

  // Puntos clave (frames absolutos)
  const replyAt = S.s4.from + 4;
  const phoneExitAt = S.s4.from + 24;
  const planInAt = phoneExitAt + 4;
  const confirmAt = planInAt + 18;

  return (
    <AbsoluteFill>
      <Background />

      {/* ── Visuales ── */}
      <Sequence name="Escenas 1-2 · No-show" durationInFrames={S.s3.from + 12} premountFor={fps}>
        <NoShowPart clockAt={S.s2.from} exitAt={S.s3.from} />
      </Sequence>

      <Sequence name="Escenas 3-4 · WhatsApp" from={S.s3.from} durationInFrames={phoneExitAt + 16 - S.s3.from} premountFor={fps}>
        <ReminderPart messageAt={14} replyAt={replyAt - S.s3.from} exitAt={phoneExitAt - S.s3.from} />
      </Sequence>

      <Sequence name="Escenas 4-5 · Plano de mañana" from={planInAt} durationInFrames={S.s6.from + 2 - planInAt} premountFor={fps}>
        <TomorrowPart
          confirmAt={confirmAt - planInAt}
          rebookAt={S.s5.from - planInAt}
          exitAt={S.s6.from - 8 - planInAt}
        />
      </Sequence>

      <Sequence name="Escena 6 · Cierre" from={S.s6.from} premountFor={fps}>
        <EndCard />
      </Sequence>

      {/* ── Titulares de escena ── */}
      <Sequence name="Titular s1" durationInFrames={S.s1.durationInFrames}>
        <OnScreenText text={S.s1.onScreen} highlight="y no vino." highlightColor={RED} at={2} outAt={S.s1.durationInFrames - 6} />
      </Sequence>
      <Sequence name="Titular s2" from={S.s2.from} durationInFrames={S.s2.durationInFrames}>
        <OnScreenText text={S.s2.onScreen} highlight="Cena perdida." highlightColor={RED} outAt={S.s2.durationInFrames - 6} />
      </Sequence>
      <Sequence name="Titular s3" from={S.s3.from} durationInFrames={S.s3.durationInFrames}>
        <OnScreenText text={S.s3.onScreen} highlight="Automático." highlightColor={GREEN} at={4} outAt={S.s3.durationInFrames - 6} />
      </Sequence>
      <Sequence name="Titular s4" from={S.s4.from} durationInFrames={S.s4.durationInFrames}>
        <OnScreenText text={S.s4.onScreen} highlight="✓" highlightColor={GREEN} outAt={S.s4.durationInFrames - 6} />
      </Sequence>
      <Sequence name="Titular s5" from={S.s5.from} durationInFrames={S.s5.durationInFrames}>
        <OnScreenText text={S.s5.onScreen} highlight="vuelve a venderse." highlightColor={GREEN} fontSize={76} outAt={S.s5.durationInFrames - 6} />
      </Sequence>

      {/* ── Subtítulos palabra a palabra ── */}
      <Caption captions={captions} />

      {/* ── Audio ── */}
      {scenes.map((s) => (
        <Audio key={s.id} name={`Voz ${s.id}`} src={staticFile(s.audio)} from={s.from + s.voiceFrom} premountFor={fps} />
      ))}
      <Sfx name="ding" from={2} volume={0.55} />
      <Sfx name="tick" from={S.s2.from + 14} volume={0.3} />
      <Sfx name="pop" from={S.s3.from + 14} volume={0.6} />
      <Sfx name="pop" from={replyAt} volume={0.6} />
      <Sfx name="tick" from={confirmAt} volume={0.45} />
      <Sfx name="chime" from={S.s5.from + 2} volume={0.35} />
      <Sfx name="chime" from={S.s5.from + 52} volume={0.4} />
      <BackgroundMusic voiceRanges={voiceRanges} />
    </AbsoluteFill>
  );
};
