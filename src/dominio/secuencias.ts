/* Secuencias: una tarea de vigilancia inspirada en el RVP de Cambridge (Sahakian y otros, 1989). Pasan dígitos del 2
   al 9 de uno en uno y hay que responder en cuanto se completa una de tres secuencias fijas. El ritmo se adapta: los
   aciertos seguidos lo aceleran y cada fallo lo frena.

   Es puro: el tiempo y el azar entran como argumentos, así que se prueba sin reloj ni DOM. La vista llama a
   `siguienteDigito` en cada paso, a `pulsar` en cada respuesta y a `cerrar` al acabar. */

export const OBJETIVOS: readonly (readonly number[])[] = [
  [2, 4, 6],
  [3, 5, 7],
  [4, 6, 8],
];

export interface Config {
  /** Ritmo inicial: 600 ms son los 100 dígitos por minuto del estudio original. */
  intervaloInicial: number;
  intervaloMin: number;
  intervaloMax: number;
  /** Cuánto cambia el ritmo en cada ajuste. */
  paso: number;
  /** Aciertos seguidos que aceleran el ritmo un paso. */
  aciertosParaAcelerar: number;
  /** Tiempo para responder desde que aparece el último dígito de la secuencia. Una respuesta tarda 400–500 ms, así
      que suele llegar con el dígito siguiente ya en pantalla: sin ventana, casi todo acierto contaría como error. */
  ventana: number;
  /** Probabilidad de insertar una secuencia en cada dígito libre. Al azar puro saldrían menos de 2 por cada 100
      dígitos (3 secuencias entre 8³ combinaciones); con 0,105 salen unas 8. */
  probObjetivo: number;
  /** Duración de una partida. */
  duracion: number;
}

export const CONFIG: Config = {
  intervaloInicial: 600,
  intervaloMin: 350,
  intervaloMax: 900,
  paso: 50,
  aciertosParaAcelerar: 5,
  ventana: 1500,
  probObjetivo: 0.105,
  duracion: 120_000,
};

/** Una secuencia que acaba de completarse y espera respuesta. */
interface Objetivo {
  /** Momento en que apareció su último dígito. */
  t: number;
  respondido: boolean;
}

export interface Partida {
  config: Config;
  inicio: number;
  intervalo: number;
  digitos: number[];
  /** Dígitos ya decididos que faltan por mostrar (los de una secuencia insertada). */
  cola: number[];
  abiertos: Objetivo[];
  racha: number;
  aciertos: number;
  omisiones: number;
  falsosPositivos: number;
  /** Tiempos de reacción de los aciertos, en ms. */
  reacciones: number[];
  intervaloMinAlcanzado: number;
  terminada: boolean;
}

export interface Resumen {
  aciertos: number;
  omisiones: number;
  falsosPositivos: number;
  objetivos: number;
  digitos: number;
  /** Mediana del tiempo de reacción en ms; null si no hubo aciertos. */
  reaccionMediana: number | null;
  intervaloFinal: number;
  intervaloMin: number;
}

export function nuevaPartida(inicio: number, config: Config = CONFIG): Partida {
  return {
    config,
    inicio,
    intervalo: config.intervaloInicial,
    digitos: [],
    cola: [],
    abiertos: [],
    racha: 0,
    aciertos: 0,
    omisiones: 0,
    falsosPositivos: 0,
    reacciones: [],
    intervaloMinAlcanzado: config.intervaloInicial,
    terminada: false,
  };
}

export function esObjetivo(ultimos: readonly number[]): boolean {
  if (ultimos.length < 3) return false;
  const [a, b, c] = ultimos.slice(-3);
  return OBJETIVOS.some((o) => o[0] === a && o[1] === b && o[2] === c);
}

function ajustar(p: Partida, delta: number): void {
  const { intervaloMin, intervaloMax } = p.config;
  p.intervalo = Math.min(intervaloMax, Math.max(intervaloMin, p.intervalo + delta));
  p.intervaloMinAlcanzado = Math.min(p.intervaloMinAlcanzado, p.intervalo);
}

function fallo(p: Partida): void {
  p.racha = 0;
  ajustar(p, p.config.paso);
}

/** Las secuencias cuya ventana ya pasó sin respuesta cuentan como omisiones. */
function caducar(p: Partida, t: number): void {
  const vivos: Objetivo[] = [];
  for (const o of p.abiertos) {
    if (o.respondido) continue;
    if (t - o.t > p.config.ventana) {
      p.omisiones++;
      fallo(p);
    } else {
      vivos.push(o);
    }
  }
  p.abiertos = vivos;
}

/** Elige, muestra y devuelve el siguiente dígito. `azar` devuelve un número en [0, 1). */
export function siguienteDigito(p: Partida, t: number, azar: () => number = Math.random): number {
  caducar(p, t);
  if (p.cola.length === 0 && azar() < p.config.probObjetivo) {
    const o = OBJETIVOS[Math.floor(azar() * OBJETIVOS.length)];
    if (o) p.cola.push(...o);
  }
  const d = p.cola.shift() ?? 2 + Math.floor(azar() * 8);
  p.digitos.push(d);
  // También cuentan las secuencias que salen solas al azar o encadenadas (2-4-6-8 son dos).
  if (esObjetivo(p.digitos)) p.abiertos.push({ t, respondido: false });
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
    fallo(p);
    return { tipo: 'falso-positivo' };
  }
  o.respondido = true;
  const reaccion = t - o.t;
  p.aciertos++;
  p.reacciones.push(reaccion);
  p.racha++;
  if (p.racha % p.config.aciertosParaAcelerar === 0) ajustar(p, -p.config.paso);
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
  return {
    aciertos: p.aciertos,
    omisiones: p.omisiones,
    falsosPositivos: p.falsosPositivos,
    objetivos: p.aciertos + p.omisiones,
    digitos: p.digitos.length,
    reaccionMediana: mediana(p.reacciones),
    intervaloFinal: p.intervalo,
    intervaloMin: p.intervaloMinAlcanzado,
  };
}

export function mediana(xs: readonly number[]): number | null {
  if (xs.length === 0) return null;
  const o = [...xs].sort((a, b) => a - b);
  const m = Math.floor(o.length / 2);
  return o.length % 2 ? (o[m] ?? null) : ((o[m - 1] ?? 0) + (o[m] ?? 0)) / 2;
}
