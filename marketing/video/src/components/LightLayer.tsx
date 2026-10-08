import type React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { BRAND } from "../brand";
import { EASE_IN, EASE_OUT, clamp } from "../lib/anim";
import { COLORS } from "../theme";

type LightLayerProps = {
  /** Frame (relativo al padre) en el que el fondo claro se abre desde el centro (el golpe del giro). */
  openAt: number;
  /** Frame en el que se vuelve a cerrar hacia el centro (el cierre oscuro); sin él, se queda abierto. */
  closeAt?: number;
  /** Punto desde el que se abre/cierra. */
  x?: number;
  y?: number;
  openFrames?: number;
  closeFrames?: number;
};

const MAX_R = 2400;

/**
 * Fondo claro de "solución" que se abre como un círculo sobre el fondo oscuro de "caos".
 * Todo lo que se pinte después de esta capa queda sobre el claro.
 */
export const LightLayer: React.FC<LightLayerProps> = ({ openAt, closeAt, x = 540, y = 860, openFrames = 10, closeFrames = 8 }) => {
  const frame = useCurrentFrame();
  const opening = interpolate(frame, [openAt, openAt + openFrames], [0, MAX_R], { ...clamp, easing: EASE_OUT });
  const closing =
    closeAt === undefined ? 0 : interpolate(frame, [closeAt, closeAt + closeFrames], [0, MAX_R], { ...clamp, easing: EASE_IN });
  const r = opening - closing;
  if (r <= 1) return null;

  const ringOpacity = interpolate(frame, [openAt, openAt + openFrames], [1, 0], clamp);

  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <AbsoluteFill
        style={{
          clipPath: `circle(${r}px at ${x}px ${y}px)`,
          background: [
            `radial-gradient(circle at 50% 18%, color-mix(in srgb, ${BRAND.colorLight} 22%, transparent) 0%, transparent 55%)`,
            `linear-gradient(180deg, ${COLORS.cardAlt}, #E3EFED)`,
          ].join(", "),
        }}
      >
        <AbsoluteFill
          style={{
            backgroundImage: `radial-gradient(color-mix(in srgb, ${BRAND.color} 14%, transparent) 2px, transparent 2px)`,
            backgroundSize: "48px 48px",
            backgroundPosition: `${(frame * 0.6) % 48}px ${(frame * 0.3) % 48}px`,
          }}
        />
      </AbsoluteFill>
      {ringOpacity > 0.01 ? (
        <div
          style={{
            position: "absolute",
            left: x - opening,
            top: y - opening,
            width: opening * 2,
            height: opening * 2,
            borderRadius: "50%",
            border: `16px solid ${BRAND.accent}`,
            opacity: ringOpacity * 0.9,
            boxSizing: "border-box",
          }}
        />
      ) : null}
    </AbsoluteFill>
  );
};
