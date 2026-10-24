/* 04 · Repaso: cola de tarjetas vencidas con FSRS, pensada primero para el móvil. También alta y edición de
   tarjetas: #repaso/nueva[/<colección>/<id>] crea una desde otro módulo; #repaso/tarjetas las lista. */
import { accion, campos, type Ctx, type Vista } from '../app';
import { CATALOGO_RETOS } from '../dominio/catalogo-retos';
import { ETIQUETA_ESTADO } from '../dominio/estudio';
import { nuevaTarjeta, previsualizar, repasar, vencidas } from '../dominio/fsrs';
import { actualizar, borrar } from '../dominio/registro';
import type { Coleccion, Nota, Tarjeta } from '../dominio/tipos';
import { fmtFecha, fmtRelativo, plural } from '../lib/fmt';
import { esc } from '../lib/html';
import { cabecera, vacio } from './comun';

const NOTAS: { nota: Nota; texto: string; tecla: string }[] = [
  { nota: 1, texto: 'Otra vez', tecla: '1' },
  { nota: 2, texto: 'Difícil', tecla: '2' },
  { nota: 3, texto: 'Bien', tecla: '3' },
  { nota: 4, texto: 'Fácil', tecla: '4' },
];

/* Estado de la visita a la cola, sólo en memoria: qué tarjeta tiene la respuesta a la vista y cuándo empezó. */
let revelada: string | null = null;
let inicioSesion: number | null = null;
let repasadasEnSesion = 0;

function intervalo(iso: string, ahora: Date): string {
  const min = Math.round((Date.parse(iso) - ahora.getTime()) / 60_000);
  if (min < 60) return `${Math.max(1, min)} min`;
  if (min < 60 * 24) return `${Math.round(min / 60)} h`;
  const d = Math.round(min / 1440);
  return d < 31 ? `${d} d` : d < 365 ? `${Math.round(d / 30)} mes` : `${(d / 365).toFixed(1).replace('.', ',')} a`;
}

function textoConSaltos(t: string): string {
  return esc(t).replace(/\n/g, '<br>');
}

function renderCola(ctx: Ctx): string {
  const cola = vencidas(ctx.datos.tarjetas, ctx.ahora);
  const total = ctx.datos.tarjetas.filter((t) => !t.borrado).length;
  const enlaces = `<div class="acciones"><a class="btn" href="#repaso/nueva">Nueva tarjeta</a><a class="btn sutil" href="#repaso/tarjetas">Todas las tarjetas (${total})</a></div>`;
  const t = cola[0];
  if (!t) {
    const proxima = ctx.datos.tarjetas.filter((x) => !x.borrado).map((x) => x.fsrs.due).sort()[0];
    const fin = repasadasEnSesion ? `Cola terminada: ${plural(repasadasEnSesion, 'tarjeta repasada', 'tarjetas repasadas')}.` : 'No hay tarjetas vencidas.';
    return `${cabecera('Repaso', fin)}${vacio(proxima ? `La próxima vence ${fmtRelativo(proxima, ctx.hoy)} (${fmtFecha(proxima)}).` : 'Aún no hay tarjetas. Créalas aquí o desde un ejercicio fallado.')}${enlaces}`;
  }
  inicioSesion ??= Date.now();
  const mostrar = revelada === t.id;
  const prev = previsualizar(t, ctx.ahora);
  return `
    ${cabecera('Repaso', `${cola.length} por repasar`)}
    <article class="flash panel" aria-live="polite">
      <div class="flash-cara"><span class="lbl">Pregunta</span><div class="flash-texto">${textoConSaltos(t.anverso)}</div></div>
      ${mostrar
        ? `<div class="flash-cara reverso"><span class="lbl">Respuesta</span><div class="flash-texto">${textoConSaltos(t.reverso)}</div></div>
           <div class="notas">${NOTAS.map((n) => `<button class="btn nota n${n.nota}" data-accion="nota" data-nota="${n.nota}" aria-keyshortcuts="${n.tecla}"><b>${n.texto}</b><small>${intervalo(prev[n.nota], ctx.ahora)}</small></button>`).join('')}</div>`
        : `<button class="btn primario ancho" data-accion="mostrar" aria-keyshortcuts="Space">Mostrar respuesta</button>`}
      <p class="note">Piensa la respuesta antes de mostrarla. Atajos: espacio para mostrar, 1–4 para puntuar.</p>
    </article>
    ${enlaces}`;
}

