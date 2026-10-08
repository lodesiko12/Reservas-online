import { Composition, Folder } from "remotion";
import { P03SenalesReservas } from "./carousels/p03-senales-reservas/P03";
import { P03_SLIDES } from "./carousels/p03-senales-reservas/script";
import { P06QueEsTurnigo } from "./carousels/p06-que-es-turnigo/P06";
import { P06_SLIDES } from "./carousels/p06-que-es-turnigo/script";
import { P09ChecklistPuente } from "./carousels/p09-checklist-puente/P09";
import { P09_SLIDES } from "./carousels/p09-checklist-puente/script";
import { P12ConsultaSinPapeles } from "./carousels/p12-consulta-sin-papeles/P12";
import { P12_SLIDES } from "./carousels/p12-consulta-sin-papeles/script";
import { P01_DURATION, P01ReservoYNoVino } from "./videos/p01-reservo-y-no-vino/P01";
import { P02_DURATION, P02ReservaDeMadrugada } from "./videos/p02-reserva-de-madrugada/P02";
import { P05_DURATION, P05LibretaVsTurnigo } from "./videos/p05-libreta-vs-turnigo/P05";
import { P04_DURATION, P04PlanoEnVivo } from "./videos/p04-plano-en-vivo/P04";
import { P07_DURATION, P07PuenteDelPilar } from "./videos/p07-puente-del-pilar/P07";
import { P14_DURATION, P14ErroresLibreta } from "./videos/p14-errores-libreta/P14";
import { P13_DURATION, P13HazLaCuenta } from "./videos/p13-haz-la-cuenta/P13";
import { P11_DURATION, P11EntranSinReserva } from "./videos/p11-entran-sin-reserva/P11";
import { P10_DURATION, P10CuidasLaMente } from "./videos/p10-cuidas-la-mente/P10";
import { P08_DURATION, P08ListaDeEspera } from "./videos/p08-lista-de-espera/P08";
import { P15_DURATION, P15FestivoBloqueos } from "./videos/p15-festivo-bloqueos/P15";
import { P16_DURATION, P16AgendaPorColores } from "./videos/p16-agenda-por-colores/P16";
import { P17_DURATION, P17FiltroProfesional } from "./videos/p17-filtro-profesional/P17";
import { P18_DURATION, P18RecordatorioWhatsApp } from "./videos/p18-recordatorio-whatsapp/P18";
import { TIMELINE as V01, V01MesaVacia } from "./videos/v01-mesa-vacia/V01MesaVacia";

