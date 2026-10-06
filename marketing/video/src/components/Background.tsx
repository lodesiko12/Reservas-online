import type React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { COLORS } from "../theme";

/** Fondo oscuro común con un resplandor que se mueve despacio. */
export const Background: React.FC<{ glowColor?: string }> = ({ glowColor = COLORS.bgGlow }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const x = 50 + Math.sin(t * 0.35) * 18;
  const y = 40 + Math.cos(t * 0.27) * 12;

  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(circle at ${x}% ${y}%, ${glowColor} 0%, ${COLORS.bg} 62%)`,
      }}
    >
      <AbsoluteFill
        style={{
          backgroundImage: "radial-gradient(rgba(255,255,255,0.05) 1.5px, transparent 1.5px)",
          backgroundSize: "44px 44px",
        }}
      />
    </AbsoluteFill>
  );
};
