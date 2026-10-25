/* Almacén local en IndexedDB: una tienda por colección, más `meta` (versión de esquema, cursor de sincronización,
   copia previa) y `pendientes` (cambios locales aún no enviados). */
import { openDB, type IDBPDatabase } from 'idb';
import { LECTURAS_SEMILLA, ajustesPorDefecto, fuentesIniciales, lecturasIniciales } from '../dominio/ajustes';
import { ID_FUENTE_RETOS, fuenteRetos } from '../dominio/catalogo-retos';
import { exportar, migrar, ErrorDeDatos } from '../dominio/migraciones';
import { actualizar } from '../dominio/registro';
import { fusionar, ganador, type Cambio } from '../dominio/sincronizacion';
import { COLECCIONES, ESQUEMA_VERSION, coleccionesVacias, type Base, type Coleccion, type Colecciones, type Exportacion, type Lectura } from '../dominio/tipos';

/* La versión de IndexedDB sólo cambia si cambia la lista de tiendas o índices; la forma de los datos la versiona
   ESQUEMA_VERSION con migraciones puras. */
const VERSION_IDB = 1;
const META = 'meta';
const PENDIENTES = 'pendientes';

type Meta = { esquema: number; cursor: number; copia: Exportacion; token: string };

export class Almacen {
  private constructor(private readonly db: IDBPDatabase) {}

  static async abrir(nombre = 'brain-gym', ahora = new Date()): Promise<Almacen> {
    const db = await openDB(nombre, VERSION_IDB, {
      upgrade(db) {
        for (const c of COLECCIONES) if (!db.objectStoreNames.contains(c)) db.createObjectStore(c, { keyPath: 'id' });
        if (!db.objectStoreNames.contains(META)) db.createObjectStore(META);
        if (!db.objectStoreNames.contains(PENDIENTES)) db.createObjectStore(PENDIENTES);
      },
    });
    const almacen = new Almacen(db);
    await almacen.preparar(ahora);
    return almacen;
  }

  /** Migra los datos si se guardaron con un esquema anterior y siembra los datos iniciales la primera vez. */
  private async preparar(ahora: Date): Promise<void> {
    const esquema = await this.meta('esquema');
    if (esquema !== undefined && esquema > ESQUEMA_VERSION) {
      throw new ErrorDeDatos(`Los datos de este dispositivo son de una versión más nueva (${esquema}) que la app (${ESQUEMA_VERSION}). Recarga para actualizarla.`);
    }
    if (esquema !== undefined && esquema < ESQUEMA_VERSION) {
      const antes: Exportacion = { ...exportar(await this.leerTodo(), ahora), esquema };
      await this.ponerMeta('copia', antes);
      await this.sustituir(migrar(antes).datos);
    }
    await this.ponerMeta('esquema', ESQUEMA_VERSION);
    if ((await this.db.count('ajustes')) === 0) {
      // Ids fijos: si el otro dispositivo también siembra, la sincronización los funde en uno.
      const tx = this.db.transaction(['ajustes', 'fuentes'], 'readwrite');
      await tx.objectStore('ajustes').put(ajustesPorDefecto(ahora));
      for (const f of fuentesIniciales(ahora)) await tx.objectStore('fuentes').put(f);
      await tx.done;
    } else if (!(await this.db.get('fuentes', ID_FUENTE_RETOS))) {
      await this.db.put('fuentes', fuenteRetos(ahora));
    }
    if ((await this.db.count('lecturas')) === 0) {
      const tx = this.db.transaction('lecturas', 'readwrite');
      for (const l of lecturasIniciales(ahora)) await tx.objectStore('lecturas').put(l);
      await tx.done;
    } else {
      const tx = this.db.transaction('lecturas', 'readwrite');
      const tienda = tx.objectStore('lecturas');
      for (const s of LECTURAS_SEMILLA) {
        const existente = (await tienda.get(s.id)) as Lectura | undefined;
        if (existente && (existente.url !== s.url || existente.medio !== s.medio)) {
          await tienda.put(actualizar(existente, { url: s.url, medio: s.medio }, ahora));
        }
      }
      await tx.done;
    }
  }

  async leer<C extends Coleccion>(c: C): Promise<Colecciones[C]> {
    return (await this.db.getAll(c)) as Colecciones[C];
  }

  async leerTodo(): Promise<Colecciones> {
    const datos = coleccionesVacias();
    const tx = this.db.transaction([...COLECCIONES], 'readonly');
    for (const c of COLECCIONES) (datos as unknown as Record<string, unknown[]>)[c] = await tx.objectStore(c).getAll();
    await tx.done;
    return datos;
  }

