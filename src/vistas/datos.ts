/* 07 · Datos: sincronización, exportar/importar y ajustes (plan semanal y corte del día). */
import { accion, campos, type Vista } from '../app';
import { actualizar } from '../dominio/registro';
import type { Actividad, PlanSemanal } from '../dominio/tipos';
import { esc } from '../lib/html';
import { NOMBRE_ACTIVIDAD, cabecera, descargar } from './comun';

const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
const ACTIVIDADES: Actividad[] = ['estudio', 'lectura', 'repaso', 'calibracion', 'concepto'];

export const datos: Vista = {
  titulo: 'Datos',
  render(ctx) {
    const plan = ctx.ajustes.planSemanal;
    const filas = DIAS.map((d, i) => `
      <tr><th scope="row">${d}</th>${ACTIVIDADES.map((a) => `
        <td><input type="checkbox" name="plan-${i}-${a}" aria-label="${esc(`${d}: ${NOMBRE_ACTIVIDAD[a]}`)}"${plan[i as keyof PlanSemanal]?.includes(a) ? ' checked' : ''}></td>`).join('')}</tr>`).join('');
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

        <h2 class="sec">Plan semanal</h2>
        <form class="panel" data-accion="plan">
          <div class="table-wrap"><table class="plan"><thead><tr><th></th>${ACTIVIDADES.map((a) => `<th scope="col">${esc(NOMBRE_ACTIVIDAD[a])}</th>`).join('')}</tr></thead><tbody>${filas}</tbody></table></div>
          <label class="campo corto">El día termina a las <input name="corte" type="number" min="0" max="12" value="${ctx.ajustes.horaCorte}"> h</label>
          <button class="btn primario">Guardar el plan</button>
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
    accion(raiz, 'submit', 'plan', async (form, e) => {
      e.preventDefault();
      const f = form as HTMLFormElement;
      const plan = Object.fromEntries(DIAS.map((_, i) => [i, ACTIVIDADES.filter((a) => (f.elements.namedItem(`plan-${i}-${a}`) as HTMLInputElement).checked)])) as unknown as PlanSemanal;
      const corte = Math.min(12, Math.max(0, Number(campos(f).corte) || 0));
      await ctx.guardar({ coleccion: 'ajustes', registro: actualizar(ctx.ajustes, { planSemanal: plan, horaCorte: corte }, new Date()) });
      ctx.avisar('Plan guardado.');
    });
  },
};
