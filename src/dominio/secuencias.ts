/* Secuencias: una tarea de vigilancia inspirada en el RVP de Cambridge (Sahakian y otros, 1989). Pasan dígitos del 2
   al 9 de uno en uno, a ritmo fijo, y hay que responder en cuanto se completa una de tres secuencias fijas. Sigue los
   parámetros del RVP: 100 dígitos por minuto, ventana de 1,8 s, unas 16 secuencias cada 2 minutos y A′ como medida.

   Es puro: el tiempo y el azar entran como argumentos, así que se prueba sin reloj ni DOM. La vista llama a
   `siguienteDigito` en cada paso, a `pulsar` en cada respuesta y a `cerrar` al acabar. */

export const OBJETIVOS: readonly (readonly number[])[] = [
  [2, 4, 6],
  [3, 5, 7],
  [4, 6, 8],
];

export interface Config {
  /** Tiempo entre dígitos, fijo toda la partida: 600 ms son los 100 dígitos por minuto del RVP. Un ritmo que se
      adaptara haría que dos partidas no fueran comparables. */
  intervalo: number;
  /** Tiempo para responder desde que aparece el último dígito de la secuencia (1,8 s en el RVP). Una respuesta tarda
      400–500 ms, así que suele llegar con el dígito siguiente ya en pantalla. */
  ventana: number;
  /** Probabilidad de insertar una secuencia en cada dígito libre. Al azar puro saldrían menos de 2 por cada 100
      dígitos (3 secuencias entre 8³ combinaciones); así salen unas 8, las 16 cada 2 minutos del RVP. */
  probObjetivo: number;
  /** Probabilidad de insertar un señuelo: los dos primeros dígitos de una secuencia y un tercero que no la cierra
      (2-4-7). Sin señuelos bastaría con reaccionar a cualquier arranque conocido. */
  probSenuelo: number;
  /** Duración de una partida. */
  duracion: number;
  /** En la práctica, tiempo desde el inicio durante el que los dígitos de una secuencia salen marcados. 0 = nunca. */
  pistasHasta: number;
}

export const CONFIG: Config = {
  intervalo: 600,
  ventana: 1800,
  probObjetivo: 0.105,
  probSenuelo: 0.05,
  duracion: 240_000,
  pistasHasta: 0,
};

/** Un minuto para coger el ritmo: la primera mitad con las secuencias marcadas, la segunda sin ayuda. */
export const CONFIG_PRACTICA: Config = { ...CONFIG, duracion: 60_000, pistasHasta: 30_000 };

/** Una secuencia que acaba de completarse y espera respuesta. */
interface Objetivo {
  /** Momento en que apareció su último dígito. */
  t: number;
  respondido: boolean;
  /** Sus tres dígitos, para poder decir cuál se escapó. */
  digitos: readonly number[];
}

export interface Partida {
  config: Config;
  inicio: number;
  digitos: number[];
  /** Dígitos ya decididos que faltan por mostrar (los de una secuencia o un señuelo insertados). */
  cola: number[];
  /** Los dígitos en cola son de una secuencia (no de un señuelo). */
  colaEsObjetivo: boolean;
  /** El último dígito mostrado pertenece a una secuencia insertada y toca marcarlo (sólo en la práctica). */
  pista: boolean;
  abiertos: Objetivo[];
  aciertos: number;
  omisiones: number;
  /** Las secuencias que se han escapado, en orden; la vista enseña la última si el usuario lo pide. */
  omitidas: (readonly number[])[];
  falsosPositivos: number;
  /** Tiempos de reacción de los aciertos, en ms. */
  reacciones: number[];
  terminada: boolean;
}

export interface Resumen {
  aciertos: number;
  omisiones: number;
  falsosPositivos: number;
  objetivos: number;
  digitos: number;
  /** Latencia media de los aciertos en ms; null si no hubo. */
  latenciaMedia: number | null;
  /** A′ (Grier, 1971): sensibilidad para distinguir secuencia de no secuencia. 0,5 es azar; 1, perfecto. Null sin objetivos. */
  aPrima: number | null;
  /** Falsas alarmas entre los dígitos que no cerraban secuencia. */
  tasaFalsasAlarmas: number | null;
}

export function nuevaPartida(inicio: number, config: Config = CONFIG): Partida {
  return {
    config,
    inicio,
    digitos: [],
    cola: [],
    colaEsObjetivo: false,
    pista: false,
    abiertos: [],
    aciertos: 0,
    omisiones: 0,
    omitidas: [],
    falsosPositivos: 0,
    reacciones: [],
    terminada: false,
  };
}

