import type React from "react";
import { Img, staticFile } from "remotion";
import { BRAND } from "../brand";
import { FONT } from "../theme";

/**
 * Icono de la marca. Usa `BRAND.logo` si existe; si no, un cuadrado redondeado
 * con la inicial en el color de marca (provisional).
 */
export const LogoMark: React.FC<{ size: number; style?: React.CSSProperties }> = ({ size, style }) => {
  if (BRAND.logo) {
    return (
      <Img
        src={staticFile(BRAND.logo)}
        style={{ width: size, height: size, objectFit: "contain", ...style }}
      />
    );
  }
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.28,
        background: `linear-gradient(140deg, ${BRAND.color}, color-mix(in srgb, ${BRAND.color} 60%, #000))`,
        color: "#fff",
        display: "grid",
        placeItems: "center",
        fontFamily: FONT,
        fontWeight: 900,
        fontSize: size * 0.58,
        lineHeight: 1,
        boxShadow: `0 ${size * 0.08}px ${size * 0.25}px color-mix(in srgb, ${BRAND.color} 45%, transparent)`,
        flexShrink: 0,
        ...style,
      }}
    >
      {BRAND.name.charAt(0)}
    </div>
  );
};