function formTarjeta(t: Partial<Tarjeta>, destino: string, titulo: string): string {
  return `
    <form class="panel form-bloque" data-accion="guardar-tarjeta" data-id="${esc(t.id ?? '')}" data-destino="${esc(destino)}">
      <h2 class="sec">${esc(titulo)}</h2>
      <label class="campo">Pregunta<textarea name="anverso" rows="3" required>${esc(t.anverso ?? '')}</textarea></label>
      <label class="campo">Respuesta<textarea name="reverso" rows="4" required>${esc(t.reverso ?? '')}</textarea></label>
      <div class="acciones"><button class="btn primario">Guardar</button><a class="btn sutil" href="#${esc(destino)}">Cancelar</a></div>
    </form>`;
}

/** Texto inicial de una tarjeta creada desde otro registro (un ejercicio fallado, un escrito…). */
function borradorDesde(ctx: Ctx, coleccion: string, id: string): Partial<Tarjeta> {
  if (coleccion === 'intentos') {
    const i = ctx.datos.intentos.find((x) => x.id === id);
    if (i) {
      const reto = CATALOGO_RETOS.find((r) => r.id === i.ejercicio);
      if (reto) {
        return {
          anverso: `[Reto ${reto.id} · ${reto.titulo}]\n${reto.escenario}`,
          reverso: `${reto.modeloMental}\n\nClave: ${reto.solucion}`,
          origen: { coleccion: 'intentos', id },
        };
      }
      return { anverso: `Bloque ${i.capitulo}, reto ${i.ejercicio}: `, reverso: i.notaError ? `Notas: ${i.notaError}\n` : '', origen: { coleccion: 'intentos', id } };
    }
  }
  if (coleccion === 'escritos') {
    const e = ctx.datos.escritos.find((x) => x.id === id);
    const l = e && ctx.datos.lecturas.find((x) => x.id === e.lecturaId);
    if (e) return { anverso: l ? `«${l.titulo}»: argumento central` : '', reverso: e.resumen, origen: { coleccion: 'escritos', id } };
  }
  if (coleccion === 'aprendizajes') {
    const a = ctx.datos.aprendizajes.find((x) => x.id === id);
    if (a) return { anverso: '', reverso: a.texto, origen: { coleccion: 'aprendizajes', id } };
  }
  return {};
}

function renderLista(ctx: Ctx): string {
  const lista = ctx.datos.tarjetas.filter((t) => !t.borrado).sort((a, b) => a.fsrs.due.localeCompare(b.fsrs.due));
  const origen = (t: Tarjeta) => {
    if (t.origen?.coleccion !== 'intentos') return '';
    const i = ctx.datos.intentos.find((x) => x.id === t.origen?.id);
    return i ? ` · desde ej. ${esc(i.ejercicio)} (${esc(ETIQUETA_ESTADO[i.estado].toLowerCase())})` : '';
  };
  const filas = lista.map((t) => `
    <li>
      <div class="li-main"><b>${esc(t.anverso)}</b><span class="m-sub">Vence ${esc(fmtRelativo(t.fsrs.due, ctx.hoy))} · ${t.fsrs.reps} repasos · ${t.fsrs.lapses} fallos${origen(t)}</span></div>
      <div class="li-acc"><a class="btn sutil" href="#repaso/editar/${esc(t.id)}">Editar</a><button class="btn sutil" data-accion="borrar-tarjeta" data-id="${esc(t.id)}">Borrar</button></div>
    </li>`).join('');
  return `${cabecera('Tarjetas', plural(lista.length, 'tarjeta'))}
    <div class="acciones"><a class="btn primario" href="#repaso/nueva">Nueva tarjeta</a><a class="btn sutil" href="#repaso">Volver al repaso</a></div>
    ${lista.length ? `<ul class="lista">${filas}</ul>` : vacio('Aún no hay tarjetas.')}`;
}

