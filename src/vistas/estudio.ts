/* 02 · Retos: «Ring de Sparring» interactivo autocontenido con el acordeón de 3 pasos
   (1. Compromiso/Jugada inicial → 2. Andamiaje opcional/Pista → 3. Choque con la realidad y cierre en 1 clic)
   y Modo Revisión desplegable para inspeccionar retos ya completados. */
import { accion, campos, type Ctx, type Vista } from '../app';
import {
  BLOQUES_RETOS,
  CATALOGO_RETOS,
  ID_FUENTE_RETOS,
  estadoAutomatico,
  estadoDeReto,
  fuenteRetos,
  inspeccionarRetoCompletado,
  intentosContables,
  letraVisible,
  opcionesVisibles,
  siguienteRetoPendiente,
  type InspeccionReto,
  type Reto,
} from '../dominio/catalogo-retos';
import { NIVELES_CONFIANZA, pideConfianza } from '../dominio/calibracion';
import { ETIQUETA_ESTADO, desgloseResolucion, progresoPorCapitulo } from '../dominio/estudio';
import { nuevaTarjeta } from '../dominio/fsrs';
import { actualizar, borrar, nuevo } from '../dominio/registro';
import type { EstadoIntento, Intento } from '../dominio/tipos';
import { fmtDuracion, fmtPct, fmtRelativo, plural } from '../lib/fmt';
import { esc } from '../lib/html';
import { cabecera, vacio } from './comun';

interface EstadoAcordeon {
  retoId: string;
  paso: 1 | 2 | 3;
  /** Jugada fijada antes de la pista: decide si cuenta como «sin ayuda». */
  opcionInicial: string;
  opcionElegida: string;
  /** Confianza en la jugada inicial; null si no se pide (debate o reintento). */
  confianza: number | null;
  /** Lo que el usuario escribe antes de ver las opciones (opcional): generar fija más que reconocer. */
  respuestaLibre: string;
  opcionesReveladas: boolean;
  pistaDesbloqueada: boolean;
  inicioMs: number;
}

/** Cómo se lee cada nivel de NIVELES_CONFIANZA, en el mismo orden. */
const LECTURA_CONFIANZA = ['casi a ciegas', 'me inclino', 'lo tengo claro'];

let filtroBloque = 'todos';
let estadoActual: EstadoAcordeon | null = null;
const revisionesAbiertas = new Set<string>();

function asegurarEstado(reto: Reto): EstadoAcordeon {
  if (!estadoActual || estadoActual.retoId !== reto.id) estadoActual = estadoNuevo(reto.id);
  return estadoActual;
}

function estadoNuevo(retoId: string): EstadoAcordeon {
  return {
    retoId,
    paso: 1,
    opcionInicial: '',
    opcionElegida: '',
    confianza: null,
    respuestaLibre: '',
    opcionesReveladas: false,
    pistaDesbloqueada: false,
    inicioMs: Date.now(),
  };
}

function retoActivo(ctx: Ctx): Reto {
  const [modo, id] = (ctx.sub ?? '').split('/');
  if (modo === 'reto' && id) {
    const buscado = CATALOGO_RETOS.find((r) => r.id === id);
    if (buscado) return buscado;
  }
  if (estadoActual) {
    const enCurso = CATALOGO_RETOS.find((r) => r.id === estadoActual?.retoId);
    if (enCurso && (filtroBloque === 'todos' || enCurso.bloque === filtroBloque)) {
      return enCurso;
    }
  }
  return siguienteRetoPendiente(ctx.datos.intentos, filtroBloque);
}

