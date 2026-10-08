import type React from "react";
import { Easing, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { Burst } from "../../components/Burst";
import { PhoneFrame, PHONE_ASPECT } from "../../components/PhoneFrame";
import { WA, WhatsAppChat } from "../../components/WhatsAppChat";
import { EASE_IN, clamp, springIn } from "../../lib/anim";
import { LAYOUT } from "../../theme";

type Props = {
  /** Llega el recordatorio (cuando la voz dice "WhatsApp"). */
  messageAt: number;
  /** El doble check se pone azul. */
  readAt: number;
  /** Responde el cliente. */
  replyAt: number;
  /** El móvil se encoge a la esquina para dejar paso al plano. */
  shrinkAt: number;
  /** Sale por arriba. */
  exitAt: number;
};

const PHONE_W = 640;
const PIP_SCALE = 0.42;

/** Escenas 3-4: el recordatorio de WhatsApp, la respuesta del cliente y el móvil en miniatura. */
export const ReminderPart: React.FC<Props> = ({ messageAt, readAt, replyAt, shrinkAt, exitAt }) => {
  const frame = useCurrentFrame();
  const { fps, width } = useVideoConfig();

  const enter = springIn(frame, fps, 0, { damping: 14, stiffness: 150 });
  const shrink = interpolate(frame, [shrinkAt, shrinkAt + 10], [0, 1], {
    ...clamp,
    easing: Easing.bezier(0.65, 0, 0.35, 1),
  });
  const exit = interpolate(frame, [exitAt, exitAt + 8], [0, 1], { ...clamp, easing: EASE_IN });

  // Posición completa (centrado) → miniatura arriba a la derecha
  const left = (width - PHONE_W) / 2;
  const top = LAYOUT.stageTop - 40;
  const pipLeft = width - 40 - PHONE_W * PIP_SCALE;
  const pipTop = LAYOUT.stageTop - 80;
  // Push-in sobre la burbuja cuando llega el mensaje
  const push = interpolate(frame, [messageAt, messageAt + 10], [1, 1.08], { ...clamp, easing: EASE_IN });

  return (
    <PhoneFrame
      width={PHONE_W}
      time="21:00"
      screenColor={WA.header}
      lightStatusBar
      style={{
        left: interpolate(shrink, [0, 1], [left, pipLeft]),
        top: interpolate(shrink, [0, 1], [top, pipTop]),
        transformOrigin: "0 0",
        scale: String(interpolate(shrink, [0, 1], [push, PIP_SCALE])),
        translate: `${interpolate(enter, [0, 1], [900, 0])}px ${-exit * 900}px`,
        rotate: `${interpolate(enter, [0, 1], [14, 0])}deg`,
        filter: enter < 0.6 ? `blur(${(0.6 - enter) * 20}px)` : undefined,
      }}
    >
      <WhatsAppChat
        contactName="Marta"
        avatarColor="#FF6B4A"
        dayLabel="HOY"
        scale={1.25}
        messages={[
          {
            from: "me",
            text: "Hola Marta, te recordamos tu reserva en La Plaza mañana, 21:00.",
            time: "21:00",
            at: messageAt,
            readAt,
          },
          { from: "them", text: "Ahí estaremos 👍", time: "21:02", at: replyAt, typingFrom: replyAt - 12 },
        ]}
      />
      {/* Destello al ponerse azul el doble check */}
      <Burst at={readAt} color={WA.tickBlue} size={40} spread={70} sparks={8} x={PHONE_W - 110} y={PHONE_W * PHONE_ASPECT * 0.33} />
    </PhoneFrame>
  );
};
