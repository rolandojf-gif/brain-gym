/* Fusión de registros entre dispositivos: gana el registro con `actualizado` mayor. Es conmutativa, asociativa e
   idempotente, así que da igual el orden en que lleguen los cambios o si llegan dos veces. */
import { COLECCIONES, coleccionesDeEsquema, type Base, type Coleccion, type Colecciones } from './tipos';

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

/* ── Lado servidor ────────────────────────────────────────────────────────
   El servidor guarda cada registro con el número de secuencia del momento en que cambió. Un dispositivo pide
   «lo que ha cambiado desde la secuencia N»: así no depende de que los relojes de los dispositivos coincidan. */

export interface Cambio {
  coleccion: Coleccion;
  registro: Base;
}

export interface EstadoServidor {
  seq: number;
  registros: Partial<Record<Coleccion, Record<string, { seq: number; registro: Base }>>>;
}

export interface PeticionSync {
  desde: number;
  cambios: Cambio[];
  /** Versión del esquema del dispositivo. Las apps v1 no la envían. */
  esquema?: number;
}

export interface RespuestaSync {
  seq: number;
  cambios: Cambio[];
}

export function estadoVacio(): EstadoServidor {
  return { seq: 0, registros: {} };
}

/** Aplica los cambios de un dispositivo y devuelve el nuevo estado y lo que ese dispositivo aún no tiene. */
export function aplicarCambios(estado: EstadoServidor, peticion: PeticionSync): { estado: EstadoServidor; respuesta: RespuestaSync; modificado: boolean } {
  let seq = estado.seq;
  const registros: EstadoServidor['registros'] = {};
  for (const c of COLECCIONES) {
    const actual = estado.registros[c];
    if (actual) registros[c] = { ...actual };
  }
  const aplicados = new Set<string>();
  const perdedores = new Set<string>();
  for (const { coleccion, registro } of peticion.cambios) {
    if (!COLECCIONES.includes(coleccion)) continue;
    const tabla = (registros[coleccion] ??= {});
    const previo = tabla[registro.id];
    const clave = `${coleccion}:${registro.id}`;
    if (previo && ganador(previo.registro, registro) === previo.registro) {
      // El servidor ya tiene esa versión o una más nueva: si es distinta, el dispositivo debe recibirla.
      if (JSON.stringify(previo.registro) !== JSON.stringify(registro)) perdedores.add(clave);
      continue;
    }
    tabla[registro.id] = { seq: ++seq, registro };
    aplicados.add(clave);
  }
  // Se devuelve lo cambiado desde `desde` y lo que ha ganado a un cambio enviado, salvo lo que el dispositivo
  // acaba de enviar y ha quedado (ya lo tiene).
  const cambios: Cambio[] = [];
  for (const c of coleccionesDeEsquema(peticion.esquema ?? 1)) {
    for (const { seq: s, registro } of Object.values(registros[c] ?? {})) {
      const clave = `${c}:${registro.id}`;
      if ((s > peticion.desde || perdedores.has(clave)) && !aplicados.has(clave)) cambios.push({ coleccion: c, registro });
    }
  }
  return { estado: { seq, registros }, respuesta: { seq, cambios }, modificado: seq !== estado.seq };
}
