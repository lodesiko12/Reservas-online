import type React from "react";
import { interpolate } from "remotion";
import { BRAND } from "../brand";
import { clamp } from "../lib/anim";
import { FONT } from "../theme";
import { Ripple } from "./PsyScreens";

const INK = "#0F2A2A";

/**
 * Modal "Sentar clientes · <mesa>" del plano de sala (PlanoSala.tsx → WalkinModal):
 * "¿Cuántos son? Toca un número para sentarlos" con los botones 1-12, enlace de nombre/teléfono opcional y Cancelar.
 */
export const WalkinModal: React.FC<{
  table: string;
  /** Número tocado y frames desde el toque (negativo = el dedo se acerca). */
  tapped?: { n: number; t: number };
  style?: React.CSSProperties;
}> = ({ table, tapped, style }) => (
  <div
    style={{
      width: 840,
      boxSizing: "border-box",
      borderRadius: 40,
      background: "#fff",
      padding: "42px 46px 44px",
      fontFamily: FONT,
      boxShadow: "0 50px 120px rgba(0,0,0,0.5)",
      ...style,
    }}
  >
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <div style={{ fontSize: 46, fontWeight: 800, color: INK }}>Sentar clientes · {table}</div>
      <div style={{ fontSize: 50, color: "#64748B", lineHeight: 1 }}>×</div>
    </div>
    <div style={{ fontSize: 28, fontWeight: 600, color: INK, marginTop: 30, marginBottom: 16 }}>¿Cuántos son? Toca un número para sentarlos</div>
    <div style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
      {Array.from({ length: 12 }).map((_, i) => {
        const n = i + 1;
        const hit = tapped?.n === n ? tapped.t : undefined;
        const press = hit === undefined ? 1 : interpolate(hit, [-2, 0, 6], [1, 0.88, 1], clamp);
        const on = hit !== undefined && hit >= 0;
        return (
          <div
            key={n}
            style={{
              position: "relative",
              width: 104,
              height: 104,
              boxSizing: "border-box",
              borderRadius: 22,
              display: "grid",
              placeItems: "center",
              fontSize: 46,
              fontWeight: 800,
              color: INK,
              background: on ? "#ECFDF5" : "#fff",
              border: `3px solid ${on ? "#34D399" : "#E2E8F0"}`,
              scale: String(press),
            }}
          >
            {n}
            {hit !== undefined ? <Ripple t={hit} /> : null}
          </div>
        );
      })}
    </div>
    <div style={{ fontSize: 26, color: BRAND.color, textDecoration: "underline", marginTop: 26, fontWeight: 600 }}>Añadir nombre o teléfono (opcional)</div>
    <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
      <div style={{ padding: "16px 34px", borderRadius: 18, border: "3px solid #D9E4E2", fontSize: 30, fontWeight: 800, color: INK }}>Cancelar</div>
    </div>
  </div>
);
