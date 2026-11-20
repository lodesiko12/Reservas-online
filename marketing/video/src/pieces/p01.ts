import type {PieceData} from '../types';

// P01 · Reservan y no aparecen (hostelería). Los textos hablados son los de piezas/p01-reservan-y-no-vienen/guion.json.
export const p01: PieceData = {
  id: 'p01',
  carpeta: 'p01',
  frases: [
    {
      id: 's1',
      texto: '¿Te ha pasado que reservan una mesa y luego no aparecen?',
      visual: 'noshow',
      tono: 'oscuro',
      bloques: [
        ['¿Te ha pasado que', 'reservan una mesa'],
        ['y luego', 'no aparecen?'],
      ],
    },
    {
      id: 's2',
      texto: 'Ese hueco ya no lo recuperas.',
      visual: 'hueco',
      tono: 'oscuro',
      bloques: [['Ese hueco', 'ya no lo recuperas']],
    },
    {
      id: 's3',
      texto: 'Con Turnigo, tus clientes reservan solitos,',
      visual: 'widget',
      tono: 'claro',
      bloques: [
        ['Con Turnigo,', 'tus clientes'],
        ['reservan', 'solitos'],
      ],
    },
    {
      id: 's4',
      texto: 'y tú ves la sala en directo.',
      visual: 'plano',
      tono: 'claro',
      bloques: [['y tú ves', 'la sala en directo']],
    },
    {
      id: 's5',
      texto: 'Se acabó el lío del WhatsApp.',
      visual: 'chat',
      tono: 'claro',
      bloques: [['Se acabó el lío', 'del WhatsApp']],
    },
    {
      id: 's6',
      texto: 'Comenta demo y te lo enseño.',
      visual: 'cierre',
      tono: 'marca',
      bloques: [],
    },
  ],
};
