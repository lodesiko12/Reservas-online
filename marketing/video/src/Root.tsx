import { Composition, Folder } from "remotion";
import { TIMELINE as V01, V01MesaVacia } from "./videos/v01-mesa-vacia/V01MesaVacia";

export const RemotionRoot: React.FC = () => {
  return (
    <Folder name="TikTok">
      {/* Duración = locución real (voice.json) + márgenes de cada escena */}
      <Composition
        id="V01-MesaVacia"
        component={V01MesaVacia}
        durationInFrames={V01.durationInFrames}
        fps={30}
        width={1080}
        height={1920}
      />
    </Folder>
  );
};