function renderAcordeon(reto: Reto, est: EstadoAcordeon, estadoPrevio: EstadoIntento | null, pedirConfianza: boolean): string {
  const bloque = BLOQUES_RETOS.find((b) => b.id === reto.bloque);
  const tagPrevio = estadoPrevio
    ? `<span class="tag e-${estadoPrevio}">${esc(ETIQUETA_ESTADO[estadoPrevio])}</span>`
    : '<span class="tag">Pendiente</span>';

  const bloqueOpciones = opcionesVisibles(reto)
    .map((op) => {
      const checked = est.opcionElegida === op.id ? ' checked' : '';
      const disabled = est.paso === 3 || (est.paso === 2 && !est.pistaDesbloqueada) ? ' disabled' : '';
      let claseExtra = '';
      if (est.paso === 3 && !reto.debate) {
        if (op.id === reto.opcionCorrecta) claseExtra = ' op-correcta';
        else if (op.id === est.opcionElegida) claseExtra = ' op-trampa';
      }
      return `
        <label class="reto-opcion${claseExtra}">
          <input type="radio" name="opcion" value="${esc(op.id)}"${checked}${disabled} required>
          <span class="op-letra">${esc(op.letra)}</span>
          <span class="op-texto">${esc(op.texto)}</span>
        </label>`;
    })
    .join('');

  const paso1Acciones =
    est.paso === 1
      ? `<div class="acciones">
           <button type="submit" class="btn primario">[ Fijar mi jugada ]</button>
         </div>`
      : '';

  const paso2 =
    est.paso >= 2
      ? `<div class="reto-paso">
           <div class="lbl">Paso 2 · Andamiaje opcional</div>
           <p class="m-sub">Jugada fijada: <b>Opción ${esc(letraVisible(reto, est.opcionInicial))}</b>${est.confianza === null ? '' : ` · confianza ${esc(fmtPct(est.confianza))}`}${est.respuestaLibre ? ` · «${esc(est.respuestaLibre)}»` : ''}</p>
           ${
             est.pistaDesbloqueada
               ? `<div class="reto-pista"><b>Pista desbloqueada:</b> ${esc(reto.pista)}<p class="m-sub">Si has detectado el fallo, puedes cambiar la opción marcada arriba antes de ver la resolución.</p></div>`
               : ''
           }
           ${
             est.paso === 2
               ? `<div class="acciones">
                    ${!est.pistaDesbloqueada ? `<button type="button" class="btn" data-accion="desbloquear-pista">[ Desbloquear pista ]</button>` : ''}
                    <button type="button" class="btn primario" data-accion="ver-resolucion">[ Ver resolución ]</button>
                  </div>`
               : ''
           }
         </div>`
      : '';

  const estadoFinal = estadoAutomatico(reto, est.opcionInicial, est.opcionElegida, est.pistaDesbloqueada);
  const elegida = esc(letraVisible(reto, est.opcionElegida));
  const veredicto = reto.debate
    ? `<div class="reto-veredicto"><b>Reto de debate: elegiste la ${elegida}. No hay respuesta correcta; mira los argumentos de cada lado.</b></div>`
    : est.opcionElegida === reto.opcionCorrecta
      ? `<div class="reto-veredicto ok"><b>${estadoFinal === 'sin_ayuda' ? '¡Diste en el clavo!' : `Acertaste con la pista (elegiste la ${elegida}).`}</b></div>`
      : `<div class="reto-veredicto trampa"><b>Caíste en la trampa intuitiva (elegiste la ${elegida}, la mejor jugada es la ${esc(letraVisible(reto, reto.opcionCorrecta))})</b></div>`;
  const paso3 =
    est.paso === 3
      ? `<div class="reto-paso reto-resolucion">
           <div class="lbl">Paso 3 · Choque con la realidad</div>
           ${veredicto}
           <div class="reto-explicacion">
             <p>${esc(reto.solucion)}</p>
           </div>
           <div class="reto-modelo">
             <span class="lbl">Modelo mental accionable (reverso FSRS)</span>
             <p><b>${esc(reto.modeloMental)}</b></p>
           </div>
           <div class="acciones reto-cierre">
             <button type="button" class="btn primario" data-accion="guardar-reto">${estadoFinal === 'solucion' ? '[ Guardar y crear tarjeta de repaso ]' : '[ Guardar y seguir ]'}</button>
             <span class="m-sub">${reto.debate ? 'Debate: no cuenta en las estadísticas.' : `Se guarda como: ${esc(ETIQUETA_ESTADO[estadoFinal])}.`}</span>
           </div>
         </div>`
      : '';

  return `
    <article class="panel reto-ring">
      <header class="reto-head">
        <div>
          <span class="lbl">Bloque ${esc(reto.bloque)} · ${esc(bloque?.titulo ?? '')} · Reto ${esc(reto.id)}</span>
          <h2 class="reto-titulo">${esc(reto.titulo)}</h2>
        </div>
        ${tagPrevio}
      </header>
      <p class="reto-escenario">${esc(reto.escenario)}</p>
      ${
        est.opcionesReveladas
          ? `<form class="form-bloque" data-accion="fijar-jugada">
               <div class="lbl">Paso 1 · Compromiso y jugada inicial</div>
               ${est.respuestaLibre ? `<p class="m-sub">Antes de ver las opciones escribiste: «${esc(est.respuestaLibre)}»</p>` : ''}
               <div class="reto-opciones">${bloqueOpciones}</div>
               ${pedirConfianza ? renderConfianza(est) : ''}
               ${paso1Acciones}
             </form>`
          : `<form class="form-bloque" data-accion="ver-opciones">
               <div class="lbl">Paso 1 · Antes de ver las opciones</div>
               <label class="campo">
                 ¿Qué harías tú? (una línea, opcional)
                 <input name="respuesta" value="${esc(est.respuestaLibre)}" maxlength="300" placeholder="Con tus palabras, antes de que las opciones te sugieran nada…" autocomplete="off">
               </label>
               <div class="acciones">
                 <button type="submit" class="btn primario">[ Ver opciones ]</button>
               </div>
             </form>`
      }
      ${paso2}
      ${paso3}
    </article>`;
}

