import type React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { BRAND } from "../brand";
import { EASE_OUT, clamp, springIn } from "../lib/anim";
import { COLORS, FONT, RADIUS, SAFE } from "../theme";
import { LogoFull } from "./Logo";

type EndCardProps = {
  tagline?: string;
  cta?: string;
  /** Frame en el que entra el CTA (p. ej. cuando la voz lo dice). */
  ctaAt?: number;
  /** Línea pequeña bajo el CTA (p. ej. "enlace en bio"); vacía para ocultarla. */
  hint?: string;
};

/** Cierre común: logo de Turnigo + frase + CTA. Por defecto lee todo de `BRAND`. */
export const EndCard: React.FC<EndCardProps> = ({ tagline = BRAND.tagline, cta = BRAND.cta, ctaAt = 14, hint = "" }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const logo = springIn(frame, fps, 0, { damping: 11, stiffness: 200, mass: 0.7 });
  const tagIn = springIn(frame, fps, 6);
  const ctaIn = springIn(frame, fps, ctaAt, { damping: 10, stiffness: 220, mass: 0.6 });
  const ring = ((frame - ctaAt) % 30) / 30;
  const ringOn = frame >= ctaAt + 8;

  return (
    <AbsoluteFill
      style={{
        fontFamily: FONT,
        color: COLORS.white,
        background: `radial-gradient(circle at 50% 40%, color-mix(in srgb, ${BRAND.color} 75%, transparent), transparent 62%)`,
        opacity: interpolate(frame, [0, 4], [0, 1], clamp),
      }}
    >
      <div
        style={{
          position: "absolute",
          top: SAFE.top,
          bottom: SAFE.bottom + 240, // deja hueco a los subtítulos
          left: 0,
          right: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 36,
        }}
      >
        <LogoFull
          width={760}
          style={{
            scale: String(interpolate(logo, [0, 1], [2.2, 1])),
            opacity: interpolate(logo, [0, 0.2], [0, 1], clamp),
            filter: `blur(${interpolate(logo, [0, 0.6], [12, 0], clamp)}px)`,
          }}
        />
        <div
          style={{
            fontSize: 48,
            fontWeight: 800,
            color: "#CFE6E3",
            opacity: interpolate(tagIn, [0, 0.5], [0, 1], clamp),
            translate: `0px ${interpolate(tagIn, [0, 1], [30, 0])}px`,
          }}
        >
          {tagline}
        </div>
        <div style={{ position: "relative", marginTop: 40 }}>
          {ringOn ? (
            <div
              style={{
                position: "absolute",
                inset: 0,
                borderRadius: RADIUS.pill,
                border: `6px solid ${BRAND.accent}`,
                scale: String(1 + interpolate(ring, [0, 1], [0, 0.18], { easing: EASE_OUT })),
                opacity: interpolate(ring, [0, 1], [0.9, 0]),
              }}
            />
          ) : null}
          <div
            style={{
              padding: "34px 56px",
              borderRadius: RADIUS.pill,
              background: COLORS.white,
              color: BRAND.color,
              fontSize: 56,
              fontWeight: 900,
              textAlign: "center",
              maxWidth: 940,
              boxShadow: `0 0 0 6px ${BRAND.accent}, 0 24px 70px rgba(0,0,0,0.5)`,
              opacity: interpolate(ctaIn, [0, 0.3], [0, 1], clamp),
              scale: String(interpolate(ctaIn, [0, 1], [0.4, 1])),
            }}
          >
            {cta}
          </div>
        </div>
        {hint ? (
          <div style={{ fontSize: 36, fontWeight: 700, color: COLORS.textMuted, opacity: interpolate(ctaIn, [0, 1], [0, 1], clamp) }}>
            {hint}
          </div>
        ) : null}
      </div>
    </AbsoluteFill>
  );
};
