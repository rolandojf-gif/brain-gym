/* 02 · Retos: «Ring de Sparring» interactivo autocontenido con el acordeón de 3 pasos
   (1. Compromiso/Jugada inicial → 2. Andamiaje opcional/Pista → 3. Choque con la realidad y cierre en 1 clic). */
import { accion, campos, type Ctx, type Vista } from '../app';
import {
  BLOQUES_RETOS,
  CATALOGO_RETOS,
  ID_FUENTE_RETOS,
  estadoDeReto,
  fuenteRetos,
  siguienteRetoPendiente,
  type Reto,
} from '../dominio/catalogo-retos';
import { ETIQUETA_ESTADO, desgloseResolucion, progresoPorCapitulo } from '../dominio/estudio';
import { nuevaTarjeta } from '../dominio/fsrs';
import { borrar, nuevo } from '../dominio/registro';
import type { EstadoIntento, Intento } from '../dominio/tipos';
import { fmtDuracion, fmtPct, fmtRelativo, plural } from '../lib/fmt';
import { esc } from '../lib/html';
import { cabecera, vacio } from './comun';

interface EstadoAcordeon {
  retoId: string;
  paso: 1 | 2 | 3;
  opcionElegida: string;
  logica: string;
  pistaDesbloqueada: boolean;
  inicioMs: number;
}

let filtroBloque = 'todos';
let estadoActual: EstadoAcordeon | null = null;

