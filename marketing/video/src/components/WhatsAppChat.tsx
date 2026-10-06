import type React from "react";
import { interpolate, interpolateColors, useCurrentFrame, useVideoConfig } from "remotion";
import { clamp, pop } from "../lib/anim";
import { FONT } from "../theme";

export const WA = {
  header: "#008069",
  chatBg: "#EFE7DE",
  me: "#D9FDD3",
  them: "#FFFFFF",
  tickGrey: "#8696A0",
  tickBlue: "#53BDEB",
  meta: "#667781",
  text: "#111B21",
} as const;

// ───────────────────────────── Doble check ─────────────────────────────

export const DoubleCheck: React.FC<{ color: string; size?: number }> = ({ color, size = 26 }) => (
  <svg width={size * 1.45} height={size} viewBox="0 0 29 20" style={{ display: "block" }}>
    <path d="M1.5 10.5 L6.5 15.5 L16.5 4" fill="none" stroke={color} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" />
    <path d="M10.5 15.5 L12 15.5 L22.5 4" fill="none" stroke={color} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

// ───────────────────────────── Burbuja suelta ─────────────────────────────

export type BubbleTicks = "none" | "sent" | "read";

type WhatsAppBubbleProps = {
  from: "me" | "them";
  text: string;
  time?: string;
  /** Estado del doble check (solo en mensajes propios). `read` = azul. */
  ticks?: BubbleTicks;
  /** 0→1: progreso de leído (permite animar gris→azul). Prioritario sobre `ticks`. */
  readProgress?: number;
  /** 0→1 progreso de aparición ("pop"). */
  appear?: number;
  /** Escala tipográfica (1 = pensado para un móvil de 620 px de ancho). */
  scale?: number;
  maxWidth?: number | string;
  style?: React.CSSProperties;
};

/** Burbuja de WhatsApp. Úsala sola (flotando sobre otra escena) o dentro de `WhatsAppChat`. */
export const WhatsAppBubble: React.FC<WhatsAppBubbleProps> = ({
  from,
  text,
  time = "21:00",
  ticks = "none",
  readProgress,
  appear = 1,
  scale = 1,
  maxWidth = "82%",
  style,
}) => {
  const mine = from === "me";
  const read = readProgress ?? (ticks === "read" ? 1 : 0);
  const tickColor = interpolateColors(read, [0, 1], [WA.tickGrey, WA.tickBlue]);

  return (
    <div
      style={{
        alignSelf: mine ? "flex-end" : "flex-start",
        maxWidth,
        background: mine ? WA.me : WA.them,
        color: WA.text,
        borderRadius: 22 * scale,
        borderTopRightRadius: mine ? 6 * scale : 22 * scale,
        borderTopLeftRadius: mine ? 22 * scale : 6 * scale,
        padding: `${14 * scale}px ${20 * scale}px ${12 * scale}px`,
        fontFamily: FONT,
        fontSize: 31 * scale,
        lineHeight: 1.32,
        fontWeight: 500,
        boxShadow: "0 2px 3px rgba(11,20,26,0.13)",
        opacity: interpolate(appear, [0, 0.4], [0, 1], clamp),
        scale: interpolate(appear, [0, 1], [0.55, 1]),
        translate: `0px ${interpolate(appear, [0, 1], [24 * scale, 0])}px`,
        transformOrigin: mine ? "100% 100%" : "0% 100%",
        ...style,
      }}
    >
      {text}
      <span
        style={{
          float: "right",
          display: "inline-flex",
          alignItems: "center",
          gap: 6 * scale,
          marginLeft: 16 * scale,
          marginTop: 12 * scale,
          marginBottom: -4 * scale,
          fontSize: 20 * scale,
          color: WA.meta,
          fontWeight: 500,
        }}
      >
        {time}
        {mine && ticks !== "none" ? <DoubleCheck color={tickColor} size={18 * scale} /> : null}
      </span>
    </div>
  );
};

// ───────────────────────────── Chat completo ─────────────────────────────

export type ChatMessage = {
  from: "me" | "them";
  text: string;
  time?: string;
  /** Frame en el que aparece el mensaje. */
  at: number;
  /** Frame en el que el doble check pasa a azul (mensajes propios). */
  readAt?: number;
  /** Frame desde el que la cabecera muestra "escribiendo…" (mensajes del contacto). */
  typingFrom?: number;
};

type WhatsAppChatProps = {
  contactName: string;
  /** Subtítulo de la cabecera cuando nadie escribe. */
  contactStatus?: string;
  avatarColor?: string;
  messages: ChatMessage[];
  /** Etiqueta de día centrada sobre los mensajes. */
  dayLabel?: string;
  scale?: number;
  style?: React.CSSProperties;
};

/**
 * Conversación de WhatsApp animada por frames: cada mensaje entra con "pop"
 * en su `at`, y los propios pasan de doble check gris a azul en `readAt`.
 */
export const WhatsAppChat: React.FC<WhatsAppChatProps> = ({
  contactName,
  contactStatus = "en línea",
  avatarColor = "#7C8BA1",
  messages,
  dayLabel = "HOY",
  scale = 1,
  style,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const typing = messages.some(
    (m) => m.typingFrom !== undefined && frame >= m.typingFrom && frame < m.at,
  );

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        flexDirection: "column",
        background: WA.chatBg,
        fontFamily: FONT,
        ...style,
      }}
    >
      {/* Cabecera */}
      <div
        style={{
          background: WA.header,
          color: "#fff",
          display: "flex",
          alignItems: "center",
          gap: 18 * scale,
          padding: `${14 * scale}px ${26 * scale}px ${20 * scale}px`,
        }}
      >
        <svg width={22 * scale} height={36 * scale} viewBox="0 0 12 20">
          <path d="M10 2 L2 10 L10 18" fill="none" stroke="#fff" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <div
          style={{
            width: 72 * scale,
            height: 72 * scale,
            borderRadius: "50%",
            background: avatarColor,
            display: "grid",
            placeItems: "center",
            fontSize: 34 * scale,
            fontWeight: 700,
          }}
        >
          {contactName.charAt(0)}
        </div>
        <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.15 }}>
          <span style={{ fontSize: 33 * scale, fontWeight: 700 }}>{contactName}</span>
          <span style={{ fontSize: 23 * scale, opacity: 0.85, fontWeight: 500 }}>
            {typing ? "escribiendo…" : contactStatus}
          </span>
        </div>
      </div>

      {/* Mensajes */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          gap: 14 * scale,
          padding: `${22 * scale}px ${22 * scale}px`,
        }}
      >
        <div
          style={{
            alignSelf: "center",
            background: "#FFFFFF",
            color: WA.meta,
            fontSize: 21 * scale,
            fontWeight: 600,
            padding: `${6 * scale}px ${18 * scale}px`,
            borderRadius: 12 * scale,
            marginBottom: 6 * scale,
            boxShadow: "0 1px 1px rgba(11,20,26,0.08)",
          }}
        >
          {dayLabel}
        </div>
        {messages
          .filter((m) => frame >= m.at)
          .map((m, i) => (
            <WhatsAppBubble
              key={i}
              from={m.from}
              text={m.text}
              time={m.time}
              scale={scale}
              ticks={m.from === "me" ? "sent" : "none"}
              readProgress={
                m.readAt === undefined ? 0 : interpolate(frame, [m.readAt, m.readAt + 6], [0, 1], clamp)
              }
              appear={pop(frame, fps, m.at)}
            />
          ))}
      </div>
    </div>
  );
};
