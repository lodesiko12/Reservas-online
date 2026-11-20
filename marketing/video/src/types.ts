export type Visual = 'noshow' | 'hueco' | 'widget' | 'plano' | 'chat' | 'cierre';

export type Sentence = {
  id: string;
  /** Texto hablado (el mismo que en guion.json). */
  texto: string;
  visual: Visual;
  /** Fondo de la escena: oscuro = problema, claro = solución. */
  tono: 'oscuro' | 'claro' | 'marca';
  /** Subtítulos: cada bloque = [línea 1, línea 2 en acento]. Máx. 6 palabras en total. */
  bloques: [string, string?][];
};

export type PieceData = {
  id: string;
  /** Carpeta dentro de public/ con los wav y durations.json */
  carpeta: string;
  frases: Sentence[];
};