// Se compromete junto con la jugada, antes de la pista: es la probabilidad que se puntúa con Brier.
function renderConfianza(est: EstadoAcordeon): string {
  const bloqueado = est.paso > 1 ? ' disabled' : '';
  const niveles = NIVELES_CONFIANZA.map((c, i) => {
    const checked = est.confianza === c ? ' checked' : '';
    return `<label><input type="radio" name="confianza" value="${c}"${checked}${bloqueado} required> <b>${esc(fmtPct(c))}</b> <span class="m-sub">${esc(LECTURA_CONFIANZA[i] ?? '')}</span></label>`;
  }).join('');
  return `<fieldset class="seg-radio"><legend>¿Cuánto confías en tu jugada?</legend>${niveles}</fieldset>`;
}

export function renderPanelRevision(ctx: Ctx, insp: InspeccionReto): string {
  const { reto, intento, opcionElegida, logica, acertada } = insp;
  const tieneTarjeta = ctx.datos.tarjetas.some(
    (t) =>
      !t.borrado &&
      (t.id === intento.tarjetaId ||
        (t.origen?.coleccion === 'intentos' && t.origen.id === intento.id) ||
        t.anverso.includes(`[Reto ${reto.id}`)),
  );

  const opcionesHtml = opcionesVisibles(reto)
    .map((op) => {
      const esCorrecta = op.id === reto.opcionCorrecta;
      const esElegida = op.id === opcionElegida;
      const clase = esCorrecta ? ' op-correcta' : esElegida ? ' op-trampa' : '';
      let insignia = '';
      if (reto.debate) {
        insignia = esElegida ? '<span class="tag">Tu postura</span>' : '';
      } else if (esCorrecta && esElegida) {
        insignia = '<span class="tag e-sin_ayuda">✓ Tu jugada · Óptima</span>';
      } else if (esCorrecta) {
        insignia = '<span class="tag e-sin_ayuda">✓ Opción óptima</span>';
      } else if (esElegida) {
        insignia = '<span class="tag e-solucion">✗ Tu jugada · Trampa</span>';
      }
      return `
        <div class="reto-opcion rev-opcion${clase}">
          <span class="op-letra">${esc(op.letra)}</span>
          <span class="op-texto">${esc(op.texto)} ${insignia}</span>
        </div>`;
    })
    .join('');

  return `
    <div class="reto-revision-cuerpo">
      <p class="reto-escenario">${esc(reto.escenario)}</p>
      <div class="lbl">Opciones y diagnóstico de tu jugada</div>
      <div class="reto-opciones">${opcionesHtml}</div>
      <div class="reto-veredicto ${reto.debate ? '' : acertada ? 'ok' : 'trampa'}">
        <b>${
          reto.debate
            ? `Reto de debate: tu postura fue la ${esc(letraVisible(reto, opcionElegida) ?? '—')}`
            : acertada
              ? `Acertaste la opción óptima (${esc(letraVisible(reto, reto.opcionCorrecta))})`
              : opcionElegida
                ? `Marcaste la opción ${esc(letraVisible(reto, opcionElegida))} (trampa); la jugada óptima era la ${esc(letraVisible(reto, reto.opcionCorrecta))}`
                : `La jugada óptima era la opción ${esc(letraVisible(reto, reto.opcionCorrecta))}`
        }</b>
        ${logica ? `<span> · Lo que escribiste: «${esc(logica)}»</span>` : ''}
      </div>
      <div class="reto-explicacion">
        <span class="lbl">Explicación detallada del mecanismo y la trampa</span>
        <p>${esc(reto.solucion)}</p>
      </div>
      <div class="reto-modelo">
        <span class="lbl">Regla mental destilada</span>
        <p><b>${esc(reto.modeloMental)}</b></p>
      </div>
      <div class="acciones">
        ${
          tieneTarjeta
            ? '<span class="tag e-sin_ayuda">✓ Tarjeta FSRS ya en tu mazo</span>'
            : `<button type="button" class="btn primario" data-accion="crear-tarjeta-reto" data-id="${esc(reto.id)}">[ + Crear tarjeta FSRS con esta regla ]</button>`
        }
        <button type="button" class="btn" data-accion="reintentar-reto" data-id="${esc(reto.id)}">[ Reintentar reto ]</button>
        <button type="button" class="btn sutil" data-accion="toggle-revision" data-id="${esc(reto.id)}">Cerrar análisis</button>
      </div>
    </div>`;
}

