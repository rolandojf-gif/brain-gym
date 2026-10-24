/* Ajustes y datos iniciales: plan semanal del brief y catálogo de fuentes (sólo metadatos). */
import { CORTE_POR_DEFECTO } from '../lib/dia';
import { nuevo } from './registro';
import type { Ajustes, Fuente, PlanSemanal } from './tipos';

export const ID_AJUSTES = 'ajustes';

/** L-X-V estudio, M-J lectura, repaso diario, calibración el domingo. Editable desde la app. */
export const PLAN_POR_DEFECTO: PlanSemanal = {
  0: ['estudio', 'repaso', 'concepto'],
  1: ['lectura', 'repaso', 'concepto'],
  2: ['estudio', 'repaso', 'concepto'],
  3: ['lectura', 'repaso', 'concepto'],
  4: ['estudio', 'repaso', 'concepto'],
  5: ['repaso', 'concepto'],
  6: ['repaso', 'calibracion', 'concepto'],
};

export function ajustesPorDefecto(ahora: Date): Ajustes {
  return nuevo({ planSemanal: PLAN_POR_DEFECTO, horaCorte: CORTE_POR_DEFECTO }, ahora, ID_AJUSTES);
}

/* Capítulos de Introduction to Probability (Blitzstein y Hwang, 2.ª ed.), el libro de Stat 110.
   El número de ejercicios por capítulo se deja sin rellenar: no está verificado y se puede añadir desde la app. */
const CAPITULOS_STAT110 = [
  'Probabilidad y conteo', 'Probabilidad condicionada', 'Variables aleatorias y sus distribuciones', 'Esperanza',
  'Variables aleatorias continuas', 'Momentos', 'Distribuciones conjuntas', 'Transformaciones', 'Esperanza condicionada',
  'Desigualdades y teoremas límite', 'Cadenas de Markov', 'Monte Carlo con cadenas de Markov', 'Procesos de Poisson',
];

export function fuentesIniciales(ahora: Date): Fuente[] {
  return [
    nuevo({
      titulo: 'Stat 110 · Introduction to Probability (Blitzstein y Hwang)',
      tipo: 'curso' as const,
      url: 'https://stat110.hsites.harvard.edu/',
      capitulos: CAPITULOS_STAT110.map((titulo, i) => ({ id: String(i + 1), titulo })),
    }, ahora, 'stat110'),
    nuevo({
      titulo: 'Think Bayes (Allen Downey)',
      tipo: 'libro' as const,
      url: 'https://allendowney.github.io/ThinkBayes2/',
      capitulos: [],
    }, ahora, 'thinkbayes'),
  ];
}
