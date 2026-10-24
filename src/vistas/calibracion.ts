/* 05 · Calibración: predicciones con probabilidad, resolución, Brier y curva de calibración por tramos. */
import { accion, campos, type Ctx, type Vista } from '../app';
import { brier, brierPorCategoria, curva, porResolver, resueltas, type Tramo } from '../dominio/calibracion';
import { borrar, nuevo } from '../dominio/registro';
import { sumarDias } from '../dominio/sesion';
import type { Prediccion, Resultado } from '../dominio/tipos';
import { fmtNum, fmtPct, fmtRelativo, plural } from '../lib/fmt';
import { esc } from '../lib/html';
import { cabecera, vacio } from './comun';

const RESULTADO: Record<Resultado, string> = { si: 'Sí', no: 'No', anulada: 'Anulada' };

function botonesResolver(p: Prediccion): string {
  return (['si', 'no', 'anulada'] as Resultado[])
    .map((r) => `<button class="btn${r === 'anulada' ? ' sutil' : ''}" data-accion="resolver" data-id="${esc(p.id)}" data-r="${r}">${RESULTADO[r]}</button>`)
    .join('');
}

function fila(ctx: Ctx, p: Prediccion, acciones: string): string {
  return `
    <li>
      <div class="li-main"><b>${esc(p.enunciado)}</b>
        <span class="m-sub">${fmtPct(p.probabilidad)} · ${p.resolucion ? `resuelta: ${RESULTADO[p.resolucion.resultado]}` : `vence ${esc(fmtRelativo(p.venceEl, ctx.hoy))}`}${p.categoria ? ` · ${esc(p.categoria)}` : ''}</span></div>
      <div class="li-acc">${acciones}</div>
    </li>`;
}

/** Curva de calibración: probabilidad media asignada (x) frente a frecuencia observada (y), con la diagonal ideal. */
function grafico(tramos: Tramo[]): string {
  const W = 320, H = 320, M = 36, w = W - M - 10, h = H - M - 10;
  const x = (v: number) => M + v * w, y = (v: number) => 10 + (1 - v) * h;
  const maxN = Math.max(1, ...tramos.map((t) => t.n));
  const marcas = [0, 0.25, 0.5, 0.75, 1];
  const puntos = tramos.filter((t) => t.n > 0 && t.media !== null && t.frecuencia !== null);
  return `
    <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Curva de calibración">
      ${marcas.map((m) => `<line class="rejilla" x1="${x(0)}" x2="${x(1)}" y1="${y(m)}" y2="${y(m)}"/><text class="eje" x="${M - 6}" y="${y(m) + 4}" text-anchor="end">${m * 100}</text><text class="eje" x="${x(m)}" y="${H - 14}" text-anchor="middle">${m * 100}</text>`).join('')}
      <line class="ideal" x1="${x(0)}" y1="${y(0)}" x2="${x(1)}" y2="${y(1)}"/>
      ${puntos.length > 1 ? `<polyline class="traza" points="${puntos.map((t) => `${x(t.media ?? 0)},${y(t.frecuencia ?? 0)}`).join(' ')}"/>` : ''}
      ${puntos.map((t) => `<circle class="punto" cx="${x(t.media ?? 0)}" cy="${y(t.frecuencia ?? 0)}" r="${4 + 6 * Math.sqrt(t.n / maxN)}"><title>${Math.round(t.desde * 100)}–${Math.round(t.hasta * 100)} %: ${t.n} predicciones, ${fmtPct(t.frecuencia)} ocurrieron</title></circle>`).join('')}
      <text class="eje" x="${M + w / 2}" y="${H - 1}" text-anchor="middle">probabilidad asignada (%)</text>
    </svg>`;
}

