import type React from "react";
import { interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { PhoneFrame } from "../../components/PhoneFrame";
import { WA, WhatsAppChat } from "../../components/WhatsAppChat";
import { EASE_IN, clamp, springIn } from "../../lib/anim";
import { LAYOUT } from "../../theme";

type Props = {
  /** Frame en el que llega el recordatorio. */
  messageAt: number;
  /** Frame en el que el cliente responde (inicio de la escena 4). */
  replyAt: number;
  /** Frame en el que el móvil sale por abajo. */
  exitAt: number;
};

const PHONE_W = 620;

/** Escenas 3-4 (primera mitad): el recordatorio de WhatsApp y la respuesta del cliente. */
export const ReminderPart: React.FC<Props> = ({ messageAt, replyAt, exitAt }) => {
  const frame = useCurrentFrame();
  const { fps, width } = useVideoConfig();

  const enter = springIn(frame, fps, 0, { damping: 17, stiffness: 120 });
  const exit = interpolate(frame, [exitAt, exitAt + 14], [0, 1], { ...clamp, easing: EASE_IN });

  return (
    <PhoneFrame
      width={PHONE_W}
      time="21:00"
      screenColor={WA.header}
      lightStatusBar
      style={{
        left: (width - PHONE_W) / 2,
        top: LAYOUT.stageTop - 30,
        translate: `0px ${interpolate(enter, [0, 1], [1500, 0]) + exit * 1500}px`,
      }}
    >
      <WhatsAppChat
        contactName="Marta"
        avatarColor="#E58E73"
        dayLabel="HOY"
        scale={1.25}
        messages={[
          {
            from: "me",
            text: "Hola Marta, te recordamos tu reserva en La Plaza mañana, 21:00.",
            time: "21:00",
            at: messageAt,
            readAt: messageAt + 34,
          },
          {
            from: "them",
            text: "Ahí estaremos 👍",
            time: "21:02",
            at: replyAt,
            typingFrom: replyAt - 16,
          },
        ]}
      />
    </PhoneFrame>
  );
};