function resumenInspeccion({ reto, opcionElegida, acertada }: InspeccionReto): string {
  const elegida = esc(letraVisible(reto, opcionElegida) ?? '—');
  if (reto.debate) return `Debate (tu postura: ${elegida})`;
  return acertada ? `Resuelto (opción ${elegida})` : `Trampa detectada (elegiste ${elegida}, óptima ${esc(letraVisible(reto, reto.opcionCorrecta))})`;
}

function filaIntento(ctx: Ctx, i: Intento): string {
  const reto = CATALOGO_RETOS.find((r) => r.id === i.ejercicio);
  const titulo = reto ? `${reto.id} · ${reto.titulo}` : `Bloque ${i.capitulo} · Reto ${i.ejercicio}`;
  const tarjeta = ctx.datos.tarjetas.find((t) => !t.borrado && (t.id === i.tarjetaId || (t.origen?.coleccion === 'intentos' && t.origen.id === i.id)));
  const abierto = reto ? revisionesAbiertas.has(reto.id) : false;
  const verAnalisis = reto
    ? `<button type="button" class="btn ${abierto ? 'primario' : 'sutil'}" data-accion="toggle-revision" data-id="${esc(reto.id)}">${abierto ? 'Ocultar análisis' : '[ Ver análisis / Repasar ]'}</button>`
    : '';
  const crear = i.estado !== 'sin_ayuda' && !tarjeta && !reto ? `<a class="btn sutil" href="#repaso/nueva/intentos/${esc(i.id)}">Crear tarjeta</a>` : '';
  return `
    <li>
      <div class="li-main">
        <b>${esc(titulo)} <span class="tag e-${i.estado}">${esc(ETIQUETA_ESTADO[i.estado])}</span></b>
        ${i.notaError ? `<span>${esc(i.notaError)}</span>` : ''}
        <span class="m-sub">${esc(fmtRelativo(i.dia, ctx.hoy))}${i.segundos ? ` · ${esc(fmtDuracion(i.segundos))}` : ''}${typeof i.confianza === 'number' ? ` · confianza ${esc(fmtPct(i.confianza))}` : ''}${tarjeta ? ' · con tarjeta FSRS' : ''}</span>
      </div>
      <div class="li-acc">${verAnalisis}${crear}<button class="btn sutil" data-accion="borrar-intento" data-id="${esc(i.id)}">Borrar</button></div>
    </li>`;
}