export const calibracion: Vista = {
  titulo: 'Calibración',
  render(ctx) {
    const vivas = ctx.datos.predicciones.filter((p) => !p.borrado);
    const vencidas = porResolver(vivas, ctx.hoy);
    const abiertas = vivas.filter((p) => !p.resolucion && !vencidas.includes(p)).sort((a, b) => a.venceEl.localeCompare(b.venceEl));
    const hechas = vivas.filter((p) => p.resolucion).sort((a, b) => (b.resolucion?.resueltaEl ?? '').localeCompare(a.resolucion?.resueltaEl ?? ''));
    const rs = resueltas(vivas);
    const tramos = curva(rs, 10);
    const categorias = [...new Set(vivas.map((p) => p.categoria).filter(Boolean))];
    const porCat = brierPorCategoria(vivas);
    return `
      <section class="view">
        ${cabecera('Calibración', 'Cada semana, 3–5 predicciones con probabilidad. Al vencer, se resuelven y puntúan con Brier.')}

        ${vencidas.length ? `<h2 class="sec">Por resolver</h2><ul class="lista">${vencidas.map((p) => fila(ctx, p, botonesResolver(p))).join('')}</ul>` : ''}

        <h2 class="sec">Nueva predicción</h2>
        <form class="panel form-bloque" data-accion="prediccion">
          <label class="campo">Enunciado<textarea name="enunciado" rows="2" required placeholder="Algo verificable, con criterio de resolución claro"></textarea></label>
          <div class="fila">
            <label class="campo corto-v">Probabilidad (%)<input name="prob" type="number" min="1" max="99" step="1" required inputmode="numeric" placeholder="70"></label>
            <label class="campo">Vence<input name="vence" type="date" required value="${sumarDias(ctx.hoy, 30)}" min="${ctx.hoy}"></label>
            <label class="campo">Categoría<input name="categoria" list="categorias" placeholder="trabajo, ciencia…"></label>
          </div>
          <datalist id="categorias">${categorias.map((c) => `<option value="${esc(c)}">`).join('')}</datalist>
          <div class="acciones"><button class="btn primario">Registrar</button></div>
        </form>

        <h2 class="sec">Abiertas</h2>
        ${abiertas.length ? `<ul class="lista">${abiertas.map((p) => fila(ctx, p, `<details class="resolver-antes"><summary class="btn sutil">Resolver ya</summary><div>${botonesResolver(p)}</div></details><button class="btn sutil" data-accion="borrar" data-id="${esc(p.id)}">Borrar</button>`)).join('')}</ul>` : vacio('No hay predicciones abiertas.')}

        <h2 class="sec">Resultados</h2>
        <div class="kpis">
          <div class="kpi"><span class="k">Brier</span><span class="v">${fmtNum(brier(rs))}</span><span class="s">${plural(rs.length, 'predicción resuelta', 'predicciones resueltas')}. 0 es perfecto; decir siempre 50 % da 0,25.</span></div>
        </div>
        ${rs.length ? `
          <div class="panel graf-cal">${grafico(tramos)}<p class="note">Cada punto es un tramo de 10 puntos; su tamaño, cuántas predicciones tiene. Sobre la diagonal, bien calibrado; por debajo, exceso de confianza en el «sí».${rs.length < 20 ? ' Con menos de 20 predicciones resueltas la curva es sobre todo ruido.' : ''}</p></div>
          ${porCat.length > 1 ? `<div class="table-wrap panel"><table class="plan cap"><thead><tr><th class="t-cap">Categoría</th><th>Resueltas</th><th>Brier</th></tr></thead><tbody>${porCat.map((c) => `<tr><td class="t-cap">${esc(c.categoria)}</td><td>${c.n}</td><td>${fmtNum(c.brier)}</td></tr>`).join('')}</tbody></table></div>` : ''}` : ''}

        ${hechas.length ? `<h2 class="sec">Resueltas</h2><ul class="lista">${hechas.slice(0, 30).map((p) => fila(ctx, p, '')).join('')}</ul>` : ''}
      </section>`;
  },
  montar(ctx, raiz) {
    accion(raiz, 'submit', 'prediccion', async (f, e) => {
      e.preventDefault();
      const v = campos(f as HTMLFormElement);
      const prob = Number(v.prob);
      if (!(prob >= 1 && prob <= 99)) return ctx.avisar('La probabilidad debe estar entre 1 y 99 %.', 'error');
      const registro: Prediccion = nuevo({ enunciado: v.enunciado ?? '', probabilidad: prob / 100, venceEl: v.vence ?? ctx.hoy, categoria: v.categoria ?? '' }, new Date());
      await ctx.guardar({ coleccion: 'predicciones', registro });
      await ctx.registrar('calibracion');
      ctx.avisar('Predicción registrada.');
    });
    accion(raiz, 'click', 'resolver', async (b) => {
      const p = ctx.datos.predicciones.find((x) => x.id === b.dataset.id);
      const r = b.dataset.r as Resultado;
      if (!p || !(r in RESULTADO)) return;
      const ahora = new Date();
      const registro: Prediccion = { ...p, resolucion: { resultado: r, resueltaEl: ahora.toISOString() }, actualizado: ahora.toISOString() };
      await ctx.guardar({ coleccion: 'predicciones', registro });
      await ctx.registrar('calibracion');
    });
    accion(raiz, 'click', 'borrar', async (b) => {
      const p = ctx.datos.predicciones.find((x) => x.id === b.dataset.id);
      if (p && confirm('¿Borrar esta predicción? (Para no puntuarla, mejor resolverla como anulada.)')) {
        await ctx.guardar({ coleccion: 'predicciones', registro: borrar(p, new Date()) });
      }
    });
  },
};
