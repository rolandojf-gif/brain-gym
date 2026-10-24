/* BRAIN.GYM — arranque, navegación por hash, tema, franja de estado y avisos. */
import './styles/base.css';
import { App, type Vista } from './app';
import { Almacen } from './datos/almacen';
import { fmtReloj } from './lib/fmt';
import { esc } from './lib/html';
import * as temporizador from './lib/temporizador';
import { NOMBRE_ACTIVIDAD } from './vistas/comun';
import { datos } from './vistas/datos';
import { estudio } from './vistas/estudio';
import { hoy } from './vistas/hoy';
import { progreso } from './vistas/progreso';
import { repaso } from './vistas/repaso';

const $ = <T extends Element>(s: string) => document.querySelector<T>(s);
const $$ = <T extends Element>(s: string) => [...document.querySelectorAll<T>(s)];

const enConstruccion = (titulo: string): Vista => ({
  titulo,
  render: () => `<section class="view"><div class="view-head"><h1>${esc(titulo)}</h1></div><div class="empty">Este módulo llega en su propia rama de la Fase 1.</div></section>`,
});

const VISTAS: Record<string, Vista> = {
  hoy,
  estudio,
  lectura: enConstruccion('Lectura y escritura'),
  repaso,
  calibracion: enConstruccion('Calibración'),
  progreso,
  datos,
};

let app: App;
let vistaActual = '';
let pintadoPendiente = false;

function ruta(): { nombre: string; sub: string | null } {
  const [v = '', ...resto] = location.hash.replace(/^#/, '').split('/');
  let sub = resto.join('/');
  try { sub = decodeURIComponent(sub); } catch { /* se usa tal cual */ }
  return { nombre: v in VISTAS ? v : 'hoy', sub: sub || null };
}

/* Un pintado que llega de fondo (una sincronización) no debe borrar lo que se está escribiendo: se aplaza hasta
   la siguiente navegación, guardado o vuelta a la app. Los pintados que pide el usuario van siempre. No se repinta al
   perder el foco: eso destruiría el botón que se acaba de pulsar antes de que llegue el clic. */
function pintar(forzar = false): void {
  pintarEstado();
  const activo = document.activeElement;
  if (!forzar && activo instanceof HTMLElement && activo.closest('main') && activo.matches('input, textarea, select')) {
    pintadoPendiente = true;
    return;
  }
  pintadoPendiente = false;
  const { nombre, sub } = ruta();
  const vista = VISTAS[nombre] ?? hoy;
  const ctx = app.ctx(sub);
  const main = $<HTMLElement>('#main');
  if (!main) return;
  main.innerHTML = vista.render(ctx);
  const raiz = main.firstElementChild;
  if (raiz instanceof HTMLElement) vista.montar?.(ctx, raiz);
  $$<HTMLAnchorElement>('.navtab[data-view]').forEach((a) => (a.dataset.view === nombre ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current')));
  document.title = `${vista.titulo} · BRAIN.GYM`;
  if (nombre !== vistaActual) {
    vistaActual = nombre;
    window.scrollTo(0, 0);
  }
}

/** Franja bajo la cabecera: temporizador en marcha y estado de la sincronización. */
function pintarEstado(): void {
  const el = $<HTMLElement>('#franja');
  if (!el || !app) return;
  const t = temporizador.actual();
  const crono = t ? `<span class="crono">● ${esc(NOMBRE_ACTIVIDAD[t.actividad])} <b>${fmtReloj((Date.now() - t.inicio) / 1000)}</b></span>` : '';
  const s = app.sync;
  const sync = s.texto ? `<span class="st-${s.tipo}">${esc(s.texto)}</span>` : '';
  el.innerHTML = `${crono}${sync}<a class="ir-datos" href="#datos">Datos</a>`;
  el.hidden = !crono && !sync;
}

function avisar(texto: string, tipo: 'ok' | 'error' = 'ok'): void {
  const caja = $<HTMLElement>('#avisos');
  if (!caja) return;
  const el = Object.assign(document.createElement('div'), { className: `aviso ${tipo}`, textContent: texto });
  el.setAttribute('role', tipo === 'error' ? 'alert' : 'status');
  caja.append(el);
  setTimeout(() => el.remove(), tipo === 'error' ? 8000 : 3500);
}

function initTheme(): void {
  const root = document.documentElement;
  const sync = () => $$<HTMLButtonElement>('[data-theme-set]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.themeSet === (root.dataset.theme ?? 'auto'))));
  $$<HTMLButtonElement>('[data-theme-set]').forEach((b) => b.addEventListener('click', () => {
    root.dataset.theme = b.dataset.themeSet ?? 'auto';
    try { localStorage.setItem('bg.theme', root.dataset.theme); } catch { /* el tema dura lo que la pestaña */ }
    sync();
  }));
  sync();
}

/* Altura de la cabecera fija, para colocar la franja de estado justo debajo. */
function seguirCabecera(): void {
  const nav = $<HTMLElement>('.topnav');
  if (!nav) return;
  const fijar = () => document.documentElement.style.setProperty('--top-h', `${Math.round(nav.getBoundingClientRect().height)}px`);
  fijar();
  new ResizeObserver(fijar).observe(nav);
}

async function main(): Promise<void> {
  initTheme();
  seguirCabecera();
  let almacen: Almacen;
  try {
    almacen = await Almacen.abrir();
  } catch (e) {
    const main = $<HTMLElement>('#main');
    if (main) main.innerHTML = `<div class="empty">No se pudieron abrir los datos de este dispositivo: ${esc(e instanceof Error ? e.message : String(e))}</div>`;
    console.error(e);
    return;
  }
  app = new App(almacen, pintar, avisar);
  await app.cargar();
  window.addEventListener('hashchange', () => pintar(true));
  // Sincroniza al abrir y al volver a la app (p. ej., al cambiar del Mac al móvil).
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    if (pintadoPendiente) pintar();
    void app.sincronizar();
  });
  setInterval(pintarEstado, 1000);
  pintar(true);
  void app.sincronizar();
}

void main();
