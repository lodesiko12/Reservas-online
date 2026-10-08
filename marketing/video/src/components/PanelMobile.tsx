import type React from "react";
import { BRAND } from "../brand";
import { FONT } from "../theme";
import { LogoMark } from "./Logo";

/**
 * Panel del negocio en el móvil, imitado de `capturas/panel/<tipo>/movil/*.png`: barra superior blanca
 * (menú, icono de Turnigo, nombre del negocio, botón de modo oscuro) y página sobre `--tg-bg`.
 * Medidas en "pt" de un móvil de 390 de ancho, escaladas con `s`.
 */

export const PANEL = {
  bg: "#F3F7F6",
  surface: "#FFFFFF",
  border: "#D9E4E2",
  ink: "#0F2A2A",
  muted: "#4A6362",
  faint: "#8CA3A1",
} as const;

type PanelMobileProps = {
  s: number;
  business: string;
  title: string;
  subtitle?: string;
  /** Acción principal bajo el título (p. ej. "+ Nuevo bloqueo"). */
  action?: React.ReactNode;
  children?: React.ReactNode;
};

export const PanelMobile: React.FC<PanelMobileProps> = ({ s, business, title, subtitle, action, children }) => (
  <div style={{ position: "absolute", inset: 0, background: PANEL.bg, fontFamily: FONT, color: PANEL.ink }}>
    <div
      style={{
        height: 55 * s,
        background: PANEL.surface,
        borderBottom: `${1 * s}px solid ${PANEL.border}`,
        display: "flex",
        alignItems: "center",
        gap: 12 * s,
        padding: `0 ${16 * s}px`,
      }}
    >
      <div
        style={{
          width: 36 * s,
          height: 36 * s,
          borderRadius: 10 * s,
          border: `${1 * s}px solid ${PANEL.border}`,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 4 * s,
        }}
      >
        {[0, 1, 2].map((i) => (
          <div key={i} style={{ width: 14 * s, height: 1.6 * s, borderRadius: 2, background: PANEL.muted }} />
        ))}
      </div>
      <LogoMark size={28 * s} style={{ borderRadius: 7 * s }} />
      <div style={{ flex: 1, fontSize: 16 * s, fontWeight: 800 }}>{business}</div>
      <div
        style={{
          width: 36 * s,
          height: 36 * s,
          borderRadius: 10 * s,
          border: `${1 * s}px solid ${PANEL.border}`,
          display: "grid",
          placeItems: "center",
          fontSize: 15 * s,
        }}
      >
        🌙
      </div>
    </div>
    <div style={{ padding: `${20 * s}px ${16 * s}px` }}>
      <div style={{ fontSize: 20 * s, fontWeight: 800, letterSpacing: -0.2 * s }}>{title}</div>
      {subtitle ? <div style={{ fontSize: 13 * s, color: PANEL.muted, marginTop: 4 * s }}>{subtitle}</div> : null}
      {action ? <div style={{ marginTop: 18 * s }}>{action}</div> : null}
      {children}
    </div>
  </div>
);

/** Botón principal del panel (`btn-primary`): verde de marca, esquinas de 12 pt. */
export const PanelButton: React.FC<{ s: number; label: string; ghost?: boolean; press?: number; style?: React.CSSProperties; children?: React.ReactNode }> = ({
  s,
  label,
  ghost = false,
  press = 1,
  style,
  children,
}) => (
  <div
    style={{
      position: "relative",
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      height: 36 * s,
      padding: `0 ${16 * s}px`,
      borderRadius: 12 * s,
      background: ghost ? PANEL.surface : BRAND.color,
      color: ghost ? PANEL.ink : "#FFFFFF",
      border: ghost ? `${1 * s}px solid ${PANEL.border}` : undefined,
      fontSize: 14 * s,
      fontWeight: 800,
      whiteSpace: "nowrap",
      scale: String(press),
      ...style,
    }}
  >
    {label}
    {children}
  </div>
);
