/* Retos generados en segundo plano: pide a /api/retos uno por tema hasta tener uno listo en cada uno. Nunca bloquea
   ni repinta: lo nuevo aparece en el siguiente pintado. Va de uno en uno y con topes diarios por dispositivo,
   guardados en local, porque cada petición gasta una o dos llamadas del cupo diario de IA y la app se reabre a menudo. */
import { BLOQUES_RETOS, temasPorReponer, todosLosRetos, vistosDeTema } from '../dominio/catalogo-retos';
import { nuevo } from '../dominio/registro';
import { validarRetoPropuesto } from '../dominio/retos-ia';
import type { Colecciones, RetoGenerado, TemaReto } from '../dominio/tipos';
import type { Almacen, GastoRetos } from './almacen';

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

/** Peticiones al día por dispositivo que llegan al modelo (cada una gasta 1 o 2 llamadas del cupo diario). */
export const MAX_PETICIONES_DIA = 10;
/** Descartes seguidos de un tema antes de pasar al siguiente (en esta sesión). */
export const MAX_DESCARTES_TEMA = 2;
/** Descartes seguidos, de cualquier tema, que delatan un fallo sistemático: se deja para mañana. */
export const MAX_DESCARTES_SEGUIDOS = 3;

export interface MemoriaGasto {
  leer(): Promise<GastoRetos | undefined>;
  guardar(gasto: GastoRetos): Promise<void>;
}

export interface DepsReponedor {
  almacen: Almacen;
  /** Datos actuales (en vivo): tras cada guardado, el reponedor ve lo nuevo. */
  leer: () => Colecciones;
  guardar: (reto: RetoGenerado) => Promise<void>;
  pedir?: typeof pedirReto;
  reloj?: () => number;
  /** Dónde se guarda lo pedido hoy; por defecto, en `meta` del almacén. */
  gasto?: MemoriaGasto;
  /** Se llama cada vez que cambia `estado`, para que la pestaña Datos lo muestre en vivo. */
  alCambiarEstado?: () => void;
}

export class Reponedor {
  /** Última novedad, en una línea, para la pestaña Datos. */
  private estadoActual = '';
  private enCurso: Promise<void> | null = null;
  private descartes = new Map<TemaReto, number>();
  private pausaHasta = 0;
  private readonly memoria: MemoriaGasto;

  constructor(private readonly deps: DepsReponedor) {
    this.memoria = deps.gasto ?? {
      leer: () => deps.almacen.meta('gastoRetos'),
      guardar: (g) => deps.almacen.ponerMeta('gastoRetos', g),
    };
  }

  get estado(): string {
    return this.estadoActual;
  }

  private set estado(texto: string) {
    if (texto === this.estadoActual) return;
    this.estadoActual = texto;
    this.deps.alCambiarEstado?.();
  }

  /** Repone lo que falte. Si ya está reponiendo, devuelve la misma promesa. */
  reponer(): Promise<void> {
    this.enCurso ??= this.bucle().finally(() => {
      this.enCurso = null;
    });
    return this.enCurso;
  }

  /** Tras cambiar la clave de sincronización: vuelve a intentarlo aunque antes fallara. Los topes diarios siguen. */
  reiniciar(): void {
    this.descartes.clear();
    this.pausaHasta = 0;
  }

  private async bucle(): Promise<void> {
    const reloj = this.deps.reloj ?? Date.now;
    const pedir = this.deps.pedir ?? pedirReto;
    const hoy = diaUtc(reloj());
    const guardado = await this.memoria.leer();
    let gasto: GastoRetos = guardado?.dia === hoy ? guardado : { dia: hoy, peticiones: 0, descartesSeguidos: 0, ultimo: '' };

    while (reloj() >= this.pausaHasta) {
      if (gasto.descartesSeguidos >= MAX_DESCARTES_SEGUIDOS) {
        this.estado = `${gasto.ultimo} Tras ${MAX_DESCARTES_SEGUIDOS} descartes seguidos, este dispositivo no pide más hasta mañana.`;
        return;
      }
      if (gasto.peticiones >= MAX_PETICIONES_DIA) {
        this.estado = `${gasto.ultimo} Este dispositivo ya ha pedido hoy ${MAX_PETICIONES_DIA} retos; mañana pedirá más.`;
        return;
      }
      const datos = this.deps.leer();
      const retos = todosLosRetos(datos.retos);
      const tema = temasPorReponer(retos, datos.intentos).find((t) => (this.descartes.get(t) ?? 0) < MAX_DESCARTES_TEMA);
      if (!tema) {
        if (gasto.ultimo) this.estado = gasto.ultimo;
        return;
      }
      // Cada petición tarda decenas de segundos (generar, comprobar la fuente, revisar): que se vea que trabaja.
      this.estado = `Pidiendo un reto de ${BLOQUES_RETOS.find((b) => b.id === tema)?.titulo ?? `tema ${tema}`}…`;
      const r = await pedir(this.deps.almacen, tema, vistosDeTema(tema, retos));
      if (r.tipo === 'parar') {
        // Ninguna de estas paradas llega al modelo, así que no cuenta para los topes del día.
        this.estado = r.mensaje;
        // Sin clave o sin red se reintenta en la próxima ocasión (al sincronizar); con el cupo agotado, mañana (UTC);
        // con la clave mal o el servidor roto, no hasta reiniciar la app o cambiar la clave.
        if (r.motivo === 'cupo') this.pausaHasta = siguienteDiaUtc(reloj());
        else if (r.motivo === 'token' || r.motivo === 'servidor') this.pausaHasta = Number.POSITIVE_INFINITY;
        return;
      }
      if (r.tipo === 'ok') {
        await this.deps.guardar(r.reto);
        this.descartes.delete(tema);
        gasto = { ...gasto, peticiones: gasto.peticiones + 1, descartesSeguidos: 0, ultimo: `Último reto generado: «${r.reto.titulo}».` };
      } else {
        this.descartes.set(tema, (this.descartes.get(tema) ?? 0) + 1);
        gasto = { ...gasto, peticiones: gasto.peticiones + 1, descartesSeguidos: gasto.descartesSeguidos + 1, ultimo: r.mensaje };
      }
      await this.memoria.guardar(gasto);
      this.estado = gasto.ultimo;
    }
  }
}

function diaUtc(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

function siguienteDiaUtc(ms: number): number {
  const d = new Date(ms);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1);
}