function asegurarEstado(reto: Reto): EstadoAcordeon {
  if (!estadoActual || estadoActual.retoId !== reto.id) {
    estadoActual = {
      retoId: reto.id,
      paso: 1,
      opcionElegida: '',
      logica: '',
      pistaDesbloqueada: false,
      inicioMs: Date.now(),
    };
  }
  return estadoActual;
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

function renderAcordeon(reto: Reto, est: EstadoAcordeon, estadoPrevio: EstadoIntento | null): string {
  const bloque = BLOQUES_RETOS.find((b) => b.id === reto.bloque);
  const tagPrevio = estadoPrevio
    ? `<span class="tag e-${estadoPrevio}">${esc(ETIQUETA_ESTADO[estadoPrevio])}</span>`
    : '<span class="tag">Pendiente</span>';

  const bloqueOpciones = reto.opciones
    .map((op) => {
      const checked = est.opcionElegida === op.id ? ' checked' : '';
      const disabled = est.paso === 3 || (est.paso === 2 && !est.pistaDesbloqueada) ? ' disabled' : '';
      let claseExtra = '';
      if (est.paso === 3) {
        if (op.id === reto.opcionCorrecta) claseExtra = ' op-correcta';
        else if (op.id === est.opcionElegida) claseExtra = ' op-trampa';
      }
      return `
        <label class="reto-opcion${claseExtra}">
          <input type="radio" name="opcion" value="${esc(op.id)}"${checked}${disabled} required>
          <span class="op-letra">${esc(op.id)}</span>
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
           <p class="m-sub">Jugada fijada: <b>Opción ${esc(est.opcionElegida)}</b>${est.logica ? ` · «${esc(est.logica)}»` : ''}</p>
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

  const acertada = est.opcionElegida === reto.opcionCorrecta;
  const paso3 =
    est.paso === 3
      ? `<div class="reto-paso reto-resolucion">
           <div class="lbl">Paso 3 · Choque con la realidad</div>
           <div class="reto-veredicto ${acertada ? 'ok' : 'trampa'}">
             <b>${acertada ? '¡Diste en el clavo!' : `Caíste en la trampa intuitiva (elegiste ${esc(est.opcionElegida)}, la mejor jugada es ${esc(reto.opcionCorrecta)})`}</b>
           </div>
           <div class="reto-explicacion">
             <p>${esc(reto.solucion)}</p>
           </div>
           <div class="reto-modelo">
             <span class="lbl">Modelo mental accionable (reverso FSRS)</span>
             <p><b>${esc(reto.modeloMental)}</b></p>
           </div>
           <div class="acciones reto-cierre">
             <button type="button" class="btn ${acertada && !est.pistaDesbloqueada ? 'primario' : ''}" data-accion="guardar-reto" data-estado="sin_ayuda">[ Lo clavé sin ayuda ]</button>
             <button type="button" class="btn ${est.pistaDesbloqueada && acertada ? 'primario' : ''}" data-accion="guardar-reto" data-estado="con_pista">[ Necesité la pista ]</button>
             <button type="button" class="btn ${!acertada ? 'primario' : ''}" data-accion="guardar-reto" data-estado="solucion">[ Caí en la trampa · Crear tarjeta de repaso ]</button>
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
      <form class="form-bloque" data-accion="fijar-jugada">
        <div class="lbl">Paso 1 · Compromiso y jugada inicial</div>
        <div class="reto-opciones">${bloqueOpciones}</div>
        <label class="campo">
          ¿Cuál es tu lógica? (1 línea, opcional)
          <input name="logica" value="${esc(est.logica)}" placeholder="Por qué eliges esta jugada y qué trampa descartas…" autocomplete="off"${est.paso > 1 ? ' readonly' : ''}>
        </label>
        ${paso1Acciones}
      </form>
      ${paso2}
      ${paso3}
    </article>`;
}

function filaIntento(ctx: Ctx, i: Intento): string {
  const reto = CATALOGO_RETOS.find((r) => r.id === i.ejercicio);
  const titulo = reto ? `${reto.id} · ${reto.titulo}` : `Bloque ${i.capitulo} · Reto ${i.ejercicio}`;
  const tarjeta = ctx.datos.tarjetas.find((t) => !t.borrado && (t.id === i.tarjetaId || (t.origen?.coleccion === 'intentos' && t.origen.id === i.id)));
  const crear = i.estado !== 'sin_ayuda' && !tarjeta ? `<a class="btn sutil" href="#repaso/nueva/intentos/${esc(i.id)}">Crear tarjeta</a>` : '';
  return `
    <li>
      <div class="li-main">
        <b>${esc(titulo)} <span class="tag e-${i.estado}">${esc(ETIQUETA_ESTADO[i.estado])}</span></b>
        ${i.notaError ? `<span>${esc(i.notaError)}</span>` : ''}
        <span class="m-sub">${esc(fmtRelativo(i.dia, ctx.hoy))}${i.segundos ? ` · ${esc(fmtDuracion(i.segundos))}` : ''}${tarjeta ? ' · con tarjeta FSRS' : ''}</span>
      </div>
      <div class="li-acc">${crear}<button class="btn sutil" data-accion="borrar-intento" data-id="${esc(i.id)}">Borrar</button></div>
    </li>`;
}

export const estudio: Vista = {
  titulo: 'Retos',
  render(ctx) {
    const fuente = fuenteRetos(ctx.ahora);
    const intentos = ctx.datos.intentos.filter((i) => !i.borrado).sort((a, b) => b.creado.localeCompare(a.creado));
    const desglose = desgloseResolucion(intentos);
    const progreso = progresoPorCapitulo(fuente, intentos);
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
                const st = estadoDeReto(r.id, intentos);
                const activo = r.id === reto.id;
                return `
                  <li>
                    <div class="li-main">
                      <b>${esc(r.id)} · ${esc(r.titulo)} ${st ? `<span class="tag e-${st}">${esc(ETIQUETA_ESTADO[st])}</span>` : '<span class="tag">Pendiente</span>'}</b>
                    </div>
                    <div class="li-acc">
                      <button class="btn ${activo ? 'primario' : 'sutil'}" data-accion="elegir-reto" data-id="${esc(r.id)}">${activo ? 'En juego' : st ? 'Rejugar' : 'Jugar'}</button>
                    </div>
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
        ${renderAcordeon(reto, est, estadoPrevio)}

        <h2 class="sec">Catálogo integrado (${CATALOGO_RETOS.length} retos · ${BLOQUES_RETOS.length} bloques)</h2>
        <p class="note">Tasa global sin ayuda: <b>${fmtPct(desglose.tasaSinAyuda)}</b> (${plural(desglose.total, 'intento registrado', 'intentos registrados')}: ${desglose.sinAyuda} sin ayuda, ${desglose.conPista} con pista, ${desglose.solucion} mirando solución).</p>
        <div class="form-bloque">${catalogoHtml}</div>

        <h2 class="sec">Últimos intentos</h2>
        ${intentos.length ? `<ul class="lista">${intentos.slice(0, 20).map((i) => filaIntento(ctx, i)).join('')}</ul>` : vacio('Aún no has completado ningún reto.')}
      </section>`;
  },
  montar(ctx, raiz) {
    accion(raiz, 'click', 'filtrar-bloque', (b) => {
      filtroBloque = b.dataset.bloque ?? 'todos';
      const sig = siguienteRetoPendiente(ctx.datos.intentos, filtroBloque);
      estadoActual = {
        retoId: sig.id,
        paso: 1,
        opcionElegida: '',
        logica: '',
        pistaDesbloqueada: false,
        inicioMs: Date.now(),
      };
      if (ctx.sub) ctx.ir('#estudio');
      else ctx.pintar();
    });

    accion(raiz, 'click', 'elegir-reto', (b) => {
      const id = b.dataset.id ?? '';
      const buscado = CATALOGO_RETOS.find((r) => r.id === id);
      if (!buscado) return;
      estadoActual = {
        retoId: buscado.id,
        paso: 1,
        opcionElegida: '',
        logica: '',
        pistaDesbloqueada: false,
        inicioMs: Date.now(),
      };
      if (ctx.sub) ctx.ir('#estudio');
      else ctx.pintar();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    accion(raiz, 'change', 'fijar-jugada', (form) => {
      if (!estadoActual || estadoActual.paso !== 2 || !estadoActual.pistaDesbloqueada) return;
      const v = campos(form as HTMLFormElement);
      if (v.opcion) estadoActual.opcionElegida = v.opcion;
    });

    accion(raiz, 'submit', 'fijar-jugada', (form, e) => {
      e.preventDefault();
      const reto = retoActivo(ctx);
      const est = asegurarEstado(reto);
      const v = campos(form as HTMLFormElement);
      if (!v.opcion) return ctx.avisar('Selecciona una opción antes de fijar tu jugada.', 'error');
      est.opcionElegida = v.opcion;
      est.logica = v.logica ?? '';
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

    accion(raiz, 'click', 'guardar-reto', async (b) => {
      const reto = retoActivo(ctx);
      const est = asegurarEstado(reto);
      const estado = (b.dataset.estado ?? 'sin_ayuda') as EstadoIntento;
      const ahora = new Date();
      const segundos = Math.max(5, Math.round((Date.now() - est.inicioMs) / 1000));
      const resumenJugada = [
        `Jugada: ${est.opcionElegida || '—'} (correcta: ${reto.opcionCorrecta})`,
        est.logica ? `Lógica: ${est.logica}` : '',
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
      estadoActual = {
        retoId: siguiente.id,
        paso: 1,
        opcionElegida: '',
        logica: '',
        pistaDesbloqueada: false,
        inicioMs: Date.now(),
      };

      ctx.avisar(
        estado === 'solucion'
          ? 'Reto registrado y tarjeta FSRS creada con el modelo mental.'
          : 'Reto completado y sesión del día registrada.',
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