  /** Guarda registros creados o editados en este dispositivo y los apunta para sincronizar. */
  async guardar(...cambios: Cambio[]): Promise<void> {
    const tx = this.db.transaction([...new Set(cambios.map((c) => c.coleccion)), PENDIENTES], 'readwrite');
    for (const { coleccion, registro } of cambios) {
      await tx.objectStore(coleccion).put(registro);
      await tx.objectStore(PENDIENTES).put({ coleccion, id: registro.id }, clave(coleccion, registro.id));
    }
    await tx.done;
  }

  /** Cambios locales pendientes de enviar, con la versión actual de cada registro. */
  async pendientes(): Promise<Cambio[]> {
    const marcas = (await this.db.getAll(PENDIENTES)) as { coleccion: Coleccion; id: string }[];
    const salida: Cambio[] = [];
    for (const { coleccion, id } of marcas) {
      const registro = (await this.db.get(coleccion, id)) as Base | undefined;
      if (registro) salida.push({ coleccion, registro });
    }
    return salida;
  }

  /** Quita de pendientes lo enviado, salvo lo que se haya vuelto a editar mientras tanto. */
  async confirmarEnviados(enviados: readonly Cambio[]): Promise<void> {
    const tx = this.db.transaction([...new Set(enviados.map((c) => c.coleccion)), PENDIENTES], 'readwrite');
    for (const { coleccion, registro } of enviados) {
      const actual = (await tx.objectStore(coleccion).get(registro.id)) as Base | undefined;
      if (!actual || actual.actualizado === registro.actualizado) await tx.objectStore(PENDIENTES).delete(clave(coleccion, registro.id));
    }
    await tx.done;
  }

  /** Aplica cambios llegados de otro dispositivo con la regla «gana el último». No los marca como pendientes. */
  async aplicarRemotos(cambios: readonly Cambio[]): Promise<number> {
    if (cambios.length === 0) return 0;
    let aplicados = 0;
    const tx = this.db.transaction([...new Set(cambios.map((c) => c.coleccion))], 'readwrite');
    for (const { coleccion, registro } of cambios) {
      const tienda = tx.objectStore(coleccion);
      const local = (await tienda.get(registro.id)) as Base | undefined;
      if (!local || (ganador(local, registro) === registro && JSON.stringify(local) !== JSON.stringify(registro))) {
        await tienda.put(registro);
        aplicados++;
      }
    }
    await tx.done;
    return aplicados;
  }

  async exportar(ahora = new Date()): Promise<Exportacion> {
    return exportar(await this.leerTodo(), ahora);
  }

  /**
   * Importa una exportación (de cualquier versión anterior). «sustituir» borra lo local; «fusionar» aplica la regla
   * de la sincronización. Antes se guarda una copia de lo que había. Todo lo importado queda pendiente de sincronizar.
   */
  async importar(entrada: unknown, modo: 'sustituir' | 'fusionar', ahora = new Date()): Promise<void> {
    const nueva = migrar(entrada);
    const actuales = await this.leerTodo();
    await this.ponerMeta('copia', exportar(actuales, ahora));
    const datos = modo === 'sustituir' ? nueva.datos : fusionar(actuales, nueva.datos);
    await this.sustituir(datos);
    await this.guardar(...COLECCIONES.flatMap((c) => datos[c].map((registro: Base) => ({ coleccion: c, registro }))));
  }

  /** Copia guardada antes de la última migración o importación, para poder volver atrás. */
  async copiaPrevia(): Promise<Exportacion | undefined> {
    return this.meta('copia');
  }

  private async sustituir(datos: Colecciones): Promise<void> {
    const tx = this.db.transaction([...COLECCIONES], 'readwrite');
    for (const c of COLECCIONES) {
      const tienda = tx.objectStore(c);
      await tienda.clear();
      for (const r of datos[c]) await tienda.put(r);
    }
    await tx.done;
  }

  async meta<K extends keyof Meta>(k: K): Promise<Meta[K] | undefined> {
    return (await this.db.get(META, k)) as Meta[K] | undefined;
  }

  async ponerMeta<K extends keyof Meta>(k: K, v: Meta[K]): Promise<void> {
    await this.db.put(META, v, k);
  }

  cerrar(): void {
    this.db.close();
  }
}

function clave(c: Coleccion, id: string): string {
  return `${c}:${id}`;
}
