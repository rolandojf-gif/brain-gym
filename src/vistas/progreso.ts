/* 05 · Progreso: continuidad real (calendario de sesiones hechas), tasa de resolución de retos
   (sin ayuda vs con pista vs solución y desglose por los 4 bloques temáticos) y madurez del mazo FSRS + lecturas 3x1. */
import type { Vista } from '../app';
import { calibracionRetos, type CalibracionRetos } from '../dominio/calibracion';
import { fuenteRetos, intentosContables } from '../dominio/catalogo-retos';
import { desgloseResolucion, progresoPorCapitulo } from '../dominio/estudio';
import { calendario, madurezMazo } from '../dominio/progreso';
import type { Actividad } from '../dominio/tipos';
import { fmtFecha, fmtNum, fmtPct, plural } from '../lib/fmt';
import { esc } from '../lib/html';
import { NOMBRE_ACTIVIDAD, cabecera } from './comun';

const ORDEN: Actividad[] = ['estudio', 'lectura', 'repaso', 'concepto'];

/** Por debajo, la aproximación normal del margen no vale y cualquier diferencia es ruido: sólo se muestran los datos. */
const MINIMO_CALIBRACION = 10;

// Calibración: si aciertas tanto como dices. El veredicto sólo aparece si el sesgo supera el ruido esperable.
function panelCalibracion(c: CalibracionRetos): string {
  if (c.n === 0 || c.confianzaMedia === null || c.tasaAcierto === null || c.sesgo === null || c.margen === null) {
    return `<div class="panel"><p class="note">Aún sin datos. Cada reto nuevo te pide cuánto confías en tu jugada antes de ver la pista; aquí verás si aciertas tanto como dices.</p></div>`;
  }
  const declarada = fmtPct(c.confianzaMedia), real = fmtPct(c.tasaAcierto);
  const ruido = `con ${plural(c.n, 'reto', 'retos')}, el azar explica hasta ±${Math.round(c.margen * 100)} puntos`;
  const veredicto =
    c.n < MINIMO_CALIBRACION
      ? `Declaras de media ${declarada} y aciertas el ${real}. Con ${plural(c.n, 'reto', 'retos')} todavía es ruido: el veredicto aparece a partir de ${MINIMO_CALIBRACION}.`
      : c.sesgo > c.margen
      ? `<b>Te pasas de confiado:</b> declaras de media ${declarada} y aciertas el ${real} (${ruido}).`
      : c.sesgo < -c.margen
        ? `<b>Te quedas corto:</b> aciertas el ${real} y declaras de media ${declarada} (${ruido}).`
        : `Declaras de media ${declarada} y aciertas el ${real}: <b>compatible con estar bien calibrado</b> (${ruido}).`;
  const filas = c.niveles
    .map((nv) => `<tr><th scope="row">${esc(fmtPct(nv.confianza))}</th><td class="num">${nv.n}</td><td class="num">${nv.aciertos} (${esc(fmtPct(nv.aciertos / nv.n))})</td></tr>`)
    .join('');
  const distingue = c.brier !== null && c.referencia !== null && c.brier < c.referencia;
  const comparacion =
    c.n < MINIMO_CALIBRACION
      ? ''
      : ` Decir siempre tu tasa de acierto daría ${esc(fmtNum(c.referencia, 2))}: ${distingue ? 'tu confianza distingue los retos que sabes de los que no.' : 'de momento tu confianza no distingue mejor que eso.'}`;
  return `
    <div class="panel">
      <p>${veredicto}</p>
      <div class="table-wrap">
        <table class="plan">
          <thead><tr><th>Dices</th><th>Retos</th><th>Aciertas</th></tr></thead>
          <tbody>${filas}</tbody>
        </table>
      </div>
      <p class="note">Brier ${esc(fmtNum(c.brier, 2))} (0 es perfecto).${comparacion} Sólo cuenta el primer intento de cada reto.</p>
    </div>`;
}

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
    // Los retos de debate no tienen acierto posible: no entran en las tasas.
    const contables = intentosContables(ctx.datos.intentos);
    const desglose = desgloseResolucion(contables);
    const porBloque = progresoPorCapitulo(fuente, contables);
    const calibracion = calibracionRetos(ctx.datos.intentos);
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

        <h2 class="sec">Calibración en retos</h2>
        ${panelCalibracion(calibracion)}

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
