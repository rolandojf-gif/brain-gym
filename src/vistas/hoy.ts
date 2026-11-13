/* 01 · Hoy: un menú, no una agenda. Tres cosas para elegir (un reto, una lectura, una curiosidad), una rejilla viva que
   enseña algo de teoría de juegos mientras decides y, si hay tarjetas vencidas, un aviso discreto para repasarlas.
   Nada se marca como pendiente ni hecho. El reto va primero y grande: es lo que más invita a participar. */
import { accion, campos, type Ctx, type Vista } from '../app';
import { BLOQUES_RETOS, CATALOGO_RETOS, retosJugables, siguienteRetoPendiente, temaSiguiente, todosLosRetos, type Reto } from '../dominio/catalogo-retos';
import { ordenarCuriosidades, pasoCuriosidad } from '../dominio/explorar';
import { vencidas } from '../dominio/fsrs';
import { haceCuanto, hayOtroRecuerdo, recuerdoDelDia, recuerdos } from '../dominio/recuerdos';
import { actualizar } from '../dominio/registro';
import { separarPregunta } from '../dominio/texto';
import type { TemaReto } from '../dominio/tipos';
import { fmtFechaLarga, plural } from '../lib/fmt';
import { esc, urlSegura } from '../lib/html';
import { ACCION_PASO, formApuntar, montarApuntar } from './curiosidades';
import { empezarReto } from './estudio';
import { montarRejilla, renderRejilla } from './rejilla';

/** Tema elegido a mano en el selector. Vale hasta que se juega un reto: después vuelve la rotación. */
let temaElegido: { id: TemaReto; el: string } | null = null;

/** Lo escrito en «¿Qué harías tú?»: sobrevive a un repintado (una sincronización) mientras sea del mismo reto. */
let borrador = { retoId: '', texto: '' };

/** Cuántas veces se ha pedido «otro recuerdo» hoy; sólo en memoria: al reabrir vuelve el del día. */
let saltoRecuerdo = { dia: '', n: 0 };

function temaActual(ctx: Ctx, jugables: readonly Reto[]): TemaReto {
  const rotacion = temaSiguiente(ctx.datos.intentos, jugables);
  const el = temaElegido?.el ?? '';
  if (temaElegido && (ctx.datos.intentos.some((i) => i.creado > el) || !jugables.some((r) => r.bloque === temaElegido?.id))) temaElegido = null;
  return temaElegido?.id ?? rotacion;
}

function renderRepaso(ctx: Ctx): string {
  const n = vencidas(ctx.datos.tarjetas, ctx.ahora).length;
  if (n === 0) return '';
  return `<a class="chip-repaso" href="#repaso">${plural(n, 'tarjeta para repasar', 'tarjetas para repasar')} →</a>`;
}

function renderReto(ctx: Ctx): string {
  const jugables = retosJugables(todosLosRetos(ctx.datos.retos));
  const tema = temaActual(ctx, jugables);
  const reto = siguienteRetoPendiente(ctx.datos.intentos, jugables, tema) ?? CATALOGO_RETOS[0];
  const bloque = BLOQUES_RETOS.find((b) => b.id === reto.bloque);
  const { cuerpo, pregunta } = separarPregunta(reto.escenario);
  const escrito = borrador.retoId === reto.id ? borrador.texto : '';
  // Un tema sin ningún reto (la carrera por la AGI antes del primer generado) no se ofrece.
  const selector = BLOQUES_RETOS.filter((b) => jugables.some((r) => r.bloque === b.id)).map(
    (b) =>
      `<button type="button" class="seg-btn" data-accion="tema" data-tema="${esc(b.id)}" aria-pressed="${b.id === tema}">${esc(b.corto)}</button>`,
  ).join('');

  return `
    <article class="act act-reto">
      <header>
        <h2>Un reto</h2>
        <span class="m-sub">${esc(bloque?.titulo ?? '')}${reto.generado ? ' · generado por IA' : ''}${reto.debate ? ' · debate' : ''}</span>
      </header>
      <p class="reto-hoy-titulo">${esc(reto.titulo)}</p>
      <p>${esc(cuerpo)}</p>
      ${pregunta ? `<p class="reto-hoy-pregunta">${esc(pregunta)}</p>` : ''}
      <form class="form-bloque" data-accion="jugar" data-id="${esc(reto.id)}">
        <label class="campo">
          ¿Qué harías tú? Antes de ver las opciones (opcional)
          <textarea name="respuesta" rows="2" maxlength="300" data-accion="borrador-reto" data-id="${esc(reto.id)}" placeholder="Tu jugada y por qué, en una o dos líneas.">${esc(escrito)}</textarea>
        </label>
        <div class="reto-hoy-pie">
          <div class="seg tema" role="group" aria-label="Tema del reto">${selector}</div>
          <button class="btn primario grande">Jugar →</button>
        </div>
      </form>
    </article>`;
}

