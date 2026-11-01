/* Dilema del prisionero espacial (Nowak y May, 1992), la animación de Hoy. Cada celda juega una ronda contra sus
   ocho vecinas y contra sí misma, y en la siguiente generación copia la estrategia de la celda que más ganó en su
   vecindario (ella incluida). Pagos: cooperar contra quien coopera da 1, traicionar a quien coopera da b (la
   tentación) y todo lo demás da 0. Con 1,8 < b < 2 cooperadores y traidores conviven en un caos que no se apaga.
   La rejilla es un toro: los bordes se tocan, así que no hay celdas privilegiadas. */

export const COOPERA = 0;
export const TRAICIONA = 1;

export const TENTACION_POR_DEFECTO = 1.85;
export const TENTACION_MIN = 1.5;
export const TENTACION_MAX = 2.2;

export interface Rejilla {
  ancho: number;
  alto: number;
  /** COOPERA o TRAICIONA, fila a fila. */
  celdas: Uint8Array;
}

/** Rejilla con una proporción de traidores repartidos al azar, reproducible con la semilla (Park-Miller). */
export function rejillaAleatoria(ancho: number, alto: number, proporcion = 0.1, semilla = 1): Rejilla {
  const celdas = new Uint8Array(ancho * alto);
  let s = Math.max(1, Math.floor(Math.abs(semilla)) % 2147483647);
  for (let i = 0; i < celdas.length; i++) {
    s = (s * 16807) % 2147483647;
    celdas[i] = s / 2147483647 < proporcion ? TRAICIONA : COOPERA;
  }
  return { ancho, alto, celdas };
}

/** Lo que gana cada celda en esta ronda. */
export function pagos(r: Rejilla, b: number): Float64Array {
  const { ancho, alto, celdas } = r;
  const salida = new Float64Array(celdas.length);
  for (let y = 0; y < alto; y++) {
    for (let x = 0; x < ancho; x++) {
      const i = y * ancho + x;
      const pagoPorCooperador = celdas[i] === COOPERA ? 1 : b;
      let total = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (celdas[vecina(ancho, alto, x + dx, y + dy)] === COOPERA) total += pagoPorCooperador;
        }
      }
      salida[i] = total;
    }
  }
  return salida;
}

/** Siguiente generación. En caso de empate, la celda conserva su estrategia. */
export function pasoRejilla(r: Rejilla, b: number): Rejilla {
  const { ancho, alto, celdas } = r;
  const ganancia = pagos(r, b);
  const siguiente = new Uint8Array(celdas.length);
  for (let y = 0; y < alto; y++) {
    for (let x = 0; x < ancho; x++) {
      const i = y * ancho + x;
      let mejor = i;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const j = vecina(ancho, alto, x + dx, y + dy);
          if ((ganancia[j] ?? 0) > (ganancia[mejor] ?? 0)) mejor = j;
        }
      }
      siguiente[i] = celdas[mejor] ?? COOPERA;
    }
  }
  return { ancho, alto, celdas: siguiente };
}

/** Proporción de cooperadores, entre 0 y 1. */
export function proporcionCooperadores(r: Rejilla): number {
  let n = 0;
  for (const c of r.celdas) if (c === COOPERA) n++;
  return r.celdas.length ? n / r.celdas.length : 0;
}

function vecina(ancho: number, alto: number, x: number, y: number): number {
  return ((y + alto) % alto) * ancho + ((x + ancho) % ancho);
}
