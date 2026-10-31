/* 05 · Progreso: lo aprendido (retos jugados por tema, tarjetas y retención real, lecturas e ideas) y la calibración.
   Sin calendario ni tasas de acierto: el detalle por reto está en Retos. */
import type { Vista } from '../app';
import { calibracionRetos, type CalibracionRetos } from '../dominio/calibracion';
import { BLOQUES_RETOS, CATALOGO_RETOS, ID_FUENTE_RETOS, todosLosRetos } from '../dominio/catalogo-retos';
import { madurezMazo } from '../dominio/progreso';
import { fmtNum, fmtPct, plural } from '../lib/fmt';
import { esc } from '../lib/html';
import { cabecera } from './comun';

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
    const retos = todosLosRetos(ctx.datos.retos);
    const jugados = new Set(ctx.datos.intentos.filter((i) => !i.borrado && i.fuenteId === ID_FUENTE_RETOS).map((i) => i.ejercicio));
    const jugadosDe = (lista: readonly { id: string }[]) => lista.filter((r) => jugados.has(r.id)).length;
    const porTema = BLOQUES_RETOS.map((b) => ({ b, n: jugadosDe(retos.filter((r) => r.bloque === b.id)) }))
      .filter(({ b, n }) => n > 0 || b.id !== '5')
      .map(({ b, n }) => `${b.corto} ${n}`)
      .join(' · ');
    const totalJugados = jugadosDe(retos);
    const delCatalogo = jugadosDe(CATALOGO_RETOS);
    const mazo = madurezMazo(ctx.datos.tarjetas, ctx.datos.repasos);
    const escritos = ctx.datos.escritos.filter((e) => !e.borrado).length;
    const ideas = ctx.datos.aprendizajes.filter((a) => !a.borrado).length;

    return `
      <section class="view">
        ${cabecera('Progreso', 'Lo que has aprendido y si aciertas tanto como crees.')}

        <div class="kpis">
          <div class="kpi">
            <span class="k">Retos jugados</span>
            <span class="v">${totalJugados}</span>
            <span class="s">${esc(porTema)} · ${delCatalogo} de los ${CATALOGO_RETOS.length} del catálogo</span>
          </div>
          <div class="kpi">
            <span class="k">Tarjetas aprendidas</span>
            <span class="v">${mazo.aprendidas} / ${mazo.totalTarjetas}</span>
            <span class="s">Retención: ${fmtPct(mazo.retencion)} en ${plural(mazo.totalRepasos, 'repaso')}</span>
          </div>
          <div class="kpi">
            <span class="k">Lecturas e ideas</span>
            <span class="v">${escritos + ideas}</span>
            <span class="s">${plural(escritos, 'síntesis 3x1', 'síntesis 3x1')} · ${plural(ideas, 'idea apuntada', 'ideas apuntadas')}</span>
          </div>
        </div>

        <h2 class="sec">Calibración en retos</h2>
        ${panelCalibracion(calibracionRetos(ctx.datos.intentos, retos))}
      </section>`;
  },
};
