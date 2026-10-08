import type React from "react";
import { COLORS, LAYOUT } from "../theme";
import { OnScreenText } from "./OnScreenText";

type TwoLineProps = {
  l1: string;
  l2?: string;
  /** Duración de la escena en frames (el titular sale 4 frames antes del final). */
  dur: number;
  /** Frame (local) en el que entra la 2.ª línea. */
  l2At?: number;
  light?: boolean;
  accent: string;
  fontSize?: number;
  top?: number;
};

/** Titular en dos líneas: la 1.ª en el color base y la 2.ª en el color de acento. */
export const TwoLine: React.FC<TwoLineProps> = ({ l1, l2, dur, l2At = 7, light = false, accent, fontSize = 92, top = LAYOUT.headlineTop }) => {
  const ink = light ? COLORS.ink : COLORS.white;
  const shadow = light ? "none" : undefined;
  return (
    <>
      <OnScreenText text={l1} ink={ink} shadow={shadow} fontSize={fontSize} top={top} outAt={dur - 4} />
      {l2 ? (
        <OnScreenText
          text={l2}
          ink={accent}
          shadow={shadow}
          fontSize={fontSize}
          top={top + Math.round(fontSize * 1.12)}
          at={l2At}
          outAt={dur - 4}
        />
      ) : null}
    </>
  );
};
