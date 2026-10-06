import type React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { BRAND } from "../brand";
import { clamp, springIn } from "../lib/anim";
import { COLORS, FONT, SAFE } from "../theme";
import { LogoMark } from "./Logo";

type EndCardProps = {
  name?: string;
  tagline?: string;
  cta?: string;
  /** Línea pequeña bajo el CTA (p. ej. "enlace en bio"); vacía para ocultarla. */
  hint?: string;
  brandColor?: string;
};

/** Cierre común: logo + nombre + frase + CTA. Por defecto lee todo de `BRAND`. */
export const EndCard: React.FC<EndCardProps> = ({
  name = BRAND.name,
  tagline = BRAND.tagline,
  cta = BRAND.cta,
  hint = "",
  brandColor = BRAND.color,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const logo = springIn(frame, fps, 0, { damping: 12, stiffness: 150 });
  const nameIn = springIn(frame, fps, 6);
  const tagIn = springIn(frame, fps, 11);
  const ctaIn = springIn(frame, fps, 18, { damping: 12 });
  const breathe = 1 + Math.sin(((frame - 30) / fps) * Math.PI * 2 * 0.9) * 0.025 * (frame > 30 ? 1 : 0);

  return (
    <AbsoluteFill
      style={{
        fontFamily: FONT,
        color: COLORS.white,
        background: `radial-gradient(circle at 50% 42%, color-mix(in srgb, ${brandColor} 38%, transparent), transparent 60%)`,
        opacity: interpolate(frame, [0, 6], [0, 1], clamp),
      }}
    >
      <div
        style={{
          position: "absolute",
          top: SAFE.top,
          bottom: SAFE.bottom + 260, // deja hueco a los subtítulos
          left: 0,
          right: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 26,
        }}
      >
        <LogoMark
          size={220}
          style={{ scale: interpolate(logo, [0, 1], [0.4, 1]), opacity: interpolate(logo, [0, 0.4], [0, 1], clamp) }}
        />
        <div
          style={{
            fontSize: 132,
            fontWeight: 900,
            letterSpacing: -4,
            lineHeight: 1,
            marginTop: 16,
            opacity: interpolate(nameIn, [0, 0.5], [0, 1], clamp),
            translate: `0px ${interpolate(nameIn, [0, 1], [40, 0])}px`,
          }}
        >
          {name}
        </div>
        <div
          style={{
            fontSize: 44,
            fontWeight: 600,
            color: COLORS.textMuted,
            opacity: interpolate(tagIn, [0, 0.5], [0, 1], clamp),
            translate: `0px ${interpolate(tagIn, [0, 1], [30, 0])}px`,
          }}
        >
          {tagline}
        </div>
        <div
          style={{
            marginTop: 50,
            padding: "34px 54px",
            borderRadius: 999,
            background: brandColor,
            fontSize: 54,
            fontWeight: 800,
            textAlign: "center",
            maxWidth: 940,
            boxShadow: `0 20px 60px color-mix(in srgb, ${brandColor} 55%, transparent)`,
            opacity: interpolate(ctaIn, [0, 0.4], [0, 1], clamp),
            scale: interpolate(ctaIn, [0, 1], [0.7, 1]) * breathe,
          }}
        >
          {cta}
        </div>
        {hint ? (
          <div style={{ fontSize: 36, fontWeight: 600, color: COLORS.textMuted, opacity: interpolate(ctaIn, [0, 1], [0, 1], clamp) }}>
            {hint}
          </div>
        ) : null}
      </div>
    </AbsoluteFill>
  );
};
