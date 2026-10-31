/* Brier y curva de calibración: de las predicciones resueltas (las anuladas no cuentan) y de la confianza
   declarada en los retos. */
import { ID_FUENTE_RETOS, intentosContables, type Reto } from './catalogo-retos';
import type { Intento, Prediccion } from './tipos';

export interface Resuelta {
  probabilidad: number;
  ocurrio: boolean;
}

export function resueltas(predicciones: readonly Prediccion[]): Resuelta[] {
  return predicciones.flatMap((p) =>
    !p.borrado && p.resolucion && p.resolucion.resultado !== 'anulada'
      ? [{ probabilidad: p.probabilidad, ocurrio: p.resolucion.resultado === 'si' }]
      : [],
  );
}

/** Puntuación de Brier: media de (p − resultado)². 0 es perfecto; 0,25 es lo que da decir siempre 50 %. */
export function brier(rs: readonly Resuelta[]): number | null {
  if (rs.length === 0) return null;
  return rs.reduce((s, r) => s + (r.probabilidad - (r.ocurrio ? 1 : 0)) ** 2, 0) / rs.length;
}

export interface Tramo {
  desde: number;
  hasta: number;
  n: number;
  /** Probabilidad media asignada en el tramo. */
  media: number | null;
  /** Frecuencia observada de «sí» en el tramo. */
  frecuencia: number | null;
}

/** Curva de calibración por tramos iguales de probabilidad (por defecto, 10 tramos de 10 puntos). */
export function curva(rs: readonly Resuelta[], tramos = 10): Tramo[] {
  const salida: Tramo[] = Array.from({ length: tramos }, (_, i) => ({
    desde: i / tramos, hasta: (i + 1) / tramos, n: 0, media: null, frecuencia: null,
  }));
  const sumas = salida.map(() => ({ p: 0, si: 0 }));
  for (const r of rs) {
    const i = Math.min(tramos - 1, Math.floor(r.probabilidad * tramos));
    const t = salida[i], s = sumas[i];
    if (!t || !s) continue;
    t.n++;
    s.p += r.probabilidad;
    if (r.ocurrio) s.si++;
  }
  salida.forEach((t, i) => {
    const s = sumas[i];
    if (t.n > 0 && s) {
      t.media = s.p / t.n;
      t.frecuencia = s.si / t.n;
    }
  });
  return salida;
}

/** Predicciones vivas sin resolver cuya fecha ya ha pasado (por día lógico, AAAA-MM-DD). */
export function porResolver(predicciones: readonly Prediccion[], hoy: string): Prediccion[] {
  return predicciones
    .filter((p) => !p.borrado && !p.resolucion && p.venceEl.slice(0, 10) <= hoy)
    .sort((a, b) => a.venceEl.localeCompare(b.venceEl));
}

/** Brier por categoría, de más a menos predicciones resueltas. */
export function brierPorCategoria(predicciones: readonly Prediccion[]): { categoria: string; n: number; brier: number | null }[] {
  const grupos = new Map<string, Prediccion[]>();
  for (const p of predicciones) {
    const c = p.categoria || 'Sin categoría';
    grupos.set(c, [...(grupos.get(c) ?? []), p]);
  }
  return [...grupos.entries()]
    .map(([categoria, ps]) => {
      const rs = resueltas(ps);
      return { categoria, n: rs.length, brier: brier(rs) };
    })
    .filter((g) => g.n > 0)
    .sort((a, b) => b.n - a.n || a.categoria.localeCompare(b.categoria));
}

/** Niveles de confianza que ofrece un reto. Con cuatro opciones el azar ya da un 25 %, así que el nivel bajo es
    «casi a ciegas»; un mínimo más alto obligaría a declarar exceso de confianza cada vez que dudas. */
export const NIVELES_CONFIANZA = [0.3, 0.6, 0.9] as const;

/**
 * Retos con confianza declarada, como predicciones resueltas. Sólo cuenta el primer intento de cada reto: en un
 * reintento ya conoces la solución. Los de debate no tienen acierto posible. El acierto es la jugada inicial
 * correcta, que es justo el estado «sin ayuda» (ver `estadoAutomatico`).
 */
export function resueltasDeRetos(intentos: readonly Intento[], retos: readonly Reto[]): Resuelta[] {
  const vivos = intentosContables(intentos.filter((i) => !i.borrado && i.fuenteId === ID_FUENTE_RETOS), retos)
    .sort((a, b) => a.creado.localeCompare(b.creado));
  const vistos = new Set<string>();
  const salida: Resuelta[] = [];
  for (const i of vivos) {
    if (vistos.has(i.ejercicio)) continue;
    vistos.add(i.ejercicio);
    const c = i.confianza;
    if (typeof c === 'number' && Number.isFinite(c) && c >= 0 && c <= 1) {
      salida.push({ probabilidad: c, ocurrio: i.estado === 'sin_ayuda' });
    }
  }
  return salida;
}

/** Se pide confianza sólo si el intento va a contar: reto con respuesta correcta y sin intentos previos. */
export function pideConfianza(reto: Pick<Reto, 'id' | 'debate'>, intentos: readonly Intento[]): boolean {
  return !reto.debate && !intentos.some((i) => !i.borrado && i.fuenteId === ID_FUENTE_RETOS && i.ejercicio === reto.id);
}

export interface CalibracionRetos {
  n: number;
  brier: number | null;
  /** Brier de decir siempre tu propia tasa de acierto, h(1 − h). Quedar por debajo significa que tu confianza
      distingue los retos que sabes de los que no. */
  referencia: number | null;
  confianzaMedia: number | null;
  tasaAcierto: number | null;
  /** Confianza media menos tasa de acierto: positivo, te pasas de confiado; negativo, te quedas corto. */
  sesgo: number | null;
  /** Dos errores típicos del sesgo si estuvieras bien calibrado (cada acierto, Bernoulli con tu confianza).
      Un sesgo dentro de ±margen es compatible con el azar. */
  margen: number | null;
  niveles: { confianza: number; n: number; aciertos: number }[];
}

export function calibracionRetos(intentos: readonly Intento[], retos: readonly Reto[]): CalibracionRetos {
  const rs = resueltasDeRetos(intentos, retos);
  const n = rs.length;
  const grupos = new Map<number, { n: number; aciertos: number }>();
  for (const r of rs) {
    const g = grupos.get(r.probabilidad) ?? { n: 0, aciertos: 0 };
    g.n++;
    if (r.ocurrio) g.aciertos++;
    grupos.set(r.probabilidad, g);
  }
  const niveles = [...grupos.entries()].map(([confianza, g]) => ({ confianza, ...g })).sort((a, b) => a.confianza - b.confianza);
  if (n === 0) {
    return { n, brier: null, referencia: null, confianzaMedia: null, tasaAcierto: null, sesgo: null, margen: null, niveles };
  }
  const confianzaMedia = rs.reduce((s, r) => s + r.probabilidad, 0) / n;
  const tasaAcierto = rs.filter((r) => r.ocurrio).length / n;
  const varianza = rs.reduce((s, r) => s + r.probabilidad * (1 - r.probabilidad), 0);
  return {
    n,
    brier: brier(rs),
    referencia: tasaAcierto * (1 - tasaAcierto),
    confianzaMedia,
    tasaAcierto,
    sesgo: confianzaMedia - tasaAcierto,
    margen: (2 * Math.sqrt(varianza)) / n,
    niveles,
  };
}
