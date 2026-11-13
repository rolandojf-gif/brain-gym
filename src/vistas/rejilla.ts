/* La rejilla viva de Hoy: el dilema del prisionero espacial dibujado en un canvas. El estado vive en el módulo para
   que repintar Hoy (elegir tema, guardar una idea) no la reinicie; el reloj se para solo cuando Hoy deja de estar en
   pantalla o la pestaña se oculta. */
import { accion } from '../app';
import {
  COOPERA,
  TENTACION_MAX,
  TENTACION_MIN,
  TENTACION_POR_DEFECTO,
  TRAICIONA,
  pasoRejilla,
  rejillaAleatoria,
  type Rejilla,
} from '../dominio/rejilla';
import { fmtNum } from '../lib/fmt';

const ANCHO = 40;
const ALTO = 16;
const MS_POR_GENERACION = 450;
const COLOR = { fondo: '#0F0F0E', coopera: '#CCFF00', reciencoopera: '#EEFFAA', traiciona: '#2E2E2A', recientraiciona: '#FF5722' };

interface Estado {
  actual: Rejilla;
  previa: Rejilla;
  b: number;
  pausa: boolean;
}

let estado: Estado | null = null;
let reloj: ReturnType<typeof setInterval> | undefined;

function asegurarEstado(): Estado {
  if (!estado) {
    const r = rejillaAleatoria(ANCHO, ALTO, 0.1, Date.now() % 2147483647);
    const reducir = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    estado = { actual: r, previa: r, b: TENTACION_POR_DEFECTO, pausa: reducir };
  }
  return estado;
}

const textoB = (b: number) => fmtNum(b, 2);

export function renderRejilla(): string {
  const e = asegurarEstado();
  return `
    <figure class="rejilla">
      <div class="rejilla-cab">
        <span>Cooperar o traicionar, en vivo</span>
        <small>Nowak y May, 1992</small>
      </div>
      <canvas class="rejilla-lienzo" width="${ANCHO * 12}" height="${ALTO * 12}" aria-hidden="true"></canvas>
      <ul class="rejilla-leyenda" aria-label="Qué significa cada color">
        <li><i class="l-coopera"></i>Coopera</li>
        <li><i class="l-traiciona"></i>Traiciona</li>
        <li><i class="l-recientraiciona"></i>Acaba de traicionar</li>
        <li><i class="l-reciencoopera"></i>Acaba de cooperar</li>
      </ul>
      <details class="rejilla-que">
        <summary>¿Qué estás viendo?</summary>
        <p>Cada cuadro es un jugador. En cada ronda juega el dilema del prisionero con sus ocho vecinos: si los dos cooperan, ganan 1 cada uno; si uno traiciona a un cooperador, el traidor se lleva el premio por traicionar y el otro, nada; entre dos traidores, nadie gana.</p>
        <p>Nadie piensa ni recuerda: tras cada ronda, cada cuadro copia lo que hizo el vecino que más ganó.</p>
        <p>Lo que se ve: los cooperadores sobreviven en grupos, porque dentro del grupo se benefician entre ellos; en los bordes los traidores se aprovechan. Por eso los bordes nunca se quedan quietos. Mezclados al azar, en cambio, ganarían siempre los traidores.</p>
      </details>
      <div class="rejilla-mandos">
        <div class="rejilla-b">
          <label for="rejilla-b">Premio por traicionar: <output data-b>${textoB(e.b)}</output></label>
          <input id="rejilla-b" type="range" min="${TENTACION_MIN}" max="${TENTACION_MAX}" step="0.05" value="${e.b}" data-accion="rejilla-b" aria-describedby="rejilla-b-pista">
          <small id="rejilla-b-pista">Por debajo de 1,8 ganan los cooperadores; por encima de 2, los traidores; entre medias, conviven.</small>
        </div>
        <div class="rejilla-botones">
          <button type="button" class="btn oscuro" data-accion="rejilla-sembrar" title="Convierte en traidor a un cooperador al azar">Meter un traidor</button>
          <button type="button" class="btn primario" data-accion="rejilla-pausa" aria-pressed="${e.pausa}">${e.pausa ? 'Seguir' : 'Pausar'}</button>
        </div>
      </div>
    </figure>`;
}

