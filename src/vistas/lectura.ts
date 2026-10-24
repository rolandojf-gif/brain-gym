/* 03 · Lectura: «Extracción Quirúrgica 3x1» y «Abogado del Diablo (IA)».
   Cola de lecturas (sólo URL y metadatos) y, tras leer, síntesis comprimida sin mirar el texto en 3 campos cortos
   (Tesis central, Mecanismo/Incentivo, Punto ciego/Objeción). Sólo después de guardar el escrito se habilita el
   juicio del Abogado del Diablo (/api/ia). */
import { accion, campos, type Ctx, type Vista } from '../app';
import { ErrorDeIa, auditarConIa } from '../datos/ia';
import { nuevaTarjeta } from '../dominio/fsrs';
import { actualizar, nuevo } from '../dominio/registro';
import { contarPalabras } from '../dominio/texto';
import type { Escrito, Lectura } from '../dominio/tipos';
import { fmtFecha, fmtRelativo, plural } from '../lib/fmt';
import { esc, urlSegura } from '../lib/html';
import { cabecera, vacio } from './comun';

const MAX_CAMPO = 40;

let auditandoId: string | null = null;
let errorIaPorEscrito: { id: string; mensaje: string } | null = null;

interface Borrador3x1 {
  tesis: string;
  mecanismo: string;
  objecion: string;
}

/* Borrador del escrito en este dispositivo, para no perderlo si se recarga o se cierra la pestaña. */
const claveBorrador = (id: string) => `bg.borrador.${id}`;
function leerBorrador(id: string): Borrador3x1 {
  try {
    const raw = JSON.parse(localStorage.getItem(claveBorrador(id)) ?? '{}') as Record<string, string>;
    return {
      tesis: raw.tesis ?? raw.resumen ?? '',
      mecanismo: raw.mecanismo ?? '',
      objecion: raw.objecion ?? '',
    };
  } catch {
    return { tesis: '', mecanismo: '', objecion: '' };
  }
}

export function formatearResumen3x1(tesis: string, mecanismo: string): string {
  return `Tesis central: ${tesis.trim()}\n\nMecanismo / Incentivo: ${mecanismo.trim()}`;
}

function enlace(l: Lectura): string {
  const u = urlSegura(l.url);
  return u ? `<a href="${esc(u)}" target="_blank" rel="noopener noreferrer">Abrir ↗</a>` : '';
}

function meta(l: Lectura): string {
  return [l.medio, l.tema].filter(Boolean).map(esc).join(' · ');
}

function renderCola(ctx: Ctx): string {
  const vivas = ctx.datos.lecturas.filter((l) => !l.borrado);
  const pendientes = vivas.filter((l) => l.estado === 'pendiente').sort((a, b) => a.creado.localeCompare(b.creado));
  const porEscribir = vivas.filter((l) => l.estado === 'leida');
  const escritos = ctx.datos.escritos.filter((e) => !e.borrado).sort((a, b) => b.enviadoEl.localeCompare(a.enviadoEl));
  const titulo = (id: string) => vivas.find((l) => l.id === id)?.titulo ?? ctx.datos.lecturas.find((l) => l.id === id)?.titulo ?? 'Lectura';
  return `
    ${cabecera('Lectura · Extracción 3x1', 'Lee con foco y extrae de memoria 3 piezas quirúrgicas (máx. ~40 palabras por campo): tesis, mecanismo y punto ciego.')}
    ${porEscribir.length ? `<h2 class="sec">Pendiente de síntesis 3x1</h2><ul class="lista">${porEscribir.map((l) => `
      <li><div class="li-main"><b>${esc(l.titulo)}</b><span class="m-sub">${meta(l)}${l.leidaEl ? ` · leída ${esc(fmtRelativo(l.leidaEl, ctx.hoy))}` : ''}</span></div>
      <div class="li-acc"><a class="btn primario" href="#lectura/escribir/${esc(l.id)}">Escribir 3x1 sin mirar</a></div></li>`).join('')}</ul>` : ''}

    <h2 class="sec">Cola de lectura</h2>
    ${pendientes.length ? `<ul class="lista">${pendientes.map((l) => `
      <li><div class="li-main"><b>${esc(l.titulo)}</b><span class="m-sub">${meta(l)} ${enlace(l)}</span></div>
      <div class="li-acc"><button class="btn" data-accion="leida" data-id="${esc(l.id)}">Leída: extraer 3x1</button><button class="btn sutil" data-accion="descartar" data-id="${esc(l.id)}">Descartar</button></div></li>`).join('')}</ul>` : vacio('La cola está vacía.')}

    <form class="panel form-bloque" data-accion="anadir">
      <div class="fila">
        <label class="campo">URL<input name="url" type="url" required placeholder="https://…" inputmode="url"></label>
        <label class="campo">Título<input name="titulo" required placeholder="Título del artículo o ensayo"></label>
      </div>
      <div class="fila">
        <label class="campo">Fuente<input name="medio" placeholder="Aeon, Works in Progress, Astral Codex Ten…" list="medios"></label>
        <label class="campo">Tema<input name="tema" placeholder="Incentivos, teoría de juegos, sistemas…"></label>
      </div>
      <datalist id="medios">${[...new Set(['Aeon', 'Works in Progress', 'Quanta Magazine', 'Stanford Encyclopedia of Philosophy', ...vivas.map((l) => l.medio).filter(Boolean)])].map((m) => `<option value="${esc(m)}">`).join('')}</datalist>
      <div class="acciones"><button class="btn primario">Añadir a la cola</button></div>
    </form>

    <h2 class="sec">Síntesis 3x1 guardadas</h2>
    ${escritos.length ? `<ul class="lista">${escritos.map((e) => `
      <li>
        <div class="li-main">
          <b>${esc(titulo(e.lecturaId))} ${e.feedbackIa ? '<span class="tag e-sin_ayuda">Auditado IA</span>' : ''}</b>
          <span class="m-sub">${esc(fmtFecha(e.enviadoEl))} · ${plural(e.palabras, 'palabra')}</span>
        </div>
        <div class="li-acc"><a class="btn ${e.feedbackIa ? 'sutil' : 'primario'}" href="#lectura/ver/${esc(e.id)}">${e.feedbackIa ? 'Ver síntesis y auditoría' : 'Ver / Abogado del Diablo'}</a></div>
      </li>`).join('')}</ul>` : vacio('Aún no hay síntesis guardadas.')}`;
}

