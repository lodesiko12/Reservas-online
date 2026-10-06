import type React from "react";
import { FONT } from "../theme";

type PhoneFrameProps = {
  /** Ancho exterior del móvil en px; el alto mantiene la proporción de un iPhone. */
  width?: number;
  /** Hora de la barra de estado. */
  time?: string;
  /** Color de fondo de la pantalla (lo que se ve detrás del contenido). */
  screenColor?: string;
  /** Barra de estado clara (texto blanco) para pantallas con cabecera oscura. */
  lightStatusBar?: boolean;
  style?: React.CSSProperties;
  children?: React.ReactNode;
};

export const PHONE_ASPECT = 2.05;

/** Marco de móvil genérico. El contenido ocupa la pantalla debajo de la barra de estado. */
export const PhoneFrame: React.FC<PhoneFrameProps> = ({
  width = 620,
  time = "21:00",
  screenColor = "#FFFFFF",
  lightStatusBar = false,
  style,
  children,
}) => {
  const height = Math.round(width * PHONE_ASPECT);
  const bezel = Math.round(width * 0.028);
  const radius = Math.round(width * 0.15);
  const statusH = Math.round(width * 0.105);
  const ink = lightStatusBar ? "#FFFFFF" : "#11141B";
  const s = width / 620; // escala de los detalles

  return (
    <div
      style={{
        position: "absolute",
        width,
        height,
        borderRadius: radius,
        background: "linear-gradient(145deg, #2A2E37, #0E1014)",
        padding: bezel,
        boxShadow:
          "0 40px 120px rgba(0,0,0,0.55), 0 0 0 2px #3A3F4A inset, 0 0 0 1px rgba(255,255,255,0.06)",
        fontFamily: FONT,
        ...style,
      }}
    >
      <div
        style={{
          position: "relative",
          width: "100%",
          height: "100%",
          borderRadius: radius - bezel,
          overflow: "hidden",
          background: screenColor,
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Barra de estado */}
        <div
          style={{
            height: statusH,
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: `${8 * s}px ${48 * s}px 0`,
            color: ink,
            fontSize: 26 * s,
            fontWeight: 700,
            position: "relative",
            zIndex: 2,
          }}
        >
          <span>{time}</span>
          <div style={{ display: "flex", alignItems: "center", gap: 8 * s }}>
            {/* Cobertura */}
            <div style={{ display: "flex", alignItems: "flex-end", gap: 3 * s, height: 18 * s }}>
              {[7, 10, 14, 18].map((h) => (
                <div key={h} style={{ width: 5 * s, height: h * s, borderRadius: 2, background: ink }} />
              ))}
            </div>
            {/* Batería */}
            <div
              style={{
                width: 40 * s,
                height: 19 * s,
                borderRadius: 6 * s,
                border: `${2.5 * s}px solid ${ink}`,
                padding: 2 * s,
                opacity: 0.95,
              }}
            >
              <div style={{ width: "78%", height: "100%", borderRadius: 3 * s, background: ink }} />
            </div>
          </div>
        </div>

        {/* Isla dinámica */}
        <div
          style={{
            position: "absolute",
            top: 14 * s,
            left: "50%",
            translate: "-50% 0",
            width: 170 * s,
            height: 46 * s,
            borderRadius: 30 * s,
            background: "#000",
            zIndex: 3,
          }}
        />

        <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>{children}</div>
      </div>
    </div>
  );
};