export const repaso: Vista = {
  titulo: 'Repaso',
  render(ctx) {
    const [modo, a, b] = (ctx.sub ?? '').split('/');
    let cuerpo: string;
    if (modo === 'nueva') cuerpo = cabecera('Nueva tarjeta') + formTarjeta(a && b ? borradorDesde(ctx, a, b) : {}, a === 'intentos' ? 'estudio' : 'repaso', 'Tarjeta');
    else if (modo === 'editar') {
      const t = ctx.datos.tarjetas.find((x) => x.id === a && !x.borrado);
      cuerpo = t ? cabecera('Editar tarjeta') + formTarjeta(t, 'repaso/tarjetas', 'Tarjeta') : vacio('Esa tarjeta no existe.');
    } else if (modo === 'tarjetas') cuerpo = renderLista(ctx);
    else cuerpo = renderCola(ctx);
    return `<section class="view repaso">${cuerpo}</section>`;
  },
  montar(ctx, raiz) {
    accion(raiz, 'click', 'mostrar', () => {
      revelada = vencidas(ctx.datos.tarjetas, ctx.ahora)[0]?.id ?? null;
      ctx.pintar();
      raiz.querySelector<HTMLButtonElement>('[data-nota="3"]')?.focus();
    });
    accion(raiz, 'click', 'nota', async (b) => {
      const t = vencidas(ctx.datos.tarjetas, new Date())[0];
      if (!t || revelada !== t.id) return;
      const r = repasar(t, Number(b.dataset.nota) as Nota, new Date());
      revelada = null;
      repasadasEnSesion++;
      await ctx.guardar({ coleccion: 'tarjetas', registro: r.tarjeta }, { coleccion: 'repasos', registro: r.repaso });
      if (vencidas(ctx.datos.tarjetas, new Date()).length === 0 && inicioSesion) {
        await ctx.registrar('repaso', Math.round((Date.now() - inicioSesion) / 1000));
        inicioSesion = null;
      }
    });
    accion(raiz, 'submit', 'guardar-tarjeta', async (form, e) => {
      e.preventDefault();
      const { anverso = '', reverso = '' } = campos(form as HTMLFormElement);
      const id = form.dataset.id;
      const existente = id ? ctx.datos.tarjetas.find((x) => x.id === id) : undefined;
      const [, a, b] = (ctx.sub ?? '').split('/');
      const origen = a && b ? { coleccion: a as Coleccion, id: b } : undefined;
      const registro = existente ? actualizar(existente, { anverso, reverso }, new Date()) : nuevaTarjeta(anverso, reverso, new Date(), origen);
      await ctx.guardar({ coleccion: 'tarjetas', registro });
      ctx.avisar(existente ? 'Tarjeta actualizada.' : 'Tarjeta creada: vence ahora.');
      ctx.ir(`#${form.dataset.destino ?? 'repaso'}`);
    });
    accion(raiz, 'click', 'borrar-tarjeta', async (b) => {
      const t = ctx.datos.tarjetas.find((x) => x.id === b.dataset.id);
      if (!t || !confirm(`¿Borrar la tarjeta «${t.anverso.slice(0, 60)}»?`)) return;
      await ctx.guardar({ coleccion: 'tarjetas', registro: borrar(t, new Date()) });
    });
  },
};

/* Atajos de teclado en la cola (en el Mac). Un único oyente para toda la app: sólo actúa en #repaso. */
document.addEventListener('keydown', (e) => {
  if (location.hash !== '#repaso' || e.metaKey || e.ctrlKey || e.altKey) return;
  const enCampo = e.target instanceof HTMLElement && e.target.matches('input, textarea, select');
  if (enCampo) return;
  const sel = e.key === ' ' ? '[data-accion="mostrar"]' : /^[1-4]$/.test(e.key) ? `[data-accion="nota"][data-nota="${e.key}"]` : '';
  const btn = sel ? document.querySelector<HTMLButtonElement>(`main ${sel}`) : null;
  if (btn) {
    e.preventDefault();
    btn.click();
  }
});
