/* Envoltorio de ts-fsrs: convierte entre el `Card` de la librería (con Date) y el estado serializable del modelo. */
import { createEmptyCard, fsrs, type Card, type Grade } from 'ts-fsrs';
import { nuevo } from './registro';
import type { EstadoFsrs, Nota, Repaso, Tarjeta } from './tipos';

/* Retención objetivo del 90 % (la recomendada por FSRS). Sin «fuzz», para que la planificación sea reproducible. */
const planificador = fsrs({ request_retention: 0.9, enable_fuzz: false });

export function aEstado(card: Card): EstadoFsrs {
  const { due, last_review, ...resto } = card;
  return { ...resto, due: due.toISOString(), ...(last_review ? { last_review: last_review.toISOString() } : {}) };
}

export function aCard(estado: EstadoFsrs): Card {
  const { due, last_review, ...resto } = estado;
  return { ...resto, due: new Date(due), ...(last_review ? { last_review: new Date(last_review) } : {}) };
}

export function estadoInicial(ahora: Date): EstadoFsrs {
  return aEstado(createEmptyCard(ahora));
}

export function nuevaTarjeta(
  anverso: string,
  reverso: string,
  ahora: Date,
  origen?: Tarjeta['origen'],
): Tarjeta {
  return nuevo({ tipo: 'basica' as const, anverso, reverso, fsrs: estadoInicial(ahora), ...(origen ? { origen } : {}) }, ahora);
}

/** Aplica una nota a una tarjeta: devuelve la tarjeta replanificada y el registro inmutable del repaso. */
export function repasar(tarjeta: Tarjeta, nota: Nota, ahora: Date): { tarjeta: Tarjeta; repaso: Repaso } {
  const { card } = planificador.next(aCard(tarjeta.fsrs), ahora, nota as Grade);
  const iso = ahora.toISOString();
  return {
    tarjeta: { ...tarjeta, fsrs: aEstado(card), actualizado: iso },
    repaso: nuevo({ tarjetaId: tarjeta.id, nota, repasadoEl: iso, estadoPrevio: tarjeta.fsrs }, ahora),
  };
}

/** Tarjetas vivas cuya fecha de repaso ya ha llegado, las más atrasadas primero. */
export function vencidas(tarjetas: readonly Tarjeta[], ahora: Date): Tarjeta[] {
  const t = ahora.getTime();
  return tarjetas
    .filter((c) => !c.borrado && new Date(c.fsrs.due).getTime() <= t)
    .sort((a, b) => a.fsrs.due.localeCompare(b.fsrs.due));
}

/** Próximo intervalo de cada nota, para mostrarlo en los botones antes de responder. */
export function previsualizar(tarjeta: Tarjeta, ahora: Date): Record<Nota, string> {
  const vista = planificador.repeat(aCard(tarjeta.fsrs), ahora);
  const r = {} as Record<Nota, string>;
  for (const nota of [1, 2, 3, 4] as const) r[nota] = vista[nota as Grade].card.due.toISOString();
  return r;
}