function renderEscribir(ctx: Ctx, id: string): string {
  const l = ctx.datos.lecturas.find((x) => x.id === id && !x.borrado);
  if (!l) return vacio('Esa lectura no existe.');
  const b = leerBorrador(id);
  return `
    ${cabecera('Extracción Quirúrgica 3x1', l.titulo)}
    <p class="aviso-sin-mirar">Sin mirar el texto original. Comprime la lectura en tres golpes directos (orientativo: máx. ${MAX_CAMPO} palabras por campo). El Abogado del Diablo (IA) sólo estará disponible tras guardar tu síntesis.</p>
    <form class="panel form-bloque" data-accion="escrito" data-id="${esc(l.id)}">
      <label class="campo">
        <span>1. Tesis central (1 frase) · <small>¿Qué defiende exactamente el autor?</small></span>
        <textarea name="tesis" rows="2" required data-accion="contar" placeholder="El autor sostiene que…">${esc(b.tesis)}</textarea>
        <span class="contador" data-contador="tesis" aria-live="polite"></span>
      </label>
      <label class="campo">
        <span>2. El mecanismo / Incentivo · <small>¿Por qué funciona así o en qué lógica se apoya?</small></span>
        <textarea name="mecanismo" rows="3" required data-accion="contar" placeholder="Funciona porque los agentes tienen el incentivo de…">${esc(b.mecanismo)}</textarea>
        <span class="contador" data-contador="mecanismo" aria-live="polite"></span>
      </label>
      <label class="campo">
        <span>3. Punto ciego / Objeción · <small>¿Dónde flaquea el argumento o bajo qué condición es falso?</small></span>
        <textarea name="objecion" rows="3" required data-accion="contar" placeholder="Falla cuando se ignora que…">${esc(b.objecion)}</textarea>
        <span class="contador" data-contador="objecion" aria-live="polite"></span>
      </label>
      <p class="contador" id="contador-total" aria-live="polite"></p>
      <div class="acciones"><button class="btn primario">Guardar extracción 3x1</button><a class="btn sutil" href="#lectura">Volver (se guarda el borrador)</a></div>
    </form>`;
}

