/* Creación y actualización de registros con los campos comunes. Recibe la hora para ser determinista en los tests. */
import type { Base } from './tipos';

export function nuevo<T extends object>(campos: T, ahora: Date, id: string = crypto.randomUUID()): T & Base {
  const iso = ahora.toISOString();
  return { ...campos, id, creado: iso, actualizado: iso, borrado: false };
}

export function actualizar<T extends Base>(registro: T, cambios: Partial<Omit<T, keyof Base>>, ahora: Date): T {
  return { ...registro, ...cambios, actualizado: ahora.toISOString() };
}

export function borrar<T extends Base>(registro: T, ahora: Date): T {
  return { ...registro, borrado: true, actualizado: ahora.toISOString() };
}

export function vivos<T extends Base>(registros: readonly T[]): T[] {
  return registros.filter((r) => !r.borrado);
}
