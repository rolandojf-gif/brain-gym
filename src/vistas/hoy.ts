/* 01 · Hoy: un menú, no una agenda. Tres cosas para elegir (un reto, una lectura, una idea), una rejilla viva que
   enseña algo de teoría de juegos mientras decides y, si hay tarjetas vencidas, un aviso discreto para repasarlas.
   Nada se marca como pendiente ni hecho. El reto va primero y grande: es lo que más invita a participar. */
import { accion, campos, type Ctx, type Vista } from '../app';
import { BLOQUES_RETOS, CATALOGO_RETOS, retosJugables, siguienteRetoPendiente, temaSiguiente, todosLosRetos, type Reto } from '../dominio/catalogo-retos';
import { nuevaTarjeta, vencidas } from '../dominio/fsrs';
import { actualizar, nuevo } from '../dominio/registro';
import { separarPregunta } from '../dominio/texto';
import type { Aprendizaje, TemaReto } from '../dominio/tipos';
import { fmtFechaLarga, plural } from '../lib/fmt';
import { esc, urlSegura } from '../lib/html';
import { empezarReto } from './estudio';
import { montarRejilla, renderRejilla } from './rejilla';

/** Tema elegido a mano en el selector. Vale hasta que se juega un reto: después vuelve la rotación. */
let temaElegido: { id: TemaReto; el: string } | null = null;

/** Lo escrito en «¿Qué harías tú?»: sobrevive a un repintado (una sincronización) mientras sea del mismo reto. */
let borrador = { retoId: '', texto: '' };

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

function renderIdea(ctx: Ctx): string {
  const deHoy = ctx.datos.aprendizajes.filter((x) => !x.borrado && x.dia === ctx.hoy).sort((a, b) => b.creado.localeCompare(a.creado));
  const ultima = deHoy[0];
  return `
    <article class="act act-idea">
      <header><h2>Una idea</h2></header>
      ${ultima ? `<p class="m-sub">Hoy apuntaste: «${esc(ultima.texto)}»${deHoy.length > 1 ? ` y ${plural(deHoy.length - 1, 'otra', 'otras')}` : ''}.</p>` : ''}
      <form class="form-bloque" data-accion="aprendizaje">
        <label class="campo">
          Un modelo mental que te llevas, en una línea
          <input name="texto" required placeholder="Ley de Goodhart: la métrica que se persigue deja de medir.">
        </label>
        <label class="check-linea">
          <input type="checkbox" name="crearTarjeta" value="si" checked>
          <span>Convertir también en tarjeta</span>
        </label>
        <div class="acciones"><button class="btn primario">Guardar</button></div>
      </form>
    </article>`;
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
          ${renderReto(ctx)}
          <div class="hoy-lado">
            ${renderLectura(ctx)}
            ${renderIdea(ctx)}
          </div>
        </div>
      </section>`;
  },
  montar(ctx, raiz) {
    montarRejilla(raiz);

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

    accion(raiz, 'submit', 'aprendizaje', async (form, e) => {
      e.preventDefault();
      const v = campos(form as HTMLFormElement);
      const texto = (v.texto ?? '').trim();
      if (!texto) return;
      const ahora = new Date();
      const baseAp: Aprendizaje = nuevo({ dia: ctx.hoy, texto }, ahora);

      if (v.crearTarjeta === 'si') {
        const tarjeta = nuevaTarjeta(
          `¿Cuál es la regla o modelo mental clave sobre: «${texto.slice(0, 70)}${texto.length > 70 ? '…' : ''}»?`,
          texto,
          ahora,
          { coleccion: 'aprendizajes', id: baseAp.id },
        );
        const conTarjeta: Aprendizaje = { ...baseAp, tarjetaId: tarjeta.id };
        await ctx.guardar(
          { coleccion: 'aprendizajes', registro: conTarjeta },
          { coleccion: 'tarjetas', registro: tarjeta },
        );
      } else {
        await ctx.guardar({ coleccion: 'aprendizajes', registro: baseAp });
      }
      await ctx.registrar('concepto');
      ctx.avisar(v.crearTarjeta === 'si' ? 'Idea guardada y convertida en tarjeta de repaso.' : 'Idea guardada.');
    });
  },
};