export const RemotionRoot: React.FC = () => {
  return (
    <>
    <Folder name="Carruseles">
      {/* 5 fotogramas = 5 diapositivas; exportar con `remotion still P03-SenalesReservas --frame N` */}
      <Composition
        id="P03-SenalesReservas"
        component={P03SenalesReservas}
        durationInFrames={P03_SLIDES}
        fps={30}
        width={1080}
        height={1920}
      />
      <Composition
        id="P06-QueEsTurnigo"
        component={P06QueEsTurnigo}
        durationInFrames={P06_SLIDES}
        fps={30}
        width={1080}
        height={1920}
      />
      <Composition
        id="P09-ChecklistPuente"
        component={P09ChecklistPuente}
        durationInFrames={P09_SLIDES}
        fps={30}
        width={1080}
        height={1920}
      />
      <Composition
        id="P12-ConsultaSinPapeles"
        component={P12ConsultaSinPapeles}
        durationInFrames={P12_SLIDES}
        fps={30}
        width={1080}
        height={1920}
      />
    </Folder>
    <Folder name="TikTok">
      {/* P01 sin voz: la duración sale de los beats (40 beats a 120 BPM = 20 s) */}
      <Composition
        id="P01-ReservoYNoVino"
        component={P01ReservoYNoVino}
        durationInFrames={P01_DURATION}
        fps={30}
        width={1080}
        height={1920}
      />
      <Composition
        id="P02-ReservaDeMadrugada"
        component={P02ReservaDeMadrugada}
        durationInFrames={P02_DURATION}
        fps={30}
        width={1080}
        height={1920}
      />
      <Composition
        id="P05-LibretaVsTurnigo"
        component={P05LibretaVsTurnigo}
        durationInFrames={P05_DURATION}
        fps={30}
        width={1080}
        height={1920}
      />
      {/* P04: 32 beats a 120 BPM = 16 s; drop en el beat 12 (pista por defecto) */}
      <Composition
        id="P04-PlanoEnVivo"
        component={P04PlanoEnVivo}
        durationInFrames={P04_DURATION}
        fps={30}
        width={1080}
        height={1920}
      />
      {/* P07: T4 texto cinético, 24 beats a 120 BPM = 12 s; drop (beat 12) en "¿Y los que no aparecen?" */}
      <Composition
        id="P07-PuenteDelPilar"
        component={P07PuenteDelPilar}
        durationInFrames={P07_DURATION}
        fps={30}
        width={1080}
        height={1920}
      />
      {/* P08: T9 chat, 32 beats a 120 BPM = 16 s; drop en el beat 4 (lista de espera) */}
      <Composition
        id="P08-ListaDeEspera"
        component={P08ListaDeEspera}
        durationInFrames={P08_DURATION}
        fps={30}
        width={1080}
        height={1920}
      />
      {/* P10: T4 texto cinético, 24 beats a 120 BPM = 12 s; drop (beat 12) = fondo claro con el panel Seguimiento */}
      <Composition
        id="P10-CuidasLaMente"
        component={P10CuidasLaMente}
        durationInFrames={P10_DURATION}
        fps={30}
        width={1080}
        height={1920}
      />
      {/* P15: T5 tour de toques, 32 beats a 120 BPM = 16 s; drop en el beat 4 (Bloqueos) */}
      <Composition
        id="P15-FestivoBloqueos"
        component={P15FestivoBloqueos}
        durationInFrames={P15_DURATION}
        fps={30}
        width={1080}
        height={1920}
      />
      {/* P11: T5 walk-ins, 32 beats a 120 BPM = 16 s; drop en el beat 12 (la cámara entra en la Mesa 3) */}
      <Composition
        id="P11-EntranSinReserva"
        component={P11EntranSinReserva}
        durationInFrames={P11_DURATION}
        fps={30}
        width={1080}
        height={1920}
      />
      {/* P13: T3 la cuenta, 32 beats a 120 BPM = 16 s; el total aterriza en el drop (beat 12) */}
      <Composition
        id="P13-HazLaCuenta"
        component={P13HazLaCuenta}
        durationInFrames={P13_DURATION}
        fps={30}
        width={1080}
        height={1920}
      />
      {/* P16: T2 VS, 32 beats a 120 BPM = 16 s; drop en el beat 4 (papel VS Turnigo) */}
      <Composition
        id="P16-AgendaPorColores"
        component={P16AgendaPorColores}
        durationInFrames={P16_DURATION}
        fps={30}
        width={1080}
        height={1920}
      />
      {/* P14: T6 lista numerada, 38 beats a 120 BPM = 19 s; drop en el beat 28 (pista TRACK_DROP28) */}
      <Composition
        id="P14-ErroresLibreta"
        component={P14ErroresLibreta}
        durationInFrames={P14_DURATION}
        fps={30}
        width={1080}
        height={1920}
      />
      {/* P17: T5 tour de toques, 32 beats a 120 BPM = 16 s; drop en el beat 12 (toque en "Paula") */}
      <Composition
        id="P17-FiltroProfesional"
        component={P17FiltroProfesional}
        durationInFrames={P17_DURATION}
        fps={30}
        width={1080}
        height={1920}
      />
      {/* P18: T9 chat, 32 beats a 120 BPM = 16 s; drop en el beat 4 (se abre el chat) */}
      <Composition
        id="P18-RecordatorioWhatsApp"
        component={P18RecordatorioWhatsApp}
        durationInFrames={P18_DURATION}
        fps={30}
        width={1080}
        height={1920}
      />
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
    </>
  );
};
