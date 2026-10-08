import type React from "react";
import { interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { EASE_IN, EASE_OUT, clamp, springIn } from "../lib/anim";
import { FONT, STATUS } from "../theme";

type StickerProps = {
  text: string;
  /** Frame (relativo al padre) en el que cae. */
  at: number;
  /** Centro final (px del lienzo). */
  x: number;
  y: number;
  /** Inclinación final en grados. */
  rot?: number;
  bg?: string;
  ink?: string;
  fontSize?: number;
  /** Frame en el que se tacha el texto (rotulador rojo de izquierda a derecha). */
  strikeAt?: number;
  /** Frame en el que sale volando. */
  outAt?: number;
};

/** Nota adhesiva de "caos": cae desde arriba con rebote y se queda torcida; opcionalmente se tacha. */
export const Sticker: React.FC<StickerProps> = ({
  text,
  at,
  x,
  y,
  rot = 0,
  bg = "#FFE27A",
  ink = "#2B2410",
  fontSize = 58,
  strikeAt,
  outAt,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  if (frame < at) return null;

  const p = springIn(frame, fps, at, { damping: 9, stiffness: 150, mass: 0.7 });
  const out = outAt === undefined ? 0 : interpolate(frame, [outAt, outAt + 8], [0, 1], { ...clamp, easing: EASE_IN });
  if (out >= 1) return null;
  const strike = strikeAt === undefined ? 0 : interpolate(frame, [strikeAt, strikeAt + 6], [0, 1], { ...clamp, easing: EASE_OUT });

  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        translate: `-50% calc(-50% + ${interpolate(p, [0, 1], [-(y + 320), 0]) - out * 700}px)`,
        rotate: `${rot + interpolate(p, [0, 1], [28, 0]) + out * 40}deg`,
        scale: String(1 - out * 0.4),
        opacity: 1 - out,
        padding: "26px 42px",
        borderRadius: 18,
        background: bg,
        color: ink,
        fontFamily: FONT,
        fontWeight: 900,
        fontSize,
        lineHeight: 1.1,
        whiteSpace: "nowrap",
        boxShadow: "0 3px 0 rgba(0,0,0,0.12), 0 26px 50px rgba(0,0,0,0.5)",
      }}
    >
      <span style={{ opacity: 1 - strike * 0.45 }}>{text}</span>
      {strikeAt !== undefined ? (
        <span
          style={{
            position: "absolute",
            left: 28,
            top: "50%",
            width: `calc(${strike} * (100% - 56px))`,
            height: 10,
            marginTop: -5,
            borderRadius: 6,
            background: STATUS.noShow.solid,
            rotate: "-2deg",
          }}
        />
      ) : null}
    </div>
  );
};
