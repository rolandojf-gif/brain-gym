/* Retos generados en segundo plano: pide a /api/retos uno por tema hasta tener uno listo en cada uno. Nunca bloquea
   ni repinta: lo nuevo aparece en el siguiente pintado. Va de uno en uno y con topes por sesión, porque cada petición
   gasta una o dos llamadas del cupo diario de IA. */
import { temasPorReponer, todosLosRetos, vistosDeTema } from '../dominio/catalogo-retos';
import { nuevo } from '../dominio/registro';
import { validarRetoPropuesto } from '../dominio/retos-ia';
import type { Colecciones, RetoGenerado, TemaReto } from '../dominio/tipos';
import type { Almacen } from './almacen';

export type ResultadoReto =
  | { tipo: 'ok'; reto: RetoGenerado }
  /** El servidor o la app lo descartaron (formato, fuente, revisor): se puede volver a pedir. */
  | { tipo: 'descartado'; mensaje: string }
  /** No tiene sentido seguir pidiendo ahora. */
  | { tipo: 'parar'; motivo: 'sin-token' | 'token' | 'cupo' | 'servidor' | 'red'; mensaje: string };

export interface OpcionesPedir {
  url?: string;
  fetch?: typeof globalThis.fetch;
  ahora?: Date;
}

export async function pedirReto(
  almacen: Almacen,
  tema: TemaReto,
  vistos: readonly string[],
  { url = '/api/retos', fetch = globalThis.fetch, ahora = new Date() }: OpcionesPedir = {},
): Promise<ResultadoReto> {
  const token = await almacen.meta('token');
  if (!token) return { tipo: 'parar', motivo: 'sin-token', mensaje: 'Los retos generados necesitan la clave de sincronización de este dispositivo.' };

  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ tema, vistos }),
    });
  } catch {
    return { tipo: 'parar', motivo: 'red', mensaje: 'Sin conexión: los retos generados esperan.' };
  }

  const cuerpo = (await res.json().catch(() => null)) as { reto?: unknown; error?: unknown } | null;
  const error = typeof cuerpo?.error === 'string' ? cuerpo.error : `El servidor de retos respondió ${res.status}.`;
  if (res.status === 401) return { tipo: 'parar', motivo: 'token', mensaje: 'La clave de sincronización no es válida.' };
  if (res.status === 429) return { tipo: 'parar', motivo: 'cupo', mensaje: error };
  if (res.status === 422) return { tipo: 'descartado', mensaje: error };
  // 5xx: falta la clave de OpenRouter, el modelo no existe o el proveedor falla. Lo arregla una persona, no reintentar.
  if (!res.ok) return { tipo: 'parar', motivo: 'servidor', mensaje: error };

  // Se vuelve a validar: lo que se guarda y se sincroniza tiene que tener la forma que espera la app.
  try {
    const datos = (cuerpo?.reto ?? null) as Record<string, unknown> | null;
    const propuesto = validarRetoPropuesto(datos, tema);
    const modelo = typeof datos?.modelo === 'string' ? datos.modelo.slice(0, 120) : '';
    const revision = typeof datos?.revision === 'string' ? datos.revision.slice(0, 600) : '';
    return { tipo: 'ok', reto: nuevo({ ...propuesto, modelo, revision }, ahora) };
  } catch (e) {
    return { tipo: 'descartado', mensaje: e instanceof Error ? e.message : 'Reto mal formado.' };
  }
}

/** Peticiones por sesión de la app (cada una gasta 1 o 2 llamadas de las 40 diarias). */
export const MAX_PETICIONES_SESION = 10;
/** Descartes seguidos de un tema antes de dejarlo para la próxima sesión. */
export const MAX_DESCARTES_TEMA = 2;

export interface DepsReponedor {
  almacen: Almacen;
  /** Datos actuales (en vivo): tras cada guardado, el reponedor ve lo nuevo. */
  leer: () => Colecciones;
  guardar: (reto: RetoGenerado) => Promise<void>;
  pedir?: typeof pedirReto;
  reloj?: () => number;
}

export class Reponedor {
  /** Última novedad, en una línea, para la pestaña Datos. */
  estado = '';
  private enCurso: Promise<void> | null = null;
  private peticiones = 0;
  private descartes = new Map<TemaReto, number>();
  private pausaHasta = 0;

  constructor(private readonly deps: DepsReponedor) {}

  /** Repone lo que falte. Si ya está reponiendo, devuelve la misma promesa. */
  reponer(): Promise<void> {
    this.enCurso ??= this.bucle().finally(() => {
      this.enCurso = null;
    });
    return this.enCurso;
  }

  /** Tras cambiar la clave de sincronización: vuelve a intentarlo aunque antes fallara. */
  reiniciar(): void {
    this.peticiones = 0;
    this.descartes.clear();
    this.pausaHasta = 0;
  }

  private async bucle(): Promise<void> {
    const reloj = this.deps.reloj ?? Date.now;
    const pedir = this.deps.pedir ?? pedirReto;
    while (reloj() >= this.pausaHasta && this.peticiones < MAX_PETICIONES_SESION) {
      const datos = this.deps.leer();
      const retos = todosLosRetos(datos.retos);
      const tema = temasPorReponer(retos, datos.intentos).find((t) => (this.descartes.get(t) ?? 0) < MAX_DESCARTES_TEMA);
      if (!tema) return;
      const r = await pedir(this.deps.almacen, tema, vistosDeTema(tema, retos));
      if (r.tipo === 'parar' && r.motivo === 'sin-token') {
        this.estado = r.mensaje;
        return;
      }
      this.peticiones++;
      if (r.tipo === 'ok') {
        await this.deps.guardar(r.reto);
        this.descartes.delete(tema);
        this.estado = `Último reto generado: «${r.reto.titulo}».`;
      } else if (r.tipo === 'descartado') {
        this.descartes.set(tema, (this.descartes.get(tema) ?? 0) + 1);
        this.estado = r.mensaje;
      } else {
        this.estado = r.mensaje;
        // Sin red se reintenta en la próxima ocasión (al volver a la app); con el cupo agotado, mañana (UTC);
        // con la clave mal o el servidor roto, no hasta reiniciar la app o cambiar la clave.
        if (r.motivo === 'cupo') this.pausaHasta = siguienteDiaUtc(reloj());
        else if (r.motivo !== 'red') this.pausaHasta = Number.POSITIVE_INFINITY;
        return;
      }
    }
  }
}

function siguienteDiaUtc(ms: number): number {
  const d = new Date(ms);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1);
}
