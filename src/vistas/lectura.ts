/* 03 · Lectura y escritura: cola de lecturas (sólo URL y metadatos) y, tras leer, el resumen sin mirar con la
   objeción más fuerte. En el paso de escribir el artículo no se enlaza. */
import { accion, campos, type Ctx, type Vista } from '../app';
import { actualizar, nuevo } from '../dominio/registro';
import { contarPalabras } from '../dominio/texto';
import type { Escrito, Lectura } from '../dominio/tipos';
import { fmtFecha, fmtRelativo, plural } from '../lib/fmt';
import { esc, urlSegura } from '../lib/html';
import { cabecera, vacio } from './comun';

const MIN_PALABRAS = 200;
const MAX_PALABRAS = 300;

/* Borrador del escrito en este dispositivo, para no perderlo si se recarga o se cierra la pestaña. */
const claveBorrador = (id: string) => `bg.borrador.${id}`;
function leerBorrador(id: string): { resumen: string; objecion: string } {
  try {
    return { resumen: '', objecion: '', ...JSON.parse(localStorage.getItem(claveBorrador(id)) ?? '{}') };
  } catch {
    return { resumen: '', objecion: '' };
  }
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
    ${cabecera('Lectura y escritura', '45 min de lectura exigente. Al terminar, sin mirar el texto, 200–300 palabras con el argumento central y la objeción más fuerte.')}
    ${porEscribir.length ? `<h2 class="sec">Por escribir</h2><ul class="lista">${porEscribir.map((l) => `
      <li><div class="li-main"><b>${esc(l.titulo)}</b><span class="m-sub">${meta(l)}${l.leidaEl ? ` · leída ${esc(fmtRelativo(l.leidaEl, ctx.hoy))}` : ''}</span></div>
      <div class="li-acc"><a class="btn primario" href="#lectura/escribir/${esc(l.id)}">Escribir sin mirar</a></div></li>`).join('')}</ul>` : ''}

    <h2 class="sec">Cola</h2>
    ${pendientes.length ? `<ul class="lista">${pendientes.map((l) => `
      <li><div class="li-main"><b>${esc(l.titulo)}</b><span class="m-sub">${meta(l)} ${enlace(l)}</span></div>
      <div class="li-acc"><button class="btn" data-accion="leida" data-id="${esc(l.id)}">Leída: escribir</button><button class="btn sutil" data-accion="descartar" data-id="${esc(l.id)}">Descartar</button></div></li>`).join('')}</ul>` : vacio('La cola está vacía.')}

    <form class="panel form-bloque" data-accion="anadir">
      <div class="fila">
        <label class="campo">URL<input name="url" type="url" required placeholder="https://…" inputmode="url"></label>
        <label class="campo">Título<input name="titulo" required></label>
      </div>
      <div class="fila">
        <label class="campo">Fuente<input name="medio" placeholder="Aeon, Quanta, SEP…" list="medios"></label>
        <label class="campo">Tema<input name="tema" placeholder="Filosofía de la mente…"></label>
      </div>
      <datalist id="medios">${[...new Set(['Aeon', 'Quanta Magazine', 'Stanford Encyclopedia of Philosophy', ...vivas.map((l) => l.medio).filter(Boolean)])].map((m) => `<option value="${esc(m)}">`).join('')}</datalist>
      <div class="acciones"><button class="btn primario">Añadir a la cola</button></div>
    </form>

    <h2 class="sec">Escritos</h2>
    ${escritos.length ? `<ul class="lista">${escritos.map((e) => `
      <li><div class="li-main"><b>${esc(titulo(e.lecturaId))}</b><span class="m-sub">${esc(fmtFecha(e.enviadoEl))} · ${plural(e.palabras, 'palabra')}</span></div>
      <div class="li-acc"><a class="btn sutil" href="#lectura/ver/${esc(e.id)}">Ver</a></div></li>`).join('')}</ul>` : vacio('Aún no hay escritos.')}`;
}

function renderEscribir(ctx: Ctx, id: string): string {
  const l = ctx.datos.lecturas.find((x) => x.id === id && !x.borrado);
  if (!l) return vacio('Esa lectura no existe.');
  const b = leerBorrador(id);
  return `
    ${cabecera('Escribir sin mirar', l.titulo)}
    <p class="aviso-sin-mirar">El artículo no se enlaza en este paso. Escribe de memoria: primero el argumento central, luego la objeción más fuerte.</p>
    <form class="form-bloque" data-accion="escrito" data-id="${esc(l.id)}">
      <label class="campo">Argumento central<textarea name="resumen" rows="10" required data-accion="contar">${esc(b.resumen)}</textarea></label>
      <label class="campo">La objeción más fuerte<textarea name="objecion" rows="5" required data-accion="contar">${esc(b.objecion)}</textarea></label>
      <p class="contador" id="contador" aria-live="polite"></p>
      <div class="acciones"><button class="btn primario">Enviar</button><a class="btn sutil" href="#lectura">Volver (se guarda el borrador)</a></div>
    </form>`;
}

function renderVer(ctx: Ctx, id: string): string {
  const e = ctx.datos.escritos.find((x) => x.id === id && !x.borrado);
  const l = e && ctx.datos.lecturas.find((x) => x.id === e.lecturaId);
  if (!e) return vacio('Ese escrito no existe.');
  const parrafos = (t: string) => t.split(/\n{2,}/).map((p) => `<p>${esc(p).replace(/\n/g, '<br>')}</p>`).join('');
  return `
    ${cabecera(l?.titulo ?? 'Escrito', `${fmtFecha(e.enviadoEl)} · ${plural(e.palabras, 'palabra')}${l ? ` · ${meta(l)}` : ''}`)}
    <article class="panel escrito">
      <h2 class="sec">Argumento central</h2>${parrafos(e.resumen)}
      <h2 class="sec">Objeción más fuerte</h2>${parrafos(e.objecion)}
    </article>
    <div class="acciones">${l ? enlace(l).replace('<a ', '<a class="btn" ') : ''}<a class="btn" href="#repaso/nueva/escritos/${esc(e.id)}">Crear tarjeta</a><a class="btn sutil" href="#lectura">Volver</a></div>`;
}

function actualizarContador(form: HTMLFormElement): void {
  const r = contarPalabras((form.elements.namedItem('resumen') as HTMLTextAreaElement).value);
  const o = contarPalabras((form.elements.namedItem('objecion') as HTMLTextAreaElement).value);
  const total = r + o;
  const el = form.querySelector<HTMLElement>('#contador');
  if (!el) return;
  const rango = total < MIN_PALABRAS ? 'corto' : total > MAX_PALABRAS ? 'largo' : 'ok';
  el.className = `contador ${rango}`;
  el.textContent = `${total} palabras (argumento ${r}, objeción ${o}) · objetivo ${MIN_PALABRAS}–${MAX_PALABRAS}`;
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
      const { resumen = '', objecion = '' } = campos(f);
      try { localStorage.setItem(claveBorrador(f.dataset.id ?? ''), JSON.stringify({ resumen, objecion })); } catch { /* sin borrador local */ }
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
      const { resumen = '', objecion = '' } = campos(f as HTMLFormElement);
      const palabras = contarPalabras(resumen) + contarPalabras(objecion);
      if (palabras < MIN_PALABRAS && !confirm(`Llevas ${palabras} palabras, por debajo de ${MIN_PALABRAS}. ¿Enviar igualmente?`)) return;
      const ahora = new Date();
      const escrito: Escrito = nuevo({ lecturaId: l.id, resumen, objecion, palabras, enviadoEl: ahora.toISOString() }, ahora);
      await ctx.guardar({ coleccion: 'escritos', registro: escrito }, { coleccion: 'lecturas', registro: actualizar(l, { estado: 'escrita' }, ahora) });
      await ctx.registrar('lectura');
      try { localStorage.removeItem(claveBorrador(l.id)); } catch { /* nada que limpiar */ }
      ctx.avisar('Escrito guardado.');
      ctx.ir(`#lectura/ver/${escrito.id}`);
    });
  },
};
