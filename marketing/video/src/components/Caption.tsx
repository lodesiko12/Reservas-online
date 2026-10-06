import type { Caption as CaptionToken } from "@remotion/captions";
import type React from "react";
import { useMemo } from "react";
import { interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { clamp } from "../lib/anim";
import { COLORS, FONT, LAYOUT } from "../theme";

type CaptionProps = {
  /** Palabras con tiempos absolutos (ms desde el inicio de la composición). */
  captions: CaptionToken[];
  /** Máximo de palabras por "página". */
  maxWords?: number;
  /** Máximo de caracteres por página. */
  maxChars?: number;
  /** Un silencio mayor que esto corta la página. */
  breakGapMs?: number;
  /** Tiempo que la página sigue visible tras la última palabra si no hay otra. */
  holdMs?: number;
  fontSize?: number;
  highlightColor?: string;
  /** Centro vertical en px. */
  centerY?: number;
  width?: number;
  style?: React.CSSProperties;
};

type Page = { tokens: CaptionToken[]; startMs: number; endMs: number };

const paginate = (
  captions: CaptionToken[],
  maxWords: number,
  maxChars: number,
  breakGapMs: number,
  holdMs: number,
): Page[] => {
  const pages: Page[] = [];
  let current: CaptionToken[] = [];
  const flush = () => {
    if (current.length) pages.push({ tokens: current, startMs: current[0].startMs, endMs: 0 });
    current = [];
  };
  captions.forEach((c, i) => {
    const prev = captions[i - 1];
    const chars = current.reduce((n, t) => n + t.text.length, 0) + c.text.length;
    if (
      current.length > 0 &&
      (current.length >= maxWords || chars > maxChars || (prev && c.startMs - prev.endMs > breakGapMs))
    ) {
      flush();
    }
    current.push(c);
    if (c.pageBreakAfter) flush();
  });
  flush();
  pages.forEach((p, i) => {
    const last = p.tokens[p.tokens.length - 1];
    const next = pages[i + 1];
    p.endMs = Math.min(last.endMs + holdMs, next ? next.startMs : Infinity);
  });
  return pages;
};

/**
 * Subtítulos estilo TikTok: páginas de 1-3 palabras, grandes, con la palabra
 * que se está diciendo resaltada. Los tiempos salen de la locución (voice.json).
 */
export const Caption: React.FC<CaptionProps> = ({
  captions,
  maxWords = 3,
  maxChars = 18,
  breakGapMs = 260,
  holdMs = 350,
  fontSize = 78,
  highlightColor = COLORS.captionHighlight,
  centerY = LAYOUT.captionCenterY,
  width = 940,
  style,
}) => {
  const frame = useCurrentFrame();
  const { fps, width: videoWidth } = useVideoConfig();
  const pages = useMemo(
    () => paginate(captions, maxWords, maxChars, breakGapMs, holdMs),
    [captions, maxWords, maxChars, breakGapMs, holdMs],
  );

  const ms = (frame / fps) * 1000;
  const page = pages.find((p) => ms >= p.startMs && ms < p.endMs);
  if (!page) return null;

  const enterFrame = (page.startMs / 1000) * fps;

  return (
    <div
      style={{
        position: "absolute",
        left: (videoWidth - width) / 2,
        top: centerY,
        width,
        translate: "0 -50%",
        textAlign: "center",
        fontFamily: FONT,
        fontWeight: 900,
        fontSize,
        lineHeight: 1.12,
        color: COLORS.white,
        scale: interpolate(frame, [enterFrame, enterFrame + 5], [0.86, 1], clamp),
        ...style,
      }}
    >
      {page.tokens.map((t, i) => {
        const active = ms >= t.startMs && ms < (page.tokens[i + 1]?.startMs ?? page.endMs);
        return (
          <span
            key={i}
            style={{
              whiteSpace: "pre",
              color: active ? highlightColor : COLORS.white,
              WebkitTextStroke: "14px #000",
              paintOrder: "stroke fill",
              textShadow: "0 6px 18px rgba(0,0,0,0.55)",
            }}
          >
            {t.text}
          </span>
        );
      })}
    </div>
  );
};