function renderLectura(ctx: Ctx): string {
  const porEscribir = ctx.datos.lecturas.find((l) => !l.borrado && l.estado === 'leida');
  const siguiente = ctx.datos.lecturas.find((l) => !l.borrado && l.estado === 'pendiente');

  let cuerpo: string;
  if (porEscribir) {
    cuerpo = `
      <p class="act-obra">«${esc(porEscribir.titulo)}»</p>
      <p>Ya la leíste. Queda extraer de memoria la tesis, el mecanismo y el punto ciego.</p>
      <div class="acciones">
        <a class="btn primario" href="#lectura/escribir/${esc(porEscribir.id)}">Escribir el 3x1</a>
      </div>`;
  } else if (siguiente) {
    const url = urlSegura(siguiente.url);
    cuerpo = `
      <p class="act-obra">«${esc(siguiente.titulo)}»</p>
      ${siguiente.medio ? `<p class="m-sub">${esc(siguiente.medio)}</p>` : ''}
      <div class="acciones">
        ${url ? `<a class="btn" href="${esc(url)}" target="_blank" rel="noopener noreferrer">Abrir ↗</a>` : ''}
        <button type="button" class="btn primario" data-accion="lectura-leida" data-id="${esc(siguiente.id)}">Leída: escribir 3x1</button>
        <a class="btn sutil" href="#lectura">Ver cola</a>
      </div>`;
  } else {
    cuerpo = `
      <p>La cola está vacía.</p>
      <div class="acciones"><a class="btn primario" href="#lectura">Añadir una lectura</a></div>`;
  }

  return `
    <article class="act act-lectura">
      <header><h2>Una lectura</h2></header>
      ${cuerpo}
    </article>`;
}

/* La curiosidad abierta más reciente, para retomarla; si no hay, la invitación a apuntar una. */
function renderCuriosidad(ctx: Ctx): string {
  const todas = ordenarCuriosidades(ctx.datos.curiosidades);
  const abierta = todas.find((c) => pasoCuriosidad(c) !== 'cerrada');
  const verTodas = todas.length ? `<a class="btn sutil" href="#curiosidades">Todas (${todas.length})</a>` : '';
  const cuerpo = abierta
    ? `
      <p class="act-obra">${esc(abierta.pregunta)}</p>
      <p class="m-sub">${pasoCuriosidad(abierta) === 'hipotesis' ? 'Antes de mirar nada: ¿qué crees tú?' : pasoCuriosidad(abierta) === 'explorar' ? 'Tienes tu hipótesis. ¿La contrastamos?' : 'Explorada. ¿Qué te llevas?'}</p>
      <div class="acciones">
        <a class="btn primario" href="#curiosidades/${esc(abierta.id)}">${esc(ACCION_PASO[pasoCuriosidad(abierta)])}</a>
        <a class="btn sutil" href="#curiosidades">Apuntar otra</a>
      </div>`
    : `${formApuntar('Una pregunta que te ronde')}${verTodas ? `<div class="acciones">${verTodas}</div>` : ''}`;
  return `
    <article class="act act-curiosidad">
      <header><h2>Una curiosidad</h2></header>
      ${cuerpo}
    </article>`;
}

