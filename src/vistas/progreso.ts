/* 05 · Progreso: continuidad real (calendario de sesiones hechas), tasa de resolución de retos
   (sin ayuda vs con pista vs solución y desglose por los 4 bloques temáticos) y madurez del mazo FSRS + lecturas 3x1. */
import type { Vista } from '../app';
import { fuenteRetos } from '../dominio/catalogo-retos';
import { desgloseResolucion, progresoPorCapitulo } from '../dominio/estudio';
import { calendario, madurezMazo } from '../dominio/progreso';
import type { Actividad } from '../dominio/tipos';
import { fmtFecha, fmtPct, plural } from '../lib/fmt';
import { esc } from '../lib/html';
import { NOMBRE_ACTIVIDAD, cabecera } from './comun';

const ORDEN: Actividad[] = ['estudio', 'lectura', 'repaso', 'concepto'];

export const progreso: Vista = {
  titulo: 'Progreso',
  render(ctx) {
    const cal = calendario(ctx.datos.sesiones, ctx.hoy, 12);
    const diasActivos = cal.filter((d) => d.actividades.length > 0).length;
    const celdas = cal
      .map((d) => {
        const futuro = d.dia > ctx.hoy;
        const t = d.actividades.length
          ? `${fmtFecha(d.dia)}: ${d.actividades.map((a) => NOMBRE_ACTIVIDAD[a]).join(', ')}`
          : `${fmtFecha(d.dia)}: nada registrado`;
        return `<div class="dia${futuro ? ' futuro' : ''}${d.dia === ctx.hoy ? ' hoy' : ''}" title="${esc(t)}" aria-label="${esc(t)}">${ORDEN.map((a) => `<i class="a-${a}${d.actividades.includes(a) ? ' si' : ''}"></i>`).join('')}</div>`;
      })
      .join('');

    const fuente = fuenteRetos(ctx.ahora);
    const desglose = desgloseResolucion(ctx.datos.intentos);
    const porBloque = progresoPorCapitulo(fuente, ctx.datos.intentos);
    const mazo = madurezMazo(ctx.datos.tarjetas, ctx.datos.repasos);
    const escritos = ctx.datos.escritos.filter((e) => !e.borrado).length;
    const aprendizajes = ctx.datos.aprendizajes.filter((a) => !a.borrado).length;

    const filasBloques = porBloque
      .map(
        (b) => `
      <tr>
        <th scope="row">${esc(b.capitulo)}</th>
        <td class="t-cap">${esc(b.titulo)}</td>
        <td class="num">${b.intentados} / ${b.total ?? 8}</td>
        <td class="num"><b>${b.sinAyuda}</b></td>
        <td class="num">${b.conPista}</td>
        <td class="num">${b.conSolucion}</td>
      </tr>`,
      )
      .join('');

    return `
      <section class="view">
        ${cabecera('Progreso', 'Métricas reales sin gamificación: continuidad, precisión estratégica, mazo FSRS y síntesis 3x1.')}

        <div class="kpis">
          <div class="kpi">
            <span class="k">Retos sin ayuda</span>
            <span class="v">${fmtPct(desglose.tasaSinAyuda)}</span>
            <span class="s">${desglose.sinAyuda} sin ayuda · ${desglose.conPista} con pista · ${desglose.solucion} trampa/solución (${plural(desglose.total, 'intento')})</span>
          </div>
          <div class="kpi">
            <span class="k">Madurez FSRS</span>
            <span class="v">${mazo.aprendidas} / ${mazo.totalTarjetas}</span>
            <span class="s">Retención: ${fmtPct(mazo.retencion)} en ${plural(mazo.totalRepasos, 'repaso')}</span>
          </div>
          <div class="kpi">
            <span class="k">Lecturas 3x1 y modelos</span>
            <span class="v">${escritos}</span>
            <span class="s">${plural(escritos, 'síntesis 3x1 escrita', 'síntesis 3x1 escritas')} · ${plural(aprendizajes, 'modelo mental diario', 'modelos mentales diarios')}</span>
          </div>
        </div>

        <h2 class="sec">Desglose por bloques temáticos</h2>
        <div class="panel">
          <div class="table-wrap">
            <table class="plan cap">
              <thead>
                <tr>
                  <th>#</th>
                  <th class="t-cap">Bloque</th>
                  <th>Jugados</th>
                  <th>Sin ayuda</th>
                  <th>Con pista</th>
                  <th>Trampa / Solución</th>
                </tr>
              </thead>
              <tbody>${filasBloques}</tbody>
            </table>
          </div>
        </div>

        <h2 class="sec">Continuidad (últimas 12 semanas · ${plural(diasActivos, 'día activo', 'días activos')})</h2>
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
