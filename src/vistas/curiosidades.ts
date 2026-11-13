/* Curiosidades: preguntas propias en cuatro pasos. Primero escribes tu hipótesis sin mirar nada; luego la IA la
   contrasta (/api/explorar); después escribes con tus palabras lo que te llevas y, con un toque, pasa a tarjeta.
   #curiosidades lista las preguntas; #curiosidades/<id> abre una. Nada se marca como pendiente: el paso se deduce. */
import { accion, campos, type Ctx, type Vista } from '../app';
import { ErrorDeIa, explorarConIa } from '../datos/ia';
import {
  MAX_CARACTERES_CONCLUSION,
  MAX_CARACTERES_HIPOTESIS,
  MAX_CARACTERES_PREGUNTA,
  ordenarCuriosidades,
  pasoCuriosidad,
  type PasoCuriosidad,
} from '../dominio/explorar';
import { nuevaTarjeta } from '../dominio/fsrs';
import { actualizar, borrar, nuevo } from '../dominio/registro';
import type { Curiosidad, ExploracionIa } from '../dominio/tipos';
import { fmtFecha, fmtRelativo } from '../lib/fmt';
import { esc, urlSegura } from '../lib/html';
import { cabecera, vacio } from './comun';

let explorandoId: string | null = null;
let errorExplorar: { id: string; mensaje: string } | null = null;
/** Lo escrito en la hipótesis y en «lo que me llevo», para no perderlo si llega un repintado o falla la IA. */
const borradores = new Map<string, string>();

/** Qué ofrece el botón de cada curiosidad según el paso en que está. */
export const ACCION_PASO: Record<PasoCuriosidad, string> = {
  hipotesis: 'Escribir mi hipótesis',
  explorar: 'Explorar con la IA',
  conclusion: 'Ver la exploración',
  cerrada: 'Ver',
};

/** Formulario para apuntar una pregunta; lo usan esta vista y la tarjeta de Hoy. */
export function formApuntar(etiqueta: string): string {
  return `
    <form class="form-bloque" data-accion="apuntar-curiosidad">
      <label class="campo">
        ${esc(etiqueta)}
        <input name="pregunta" required maxlength="${MAX_CARACTERES_PREGUNTA}" placeholder="¿Por qué los laboratorios de IA no pactan ir más despacio?">
      </label>
      <div class="acciones"><button class="btn primario">Apuntar</button></div>
    </form>`;
}

/** Engancha el formulario de apuntar en cualquier vista que lo pinte. */
export function montarApuntar(ctx: Ctx, raiz: HTMLElement): void {
  accion(raiz, 'submit', 'apuntar-curiosidad', async (form, e) => {
    e.preventDefault();
    const pregunta = (campos(form as HTMLFormElement).pregunta ?? '').trim().slice(0, MAX_CARACTERES_PREGUNTA);
    if (!pregunta) return;
    const registro: Curiosidad = nuevo({ pregunta, hipotesis: '', conclusion: '' }, new Date());
    await ctx.guardar({ coleccion: 'curiosidades', registro });
    ctx.avisar('Pregunta apuntada. Cuando quieras, escribe qué crees antes de mirar nada.');
  });
}

