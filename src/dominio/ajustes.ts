/* Ajustes y datos iniciales: plan semanal de sprints cognitivos, catálogo integrado de retos y 12 lecturas semilla. */
import { CORTE_POR_DEFECTO } from '../lib/dia';
import { fuenteRetos } from './catalogo-retos';
import { nuevo } from './registro';
import type { Ajustes, Fuente, Lectura, PlanSemanal } from './tipos';

export const ID_AJUSTES = 'ajustes';

/** L-X-V retos estratégicos, M-J lectura 3x1, repaso y modelo mental a diario. Editable desde la app. */
export const PLAN_POR_DEFECTO: PlanSemanal = {
  0: ['estudio', 'repaso', 'concepto'],
  1: ['lectura', 'repaso', 'concepto'],
  2: ['estudio', 'repaso', 'concepto'],
  3: ['lectura', 'repaso', 'concepto'],
  4: ['estudio', 'repaso', 'concepto'],
  5: ['repaso', 'concepto'],
  6: ['repaso', 'concepto'],
};

export function ajustesPorDefecto(ahora: Date): Ajustes {
  return nuevo({ planSemanal: PLAN_POR_DEFECTO, horaCorte: CORTE_POR_DEFECTO }, ahora, ID_AJUSTES);
}

export function fuentesIniciales(ahora: Date): Fuente[] {
  return [fuenteRetos(ahora)];
}

export interface SemillaLectura {
  id: string;
  titulo: string;
  medio: string;
  tema: string;
  url: string;
}

export const LECTURAS_SEMILLA: readonly SemillaLectura[] = [
  {
    id: 'lectura-semilla-01',
    titulo: 'Meditations on Moloch',
    medio: 'Astral Codex Ten',
    tema: 'Teoría de Juegos y Trampas Multipolares',
    url: 'https://slatestarcodex.com/2014/07/30/meditations-on-moloch/',
  },
  {
    id: 'lectura-semilla-02',
    titulo: 'The Strategy of Conflict: Schelling Points & Credible Commitment',
    medio: 'LessWrong / Harvard',
    tema: 'Compromiso Estratégico y Puntos Focales',
    url: 'https://www.lesswrong.com/tag/schelling-point',
  },
  {
    id: 'lectura-semilla-03',
    titulo: 'The Evolution of Trust (Dilema del Prisionero Iterado)',
    medio: 'Nicky Case',
    tema: 'Cooperación, Reciprocidad y Horizonte Temporal',
    url: 'https://ncase.me/trust/',
  },
  {
    id: 'lectura-semilla-04',
    titulo: "Goodhart's Law: When a Measure Becomes a Target",
    medio: 'Commoncog',
    tema: 'Diseño de Incentivos y Corrupción de Métricas',
    url: 'https://commoncog.com/goodharts-law-not-useful/',
  },
  {
    id: 'lectura-semilla-05',
    titulo: 'The Market for "Lemons": Quality Uncertainty and the Market Mechanism',
    medio: 'Quarterly Journal of Economics',
    tema: 'Selección Adversa y Asimetría Informativa',
    url: 'https://en.wikipedia.org/wiki/The_Market_for_Lemons',
  },
  {
    id: 'lectura-semilla-06',
    titulo: 'A Big Little Idea Called Legibility (Seeing Like a State)',
    medio: 'Ribbonfarm',
    tema: 'Sistemas Complejos y Falacia de McNamara',
    url: 'https://www.ribbonfarm.com/2010/07/26/a-big-little-idea-called-legibility/',
  },
  {
    id: 'lectura-semilla-07',
    titulo: 'The Abilene Paradox: The Management of Agreement',
    medio: 'Organizational Dynamics',
    tema: 'Paradojas de Decisión y Consenso Falso',
    url: 'https://en.wikipedia.org/wiki/Abilene_paradox',
  },
  {
    id: 'lectura-semilla-08',
    titulo: "Braess's Paradox: How Adding Roads Slows Down Traffic",
    medio: 'Quanta Magazine',
    tema: 'Paradojas en Redes y Equilibrios Egoístas',
    url: 'https://www.quantamagazine.org/braess-paradox-shows-how-extra-roads-slow-traffic-20220316/',
  },
  {
    id: 'lectura-semilla-09',
    titulo: "Newcomb's Problem and Causal vs. Evidential Decision Theory",
    medio: 'Stanford Encyclopedia of Philosophy',
    tema: 'Paradojas Lógicas y Precompromiso',
    url: 'https://plato.stanford.edu/entries/decision-causal/',
  },
  {
    id: 'lectura-semilla-10',
    titulo: "Chesterton's Fence: A Lesson in Second-Order Thinking",
    medio: 'Farnam Street',
    tema: 'Pensamiento de Segundo Orden y Sistemas Heredados',
    url: 'https://fs.blog/chestertons-fence/',
  },
  {
    id: 'lectura-semilla-11',
    titulo: 'Survivorship Bias: Abraham Wald and the Missing Bullet Holes',
    medio: 'Farnam Street',
    tema: 'Sesgo de Supervivencia y Datos Ausentes',
    url: 'https://fs.blog/survivorship-bias/',
  },
  {
    id: 'lectura-semilla-12',
    titulo: 'Action Bias: Why We Prefer Doing Something to Doing Nothing',
    medio: 'The Decision Lab',
    tema: 'Sesgo de Acción y Asimetría de Omisión',
    url: 'https://thedecisionlab.com/biases/action-bias',
  },
];

export function lecturasIniciales(ahora: Date): Lectura[] {
  return LECTURAS_SEMILLA.map((s, idx) =>
    nuevo(
      {
        url: s.url,
        titulo: s.titulo,
        medio: s.medio,
        tema: s.tema,
        estado: 'pendiente' as const,
      },
      new Date(ahora.getTime() + idx),
      s.id,
    ),
  );
}