function renderAbogadoDelDiablo(ctx: Ctx, e: Escrito, l: Lectura | undefined): string {
  const cargando = auditandoId === e.id;
  const err = errorIaPorEscrito?.id === e.id ? errorIaPorEscrito.mensaje : null;

  if (!e.feedbackIa) {
    return `
      <div class="ia-cta">
        <div class="acciones">
          <button type="button" class="btn primario" data-accion="auditar-ia" data-id="${esc(e.id)}"${cargando ? ' disabled' : ''}>
            ${cargando ? '[ Auditando fisuras lógicas... ]' : '[ ⚡ Pasar por el Abogado del Diablo (IA) ]'}
          </button>
        </div>
        ${err ? `<p class="ia-error" role="alert">${esc(err)}</p>` : ''}
      </div>`;
  }

  const fb = e.feedbackIa;
  const yaTieneTarjeta = ctx.datos.tarjetas.some(
    (t) => !t.borrado && t.origen?.coleccion === 'escritos' && t.origen.id === e.id && t.reverso === fb.modeloMentalSugerido,
  );

  return `
    <aside class="panel abogado-diablo" aria-label="Dictamen del Abogado del Diablo">
      <header class="ad-head">
        <span>&gt;_ ABOGADO DEL DIABLO · AUDITORÍA LÓGICA</span>
        <small>${esc(fmtFecha(fb.fecha))}</small>
      </header>
      <div class="ad-bloque">
        <span class="ad-lbl">AUDITORÍA DE MECANISMO:</span>
        <p>${esc(fb.diagnostico)}</p>
      </div>
      <div class="ad-bloque">
        <span class="ad-lbl">CONTRAATAQUE A TU OBJECIÓN:</span>
        <p>${esc(fb.contraataque)}</p>
      </div>
      <div class="ad-bloque ad-regla">
        <span class="ad-lbl">REGLA DESTILADA:</span>
        <p><b>${esc(fb.modeloMentalSugerido)}</b></p>
        <div class="acciones">
          ${
            yaTieneTarjeta
              ? '<span class="tag e-sin_ayuda">✓ Tarjeta FSRS creada con este ángulo</span>'
              : `<button type="button" class="btn primario" data-accion="tarjeta-angulo-ia" data-id="${esc(e.id)}" data-titulo="${esc(l?.titulo ?? 'Lectura')}">[ + Crear tarjeta FSRS con este ángulo ]</button>`
          }
        </div>
      </div>
    </aside>`;
}

function renderVer(ctx: Ctx, id: string): string {
  const e = ctx.datos.escritos.find((x) => x.id === id && !x.borrado);
  const l = e && ctx.datos.lecturas.find((x) => x.id === e.lecturaId);
  if (!e) return vacio('Ese escrito no existe.');
  const parrafos = (t: string) => t.split(/\n{2,}/).map((p) => `<p>${esc(p).replace(/\n/g, '<br>')}</p>`).join('');
  return `
    ${cabecera(l?.titulo ?? 'Síntesis 3x1', `${fmtFecha(e.enviadoEl)} · ${plural(e.palabras, 'palabra')}${l ? ` · ${meta(l)}` : ''}`)}
    <article class="panel escrito">
      <h2 class="sec">Tesis y mecanismo</h2>${parrafos(e.resumen)}
      <h2 class="sec">Punto ciego / Objeción</h2>${parrafos(e.objecion)}
    </article>
    ${renderAbogadoDelDiablo(ctx, e, l)}
    <div class="acciones">${l ? enlace(l).replace('<a ', '<a class="btn" ') : ''}<a class="btn" href="#repaso/nueva/escritos/${esc(e.id)}">Crear tarjeta manual</a><a class="btn sutil" href="#lectura">Volver</a></div>`;
}

function actualizarContador(form: HTMLFormElement): void {
  const nombres = ['tesis', 'mecanismo', 'objecion'] as const;
  let total = 0;
  for (const nombre of nombres) {
    const campo = form.elements.namedItem(nombre) as HTMLTextAreaElement | null;
    const n = contarPalabras(campo?.value ?? '');
    total += n;
    const ind = form.querySelector<HTMLElement>(`[data-contador="${nombre}"]`);
    if (ind) {
      const estado = n === 0 ? 'corto' : n <= MAX_CAMPO ? 'ok' : 'largo';
      ind.className = `contador ${estado}`;
      ind.textContent = `${n} / ${MAX_CAMPO} palabras máx. orientativas`;
    }
  }
  const el = form.querySelector<HTMLElement>('#contador-total');
  if (el) {
    el.className = `contador ${total <= MAX_CAMPO * 3 ? 'ok' : 'largo'}`;
    el.textContent = `Total: ${total} palabras comprimidas en 3 bloques`;
  }
}

