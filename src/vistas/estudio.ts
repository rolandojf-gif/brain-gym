/* 02 · Estudio: registro de ejercicios por fuente y capítulo, y progreso por capítulo. No se copia el contenido:
   sólo se enlaza la fuente y se registra el intento. */
import { accion, campos, type Ctx, type Vista } from '../app';
import { ETIQUETA_ESTADO, progresoPorCapitulo, proporcionSinAyuda } from '../dominio/estudio';
import { actualizar, borrar, nuevo } from '../dominio/registro';
import type { EstadoIntento, Fuente, Intento } from '../dominio/tipos';
import { fmtDuracion, fmtPct, fmtRelativo, plural } from '../lib/fmt';
import { esc, urlSegura } from '../lib/html';
import { cabecera, vacio } from './comun';

const ESTADOS: EstadoIntento[] = ['sin_ayuda', 'con_pista', 'solucion', 'no_resuelto'];
const CLAVE_FUENTE = 'bg.estudio.fuente';

function fuenteActual(ctx: Ctx): Fuente | undefined {
  const fuentes = ctx.datos.fuentes.filter((f) => !f.borrado);
  let id: string | null = null;
  try { id = localStorage.getItem(CLAVE_FUENTE); } catch { /* sin preferencia guardada */ }
  return fuentes.find((f) => f.id === id) ?? fuentes[0];
}

function formIntento(f: Fuente, ultimo: Intento | undefined): string {
  const capInicial = ultimo?.capitulo ?? f.capitulos[0]?.id ?? '';
  const selectorCap = f.capitulos.length
    ? `<select name="capitulo" required>${f.capitulos.map((c) => `<option value="${esc(c.id)}"${c.id === capInicial ? ' selected' : ''}>${esc(`${c.id}. ${c.titulo}`)}</option>`).join('')}</select>`
    : `<input name="capitulo" required value="${esc(capInicial)}" placeholder="Capítulo">`;
  return `
    <form class="panel form-bloque" data-accion="intento">
      <div class="fila">
        <label class="campo">Capítulo${selectorCap}</label>
        <label class="campo">Ejercicio<input name="ejercicio" required placeholder="p. ej. 2.14" autocomplete="off"></label>
        <label class="campo corto-v">Minutos<input name="minutos" type="number" min="0" max="600" inputmode="numeric" placeholder="0"></label>
      </div>
      <fieldset class="seg-radio estados"><legend>Resultado</legend>
        ${ESTADOS.map((e, i) => `<label class="e-${e}"><input type="radio" name="estado" value="${e}" required${i === 0 ? ' checked' : ''}> ${esc(ETIQUETA_ESTADO[e])}</label>`).join('')}
      </fieldset>
      <label class="campo">Nota breve sobre el error<textarea name="nota" rows="2" placeholder="Qué falló o qué idea faltaba (opcional)"></textarea></label>
      <div class="acciones"><button class="btn primario">Registrar intento</button></div>
    </form>`;
}

function filaIntento(ctx: Ctx, i: Intento): string {
  const tarjeta = ctx.datos.tarjetas.find((t) => !t.borrado && t.origen?.coleccion === 'intentos' && t.origen.id === i.id);
  const crear = i.estado !== 'sin_ayuda' && !tarjeta ? `<a class="btn sutil" href="#repaso/nueva/intentos/${esc(i.id)}">Crear tarjeta</a>` : '';
  return `
    <li>
      <div class="li-main">
        <b>Cap. ${esc(i.capitulo)} · ej. ${esc(i.ejercicio)} <span class="tag e-${i.estado}">${esc(ETIQUETA_ESTADO[i.estado])}</span></b>
        ${i.notaError ? `<span>${esc(i.notaError)}</span>` : ''}
        <span class="m-sub">${esc(fmtRelativo(i.dia, ctx.hoy))}${i.segundos ? ` · ${esc(fmtDuracion(i.segundos))}` : ''}${tarjeta ? ' · con tarjeta' : ''}</span>
      </div>
      <div class="li-acc">${crear}<button class="btn sutil" data-accion="borrar-intento" data-id="${esc(i.id)}">Borrar</button></div>
    </li>`;
}

