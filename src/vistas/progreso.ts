/* 06 · Progreso: calendario de continuidad y las métricas que ya se pueden medir. El panel completo es de la Fase 2. */
import type { Vista } from '../app';
import { brier, resueltas } from '../dominio/calibracion';
import { proporcionSinAyuda } from '../dominio/estudio';
import { calendario } from '../dominio/progreso';
import type { Actividad } from '../dominio/tipos';
import { fmtFecha, fmtNum, fmtPct } from '../lib/fmt';
import { esc } from '../lib/html';
import { NOMBRE_ACTIVIDAD, cabecera } from './comun';

const ORDEN: Actividad[] = ['estudio', 'lectura', 'repaso', 'calibracion', 'concepto'];

export const progreso: Vista = {
  titulo: 'Progreso',
  render(ctx) {
    const cal = calendario(ctx.datos.sesiones, ctx.hoy, 12);
    const celdas = cal.map((d) => {
      const futuro = d.dia > ctx.hoy;
      const t = d.actividades.length ? `${fmtFecha(d.dia)}: ${d.actividades.map((a) => NOMBRE_ACTIVIDAD[a]).join(', ')}` : `${fmtFecha(d.dia)}: nada registrado`;
      return `<div class="dia${futuro ? ' futuro' : ''}${d.dia === ctx.hoy ? ' hoy' : ''}" title="${esc(t)}" aria-label="${esc(t)}">${ORDEN.map((a) => `<i class="a-${a}${d.actividades.includes(a) ? ' si' : ''}"></i>`).join('')}</div>`;
    }).join('');
    const sinAyuda = proporcionSinAyuda(ctx.datos.intentos);
    const rs = resueltas(ctx.datos.predicciones);
    const escritos = ctx.datos.escritos.filter((e) => !e.borrado).length;
    return `
      <section class="view">
        ${cabecera('Progreso', 'Continuidad como dato: qué se hizo cada día de las últimas 12 semanas.')}
        <div class="kpis">
          <div class="kpi"><span class="k">Ejercicios sin ayuda</span><span class="v">${fmtPct(sinAyuda)}</span><span class="s">${ctx.datos.intentos.filter((i) => !i.borrado).length} intentos</span></div>
          <div class="kpi"><span class="k">Brier</span><span class="v">${fmtNum(brier(rs))}</span><span class="s">${rs.length} predicciones resueltas · 0 es perfecto, 0,25 es decir siempre 50 %</span></div>
          <div class="kpi"><span class="k">Resúmenes escritos</span><span class="v">${escritos}</span><span class="s">La revisión a 30 días llega en la Fase 2</span></div>
        </div>
        <h2 class="sec">Calendario</h2>
        <div class="panel">
          <div class="cal" role="img" aria-label="Calendario de las últimas 12 semanas">
            <div class="cal-dias">${['L', 'M', 'X', 'J', 'V', 'S', 'D'].map((d) => `<span>${d}</span>`).join('')}</div>
            <div class="cal-grid">${celdas}</div>
          </div>
          <div class="legend">${ORDEN.map((a) => `<span><i class="a-${a} si"></i>${esc(NOMBRE_ACTIVIDAD[a])}</span>`).join('')}</div>
        </div>
      </section>`;
  },
};
