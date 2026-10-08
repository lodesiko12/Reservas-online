import type React from "react";
import { AbsoluteFill } from "remotion";
import { loadFont } from "@remotion/google-fonts/Caveat";
import { BRAND } from "../brand";
import { COLORS, FONT, SAFE, STATUS } from "../theme";

/**
 * Piezas comunes de los carruseles (diapositivas estáticas 1080×1920): titular de 2 líneas,
 * chip de paso, subtítulo, "Desliza →", fondo claro y marca de verificación.
 */

/** Letra a mano (libretas, pósits, comandas). */
export const { fontFamily: HAND } = loadFont("normal", { weights: ["600", "700"], subsets: ["latin", "latin-ext"] });

export const LIGHT_BG = "#F3F7F6";
/** Coral oscurecido para texto sobre fondo claro (contraste ≥ 4,5:1). */
export const ACCENT_ON_LIGHT = "#C8401F";

export const Headline: React.FC<{ l1: string; l2: string; size?: number; top?: number; light?: boolean; accent?: string }> = ({
  l1,
  l2,
  size = 104,
  top = SAFE.top + 130,
  light = false,
  accent,
}) => (
  <div
    style={{
      position: "absolute",
      top,
      left: SAFE.side - 20,
      right: SAFE.side - 20,
      textAlign: "center",
      fontFamily: FONT,
      fontWeight: 900,
      fontSize: size,
      lineHeight: 1.04,
      letterSpacing: -1.5,
      color: light ? COLORS.ink : COLORS.white,
      textWrap: "balance",
    }}
  >
    <div>{l1}</div>
    <div style={{ color: accent ?? (light ? ACCENT_ON_LIGHT : BRAND.accent) }}>{l2}</div>
  </div>
);

export const Sub: React.FC<{ text: string; top?: number; light?: boolean }> = ({ text, top = SAFE.top + 375, light = false }) => (
  <div
    style={{
      position: "absolute",
      top,
      left: SAFE.side,
      right: SAFE.side,
      textAlign: "center",
      fontFamily: FONT,
      fontWeight: 700,
      fontSize: 44,
      color: light ? COLORS.inkMuted : "#9FBDB9",
    }}
  >
    {text}
  </div>
);

/** Chip superior ("Señal 1 de 3", "Paso 2 de 3"…); `n` va en color de acento. */
export const StepChip: React.FC<{ label: string; n: number; of: number }> = ({ label, n, of }) => (
  <div style={{ position: "absolute", top: SAFE.top + 30, left: 0, right: 0, display: "flex", justifyContent: "center" }}>
    <div
      style={{
        padding: "12px 30px",
        borderRadius: 999,
        border: "3px solid rgba(207,230,227,0.35)",
        color: "#CFE6E3",
        fontFamily: FONT,
        fontWeight: 800,
        fontSize: 36,
        letterSpacing: 3,
        textTransform: "uppercase",
      }}
    >
      {label} <span style={{ color: BRAND.accent }}>{n}</span> de {of}
    </div>
  </div>
);

/** Chip coral de portada ("3 SEÑALES", "ANTES DEL PUENTE"…). */
export const KickerChip: React.FC<{ text: string; top?: number }> = ({ text, top = SAFE.top + 40 }) => (
  <div style={{ position: "absolute", top, left: 0, right: 0, display: "flex", justifyContent: "center" }}>
    <div
      style={{
        padding: "14px 34px",
        borderRadius: 999,
        background: BRAND.accent,
        color: "#fff",
        fontFamily: FONT,
        fontWeight: 900,
        fontSize: 44,
        letterSpacing: 4,
        textTransform: "uppercase",
        rotate: "-2deg",
        boxShadow: "0 14px 34px rgba(255,107,74,0.4)",
      }}
    >
      {text}
    </div>
  </div>
);

/** Número gigante tenue al fondo de las diapositivas de contenido. */
export const GhostNumber: React.FC<{ n: number }> = ({ n }) => (
  <div
    style={{
      position: "absolute",
      right: -40,
      top: 420,
      fontFamily: FONT,
      fontWeight: 900,
      fontSize: 1100,
      lineHeight: 1,
      color: "rgba(255,107,74,0.08)",
    }}
  >
    {n}
  </div>
);

/** Pastilla "Desliza →" abajo a la derecha, dentro de la zona segura. */
export const SwipeHint: React.FC<{ light?: boolean }> = ({ light = false }) => (
  <div
    style={{
      position: "absolute",
      right: SAFE.side,
      bottom: SAFE.bottom + 40,
      display: "flex",
      alignItems: "center",
      gap: 18,
      fontFamily: FONT,
      fontWeight: 800,
      fontSize: 40,
      color: light ? COLORS.inkMuted : "#CFE6E3",
    }}
  >
    Desliza
    <div
      style={{
        width: 84,
        height: 84,
        borderRadius: 999,
        background: BRAND.accent,
        display: "grid",
        placeItems: "center",
        boxShadow: "0 12px 30px rgba(255,107,74,0.45)",
      }}
    >
      <svg width="42" height="42" viewBox="0 0 24 24" fill="none">
        <path d="M5 12h13M13 6l6 6-6 6" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  </div>
);

/** Fondo claro de "solución" con resplandor teal y puntos (versión fija del de los vídeos). */
export const LightBackground: React.FC<{ glowY?: string }> = ({ glowY = "62%" }) => (
  <AbsoluteFill style={{ background: LIGHT_BG }}>
    <AbsoluteFill style={{ background: `radial-gradient(circle at 50% ${glowY}, color-mix(in srgb, ${BRAND.color} 22%, transparent), transparent 55%)` }} />
    <AbsoluteFill style={{ backgroundImage: "radial-gradient(rgba(11,110,106,0.10) 2px, transparent 2px)", backgroundSize: "48px 48px" }} />
  </AbsoluteFill>
);

/** Círculo verde con ✓ (sello de "hecho"). */
export const CheckBadge: React.FC<{ size?: number; style?: React.CSSProperties }> = ({ size = 120, style }) => (
  <div
    style={{
      position: "absolute",
      width: size,
      height: size,
      borderRadius: 999,
      background: STATUS.confirmed.solid,
      display: "grid",
      placeItems: "center",
      border: `${Math.round(size * 0.07)}px solid #fff`,
      boxShadow: "0 18px 40px rgba(0,0,0,0.35)",
      ...style,
    }}
  >
    <svg width={size * 0.56} height={size * 0.56} viewBox="0 0 24 24" fill="none">
      <path d="M5 12.5l4.5 4.5L19 7.5" stroke="#fff" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  </div>
);

/** CTA final común de los carruseles. */
export const CtaPill: React.FC<{ cta: string; sub: string; top: number }> = ({ cta, sub, top }) => (
  <div style={{ position: "absolute", left: 0, right: 0, top, display: "flex", justifyContent: "center" }}>
    <div
      style={{
        padding: "26px 60px 30px",
        borderRadius: 999,
        background: BRAND.color,
        color: "#fff",
        fontFamily: FONT,
        textAlign: "center",
        boxShadow: `0 0 0 8px ${BRAND.accent}, 0 30px 70px rgba(11,110,106,0.45)`,
      }}
    >
      <div style={{ fontSize: 66, fontWeight: 900, lineHeight: 1.05 }}>{cta}</div>
      <div style={{ fontSize: 38, fontWeight: 800, color: "#CFE6E3" }}>{sub}</div>
    </div>
  </div>
);
