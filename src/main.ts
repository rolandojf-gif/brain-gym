/* BRAIN.GYM — navegación por hash, tema y vistas. Las vistas de cada módulo llegan en sus propias ramas. */
import './styles/base.css';
import { diaLogico } from './lib/dia';
import { esc } from './lib/html';

const $$ = <T extends Element>(s: string, r: ParentNode = document) => [...r.querySelectorAll<T>(s)];

export const VISTAS = ['hoy', 'estudio', 'lectura', 'repaso', 'calibracion', 'progreso', 'datos'] as const;
export type Vista = (typeof VISTAS)[number];

const TITULOS: Record<Vista, string> = {
  hoy: 'Hoy',
  estudio: 'Estudio',
  lectura: 'Lectura y escritura',
  repaso: 'Repaso',
  calibracion: 'Calibración',
  progreso: 'Progreso',
  datos: 'Datos',
};

function esVista(v: string): v is Vista {
  return (VISTAS as readonly string[]).includes(v);
}

function renderVista(vista: Vista): string {
  const fecha = new Intl.DateTimeFormat('es-ES', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date());
  const lede = vista === 'hoy' ? `${fecha} · día lógico ${diaLogico(new Date())}` : 'En construcción.';
  return `
    <section class="view" aria-labelledby="h-${vista}">
      <div class="view-head">
        <h1 id="h-${vista}">${esc(TITULOS[vista])}</h1>
        <p class="lede">${esc(lede)}</p>
      </div>
      <div class="empty">Este módulo llega en la Fase 1, paso 4.</div>
    </section>`;
}

function route(): void {
  const [v = ''] = location.hash.replace('#', '').split('/');
  const vista: Vista = esVista(v) ? v : 'hoy';
  const main = document.getElementById('main');
  if (main) main.innerHTML = renderVista(vista);
  $$<HTMLAnchorElement>('.navtab[data-view]').forEach((a) =>
    a.dataset.view === vista ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current'),
  );
}

function initTheme(): void {
  const root = document.documentElement;
  const sync = () =>
    $$<HTMLButtonElement>('[data-theme-set]').forEach((b) =>
      b.setAttribute('aria-pressed', String(b.dataset.themeSet === (root.dataset.theme ?? 'auto'))),
    );
  $$<HTMLButtonElement>('[data-theme-set]').forEach((b) =>
    b.addEventListener('click', () => {
      root.dataset.theme = b.dataset.themeSet ?? 'auto';
      try {
        localStorage.setItem('bg.theme', root.dataset.theme);
      } catch {
        /* sin almacenamiento: el tema dura lo que la pestaña */
      }
      sync();
    }),
  );
  sync();
}

initTheme();
window.addEventListener('hashchange', () => {
  route();
  window.scrollTo(0, 0);
});
route();