/* Tu propia voz de hace un tiempo, junto a lo que resultó. Si aún no hay nada que recordar, no se pinta. */
function renderRecuerdo(ctx: Ctx): string {
  const todos = recuerdos(ctx.datos, todosLosRetos(ctx.datos.retos));
  if (saltoRecuerdo.dia !== ctx.hoy) saltoRecuerdo = { dia: ctx.hoy, n: 0 };
  const r = recuerdoDelDia(todos, ctx.hoy, saltoRecuerdo.n);
  if (!r) return '';
  return `
    <aside class="recuerdo" aria-label="Un recuerdo tuyo">
      <p class="kicker">${esc(haceCuanto(r.fecha, ctx.hoy))} · ${esc(r.contexto)}</p>
      <blockquote>${esc(r.tuyo)}</blockquote>
      ${r.desenlace ? `<p class="recuerdo-desenlace"><b>${esc(r.desenlace.etiqueta)}.</b> ${esc(r.desenlace.texto)}</p>` : ''}
      <div class="recuerdo-pie">
        <a href="${esc(r.enlace)}">Volver a verlo →</a>
        ${hayOtroRecuerdo(todos, ctx.hoy) ? '<button type="button" data-accion="otro-recuerdo">Otro recuerdo</button>' : ''}
      </div>
    </aside>`;
}

export const hoy: Vista = {
  titulo: 'Hoy',
  render(ctx) {
    return `
      <section class="view hoy">
        <div class="hoy-grid">
          <div class="hoy-saludo">
            <p class="kicker">${esc(fmtFechaLarga(ctx.hoy))}</p>
            <h1>¿Qué te apetece?</h1>
            <p class="lede">Elige una cosa; con una basta.</p>
            ${renderRepaso(ctx)}
            <a class="chip-juego" href="#secuencias">Secuencias: un juego de atención →</a>
          </div>
          ${renderRejilla()}
          ${renderRecuerdo(ctx)}
          ${renderReto(ctx)}
          <div class="hoy-lado">
            ${renderLectura(ctx)}
            ${renderCuriosidad(ctx)}
          </div>
        </div>
      </section>`;
  },
  montar(ctx, raiz) {
    montarRejilla(raiz);
    montarApuntar(ctx, raiz);

    accion(raiz, 'click', 'otro-recuerdo', () => {
      saltoRecuerdo = { dia: ctx.hoy, n: saltoRecuerdo.n + 1 };
      ctx.pintar();
    });

    accion(raiz, 'input', 'borrador-reto', (el) => {
      borrador = { retoId: el.dataset.id ?? '', texto: (el as HTMLTextAreaElement).value };
    });

    accion(raiz, 'submit', 'jugar', (form, e) => {
      e.preventDefault();
      const id = form.dataset.id;
      if (!id) return;
      empezarReto(id, campos(form as HTMLFormElement).respuesta ?? '');
      borrador = { retoId: '', texto: '' };
      ctx.ir(`#estudio/reto/${id}`);
    });

    accion(raiz, 'click', 'tema', (b) => {
      const id = BLOQUES_RETOS.find((x) => x.id === b.dataset.tema)?.id;
      if (!id) return;
      // Pulsar el tema que ya toca por rotación vuelve a la rotación.
      const rotacion = temaSiguiente(ctx.datos.intentos, retosJugables(todosLosRetos(ctx.datos.retos)));
      temaElegido = id === rotacion ? null : { id, el: new Date().toISOString() };
      ctx.pintar();
    });

    accion(raiz, 'click', 'lectura-leida', async (b) => {
      const l = ctx.datos.lecturas.find((x) => x.id === b.dataset.id);
      if (!l) return;
      const ahora = new Date();
      await ctx.guardar({ coleccion: 'lecturas', registro: actualizar(l, { estado: 'leida', leidaEl: ahora.toISOString() }, ahora) });
      ctx.ir(`#lectura/escribir/${l.id}`);
    });
  },
};
