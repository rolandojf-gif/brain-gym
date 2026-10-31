/* Migraciones del modelo de datos. Una migración es una función pura de la versión n a la n+1 sobre la forma de la
   exportación JSON. Se usan al abrir la base de datos y al importar, así que una exportación antigua siempre se puede
   importar. Nunca se edita una migración ya publicada: se añade otra. */
import { COLECCIONES, ESQUEMA_VERSION, type Colecciones, type Exportacion } from './tipos';

/** Datos de una versión anterior: forma de la exportación, colecciones sin tipar. */
export interface DatosVersionados {
  app: 'brain-gym';
  esquema: number;
  exportadoEl: string;
  datos: Record<string, unknown[]>;
}

export type Migracion = (d: DatosVersionados) => DatosVersionados;

/** Clave: versión de origen. */
export const MIGRACIONES: Readonly<Record<number, Migracion>> = {
  // v1 → v2: nace la colección `retos` (retos generados por IA). Los registros existentes no cambian.
  1: (d) => ({ ...d, esquema: 2, datos: { ...d.datos, retos: d.datos.retos ?? [] } }),
};

export class ErrorDeDatos extends Error {
  override name = 'ErrorDeDatos';
}

/** Valida una exportación (de cualquier versión conocida), la migra a `objetivo` y completa las colecciones que falten. */
export function migrar(entrada: unknown, migraciones: Readonly<Record<number, Migracion>> = MIGRACIONES, objetivo = ESQUEMA_VERSION): Exportacion {
  let d = validarEnvoltorio(entrada, objetivo);
  while (d.esquema < objetivo) {
    const m = migraciones[d.esquema];
    if (!m) throw new ErrorDeDatos(`Falta la migración de la versión ${d.esquema} a la ${d.esquema + 1}.`);
    const siguiente = m(d);
    if (siguiente.esquema !== d.esquema + 1) throw new ErrorDeDatos(`La migración desde la versión ${d.esquema} no avanza a la ${d.esquema + 1}.`);
    d = siguiente;
  }
  return { app: 'brain-gym', esquema: objetivo, exportadoEl: d.exportadoEl, datos: completar(d.datos) };
}

function validarEnvoltorio(entrada: unknown, objetivo: number): DatosVersionados {
  if (!esObjeto(entrada) || entrada.app !== 'brain-gym') throw new ErrorDeDatos('El archivo no es una exportación de Brain Gym.');
  const { esquema, exportadoEl, datos } = entrada;
  if (typeof esquema !== 'number' || !Number.isInteger(esquema) || esquema < 1) throw new ErrorDeDatos('La exportación no indica una versión de esquema válida.');
  if (esquema > objetivo) throw new ErrorDeDatos(`La exportación es de una versión más nueva (${esquema}) que esta app (${objetivo}). Actualiza la app antes de importarla.`);
  if (!esObjeto(datos)) throw new ErrorDeDatos('La exportación no contiene datos.');
  const colecciones: Record<string, unknown[]> = {};
  for (const [nombre, registros] of Object.entries(datos)) {
    if (!Array.isArray(registros)) throw new ErrorDeDatos(`La colección «${nombre}» no es una lista.`);
    registros.forEach((r, i) => {
      if (!esObjeto(r) || typeof r.id !== 'string' || typeof r.actualizado !== 'string') {
        throw new ErrorDeDatos(`El registro ${i + 1} de «${nombre}» no tiene id o fecha de actualización.`);
      }
    });
    colecciones[nombre] = registros;
  }
  return { app: 'brain-gym', esquema, exportadoEl: typeof exportadoEl === 'string' ? exportadoEl : '', datos: colecciones };
}

/* Tras migrar, la forma ya es la actual: sólo se completan las colecciones ausentes y se descartan las desconocidas. */
function completar(datos: Record<string, unknown[]>): Colecciones {
  return Object.fromEntries(COLECCIONES.map((c) => [c, datos[c] ?? []])) as unknown as Colecciones;
}

function esObjeto(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

export function exportar(datos: Colecciones, ahora: Date): Exportacion {
  return { app: 'brain-gym', esquema: ESQUEMA_VERSION, exportadoEl: ahora.toISOString(), datos };
}
