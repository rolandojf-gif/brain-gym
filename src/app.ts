/* Estado de la aplicación y contexto que reciben las vistas. Una vista es una función que devuelve HTML más,
   opcionalmente, un `montar` que engancha los eventos sobre su propia sección (se crea de nuevo en cada pintado). */
import type { Almacen } from './datos/almacen';
import { ErrorDeSync, sincronizar } from './datos/sincronizar';
import { ID_AJUSTES, ajustesPorDefecto } from './dominio/ajustes';
import { idSesion, registrarSesion } from './dominio/sesion';
import type { Cambio } from './dominio/sincronizacion';
import type { Actividad, Ajustes, Colecciones } from './dominio/tipos';
import { diaLogico } from './lib/dia';

export interface Ctx {
  datos: Colecciones;
  ajustes: Ajustes;
  ahora: Date;
  hoy: string;
  /** Parte de la dirección tras la vista: `#lectura/escribir/<id>` → `escribir/<id>`. */
  sub: string | null;
  almacen: Almacen;
  guardar(...cambios: Cambio[]): Promise<void>;
  /** Marca la actividad como hecha hoy y suma el tiempo, si se midió. */
  registrar(actividad: Actividad, segundos?: number): Promise<void>;
  ir(hash: string): void;
  avisar(texto: string, tipo?: 'ok' | 'error'): void;
  pintar(): void;
  sync: EstadoSync & { tieneToken: boolean };
  sincronizar(): Promise<void>;
  /** Guarda (o borra, con '') la clave de sincronización de este dispositivo y sincroniza. */
  ponerToken(token: string): Promise<void>;
  /** Vuelve a leer todo del almacén (tras una importación). */
  recargar(): Promise<void>;
}

export interface Vista {
  titulo: string;
  render(ctx: Ctx): string;
  montar?(ctx: Ctx, raiz: HTMLElement): void;
}

export interface EstadoSync {
  texto: string;
  tipo: 'ok' | 'aviso' | 'error' | 'apagado';
}

export class App {
  datos!: Colecciones;
  sync: EstadoSync = { texto: '', tipo: 'apagado' };
  tieneToken = false;
  private enCurso: Promise<void> | null = null;
  private diferida: ReturnType<typeof setTimeout> | undefined;

  constructor(
    readonly almacen: Almacen,
    private readonly alCambiar: (forzar?: boolean) => void,
    private readonly alAvisar: (texto: string, tipo: 'ok' | 'error') => void,
  ) {}

  async cargar(): Promise<void> {
    this.datos = await this.almacen.leerTodo();
    this.tieneToken = Boolean(await this.almacen.meta('token'));
  }

  get ajustes(): Ajustes {
    return this.datos.ajustes.find((a) => a.id === ID_AJUSTES) ?? ajustesPorDefecto(new Date(0));
  }

  ctx(sub: string | null): Ctx {
    const ahora = new Date();
    // `datos` y `ajustes` se leen en vivo: tras un guardado, los manejadores de eventos ven ya lo nuevo.
    const leerDatos = () => this.datos;
    const leerAjustes = () => this.ajustes;
    return {
      get datos() { return leerDatos(); },
      get ajustes() { return leerAjustes(); },
      ahora,
      hoy: diaLogico(ahora, this.ajustes.horaCorte),
      sub,
      almacen: this.almacen,
      guardar: (...c) => this.guardar(...c),
      registrar: (a, s) => this.registrar(a, s),
      ir: (hash) => { location.hash = hash; },
      avisar: (t, tipo = 'ok') => this.alAvisar(t, tipo),
      pintar: () => this.alCambiar(true),
      sync: { ...this.sync, tieneToken: this.tieneToken },
      sincronizar: () => this.sincronizar(),
      ponerToken: async (token) => {
        await this.almacen.ponerMeta('token', token);
        this.tieneToken = Boolean(token);
        await this.sincronizar();
      },
      recargar: async () => {
        await this.cargar();
        this.alCambiar(true);
        this.programarSync(0);
      },
    };
  }

  async guardar(...cambios: Cambio[]): Promise<void> {
    if (cambios.length === 0) return;
    await this.almacen.guardar(...cambios);
    await this.cargar();
    this.alCambiar(true);
    this.programarSync();
  }

  async registrar(actividad: Actividad, segundos = 0): Promise<void> {
    const ahora = new Date();
    const dia = diaLogico(ahora, this.ajustes.horaCorte);
    const existente = this.datos.sesiones.find((s) => s.id === idSesion(dia, actividad));
    await this.guardar({ coleccion: 'sesiones', registro: registrarSesion(existente, dia, actividad, segundos, ahora) });
  }

  /** Agrupa los cambios de unos segundos en una sola sincronización. */
  programarSync(ms = 2000): void {
    clearTimeout(this.diferida);
    this.diferida = setTimeout(() => void this.sincronizar(), ms);
  }

  async sincronizar(): Promise<void> {
    if (this.enCurso) return this.enCurso;
    this.enCurso = (async () => {
      try {
        const { recibidos } = await sincronizar(this.almacen);
        const pendientes = (await this.almacen.pendientes()).length;
        this.sync = { texto: `Sincronizado ${new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}${pendientes ? ` · ${pendientes} pendientes` : ''}`, tipo: 'ok' };
        if (recibidos > 0) await this.cargar();
        this.alCambiar();
      } catch (e) {
        const pendientes = (await this.almacen.pendientes()).length;
        const extra = pendientes ? ` · ${pendientes} cambios sin enviar` : '';
        if (e instanceof ErrorDeSync) {
          this.sync = { texto: e.motivo === 'sin-token' ? `Sólo en este dispositivo${extra}` : `${e.message}${extra}`, tipo: e.motivo === 'sin-token' ? 'apagado' : e.motivo === 'red' ? 'aviso' : 'error' };
        } else {
          this.sync = { texto: `Error al sincronizar${extra}`, tipo: 'error' };
          console.error(e);
        }
        this.alCambiar();
      } finally {
        this.enCurso = null;
      }
    })();
    return this.enCurso;
  }
}

/** Delegación de eventos: `accion(raiz, 'click', 'borrar', (el, e) => …)` para elementos con data-accion="borrar". */
export function accion<K extends keyof HTMLElementEventMap>(
  raiz: HTMLElement,
  tipo: K,
  nombre: string,
  fn: (el: HTMLElement, e: HTMLElementEventMap[K]) => void | Promise<void>,
): void {
  raiz.addEventListener(tipo, (e) => {
    const el = (e.target as Element | null)?.closest<HTMLElement>(`[data-accion="${nombre}"]`);
    if (el && raiz.contains(el)) void fn(el, e);
  });
}

/** Valores de un formulario como cadenas recortadas. */
export function campos(form: HTMLFormElement): Record<string, string> {
  const salida: Record<string, string> = {};
  new FormData(form).forEach((v, k) => { salida[k] = typeof v === 'string' ? v.trim() : ''; });
  return salida;
}