export const estudio: Vista = {
  titulo: 'Retos',
  render(ctx) {
    const fuente = fuenteRetos(ctx.ahora);
    const intentos = ctx.datos.intentos.filter((i) => !i.borrado).sort((a, b) => b.creado.localeCompare(a.creado));
    const contables = intentosContables(intentos);
    const desglose = desgloseResolucion(contables);
    const progreso = progresoPorCapitulo(fuente, contables);
    const reto = retoActivo(ctx);
    const est = asegurarEstado(reto);
    const estadoPrevio = estadoDeReto(reto.id, intentos);

    const bloquesFiltro = [
      { id: 'todos', texto: 'Todos los bloques' },
      ...BLOQUES_RETOS.map((b) => ({ id: b.id, texto: `${b.id}. ${b.titulo}` })),
    ];

    const catalogoHtml = BLOQUES_RETOS.map((b) => {
      const retosBloque = CATALOGO_RETOS.filter((r) => r.bloque === b.id);
      const prog = progreso.find((p) => p.capitulo === b.id);
      return `
        <div class="panel bloque-cat">
          <div class="bloque-head">
            <div>
              <span class="lbl">Bloque ${esc(b.id)}</span>
              <h3>${esc(b.titulo)}</h3>
              <p class="m-sub">${esc(b.descripcion)}</p>
            </div>
            <span class="estado">${prog ? `${prog.sinAyuda}/${prog.total ?? retosBloque.length} sin ayuda` : `0/${retosBloque.length}`}</span>
          </div>
          <ul class="lista">
            ${retosBloque
              .map((r) => {
                const insp = inspeccionarRetoCompletado(r.id, intentos);
                const st = insp?.intento.estado ?? null;
                const activo = r.id === reto.id;
                const abierto = Boolean(insp && revisionesAbiertas.has(r.id));
                const claseItem = insp ? `reto-completado${abierto ? ' abierto' : ''}` : '';
                return `
                  <li class="${claseItem}" id="cat-reto-${esc(r.id)}">
                    <div class="li-fila">
                      <div class="li-main" ${insp ? `data-accion="toggle-revision" data-id="${esc(r.id)}" role="button" tabindex="0"` : ''}>
                        <b>${esc(r.id)} · ${esc(r.titulo)} ${st ? `<span class="tag e-${st}">${esc(ETIQUETA_ESTADO[st])}</span>` : '<span class="tag">Pendiente</span>'}</b>
                        ${insp ? `<span class="m-sub">${resumenInspeccion(insp)} · Clic para ${abierto ? 'ocultar' : 'inspeccionar análisis y regla'}</span>` : ''}
                      </div>
                      <div class="li-acc">
                        ${
                          insp
                            ? `<button type="button" class="btn ${abierto ? 'primario' : ''}" data-accion="toggle-revision" data-id="${esc(r.id)}" aria-expanded="${abierto}">${abierto ? 'Ocultar análisis' : '[ Ver análisis / Repasar ]'}</button>
                               <button type="button" class="btn sutil" data-accion="reintentar-reto" data-id="${esc(r.id)}">[ Reintentar reto ]</button>`
                            : `<button type="button" class="btn ${activo ? 'primario' : 'sutil'}" data-accion="elegir-reto" data-id="${esc(r.id)}">${activo ? 'En juego' : 'Jugar'}</button>`
                        }
                      </div>
                    </div>
                    ${abierto && insp ? renderPanelRevision(ctx, insp) : ''}
                  </li>`;
              })
              .join('')}
          </ul>
        </div>`;
    }).join('');

    return `
      <section class="view">
        ${cabecera('Retos Estratégicos', 'Ring de sparring: compromete tu jugada antes de ver la pista o la solución.')}

        <div class="fuentes seg" role="group" aria-label="Filtrar por bloque">
          ${bloquesFiltro.map((b) => `<button class="seg-btn" data-accion="filtrar-bloque" data-bloque="${esc(b.id)}" aria-pressed="${filtroBloque === b.id}">${esc(b.texto)}</button>`).join('')}
        </div>

        <h2 class="sec">Siguiente reto pendiente</h2>
        ${renderAcordeon(reto, est, estadoPrevio, pideConfianza(reto, intentos))}

        <h2 class="sec">Catálogo integrado (${CATALOGO_RETOS.length} retos · ${BLOQUES_RETOS.length} bloques)</h2>
        <p class="note">Tasa global sin ayuda: <b>${fmtPct(desglose.tasaSinAyuda)}</b> (${plural(desglose.total, 'intento registrado', 'intentos registrados')}: ${desglose.sinAyuda} sin ayuda, ${desglose.conPista} con pista, ${desglose.solucion} mirando solución). Haz clic en cualquier reto completado para desplegar su análisis, opciones y regla mental.</p>
        <div class="form-bloque">${catalogoHtml}</div>

        <h2 class="sec">Últimos intentos</h2>
        ${intentos.length ? `<ul class="lista">${intentos.slice(0, 20).map((i) => filaIntento(ctx, i)).join('')}</ul>` : vacio('Aún no has completado ningún reto.')}
      </section>`;
  },
  montar(ctx, raiz) {
    accion(raiz, 'click', 'filtrar-bloque', (b) => {
      filtroBloque = b.dataset.bloque ?? 'todos';
      const sig = siguienteRetoPendiente(ctx.datos.intentos, filtroBloque);
      estadoActual = estadoNuevo(sig.id);
      if (ctx.sub) ctx.ir('#estudio');
      else ctx.pintar();
    });

    accion(raiz, 'click', 'elegir-reto', (b) => {
      const id = b.dataset.id ?? '';
      const buscado = CATALOGO_RETOS.find((r) => r.id === id);
      if (!buscado) return;
      estadoActual = estadoNuevo(buscado.id);
      if (ctx.sub) ctx.ir('#estudio');
      else ctx.pintar();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    accion(raiz, 'click', 'toggle-revision', (el) => {
      const id = el.dataset.id ?? '';
      if (!id) return;
      if (revisionesAbiertas.has(id)) {
        revisionesAbiertas.delete(id);
      } else {
        revisionesAbiertas.add(id);
      }
      ctx.pintar();
      if (revisionesAbiertas.has(id)) {
        document.getElementById(`cat-reto-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    });

    accion(raiz, 'click', 'crear-tarjeta-reto', async (b) => {
      const id = b.dataset.id ?? '';
      const insp = inspeccionarRetoCompletado(id, ctx.datos.intentos);
      if (!insp) return;
      const ahora = new Date();
      const { reto, intento } = insp;
      const anverso = `[Reto ${reto.id} · ${reto.titulo}]\n${reto.escenario}`;
      const reverso = `${reto.modeloMental}\n\nClave: ${reto.solucion}`;
      const tarjeta = nuevaTarjeta(anverso, reverso, ahora, { coleccion: 'intentos', id: intento.id });
      await ctx.guardar(
        { coleccion: 'tarjetas', registro: tarjeta },
        { coleccion: 'intentos', registro: actualizar(intento, { tarjetaId: tarjeta.id }, ahora) },
      );
      ctx.avisar('Tarjeta FSRS creada con la regla mental de este reto.');
    });

    accion(raiz, 'click', 'reintentar-reto', (b) => {
      const id = b.dataset.id ?? '';
      const reto = CATALOGO_RETOS.find((r) => r.id === id);
      if (!reto) return;
      revisionesAbiertas.delete(id);
      estadoActual = estadoNuevo(reto.id);
      ctx.avisar(`Reto ${reto.id} listo en el ring superior. Tus intentos anteriores se conservan.`);
      if (ctx.sub) ctx.ir('#estudio');
      else ctx.pintar();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    accion(raiz, 'change', 'fijar-jugada', (form) => {
      if (!estadoActual || estadoActual.paso !== 2 || !estadoActual.pistaDesbloqueada) return;
      const v = campos(form as HTMLFormElement);
      if (v.opcion) estadoActual.opcionElegida = v.opcion;
    });

    accion(raiz, 'submit', 'ver-opciones', (form, e) => {
      e.preventDefault();
      const est = asegurarEstado(retoActivo(ctx));
      est.respuestaLibre = (campos(form as HTMLFormElement).respuesta ?? '').trim();
      est.opcionesReveladas = true;
      ctx.pintar();
    });

    accion(raiz, 'submit', 'fijar-jugada', (form, e) => {
      e.preventDefault();
      const reto = retoActivo(ctx);
      const est = asegurarEstado(reto);
      const v = campos(form as HTMLFormElement);
      if (!v.opcion) return ctx.avisar('Selecciona una opción antes de fijar tu jugada.', 'error');
      if (pideConfianza(reto, ctx.datos.intentos)) {
        const c = Number(v.confianza);
        if (!(NIVELES_CONFIANZA as readonly number[]).includes(c)) return ctx.avisar('Marca cuánto confías en tu jugada antes de fijarla.', 'error');
        est.confianza = c;
      } else {
        est.confianza = null;
      }
      est.opcionInicial = v.opcion;
      est.opcionElegida = v.opcion;
      est.paso = 2;
      ctx.pintar();
    });

    accion(raiz, 'click', 'desbloquear-pista', () => {
      const reto = retoActivo(ctx);
      const est = asegurarEstado(reto);
      est.pistaDesbloqueada = true;
      ctx.pintar();
    });

    accion(raiz, 'click', 'ver-resolucion', () => {
      const reto = retoActivo(ctx);
      const est = asegurarEstado(reto);
      const radio = raiz.querySelector<HTMLInputElement>('input[name="opcion"]:checked');
      if (radio?.value) est.opcionElegida = radio.value;
      est.paso = 3;
      ctx.pintar();
    });

    accion(raiz, 'click', 'guardar-reto', async () => {
      const reto = retoActivo(ctx);
      const est = asegurarEstado(reto);
      const estado = estadoAutomatico(reto, est.opcionInicial, est.opcionElegida, est.pistaDesbloqueada);
      const ahora = new Date();
      const segundos = Math.max(5, Math.round((Date.now() - est.inicioMs) / 1000));
      // Se guardan las letras internas (estables), no las visibles. El texto libre va al final porque se lee hasta el fin.
      const resumenJugada = [
        `Jugada: ${est.opcionElegida || '—'} (correcta: ${reto.opcionCorrecta ?? 'debate'})`,
        est.opcionInicial && est.opcionInicial !== est.opcionElegida ? `Inicial: ${est.opcionInicial}` : '',
        est.respuestaLibre ? `Antes de ver opciones: ${est.respuestaLibre}` : '',
      ]
        .filter(Boolean)
        .join(' · ');

      const intentoBase: Intento = nuevo(
        {
          fuenteId: ID_FUENTE_RETOS,
          capitulo: reto.bloque,
          ejercicio: reto.id,
          estado,
          segundos,
          notaError: resumenJugada,
          dia: ctx.hoy,
          ...(est.confianza === null ? {} : { confianza: est.confianza }),
        },
        ahora,
      );

      if (estado === 'solucion') {
        const anverso = `[Reto ${reto.id} · ${reto.titulo}]\n${reto.escenario}`;
        const reverso = `${reto.modeloMental}\n\nClave: ${reto.solucion}`;
        const tarjeta = nuevaTarjeta(anverso, reverso, ahora, { coleccion: 'intentos', id: intentoBase.id });
        const intentoConTarjeta: Intento = { ...intentoBase, tarjetaId: tarjeta.id };
        await ctx.guardar(
          { coleccion: 'intentos', registro: intentoConTarjeta },
          { coleccion: 'tarjetas', registro: tarjeta },
        );
      } else {
        await ctx.guardar({ coleccion: 'intentos', registro: intentoBase });
      }

      await ctx.registrar('estudio', segundos);

      const siguiente = siguienteRetoPendiente(ctx.datos.intentos, filtroBloque);
      estadoActual = estadoNuevo(siguiente.id);

      ctx.avisar(
        estado === 'solucion'
          ? 'Reto registrado y tarjeta FSRS creada con el modelo mental.'
          : `Reto guardado como «${ETIQUETA_ESTADO[estado]}». Puedes desplegar su análisis desde el catálogo.`,
      );
      if (ctx.sub) ctx.ir('#estudio');
      else ctx.pintar();
    });

    accion(raiz, 'click', 'borrar-intento', async (b) => {
      const i = ctx.datos.intentos.find((x) => x.id === b.dataset.id);
      if (!i || !confirm(`¿Borrar el intento del reto ${i.ejercicio}?`)) return;
      await ctx.guardar({ coleccion: 'intentos', registro: borrar(i, new Date()) });
    });
  },
};
