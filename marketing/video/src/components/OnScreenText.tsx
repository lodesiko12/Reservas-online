import type React from "react";
import { interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { EASE_OUT, clamp, fadeOut, springIn } from "../lib/anim";
import { COLORS, FONT, LAYOUT } from "../theme";

type OnScreenTextProps = {
  text: string;
  /** Fragmento del texto que va resaltado con un "marcador" de color. */
  highlight?: string;
  highlightColor?: string;
  /** Color del texto resaltado (sobre el marcador). */
  highlightInk?: string;
  /** Frame (relativo al padre) de entrada. */
  at?: number;
  /** Frame en el que entra el fragmento resaltado (p. ej. cuando la voz lo dice). */
  highlightAt?: number;
  /** Frame (relativo al padre) de salida; sin él, no sale. */
  outAt?: number;
  fontSize?: number;
  top?: number;
  /** Color base del texto (por defecto blanco; usa `COLORS.ink` sobre fondo claro). */
  ink?: string;
  /** Sombra del texto; `"none"` sobre fondo claro. */
  shadow?: string;
  style?: React.CSSProperties;
};

/**
 * Titular grande de escena, arriba y dentro de la zona segura. Las palabras
 * entran "de golpe" (escala grande → 1) y el fragmento resaltado lleva un
 * marcador de color que se pinta de izquierda a derecha.
 */
export const OnScreenText: React.FC<OnScreenTextProps> = ({
  text,
  highlight,
  highlightColor = COLORS.captionHighlight,
  highlightInk = COLORS.white,
  at = 0,
  highlightAt,
  outAt,
  fontSize = 92,
  top = LAYOUT.headlineTop,
  ink = COLORS.white,
  shadow = "0 6px 24px rgba(0,0,0,0.45)",
  style,
}) => {
  const frame = useCurrentFrame();
  const { fps, width } = useVideoConfig();

  const hlStart = highlight ? text.indexOf(highlight) : -1;
  const hlEnd = hlStart + (highlight?.length ?? 0);

  let cursor = 0;
  let plainIndex = 0;
  let hlIndex = 0;
  const words = text.split(" ").map((w) => {
    const start = cursor;
    cursor += w.length + 1;
    const highlighted = hlStart >= 0 && start >= hlStart && start < hlEnd;
    const enter = highlighted && highlightAt !== undefined ? highlightAt + hlIndex++ : at + plainIndex++ * 2 + (highlighted ? hlIndex++ : 0);
    return { w, highlighted, enter };
  });

  const out = outAt === undefined ? 1 : fadeOut(frame, outAt, 5);
  const outScale = outAt === undefined ? 1 : interpolate(frame, [outAt, outAt + 5], [1, 0.92], clamp);

  return (
    <div
      style={{
        position: "absolute",
        top,
        left: 60,
        width: width - 120,
        textAlign: "center",
        fontFamily: FONT,
        fontWeight: 900,
        fontSize,
        lineHeight: 1.12,
        letterSpacing: -1,
        color: ink,
        opacity: out,
        scale: String(outScale),
        ...style,
      }}
    >
      {words.map(({ w, highlighted, enter }, i) => {
        const p = springIn(frame, fps, enter, { damping: 13, stiffness: 260, mass: 0.6 });
        const marker = interpolate(frame, [enter + 2, enter + 8], [0, 1], { ...clamp, easing: EASE_OUT });
        return (
          <span
            key={i}
            style={{
              display: "inline-block",
              position: "relative",
              margin: "0 0.12em",
              padding: highlighted ? "0 0.14em" : undefined,
              color: highlighted ? highlightInk : ink,
              opacity: interpolate(p, [0, 0.25], [0, 1], clamp),
              scale: String(interpolate(p, [0, 1], [1.8, 1])),
              textShadow: shadow,
            }}
          >
            {highlighted ? (
              <span
                style={{
                  position: "absolute",
                  inset: "0.08em -0.13em 0.02em",
                  background: highlightColor,
                  borderRadius: "0.18em",
                  transformOrigin: "0 50%",
                  scale: `${marker} 1`,
                  zIndex: -1,
                  boxShadow: `0 8px 30px color-mix(in srgb, ${highlightColor} 45%, transparent)`,
                }}
              />
            ) : null}
            {w}
          </span>
        );
      })}
    </div>
  );
};
