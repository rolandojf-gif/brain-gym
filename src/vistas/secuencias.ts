/* Secuencias: el juego de atención sostenida (ver src/dominio/secuencias.ts). No se guarda nada: es una opción del
   menú para cuando apetece, no un ejercicio que registrar. El estado vive en el módulo para que un repintado de
   fondo (una sincronización) no corte la partida; el bucle escribe en el DOM buscando los elementos cada vez. */
import { accion, type Ctx, type Vista } from '../app';
import { CONFIG, OBJETIVOS, cerrar, nuevaPartida, pulsar, siguienteDigito, type Partida, type Resumen } from '../dominio/secuencias';
import { esc } from '../lib/html';

type Fase = 'inicio' | 'jugando' | 'fin';

let fase: Fase = 'inicio';
let partida: Partida | null = null;
let ultimo: Resumen | null = null;
let interrumpida = false;
/** Cuándo acabó (o se cortó) la última partida: pasado un rato, al volver se ve otra vez la presentación. */
let marca = 0;
const CADUCA_MS = 10 * 60_000;
let reloj: ReturnType<typeof setTimeout> | undefined;
let ctxActual: Ctx | null = null;

const $ = <T extends Element>(s: string) => document.querySelector<T>(s);
const enPantalla = () => location.hash.startsWith('#secuencias');
const porMinuto = (ms: number) => Math.round(60_000 / ms);

function renderObjetivos(): string {
  return `<div class="sec-objetivos" aria-label="Secuencias objetivo">${OBJETIVOS.map(
    (o) => `<span>${o.join('<i>·</i>')}</span>`,
  ).join('')}</div>`;
}

function renderInicio(): string {
  const aviso = interrumpida ? '<p class="note">La partida se cortó al salir de la pantalla. Empieza otra cuando quieras.</p>' : '';
  return `
    <div class="view-head">
      <p class="kicker">Atención sostenida</p>
      <h1>Secuencias</h1>
      <p class="lede">Pasan dígitos del 2 al 9, uno tras otro. Responde en cuanto veas completarse una de estas tres secuencias:</p>
    </div>
    ${renderObjetivos()}
    <div class="panel sec-reglas">
      <p>Pulsa la <b>barra espaciadora</b> o el botón grande. Si aciertas cinco seguidas, el ritmo se acelera; si pulsas sin secuencia o dejas pasar una, se frena. Empieza a ${porMinuto(CONFIG.intervaloInicial)} dígitos por minuto y dura ${CONFIG.duracion / 60_000} minutos.</p>
      <p class="m-sub">Inspirado en la tarea RVP de Cambridge (Sahakian y otros, 1989). No se guarda nada.</p>
      ${aviso}
      <div class="acciones"><button type="button" class="btn primario grande" data-accion="sec-empezar">Empezar</button></div>
    </div>`;
}

function renderJuego(p: Partida): string {
  const d = p.digitos.at(-1);
  return `
    ${renderObjetivos()}
    <div class="sec-escena" data-sec-escena>
      <div class="sec-barra"><span data-sec-tiempo></span></div>
      <output class="sec-digito" data-sec-digito aria-live="off">${d ?? ''}</output>
      <p class="sec-ritmo m-sub" data-sec-ritmo>${porMinuto(p.intervalo)} dígitos/min</p>
    </div>
    <button type="button" class="sec-boton" data-accion="sec-pulsar" tabindex="-1">Secuencia<small>o barra espaciadora</small></button>
    <div class="acciones sec-pie"><button type="button" class="btn sutil" data-accion="sec-parar">Parar</button></div>`;
}

function renderFin(r: Resumen): string {
  const reaccion = r.reaccionMediana === null ? '—' : `${Math.round(r.reaccionMediana)} ms`;
  return `
    <div class="view-head">
      <p class="kicker">Secuencias</p>
      <h1>Fin de la partida</h1>
    </div>
    <div class="kpis">
      <div class="kpi"><span class="k">Secuencias vistas</span><span class="v">${r.aciertos} de ${r.objetivos}</span><span class="s">${r.omisiones === 1 ? '1 se te pasó' : `${r.omisiones} se te pasaron`}</span></div>
      <div class="kpi"><span class="k">Falsas alarmas</span><span class="v">${r.falsosPositivos}</span><span class="s">pulsaciones sin secuencia</span></div>
      <div class="kpi"><span class="k">Reacción</span><span class="v">${esc(reaccion)}</span><span class="s">mediana de los aciertos</span></div>
      <div class="kpi"><span class="k">Ritmo</span><span class="v">${porMinuto(r.intervaloFinal)}/min</span><span class="s">al acabar; el más rápido, ${porMinuto(r.intervaloMin)}/min</span></div>
    </div>
    <div class="acciones">
      <button type="button" class="btn primario grande" data-accion="sec-empezar">Otra partida</button>
      <a class="btn" href="#hoy">Volver a Hoy</a>
    </div>`;
}

