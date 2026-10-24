/* Fusión de registros entre dispositivos: gana el registro con `actualizado` mayor. Es conmutativa, asociativa e
   idempotente, así que da igual el orden en que lleguen los cambios o si llegan dos veces. */
import { COLECCIONES, type Base, type Colecciones } from './tipos';

export function ganador<T extends Base>(a: T, b: T): T {
  if (a.actualizado !== b.actualizado) return a.actualizado > b.actualizado ? a : b;
  // Empate exacto de fecha: un criterio determinista para que los dos dispositivos elijan el mismo.
  return JSON.stringify(a) >= JSON.stringify(b) ? a : b;
}

export function fusionarColeccion<T extends Base>(a: readonly T[], b: readonly T[]): T[] {
  const porId = new Map<string, T>();
  for (const r of [...a, ...b]) {
    const previo = porId.get(r.id);
    porId.set(r.id, previo ? ganador(previo, r) : r);
  }
  return [...porId.values()].sort((x, y) => x.id.localeCompare(y.id));
}

export function fusionar(a: Colecciones, b: Colecciones): Colecciones {
  return Object.fromEntries(COLECCIONES.map((c) => [c, fusionarColeccion<Base>(a[c], b[c])])) as unknown as Colecciones;
}