export const lectura: Vista = {
  titulo: 'Lectura',
  render(ctx) {
    const [modo, id] = (ctx.sub ?? '').split('/');
    const cuerpo = modo === 'escribir' && id ? renderEscribir(ctx, id) : modo === 'ver' && id ? renderVer(ctx, id) : renderCola(ctx);
    return `<section class="view lectura">${cuerpo}</section>`;
  },
  montar(ctx, raiz) {
    const form = raiz.querySelector<HTMLFormElement>('form[data-accion="escrito"]');
    if (form) actualizarContador(form);
    accion(raiz, 'input', 'contar', (el) => {
      const f = el.closest('form');
      if (!f) return;
      actualizarContador(f);
      const { tesis = '', mecanismo = '', objecion = '' } = campos(f);
      try { localStorage.setItem(claveBorrador(f.dataset.id ?? ''), JSON.stringify({ tesis, mecanismo, objecion })); } catch { /* sin borrador local */ }
    });
    accion(raiz, 'submit', 'anadir', async (f, e) => {
      e.preventDefault();
      const { url = '', titulo = '', medio = '', tema = '' } = campos(f as HTMLFormElement);
      if (!urlSegura(url)) return ctx.avisar('La URL debe empezar por http:// o https://.', 'error');
      const registro: Lectura = nuevo({ url, titulo, medio, tema, estado: 'pendiente' as const }, new Date());
      await ctx.guardar({ coleccion: 'lecturas', registro });
    });
    accion(raiz, 'click', 'leida', async (b) => {
      const l = ctx.datos.lecturas.find((x) => x.id === b.dataset.id);
      if (!l) return;
      const ahora = new Date();
      await ctx.guardar({ coleccion: 'lecturas', registro: actualizar(l, { estado: 'leida', leidaEl: ahora.toISOString() }, ahora) });
      ctx.ir(`#lectura/escribir/${l.id}`);
    });
    accion(raiz, 'click', 'descartar', async (b) => {
      const l = ctx.datos.lecturas.find((x) => x.id === b.dataset.id);
      if (l) await ctx.guardar({ coleccion: 'lecturas', registro: actualizar(l, { estado: 'descartada' }, new Date()) });
    });
    accion(raiz, 'submit', 'escrito', async (f, e) => {
      e.preventDefault();
      const l = ctx.datos.lecturas.find((x) => x.id === f.dataset.id);
      if (!l) return;
      const { tesis = '', mecanismo = '', objecion = '' } = campos(f as HTMLFormElement);
      const resumen = formatearResumen3x1(tesis, mecanismo);
      const palabras = contarPalabras(tesis) + contarPalabras(mecanismo) + contarPalabras(objecion);
      const ahora = new Date();
      const escrito: Escrito = nuevo({ lecturaId: l.id, resumen, objecion, palabras, enviadoEl: ahora.toISOString() }, ahora);
      await ctx.guardar({ coleccion: 'escritos', registro: escrito }, { coleccion: 'lecturas', registro: actualizar(l, { estado: 'escrita' }, ahora) });
      await ctx.registrar('lectura');
      try { localStorage.removeItem(claveBorrador(l.id)); } catch { /* nada que limpiar */ }
      ctx.avisar('Síntesis 3x1 guardada. Ya puedes someterla al Abogado del Diablo.');
      ctx.ir(`#lectura/ver/${escrito.id}`);
    });
    accion(raiz, 'click', 'auditar-ia', async (b) => {
      const id = b.dataset.id ?? '';
      const escrito = ctx.datos.escritos.find((x) => x.id === id && !x.borrado);
      if (!escrito || auditandoId) return;
      const l = ctx.datos.lecturas.find((x) => x.id === escrito.lecturaId);
      auditandoId = escrito.id;
      errorIaPorEscrito = null;
      ctx.pintar();
      try {
        const feedbackIa = await auditarConIa(ctx.almacen, {
          titulo: l?.titulo ?? 'Lectura',
          ...(l?.medio ? { medio: l.medio } : {}),
          ...(l?.tema ? { tema: l.tema } : {}),
          resumen: escrito.resumen,
          objecion: escrito.objecion,
        });
        auditandoId = null;
        await ctx.guardar({
          coleccion: 'escritos',
          registro: actualizar(escrito, { feedbackIa }, new Date()),
        });
        ctx.avisar('Auditoría del Abogado del Diablo guardada.');
      } catch (err) {
        auditandoId = null;
        const mensaje =
          err instanceof ErrorDeIa
            ? err.message
            : 'No se pudo completar la auditoría lógica. Revisa tu conexión o la clave BG_TOKEN.';
        errorIaPorEscrito = { id: escrito.id, mensaje };
        ctx.avisar(mensaje, 'error');
        ctx.pintar();
      }
    });
    accion(raiz, 'click', 'tarjeta-angulo-ia', async (b) => {
      const id = b.dataset.id ?? '';
      const escrito = ctx.datos.escritos.find((x) => x.id === id && !x.borrado);
      if (!escrito?.feedbackIa) return;
      const l = ctx.datos.lecturas.find((x) => x.id === escrito.lecturaId);
      const titulo = l?.titulo ?? b.dataset.titulo ?? 'Lectura';
      const anverso = `«${titulo}»: ¿Dónde colapsa o cuál es su límite real?`;
      const reverso = escrito.feedbackIa.modeloMentalSugerido;
      const tarjeta = nuevaTarjeta(anverso, reverso, new Date(), { coleccion: 'escritos', id: escrito.id });
      await ctx.guardar({ coleccion: 'tarjetas', registro: tarjeta });
      ctx.avisar('Tarjeta FSRS creada con la regla destilada.');
    });
  },
};