function renderLista(ctx: Ctx): string {
  const todas = ordenarCuriosidades(ctx.datos.curiosidades);
  const abiertas = todas.filter((c) => pasoCuriosidad(c) !== 'cerrada');
  const cerradas = todas.filter((c) => pasoCuriosidad(c) === 'cerrada');
  const fila = (c: Curiosidad) => {
    const paso = pasoCuriosidad(c);
    const sub = paso === 'cerrada' ? `Te llevas: «${esc(c.conclusion)}»` : `Apuntada ${esc(fmtRelativo(c.creado, ctx.hoy))}`;
    return `
      <li>
        <div class="li-main"><b>${esc(c.pregunta)}</b><span class="m-sub">${sub}</span></div>
        <div class="li-acc"><a class="btn ${paso === 'cerrada' ? 'sutil' : 'primario'}" href="#curiosidades/${esc(c.id)}">${esc(ACCION_PASO[paso])}</a></div>
      </li>`;
  };
  return `
    ${cabecera('Curiosidades', 'Preguntas tuyas. Primero escribes qué crees; luego la IA lo contrasta con lo que se sabe y te llevas una frase propia.')}
    <div class="panel curiosidad-nueva">${formApuntar('Una pregunta que te ronde')}</div>
    <h2 class="sec">Preguntas</h2>
    ${abiertas.length ? `<ul class="lista">${abiertas.map(fila).join('')}</ul>` : vacio('Ninguna abierta. Apunta la próxima que te ronde.')}
    ${cerradas.length ? `<h2 class="sec">Lo que te has llevado</h2><ul class="lista">${cerradas.map(fila).join('')}</ul>` : ''}`;
}

function renderExploracion(c: Curiosidad, x: ExploracionIa): string {
  const cargando = explorandoId === c.id;
  const fuentes = x.fuentes
    .map((f) => {
      const u = urlSegura(f.url);
      return u ? `<li><a href="${esc(u)}" target="_blank" rel="noopener noreferrer">${esc(f.titulo)} ↗</a></li>` : '';
    })
    .join('');
  return `
    <aside class="panel abogado-diablo exploracion" aria-label="Exploración de la IA">
      <header class="ad-head"><span>&gt;_ EXPLORACIÓN</span><small>${esc(fmtFecha(x.fecha))}</small></header>
      <div class="ad-bloque"><span class="ad-lbl">Lo que aciertas:</span><p>${esc(x.acierta)}</p></div>
      <div class="ad-bloque"><span class="ad-lbl">Lo que falla o se te escapa:</span><p>${esc(x.falla)}</p></div>
      <div class="ad-bloque"><span class="ad-lbl">Qué dice la investigación:</span><p>${esc(x.investigacion)}</p></div>
      <div class="ad-bloque">
        <span class="ad-lbl">Para leer más:</span>
        ${fuentes ? `<ul class="fuentes">${fuentes}</ul>` : '<p>Sin fuentes: las que propuso no respondían, así que no se enseñan.</p>'}
      </div>
      ${pasoCuriosidad(c) === 'conclusion'
        ? `<div class="acciones"><button type="button" class="btn sutil" data-accion="explorar" data-id="${esc(c.id)}"${cargando ? ' disabled' : ''}>${cargando ? 'Explorando…' : 'Repetir la exploración'}</button></div>`
        : ''}
    </aside>`;
}