export function esObjetivo(ultimos: readonly number[]): boolean {
  if (ultimos.length < 3) return false;
  const [a, b, c] = ultimos.slice(-3);
  return OBJETIVOS.some((o) => o[0] === a && o[1] === b && o[2] === c);
}

/** Las secuencias cuya ventana ya pasó sin respuesta cuentan como omisiones. */
function caducar(p: Partida, t: number): void {
  const vivos: Objetivo[] = [];
  for (const o of p.abiertos) {
    if (o.respondido) continue;
    if (t - o.t > p.config.ventana) {
      p.omisiones++;
      p.omitidas.push(o.digitos);
    } else {
      vivos.push(o);
    }
  }
  p.abiertos = vivos;
}

/** Elige, muestra y devuelve el siguiente dígito. `azar` devuelve un número en [0, 1). */
export function siguienteDigito(p: Partida, t: number, azar: () => number = Math.random): number {
  caducar(p, t);
  const deCola = p.cola.length > 0;
  if (!deCola) {
    if (azar() < p.config.probObjetivo) {
      const o = OBJETIVOS[Math.floor(azar() * OBJETIVOS.length)];
      if (o) p.cola.push(...o);
      p.colaEsObjetivo = true;
    } else if (azar() < p.config.probSenuelo) {
      const o = OBJETIVOS[Math.floor(azar() * OBJETIVOS.length)];
      if (o) {
        // Un tercero distinto del que cerraría la secuencia: de los otros siete dígitos.
        const otros = [2, 3, 4, 5, 6, 7, 8, 9].filter((x) => x !== o[2]);
        p.cola.push(o[0] ?? 2, o[1] ?? 4, otros[Math.floor(azar() * otros.length)] ?? 9);
      }
      p.colaEsObjetivo = false;
    }
  }
  const insertado = p.cola.length > 0;
  const d = p.cola.shift() ?? 2 + Math.floor(azar() * 8);
  p.pista = insertado && p.colaEsObjetivo && t - p.inicio < p.config.pistasHasta;
  p.digitos.push(d);
  // También cuentan las secuencias que salen solas al azar o encadenadas (2-4-6-8 son dos).
  if (esObjetivo(p.digitos)) p.abiertos.push({ t, respondido: false, digitos: p.digitos.slice(-3) });
  return d;
}

export type Respuesta = { tipo: 'acierto'; reaccion: number } | { tipo: 'falso-positivo' };

/** Una pulsación: acierta si hay una secuencia completada dentro de la ventana y aún sin responder. */
export function pulsar(p: Partida, t: number): Respuesta {
  caducar(p, t);
  // La más antigua primero: si se encadenan dos, la primera pulsación responde a la primera.
  const o = p.abiertos.find((x) => !x.respondido && t >= x.t);
  if (!o) {
    p.falsosPositivos++;
    return { tipo: 'falso-positivo' };
  }
  o.respondido = true;
  const reaccion = t - o.t;
  p.aciertos++;
  p.reacciones.push(reaccion);
  return { tipo: 'acierto', reaccion };
}

/** Termina la partida. Una secuencia cuya ventana sigue abierta al acabar no cuenta: no hubo tiempo de responder. */
export function cerrar(p: Partida, t: number): Resumen {
  if (!p.terminada) {
    caducar(p, t);
    p.abiertos = [];
    p.terminada = true;
  }
  return resumen(p);
}

export function resumen(p: Partida): Resumen {
  const objetivos = p.aciertos + p.omisiones;
  const noObjetivos = p.digitos.length - objetivos;
  const h = objetivos > 0 ? p.aciertos / objetivos : null;
  const f = noObjetivos > 0 ? Math.min(1, p.falsosPositivos / noObjetivos) : null;
  return {
    aciertos: p.aciertos,
    omisiones: p.omisiones,
    falsosPositivos: p.falsosPositivos,
    objetivos,
    digitos: p.digitos.length,
    latenciaMedia: p.reacciones.length ? p.reacciones.reduce((a, b) => a + b, 0) / p.reacciones.length : null,
    aPrima: h === null || f === null ? null : aPrima(h, f),
    tasaFalsasAlarmas: f,
  };
}

/** A′ de Grier (1971) con la corrección para h < f. `h`: tasa de aciertos; `f`: tasa de falsas alarmas. */
export function aPrima(h: number, f: number): number {
  if (h === f) return 0.5;
  if (h > f) return 0.5 + ((h - f) * (1 + h - f)) / (4 * h * (1 - f));
  return 0.5 - ((f - h) * (1 + f - h)) / (4 * f * (1 - h));
}