/** Destello breve en la escena: lima si acierta, naranja si no. */
function destello(clase: 'sec-bien' | 'sec-mal'): void {
  const escena = $<HTMLElement>('[data-sec-escena]');
  if (!escena) return;
  escena.classList.remove('sec-bien', 'sec-mal');
  void escena.offsetWidth; // reinicia la animación aunque se repita la misma clase
  escena.classList.add(clase);
}

function mostrarDigito(d: number, p: Partida, t: number): void {
  const el = $<HTMLElement>('[data-sec-digito]');
  if (el) {
    el.textContent = String(d);
    // Un parpadeo mínimo para que dos dígitos iguales seguidos se distingan.
    el.animate?.([{ opacity: 0.1 }, { opacity: 1 }], { duration: 80 });
  }
  const ritmo = $<HTMLElement>('[data-sec-ritmo]');
  if (ritmo) ritmo.textContent = `${porMinuto(p.intervalo)} dígitos/min`;
  const barra = $<HTMLElement>('[data-sec-tiempo]');
  if (barra) barra.style.width = `${Math.min(100, ((t - p.inicio) / p.config.duracion) * 100)}%`;
}

function paso(): void {
  const p = partida;
  if (!p || fase !== 'jugando') return;
  if (!enPantalla() || document.hidden) return interrumpir();
  const t = performance.now();
  if (t - p.inicio >= p.config.duracion) return terminar(t);
  mostrarDigito(siguienteDigito(p, t), p, t);
  reloj = setTimeout(paso, p.intervalo);
}

function responder(t: number): void {
  if (!partida || fase !== 'jugando' || partida.digitos.length === 0) return;
  destello(pulsar(partida, t).tipo === 'acierto' ? 'sec-bien' : 'sec-mal');
}

function alTeclear(e: KeyboardEvent): void {
  if (e.code !== 'Space' && e.key !== ' ') return;
  e.preventDefault(); // que la barra no desplace la página
  if (!e.repeat) responder(performance.now());
}

function alOcultar(): void {
  if (document.hidden) interrumpir();
}

function soltar(): void {
  clearTimeout(reloj);
  window.removeEventListener('keydown', alTeclear);
  document.removeEventListener('visibilitychange', alOcultar);
}

function empezar(): void {
  soltar();
  interrumpida = false;
  partida = nuevaPartida(performance.now());
  fase = 'jugando';
  window.addEventListener('keydown', alTeclear);
  document.addEventListener('visibilitychange', alOcultar);
  ctxActual?.pintar();
  // Un respiro antes del primer dígito, para colocar los dedos.
  reloj = setTimeout(() => {
    if (partida) partida.inicio = performance.now();
    paso();
  }, 800);
}

function terminar(t: number): void {
  soltar();
  if (partida) ultimo = cerrar(partida, t);
  partida = null;
  fase = 'fin';
  marca = Date.now();
  if (enPantalla()) ctxActual?.pintar();
}

/** Una partida a medias no vale como resultado: se descarta. Sólo se avisa si no la paró el usuario. */
function interrumpir(avisar = true): void {
  soltar();
  partida = null;
  fase = 'inicio';
  interrumpida = avisar;
  marca = Date.now();
  if (enPantalla()) ctxActual?.pintar();
}

export const secuencias: Vista = {
  titulo: 'Secuencias',
  render() {
    if (fase !== 'jugando' && Date.now() - marca > CADUCA_MS) {
      fase = 'inicio';
      interrumpida = false;
    }
    const cuerpo = fase === 'jugando' && partida ? renderJuego(partida) : fase === 'fin' && ultimo ? renderFin(ultimo) : renderInicio();
    return `<section class="view secuencias">${cuerpo}</section>`;
  },
  montar(ctx, raiz) {
    ctxActual = ctx;
    accion(raiz, 'click', 'sec-empezar', () => empezar());
    accion(raiz, 'click', 'sec-parar', () => interrumpir(false));
    // pointerdown y no click: responde al tocar, sin esperar a levantar el dedo, que en móvil suma 100 ms o más.
    accion(raiz, 'pointerdown', 'sec-pulsar', (_el, e) => {
      e.preventDefault();
      responder(performance.now());
    });
  },
};
