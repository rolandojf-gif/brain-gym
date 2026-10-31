/* 06 · Datos: sincronización, exportar/importar y el corte del día. El plan semanal salió de la interfaz (Hoy es un
   menú, no una agenda); `ajustes.planSemanal` se conserva en los datos por compatibilidad. */
import { accion, campos, type Ctx, type Vista } from '../app';
import { ID_FUENTE_RETOS } from '../dominio/catalogo-retos';
import { MAX_LLAMADAS_IA_DIA } from '../dominio/retos-ia';
import { actualizar } from '../dominio/registro';
import { esc } from '../lib/html';
import { cabecera, descargar } from './comun';

// Estado de los retos generados: si algo falla en el servidor (falta la clave, el tope del día), se ve aquí.
function panelRetosIa(ctx: Ctx): string {
  const vivos = ctx.datos.retos.filter((r) => !r.borrado);
  const jugados = new Set(ctx.datos.intentos.filter((i) => !i.borrado && i.fuenteId === ID_FUENTE_RETOS).map((i) => i.ejercicio));
  const listos = vivos.filter((r) => !r.reporte && !jugados.has(r.id)).length;
  const reportados = vivos.filter((r) => r.reporte).length;
  return `
    <h2 class="sec">Retos generados</h2>
    <div class="panel">
      <p>${listos} sin jugar · ${vivos.length} generados en total${reportados ? ` · ${reportados} marcados como erróneos` : ''}.</p>
      ${ctx.retosIa ? `<p class="estado-sync">${esc(ctx.retosIa)}</p>` : ''}
      <p class="note">La app los pide sola, uno por tema, cuando tiene la clave de sincronización. Tope: ${MAX_LLAMADAS_IA_DIA} llamadas a la IA al día entre retos y Abogado del Diablo.</p>
    </div>`;
}

export const datos: Vista = {
  titulo: 'Datos',
  render(ctx) {
    const total = (Object.values(ctx.datos) as { borrado: boolean }[][]).reduce((n, l) => n + l.filter((r) => !r.borrado).length, 0);
    return `
      <section class="view">
        ${cabecera('Datos', 'Tus datos viven en este dispositivo y, si configuras la clave, se sincronizan con el otro.')}

        <h2 class="sec">Sincronización</h2>
        <div class="panel">
          <p class="estado-sync">${esc(ctx.sync.texto || 'Sin sincronizar todavía.')}</p>
          <form class="form-linea" data-accion="token">
            <label for="token">Clave de sincronización (la de BG_TOKEN en Netlify)</label>
            <input id="token" name="token" type="password" autocomplete="off" minlength="32" placeholder="${ctx.sync.tieneToken ? 'Guardada en este dispositivo' : 'Pega aquí la clave'}">
            <button class="btn">Guardar clave</button>
          </form>
          <div class="acciones"><button class="btn primario" data-accion="sincronizar"${ctx.sync.tieneToken ? '' : ' disabled'}>Sincronizar ahora</button>
          ${ctx.sync.tieneToken ? '<button class="btn sutil" data-accion="olvidar">Olvidar la clave en este dispositivo</button>' : ''}</div>
        </div>

        ${panelRetosIa(ctx)}

        <h2 class="sec">Exportar e importar</h2>
        <div class="panel">
          <p>${total} registros. La exportación JSON es completa y se puede volver a importar en cualquier versión posterior.</p>
          <div class="acciones"><button class="btn primario" data-accion="exportar">Exportar JSON</button>
          <button class="btn sutil" data-accion="copia">Descargar la copia previa a la última importación</button></div>
          <form class="form-bloque" data-accion="importar">
            <label for="archivo">Importar una exportación</label>
            <input id="archivo" name="archivo" type="file" accept="application/json,.json" required>
            <fieldset class="seg-radio"><legend>Modo</legend>
              <label><input type="radio" name="modo" value="fusionar" checked> Fusionar con lo que hay</label>
              <label><input type="radio" name="modo" value="sustituir"> Sustituirlo todo</label>
            </fieldset>
            <button class="btn">Importar</button>
          </form>
        </div>

        <h2 class="sec">Cuándo empieza el día</h2>
        <form class="panel" data-accion="corte">
          <p class="note">Lo que hagas de madrugada, antes de esta hora, cuenta para el día anterior.</p>
          <label class="campo corto">El día termina a las <input name="corte" type="number" min="0" max="12" value="${ctx.ajustes.horaCorte}"> h</label>
          <button class="btn primario">Guardar</button>
        </form>
      </section>`;
  },
  montar(ctx, raiz) {
    accion(raiz, 'submit', 'token', async (form, e) => {
      e.preventDefault();
      const { token = '' } = campos(form as HTMLFormElement);
      if (token.length < 32) return ctx.avisar('La clave debe tener al menos 32 caracteres.', 'error');
      ctx.avisar('Clave guardada en este dispositivo.');
      await ctx.ponerToken(token);
    });
    accion(raiz, 'click', 'olvidar', async () => {
      await ctx.ponerToken('');
    });
    accion(raiz, 'click', 'sincronizar', () => ctx.sincronizar());
    accion(raiz, 'click', 'exportar', async () => {
      const exp = await ctx.almacen.exportar();
      descargar(`brain-gym-${ctx.hoy}.json`, JSON.stringify(exp, null, 2));
    });
    accion(raiz, 'click', 'copia', async () => {
      const copia = await ctx.almacen.copiaPrevia();
      if (!copia) return ctx.avisar('No hay copia previa: aún no se ha importado ni migrado nada.', 'error');
      descargar(`brain-gym-copia-${copia.exportadoEl.slice(0, 10)}.json`, JSON.stringify(copia, null, 2));
    });
    accion(raiz, 'submit', 'importar', async (form, e) => {
      e.preventDefault();
      const f = form as HTMLFormElement;
      const archivo = (f.elements.namedItem('archivo') as HTMLInputElement).files?.[0];
      const modo = campos(f).modo === 'sustituir' ? 'sustituir' : 'fusionar';
      if (!archivo) return;
      if (modo === 'sustituir' && !confirm('Se sustituirán todos los datos de este dispositivo (queda una copia previa). ¿Seguir?')) return;
      try {
        await ctx.almacen.importar(JSON.parse(await archivo.text()), modo);
        ctx.avisar('Importación completada.');
        await ctx.recargar();
      } catch (err) {
        ctx.avisar(err instanceof Error ? err.message : 'No se pudo importar el archivo.', 'error');
      }
    });
    accion(raiz, 'submit', 'corte', async (form, e) => {
      e.preventDefault();
      const corte = Math.min(12, Math.max(0, Number(campos(form as HTMLFormElement).corte) || 0));
      await ctx.guardar({ coleccion: 'ajustes', registro: actualizar(ctx.ajustes, { horaCorte: corte }, new Date()) });
      ctx.avisar('Guardado.');
    });
  },
};