export function montarRejilla(raiz: HTMLElement): void {
  const lienzo = raiz.querySelector<HTMLCanvasElement>('.rejilla-lienzo');
  const ctx2d = lienzo?.getContext('2d');
  if (!lienzo || !ctx2d) return;
  const e = asegurarEstado();

  const ajustar = () => {
    // Píxeles reales del dispositivo, para que las celdas no salgan borrosas en pantallas retina.
    const ancho = Math.max(ANCHO, Math.round(lienzo.clientWidth * (window.devicePixelRatio || 1)));
    lienzo.width = ancho;
    lienzo.height = Math.round((ancho * ALTO) / ANCHO);
    dibujar(ctx2d, lienzo, e);
  };
  ajustar();
  const observador = typeof ResizeObserver === 'function' ? new ResizeObserver(ajustar) : null;
  observador?.observe(lienzo);

  clearInterval(reloj);
  reloj = setInterval(() => {
    if (!lienzo.isConnected) {
      clearInterval(reloj);
      observador?.disconnect();
      return;
    }
    if (e.pausa || document.hidden) return;
    e.previa = e.actual;
    e.actual = pasoRejilla(e.actual, e.b);
    dibujar(ctx2d, lienzo, e);
  }, MS_POR_GENERACION);

  accion(raiz, 'input', 'rejilla-b', (el) => {
    const b = Number((el as HTMLInputElement).value);
    if (!Number.isFinite(b)) return;
    e.b = Math.min(TENTACION_MAX, Math.max(TENTACION_MIN, b));
    const salida = raiz.querySelector('[data-b]');
    if (salida) salida.textContent = textoB(e.b);
  });

  accion(raiz, 'click', 'rejilla-sembrar', () => {
    const libres: number[] = [];
    e.actual.celdas.forEach((c, i) => {
      if (c === COOPERA) libres.push(i);
    });
    // Sin cooperadores no hay a quién traicionar: se vuelve a repartir.
    if (libres.length === 0) {
      e.actual = rejillaAleatoria(ANCHO, ALTO, 0.1, Date.now() % 2147483647);
      e.previa = e.actual;
    } else {
      const celdas = Uint8Array.from(e.actual.celdas);
      celdas[libres[Math.floor(Math.random() * libres.length)] ?? 0] = TRAICIONA;
      e.previa = e.actual;
      e.actual = { ...e.actual, celdas };
    }
    dibujar(ctx2d, lienzo, e);
  });

  accion(raiz, 'click', 'rejilla-pausa', (el) => {
    e.pausa = !e.pausa;
    el.textContent = e.pausa ? 'Seguir' : 'Pausar';
    el.setAttribute('aria-pressed', String(e.pausa));
  });
}

function dibujar(c: CanvasRenderingContext2D, lienzo: HTMLCanvasElement, e: Estado): void {
  const lado = lienzo.width / ANCHO;
  const hueco = Math.max(1, Math.round(lado * 0.12));
  c.fillStyle = COLOR.fondo;
  c.fillRect(0, 0, lienzo.width, lienzo.height);
  const { celdas } = e.actual;
  const previas = e.previa.celdas;
  for (let y = 0; y < ALTO; y++) {
    for (let x = 0; x < ANCHO; x++) {
      const i = y * ANCHO + x;
      const ahora = celdas[i], antes = previas[i];
      c.fillStyle =
        ahora === COOPERA
          ? antes === COOPERA ? COLOR.coopera : COLOR.reciencoopera
          : antes === TRAICIONA ? COLOR.traiciona : COLOR.recientraiciona;
      const x0 = Math.round(x * lado), y0 = Math.round(y * lado);
      c.fillRect(x0, y0, Math.round((x + 1) * lado) - x0 - hueco, Math.round((y + 1) * lado) - y0 - hueco);
    }
  }
}
