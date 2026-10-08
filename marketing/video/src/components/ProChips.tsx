import type React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { clamp, pulse } from "../lib/anim";
import { FONT } from "../theme";
import { Ripple } from "./PsyScreens";

/** "#rrggbb" → rgba con la opacidad dada (como `hexAlpha` de Agenda.tsx). */
export const hexAlpha = (hex: string, alpha: number) => {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  return m ? `rgba(${parseInt(m[1], 16)}, ${parseInt(m[2], 16)}, ${parseInt(m[3], 16)}, ${alpha})` : hex;
};

export type Pro = { name: string; color: string };

type ProChipsProps = {
  pros: readonly Pro[];
  /** Tamaño de letra en px (el resto se escala a partir de él). */
  fontSize?: number;
  /** Chip que se pulsa (índice en `pros`) y frame del toque; desde ahí el filtro está puesto. */
  pick?: { index: number; at: number };
  /** Recuento que la app muestra con el filtro puesto ("14 citas"). */
  count?: string;
  /** Frames en los que cada chip late (p. ej. cuando caen sus citas). */
  pulses?: readonly number[];
  style?: React.CSSProperties;
};

/**
 * Leyenda-filtro de profesionales de la Agenda de citas: "Todas" + un chip por profesional con su color
 * (fondo al 28 % + borde izquierdo de 4 px). Con un profesional elegido, su chip lleva anillo oscuro,
 * los demás se apagan (40 % + gris) y aparece el recuento.
 */
export const ProChips: React.FC<ProChipsProps> = ({ pros, fontSize = 34, pick, count, pulses = [], style }) => {
  const frame = useCurrentFrame();
  const k = fontSize / 12; // la app usa text-xs (12 px)
  const on = pick !== undefined && frame >= pick.at;
  const chip: React.CSSProperties = {
    position: "relative",
    borderRadius: 999,
    padding: `${4 * k}px ${10 * k}px`,
    fontSize,
    fontWeight: 600,
    lineHeight: 1.25,
    whiteSpace: "nowrap",
  };
  return (
    <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 8 * k, fontFamily: FONT, ...style }}>
      <div
        style={{
          ...chip,
          background: on ? "#FFFFFF" : "#1E293B",
          color: on ? "#475569" : "#FFFFFF",
          border: `${1 * k}px solid ${on ? "#E2E8F0" : "#1E293B"}`,
        }}
      >
        Todas
      </div>
      {pros.map((p, i) => {
        const chosen = on && pick!.index === i;
        const dim = on && !chosen ? interpolate(frame, [pick!.at, pick!.at + 5], [0, 1], clamp) : 0;
        const beat = pulses[i] === undefined ? 1 : pulse(frame, pulses[i], 1.14, 10);
        const press = pick?.index === i ? 1 / pulse(frame, pick.at, 1.1, 8) : 1;
        return (
          <div
            key={p.name}
            style={{
              ...chip,
              background: hexAlpha(p.color, 0.28),
              borderLeft: `${4 * k * 0.75}px solid ${p.color}`,
              color: "#1E293B",
              opacity: 1 - dim * 0.6,
              filter: dim > 0 ? `grayscale(${dim})` : undefined,
              boxShadow: chosen ? `0 0 0 ${1 * k}px #FFFFFF, 0 0 0 ${3 * k}px #1E293B` : undefined,
              scale: String(beat * press),
            }}
          >
            {p.name}
            {pick?.index === i ? <Ripple t={frame - pick.at} /> : null}
          </div>
        );
      })}
      {count && on ? (
        <span style={{ fontSize, color: "#94A3B8", fontWeight: 600, opacity: interpolate(frame, [pick!.at + 3, pick!.at + 8], [0, 1], clamp) }}>{count}</span>
      ) : null}
    </div>
  );
};
