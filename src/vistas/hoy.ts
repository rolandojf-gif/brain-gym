/* 01 · Hoy: un menú, no una agenda. Tres cosas para elegir (un reto, una lectura, una idea) y, si hay tarjetas
   vencidas, una línea discreta para repasarlas. Nada se marca como pendiente ni hecho. */
import { accion, campos, type Ctx, type Vista } from '../app';
import { BLOQUES_RETOS, siguienteRetoPendiente, temaSiguiente, type BloqueRetos } from '../dominio/catalogo-retos';
import { nuevaTarjeta, vencidas } from '../dominio/fsrs';
import { actualizar, nuevo } from '../dominio/registro';
import type { Aprendizaje } from '../dominio/tipos';
import { fmtFechaLarga, plural } from '../lib/fmt';
import { esc, urlSegura } from '../lib/html';
import { cabecera } from './comun';

/** Tema elegido a mano en el selector. Vale hasta que se juega un reto: después vuelve la rotación. */
let temaElegido: { id: BloqueRetos['id']; el: string } | null = null;

function temaActual(ctx: Ctx): BloqueRetos['id'] {
  const rotacion = temaSiguiente(ctx.datos.intentos);
  if (temaElegido && ctx.datos.intentos.some((i) => i.creado > (temaElegido?.el ?? ''))) temaElegido = null;
  return temaElegido?.id ?? rotacion;
}

function renderRepaso(ctx: Ctx): string {
  const n = vencidas(ctx.datos.tarjetas, ctx.ahora).length;
  if (n === 0) return '';
  return `<p class="linea-repaso">${plural(n, 'tarjeta para repasar', 'tarjetas para repasar')} · <a href="#repaso">Repasar</a></p>`;
}

function renderReto(ctx: Ctx): string {
  const tema = temaActual(ctx);
  const reto = siguienteRetoPendiente(ctx.datos.intentos, tema);
  const bloque = BLOQUES_RETOS.find((b) => b.id === reto.bloque);
  const resumen = reto.escenario.length > 170 ? `${reto.escenario.slice(0, 170).trimEnd()}…` : reto.escenario;
  const selector = BLOQUES_RETOS.map(
    (b) =>
      `<button type="button" class="seg-btn" data-accion="tema" data-tema="${esc(b.id)}" aria-pressed="${b.id === tema}">${esc(b.corto)}</button>`,
  ).join('');

  return `
    <article class="act">
      <header><h2>Un reto</h2></header>
      <p class="m-sub">${esc(bloque?.titulo ?? '')}</p>
      <p><b>${esc(reto.titulo)}</b></p>
      <p>${esc(resumen)}</p>
      <div class="seg tema" role="group" aria-label="Tema del reto">${selector}</div>
      <div class="acciones">
        <a class="btn primario" href="#estudio/reto/${esc(reto.id)}">[ Jugar ]</a>
      </div>
    </article>`;
}

function renderLectura(ctx: Ctx): string {
  const porEscribir = ctx.datos.lecturas.find((l) => !l.borrado && l.estado === 'leida');
  const siguiente = ctx.datos.lecturas.find((l) => !l.borrado && l.estado === 'pendiente');

  let cuerpo: string;
  if (porEscribir) {
    cuerpo = `
      <p>Ya leíste <b>«${esc(porEscribir.titulo)}»</b>. Queda extraer de memoria la tesis, el mecanismo y el punto ciego.</p>
      <div class="acciones">
        <a class="btn primario" href="#lectura/escribir/${esc(porEscribir.id)}">[ Escribir el 3x1 ]</a>
      </div>`;
  } else if (siguiente) {
    const url = urlSegura(siguiente.url);
    cuerpo = `
      <p><b>«${esc(siguiente.titulo)}»</b>${siguiente.medio ? ` <span class="m-sub">(${esc(siguiente.medio)})</span>` : ''}</p>
      <div class="acciones">
        ${url ? `<a class="btn" href="${esc(url)}" target="_blank" rel="noopener noreferrer">Abrir ↗</a>` : ''}
        <button type="button" class="btn primario" data-accion="lectura-leida" data-id="${esc(siguiente.id)}">[ Leída · escribir 3x1 ]</button>
        <a class="btn sutil" href="#lectura">Ver cola</a>
      </div>`;
  } else {
    cuerpo = `
      <p>La cola está vacía.</p>
      <div class="acciones"><a class="btn primario" href="#lectura">[ Añadir una lectura ]</a></div>`;
  }

  return `
    <article class="act">
      <header><h2>Una lectura</h2></header>
      ${cuerpo}
    </article>`;
}

function renderIdea(ctx: Ctx): string {
  const deHoy = ctx.datos.aprendizajes.filter((x) => !x.borrado && x.dia === ctx.hoy).sort((a, b) => b.creado.localeCompare(a.creado));
  const ultima = deHoy[0];
  return `
    <article class="act">
      <header><h2>Una idea</h2></header>
      ${ultima ? `<p class="m-sub">Hoy apuntaste: «${esc(ultima.texto)}»${deHoy.length > 1 ? ` y ${plural(deHoy.length - 1, 'otra', 'otras')}` : ''}.</p>` : ''}
      <form class="form-bloque" data-accion="aprendizaje">
        <label class="campo">
          Una idea o modelo mental que te llevas (una línea)
          <input name="texto" required placeholder="Ley de Goodhart: la métrica que se persigue deja de medir.">
        </label>
        <label class="check-linea">
          <input type="checkbox" name="crearTarjeta" value="si" checked>
          <span>Convertir también en tarjeta de repaso</span>
        </label>
        <div class="acciones"><button class="btn primario">[ Guardar ]</button></div>
      </form>
    </article>`;
}

export const hoy: Vista = {
  titulo: 'Hoy',
  render(ctx) {
    return `
      <section class="view">
        ${cabecera('¿Qué te apetece?', `${fmtFechaLarga(ctx.hoy)} · Elige una cosa; con una basta.`)}
        ${renderRepaso(ctx)}
        <div class="acts">
          ${renderReto(ctx)}
          ${renderLectura(ctx)}
          ${renderIdea(ctx)}
        </div>
      </section>`;
  },
  montar(ctx, raiz) {
    accion(raiz, 'click', 'tema', (b) => {
      const id = BLOQUES_RETOS.find((x) => x.id === b.dataset.tema)?.id;
      if (!id) return;
      // Pulsar el tema que ya toca por rotación vuelve a la rotación.
      temaElegido = id === temaSiguiente(ctx.datos.intentos) ? null : { id, el: new Date().toISOString() };
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