function renderUna(ctx: Ctx, id: string): string {
  const c = ctx.datos.curiosidades.find((x) => x.id === id && !x.borrado);
  if (!c) return vacio('Esa pregunta no existe.');
  const paso = pasoCuriosidad(c);
  const cargando = explorandoId === c.id;
  const err = errorExplorar?.id === c.id ? `<p class="ia-error" role="alert">${esc(errorExplorar.mensaje)}</p>` : '';

  // 1 · Hipótesis: editable hasta que se explora; después queda fija, porque es lo que te comprometiste a pensar.
  const hipotesis = c.exploracion
    ? `<div class="panel escrito"><h2 class="sec">Tu hipótesis</h2><p>${esc(c.hipotesis)}</p></div>`
    : `
      <form class="panel form-bloque curiosidad-paso" data-accion="explorar-form" data-id="${esc(c.id)}">
        <label class="campo">
          <span>1. Tu hipótesis · <small>qué crees y por qué, antes de mirar nada. «No lo sé, pero sospecho que…» también vale.</small></span>
          <textarea name="hipotesis" rows="4" required maxlength="${MAX_CARACTERES_HIPOTESIS}" data-accion="borrador-curiosidad" data-id="${esc(c.id)}" placeholder="Creo que… porque…"${cargando ? ' disabled' : ''}>${esc(borradores.get(c.id) ?? c.hipotesis)}</textarea>
        </label>
        <div class="acciones">
          <button class="btn primario"${cargando ? ' disabled' : ''}>${cargando ? 'Explorando…' : 'Explorar con la IA'}</button>
          <button type="button" class="btn sutil" data-accion="guardar-hipotesis" data-id="${esc(c.id)}"${cargando ? ' disabled' : ''}>Guardar sin explorar</button>
        </div>
        ${err}
      </form>`;

  // 3 y 4 · Lo que me llevo y tarjeta.
  let conclusion = '';
  if (paso === 'conclusion') {
    const clave = `conclusion:${c.id}`;
    conclusion = `
      <form class="panel form-bloque curiosidad-paso" data-accion="concluir" data-id="${esc(c.id)}">
        <label class="campo">
          <span>3. Lo que me llevo · <small>en una o dos frases, con tus palabras.</small></span>
          <textarea name="conclusion" rows="3" required maxlength="${MAX_CARACTERES_CONCLUSION}" data-accion="borrador-curiosidad" data-id="${esc(clave)}">${esc(borradores.get(clave) ?? '')}</textarea>
        </label>
        <label class="check-linea">
          <input type="checkbox" name="crearTarjeta" value="si" checked>
          <span>Convertir también en tarjeta de repaso</span>
        </label>
        <div class="acciones"><button class="btn primario">Guardar</button></div>
      </form>`;
  } else if (paso === 'cerrada') {
    const tarjeta = c.tarjetaId ? ctx.datos.tarjetas.find((t) => t.id === c.tarjetaId && !t.borrado) : undefined;
    conclusion = `
      <div class="panel escrito curiosidad-paso">
        <h2 class="sec">Lo que te llevas</h2>
        <p><b>${esc(c.conclusion)}</b></p>
        <div class="acciones">
          ${tarjeta
            ? `<span class="tag e-sin_ayuda">✓ En Repaso</span><a class="btn sutil" href="#repaso/editar/${esc(tarjeta.id)}">Editar la tarjeta</a>`
            : `<button type="button" class="btn" data-accion="tarjeta-curiosidad" data-id="${esc(c.id)}">Convertir en tarjeta</button>`}
        </div>
      </div>`;
  }

  return `
    <div class="view-head">
      <p class="kicker">Curiosidad · apuntada el ${esc(fmtFecha(c.creado))}</p>
      <h1 class="curiosidad-pregunta">${esc(c.pregunta)}</h1>
    </div>
    ${hipotesis}
    ${c.exploracion ? renderExploracion(c, c.exploracion) : ''}
    ${c.exploracion ? err : ''}
    ${conclusion}
    <div class="acciones">
      <a class="btn sutil" href="#curiosidades">Todas las preguntas</a>
      <button type="button" class="btn sutil" data-accion="descartar-curiosidad" data-id="${esc(c.id)}">Descartar la pregunta</button>
    </div>`;
}