export const estudio: Vista = {
  titulo: 'Estudio',
  render(ctx) {
    const fuentes = ctx.datos.fuentes.filter((f) => !f.borrado);
    const f = fuenteActual(ctx);
    if (!f) return `<section class="view">${cabecera('Estudio')}${vacio('No hay fuentes de estudio.')}</section>`;
    const intentos = ctx.datos.intentos.filter((i) => !i.borrado && i.fuenteId === f.id).sort((a, b) => b.creado.localeCompare(a.creado));
    const progreso = progresoPorCapitulo(f, intentos);
    const url = urlSegura(f.url);
    const filasCap = progreso.map((p) => `
      <tr>
        <th scope="row">${esc(p.capitulo)}</th><td class="t-cap">${esc(p.titulo)}</td>
        <td class="num">${p.intentados}</td><td class="num">${p.sinAyuda}</td>
        <td class="num"><input class="mini" type="number" min="0" max="999" value="${p.total ?? ''}" data-accion="total" data-cap="${esc(p.capitulo)}" aria-label="${esc(`Ejercicios del capítulo ${p.capitulo}`)}" placeholder="—"></td>
      </tr>`).join('');
    return `
      <section class="view">
        ${cabecera('Estudio', 'Resuelve cada ejercicio antes de mirar la solución, sin IA. Aquí sólo se registra.')}
        <div class="fuentes seg" role="group" aria-label="Fuente">
          ${fuentes.map((x) => `<button class="seg-btn" data-accion="fuente" data-id="${esc(x.id)}" aria-pressed="${x.id === f.id}">${esc(x.titulo.split(' (')[0] ?? x.titulo)}</button>`).join('')}
        </div>
        ${url ? `<p class="note"><a href="${esc(url)}" target="_blank" rel="noopener noreferrer">Abrir ${esc(f.titulo)} ↗</a></p>` : ''}

        <h2 class="sec">Registrar un intento</h2>
        ${formIntento(f, intentos[0])}

        <h2 class="sec">Últimos intentos</h2>
        ${intentos.length ? `<ul class="lista">${intentos.slice(0, 20).map((i) => filaIntento(ctx, i)).join('')}</ul>` : vacio('Aún no hay intentos en esta fuente.')}

        <h2 class="sec">Progreso por capítulo</h2>
        <div class="panel">
          <p class="estado-sync">Sin ayuda: ${fmtPct(proporcionSinAyuda(intentos))} de ${plural(intentos.length, 'intento')}. El estado de cada ejercicio es el de su último intento.</p>
          ${progreso.length ? `<div class="table-wrap"><table class="plan cap"><thead><tr><th>#</th><th class="t-cap">Capítulo</th><th>Intentados</th><th>Sin ayuda</th><th>Total</th></tr></thead><tbody>${filasCap}</tbody></table></div>` : ''}
          <form class="form-linea" data-accion="capitulo">
            <label class="sr-only" for="cap-id">Número</label><input id="cap-id" name="id" required placeholder="Nº" class="mini">
            <label class="sr-only" for="cap-titulo">Título</label><input id="cap-titulo" name="titulo" required placeholder="Título del capítulo">
            <button class="btn">Añadir capítulo</button>
          </form>
        </div>
      </section>`;
  },
  montar(ctx, raiz) {
    accion(raiz, 'click', 'fuente', (b) => {
      try { localStorage.setItem(CLAVE_FUENTE, b.dataset.id ?? ''); } catch { /* sin preferencia guardada */ }
      ctx.pintar();
    });
    accion(raiz, 'submit', 'intento', async (form, e) => {
      e.preventDefault();
      const f = fuenteActual(ctx);
      if (!f) return;
      const v = campos(form as HTMLFormElement);
      const segundos = Math.round((Number(v.minutos) || 0) * 60);
      const estado = (ESTADOS.includes(v.estado as EstadoIntento) ? v.estado : 'no_resuelto') as EstadoIntento;
      const registro: Intento = nuevo({ fuenteId: f.id, capitulo: v.capitulo ?? '', ejercicio: v.ejercicio ?? '', estado, segundos, notaError: v.nota ?? '', dia: ctx.hoy }, new Date());
      await ctx.guardar({ coleccion: 'intentos', registro });
      await ctx.registrar('estudio', segundos);
      ctx.avisar(estado === 'sin_ayuda' ? 'Intento registrado.' : 'Intento registrado. Puedes crear una tarjeta desde la lista.');
      raiz.querySelector<HTMLInputElement>('input[name="ejercicio"]')?.focus();
    });
    accion(raiz, 'click', 'borrar-intento', async (b) => {
      const i = ctx.datos.intentos.find((x) => x.id === b.dataset.id);
      if (!i || !confirm(`¿Borrar el intento del ejercicio ${i.ejercicio}?`)) return;
      await ctx.guardar({ coleccion: 'intentos', registro: borrar(i, new Date()) });
    });
    accion(raiz, 'change', 'total', async (el) => {
      const f = fuenteActual(ctx);
      if (!f) return;
      const n = Number((el as HTMLInputElement).value);
      const capitulos = f.capitulos.map((c) => {
        if (c.id !== el.dataset.cap) return c;
        return n > 0 ? { ...c, ejercicios: Math.round(n) } : { id: c.id, titulo: c.titulo };
      });
      await ctx.guardar({ coleccion: 'fuentes', registro: actualizar(f, { capitulos }, new Date()) });
    });
    accion(raiz, 'submit', 'capitulo', async (form, e) => {
      e.preventDefault();
      const f = fuenteActual(ctx);
      const { id = '', titulo = '' } = campos(form as HTMLFormElement);
      if (!f || !id || f.capitulos.some((c) => c.id === id)) return ctx.avisar('Ese capítulo ya existe.', 'error');
      await ctx.guardar({ coleccion: 'fuentes', registro: actualizar(f, { capitulos: [...f.capitulos, { id, titulo }] }, new Date()) });
    });
  },
};
