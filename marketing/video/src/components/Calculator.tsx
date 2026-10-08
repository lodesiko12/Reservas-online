import type React from "react";
import { BRAND } from "../brand";
import { FONT } from "../theme";

const KEYS = ["7", "8", "9", "÷", "4", "5", "6", "×", "1", "2", "3", "−", "0", ".", "=", "+"] as const;
const OPS = new Set(["÷", "×", "−", "+"]);

export const CALC = { width: 780, height: 830, pad: 40, display: 230, key: { w: 158, h: 98, gap: 20 } } as const;

/**
 * Calculadora gigante (la "cuenta" de T3). Pantalla con la operación y el resultado; la tecla `lit`
 * se hunde y se ilumina (`litAge` = frames desde que se pulsó).
 */
export const Calculator: React.FC<{
  expr: string;
  result: string;
  lit?: string | null;
  litAge?: number;
  resultColor?: string;
  style?: React.CSSProperties;
}> = ({ expr, result, lit = null, litAge = 99, resultColor = "#B8F5E4", style }) => {
  const on = lit !== null && litAge >= 0 && litAge < 7;
  return (
    <div
      style={{
        position: "absolute",
        width: CALC.width,
        height: CALC.height,
        boxSizing: "border-box",
        borderRadius: 64,
        padding: CALC.pad,
        background: "linear-gradient(160deg, #1B2F2E, #0F1F1F)",
        border: "4px solid rgba(159,207,201,0.25)",
        boxShadow: "0 50px 120px rgba(0,0,0,0.6), inset 0 2px 0 rgba(255,255,255,0.08)",
        fontFamily: FONT,
        ...style,
      }}
    >
      <div
        style={{
          height: CALC.display,
          boxSizing: "border-box",
          borderRadius: 30,
          background: "#0A1413",
          border: "3px solid rgba(159,207,201,0.18)",
          padding: "22px 34px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          alignItems: "flex-end",
          boxShadow: "inset 0 10px 30px rgba(0,0,0,0.5)",
        }}
      >
        <div style={{ fontSize: 42, fontWeight: 700, color: "#7FA7A2", whiteSpace: "nowrap", minHeight: 52 }}>{expr}</div>
        <div style={{ fontSize: 110, fontWeight: 900, color: resultColor, lineHeight: 1, letterSpacing: -2, whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>
          {result}
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: `repeat(4, ${CALC.key.w}px)`, gap: CALC.key.gap, marginTop: 36 }}>
        {KEYS.map((k) => {
          const pressed = on && lit === k;
          const accent = k === "=" || OPS.has(k);
          return (
            <div
              key={k}
              style={{
                height: CALC.key.h,
                borderRadius: 26,
                display: "grid",
                placeItems: "center",
                fontSize: 50,
                fontWeight: 800,
                color: accent ? "#fff" : "#E3F2F0",
                background: pressed ? (accent ? "#FF8A6F" : "#4E7C77") : accent ? (k === "=" ? BRAND.accent : "#C9573F") : "#2A4543",
                boxShadow: pressed ? "none" : "0 8px 0 rgba(0,0,0,0.35)",
                translate: pressed ? "0px 6px" : undefined,
                scale: pressed ? "0.96" : undefined,
              }}
            >
              {k}
            </div>
          );
        })}
      </div>
    </div>
  );
};