export const curiosidades: Vista = {
  titulo: 'Curiosidades',
  render(ctx) {
    const id = ctx.sub;
    return `<section class="view curiosidades">${id ? renderUna(ctx, id) : renderLista(ctx)}</section>`;
  },
  montar(ctx, raiz) {
    montarApuntar(ctx, raiz);

    const buscar = (id: string | undefined) => ctx.datos.curiosidades.find((x) => x.id === id && !x.borrado);

    accion(raiz, 'input', 'borrador-curiosidad', (el) => {
      borradores.set(el.dataset.id ?? '', (el as HTMLTextAreaElement).value);
    });

    accion(raiz, 'click', 'guardar-hipotesis', async (b) => {
      const c = buscar(b.dataset.id);
      const texto = (borradores.get(c?.id ?? '') ?? c?.hipotesis ?? '').trim().slice(0, MAX_CARACTERES_HIPOTESIS);
      if (!c || !texto) return;
      borradores.delete(c.id);
      await ctx.guardar({ coleccion: 'curiosidades', registro: actualizar(c, { hipotesis: texto }, new Date()) });
      ctx.avisar('Hipótesis guardada.');
    });

    const explorar = async (c: Curiosidad, hipotesis: string) => {
      if (explorandoId) return;
      explorandoId = c.id;
      errorExplorar = null;
      // La hipótesis se guarda antes de llamar: si la IA falla o no hay red, no se pierde.
      const conHipotesis = hipotesis !== c.hipotesis ? actualizar(c, { hipotesis }, new Date()) : c;
      if (conHipotesis !== c) await ctx.guardar({ coleccion: 'curiosidades', registro: conHipotesis });
      else ctx.pintar();
      borradores.delete(c.id);
      try {
        const exploracion = await explorarConIa(ctx.almacen, { pregunta: c.pregunta, hipotesis });
        explorandoId = null;
        const actual = buscar(c.id) ?? conHipotesis;
        await ctx.guardar({ coleccion: 'curiosidades', registro: actualizar(actual, { exploracion }, new Date()) });
      } catch (err) {
        explorandoId = null;
        const mensaje = err instanceof ErrorDeIa ? err.message : 'No se pudo completar la exploración. Revisa tu conexión.';
        errorExplorar = { id: c.id, mensaje };
        ctx.avisar(mensaje, 'error');
        ctx.pintar();
      }
    };

    accion(raiz, 'submit', 'explorar-form', async (form, e) => {
      e.preventDefault();
      const c = buscar(form.dataset.id);
      const hipotesis = (campos(form as HTMLFormElement).hipotesis ?? '').trim().slice(0, MAX_CARACTERES_HIPOTESIS);
      if (c && hipotesis) await explorar(c, hipotesis);
    });

    accion(raiz, 'click', 'explorar', async (b) => {
      const c = buscar(b.dataset.id);
      if (c?.hipotesis.trim()) await explorar(c, c.hipotesis);
    });

    accion(raiz, 'submit', 'concluir', async (form, e) => {
      e.preventDefault();
      const c = buscar(form.dataset.id);
      const v = campos(form as HTMLFormElement);
      const conclusion = (v.conclusion ?? '').trim().slice(0, MAX_CARACTERES_CONCLUSION);
      if (!c || !conclusion) return;
      const ahora = new Date();
      borradores.delete(`conclusion:${c.id}`);
      if (v.crearTarjeta === 'si') {
        const tarjeta = nuevaTarjeta(c.pregunta, conclusion, ahora, { coleccion: 'curiosidades', id: c.id });
        await ctx.guardar(
          { coleccion: 'tarjetas', registro: tarjeta },
          { coleccion: 'curiosidades', registro: actualizar(c, { conclusion, tarjetaId: tarjeta.id }, ahora) },
        );
        ctx.avisar('Guardado, y convertido en tarjeta de repaso.');
      } else {
        await ctx.guardar({ coleccion: 'curiosidades', registro: actualizar(c, { conclusion }, ahora) });
        ctx.avisar('Guardado.');
      }
    });

    accion(raiz, 'click', 'tarjeta-curiosidad', async (b) => {
      const c = buscar(b.dataset.id);
      if (!c?.conclusion) return;
      const ahora = new Date();
      const tarjeta = nuevaTarjeta(c.pregunta, c.conclusion, ahora, { coleccion: 'curiosidades', id: c.id });
      await ctx.guardar(
        { coleccion: 'tarjetas', registro: tarjeta },
        { coleccion: 'curiosidades', registro: actualizar(c, { tarjetaId: tarjeta.id }, ahora) },
      );
      ctx.avisar('Tarjeta guardada en Repaso.');
    });

    accion(raiz, 'click', 'descartar-curiosidad', async (b) => {
      const c = buscar(b.dataset.id);
      if (!c) return;
      await ctx.guardar({ coleccion: 'curiosidades', registro: borrar(c, new Date()) });
      ctx.avisar(`Pregunta descartada.${c.tarjetaId ? ' Su tarjeta sigue en Repaso.' : ''}`);
      ctx.ir('#curiosidades');
    });
  },
};

