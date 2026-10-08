import type React from "react";
import { Img, staticFile } from "remotion";
import { BRAND } from "../brand";

/** Icono cuadrado de la marca (`BRAND.icon`). */
export const LogoMark: React.FC<{ size: number; style?: React.CSSProperties }> = ({ size, style }) => (
  <Img
    src={staticFile(BRAND.icon)}
    style={{ width: size, height: size, flexShrink: 0, display: "block", ...style }}
  />
);

/** Logo completo (icono + wordmark) para fondo oscuro (`BRAND.logoOnDark`). */
export const LogoFull: React.FC<{ width: number; style?: React.CSSProperties }> = ({ width, style }) => (
  <Img
    src={staticFile(BRAND.logoOnDark)}
    style={{ width, height: (width * 120) / 474.8, display: "block", ...style }}
  />
);
