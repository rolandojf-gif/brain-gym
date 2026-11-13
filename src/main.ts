/* BRAIN.GYM — arranque, navegación por hash, tema, estado de la sincronización y avisos. */
import './styles/base.css';
import { App, type Vista } from './app';
import { Almacen } from './datos/almacen';
import { esc } from './lib/html';
import { datos } from './vistas/datos';
import { estudio } from './vistas/estudio';
import { hoy } from './vistas/hoy';
import { lectura } from './vistas/lectura';
import { progreso } from './vistas/progreso';
import { repaso } from './vistas/repaso';
import { secuencias } from './vistas/secuencias';

const $ = <T extends Element>(s: string) => document.querySelector<T>(s);
const $$ = <T extends Element>(s: string) => [...document.querySelectorAll<T>(s)];

const VISTAS: Record<string, Vista> = {
  hoy,
  estudio,
  lectura,
  repaso,
  progreso,
  datos,
  // Sin pestaña: se entra desde Hoy.
  secuencias,
};

let app: App;
let vistaActual = '';
let pintadoPendiente = false;

function ruta(): { nombre: string; sub: string | null } {
  const [raw = '', ...resto] = location.hash.replace(/^#/, '').split('/');
  const v = raw === 'retos' ? 'estudio' : raw;
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
  $$<HTMLAnchorElement>('.topnav a[data-view]').forEach((a) => (a.dataset.view === nombre ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current')));
  // «Más» se marca cuando la vista abierta vive en su menú.
  $('#mas')?.classList.toggle('activa', Boolean($(`.mas-menu a[data-view="${nombre}"]`)));
  document.title = `${vista.titulo} · BRAIN.GYM`;
  if (nombre !== vistaActual) {
    vistaActual = nombre;
    window.scrollTo(0, 0);
  }
}

/**
 * Estado de la sincronización: siempre en el menú «Más» y, sólo si algo falla, como aviso en la cabecera. Que
 * funcione no necesita pantalla; que falle, sí.
 */
function pintarEstado(): void {
  if (!app) return;
  const s = app.sync;
  const enMenu = $<HTMLElement>('#mas-sync');
  if (enMenu) {
    enMenu.textContent = s.texto;
    enMenu.className = `mas-sync st-${s.tipo}`;
  }
  const aviso = $<HTMLAnchorElement>('#aviso-sync');
  if (!aviso) return;
  const falla = s.tipo === 'error' || s.tipo === 'aviso';
  aviso.hidden = !falla;
  aviso.className = `aviso-sync st-${s.tipo}`;
  aviso.textContent = falla ? s.texto : '';
  aviso.title = falla ? `${s.texto}. Abre Datos para revisarlo.` : '';
}

function avisar(texto: string, tipo: 'ok' | 'error' = 'ok'): void {
  const caja = $<HTMLElement>('#avisos');
  if (!caja) return;
  const el = Object.assign(document.createElement('div'), { className: `aviso ${tipo}`, textContent: texto });
  el.setAttribute('role', tipo === 'error' ? 'alert' : 'status');
  while (caja.children.length >= 2) caja.firstElementChild?.remove();
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

/* El menú «Más» se cierra al elegir algo, al pulsar fuera o con Escape. */
function initMenuMas(): void {
  const mas = $<HTMLDetailsElement>('#mas');
  if (!mas) return;
  mas.addEventListener('click', (e) => {
    if ((e.target as Element).closest('.mas-menu a')) mas.open = false;
  });
  document.addEventListener('click', (e) => {
    if (mas.open && !mas.contains(e.target as Node)) mas.open = false;
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && mas.open) {
      mas.open = false;
      mas.querySelector('summary')?.focus();
    }
  });
}

async function main(): Promise<void> {
  initTheme();
  initMenuMas();
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
  pintar(true);
  void app.sincronizar();
  // Sólo en producción: en desarrollo, la caché del service worker escondería los cambios.
  if ('serviceWorker' in navigator && import.meta.env.PROD) {
    navigator.serviceWorker.register('/sw.js').catch((e: unknown) => console.warn('Sin service worker:', e));
  }
}

void main();
