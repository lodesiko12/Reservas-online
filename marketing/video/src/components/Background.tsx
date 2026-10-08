import type React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { BRAND } from "../brand";
import { COLORS } from "../theme";

/** Fondo oscuro verde azulado (modo oscuro del panel) con dos resplandores de marca en movimiento. */
export const Background: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const x1 = 30 + Math.sin(t * 0.6) * 20;
  const y1 = 30 + Math.cos(t * 0.45) * 12;
  const x2 = 75 + Math.cos(t * 0.5) * 15;
  const y2 = 78 + Math.sin(t * 0.4) * 10;

  return (
    <AbsoluteFill
      style={{
        background: [
          `radial-gradient(circle at ${x1}% ${y1}%, color-mix(in srgb, ${BRAND.color} 70%, transparent) 0%, transparent 45%)`,
          `radial-gradient(circle at ${x2}% ${y2}%, color-mix(in srgb, ${BRAND.accent} 22%, transparent) 0%, transparent 40%)`,
          COLORS.bg,
        ].join(", "),
      }}
    >
      <AbsoluteFill
        style={{
          backgroundImage: "radial-gradient(rgba(159,207,201,0.10) 2px, transparent 2px)",
          backgroundSize: "48px 48px",
          backgroundPosition: `${(frame * 0.6) % 48}px ${(frame * 0.3) % 48}px`,
        }}
      />
    </AbsoluteFill>
  );
};
