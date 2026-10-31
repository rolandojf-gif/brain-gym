/* Registro de sesiones: una por día y actividad, con el tiempo dedicado. Ya no alimenta ninguna vista (salieron el plan
   semanal y el calendario), pero se sigue guardando: es dato del usuario y viaja en la exportación. */
import { nuevo } from './registro';
import type { Actividad, Sesion } from './tipos';

/* Una sesión por día y actividad, con id fijo: si se registra desde los dos dispositivos, la sincronización la funde
   en un solo registro en lugar de duplicarla. */
export function idSesion(dia: string, actividad: Actividad): string {
  return `sesion:${dia}:${actividad}`;
}

/** Marca una actividad como hecha hoy y le suma el tiempo dedicado (si se midió). */
export function registrarSesion(existente: Sesion | undefined, dia: string, actividad: Actividad, segundos: number, ahora: Date): Sesion {
  const iso = ahora.toISOString();
  if (existente) {
    return { ...existente, borrado: false, segundos: existente.segundos + segundos, fin: iso, actualizado: iso };
  }
  return nuevo({ dia, actividad, inicio: iso, fin: iso, segundos }, ahora, idSesion(dia, actividad));
}
