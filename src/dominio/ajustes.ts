/* Ajustes y datos iniciales: plan semanal de sprints cognitivos y catálogo integrado de retos. */
import { CORTE_POR_DEFECTO } from '../lib/dia';
import { fuenteRetos } from './catalogo-retos';
import { nuevo } from './registro';
import type { Ajustes, Fuente, PlanSemanal } from './tipos';

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
