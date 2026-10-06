import type React from "react";
import { interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { clamp, fadeOut, springIn } from "../lib/anim";
import { COLORS, FONT, LAYOUT } from "../theme";

type OnScreenTextProps = {
  text: string;
  /** Fragmento del texto que se pinta en `highlightColor`. */
  highlight?: string;
  highlightColor?: string;
  /** Frame (relativo al padre) de entrada. */
  at?: number;
  /** Frame (relativo al padre) de salida; sin él, no sale. */
  outAt?: number;
  fontSize?: number;
  top?: number;
  style?: React.CSSProperties;
};

/** Titular grande de escena, arriba y dentro de la zona segura. Entra palabra a palabra. */
export const OnScreenText: React.FC<OnScreenTextProps> = ({
  text,
  highlight,
  highlightColor = COLORS.captionHighlight,
  at = 0,
  outAt,
  fontSize = 88,
  top = LAYOUT.headlineTop,
  style,
}) => {
  const frame = useCurrentFrame();
  const { fps, width } = useVideoConfig();

  const hlStart = highlight ? text.indexOf(highlight) : -1;
  const hlEnd = hlStart + (highlight?.length ?? 0);

  let cursor = 0;
  const words = text.split(" ").map((w) => {
    const start = cursor;
    cursor += w.length + 1;
    return { w, highlighted: hlStart >= 0 && start >= hlStart && start < hlEnd };
  });

  const out = outAt === undefined ? 1 : fadeOut(frame, outAt, 6);

  return (
    <div
      style={{
        position: "absolute",
        top,
        left: 70,
        width: width - 140,
        textAlign: "center",
        fontFamily: FONT,
        fontWeight: 900,
        fontSize,
        lineHeight: 1.06,
        letterSpacing: -1.5,
        color: COLORS.white,
        opacity: out,
        ...style,
      }}
    >
      {words.map(({ w, highlighted }, i) => {
        const p = springIn(frame, fps, at + i * 2, { damping: 15, stiffness: 190 });
        return (
          <span
            key={i}
            style={{
              display: "inline-block",
              marginRight: "0.24em",
              color: highlighted ? highlightColor : COLORS.white,
              opacity: interpolate(p, [0, 0.5], [0, 1], clamp),
              translate: `0px ${interpolate(p, [0, 1], [40, 0])}px`,
            }}
          >
            {w}
          </span>
        );
      })}
    </div>
  );
};
