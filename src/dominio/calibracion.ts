/* Brier y curva de calibración de las predicciones resueltas. Las anuladas no cuentan. */
import type { Prediccion } from './tipos';

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
