/* Temporizador opcional de una actividad. Vive en este dispositivo (localStorage) para sobrevivir a una recarga;
   al terminar, el tiempo se suma a la sesión del día, que sí se sincroniza. */
import type { Actividad } from '../dominio/tipos';

const CLAVE = 'bg.temporizador';

export interface Temporizador {
  actividad: Actividad;
  inicio: number;
}

export function actual(): Temporizador | null {
  try {
    const t = JSON.parse(localStorage.getItem(CLAVE) ?? 'null') as Temporizador | null;
    return t && typeof t.inicio === 'number' ? t : null;
  } catch {
    return null;
  }
}

export function iniciar(actividad: Actividad, ahora = Date.now()): void {
  try {
    localStorage.setItem(CLAVE, JSON.stringify({ actividad, inicio: ahora }));
  } catch {
    /* sin almacenamiento local no hay temporizador */
  }
}

/** Detiene el temporizador y devuelve la actividad y los segundos transcurridos. */
export function detener(ahora = Date.now()): { actividad: Actividad; segundos: number } | null {
  const t = actual();
  try {
    localStorage.removeItem(CLAVE);
  } catch {
    /* nada que limpiar */
  }
  return t ? { actividad: t.actividad, segundos: Math.max(0, Math.round((ahora - t.inicio) / 1000)) } : null;
}
