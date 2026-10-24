/* 01 · Hoy: protocolo «Sprint Diario (10 min)» en 3 bloques de ejecución inmediata:
   1º Calentamiento FSRS (2-3 min) · 2º Plato principal: Reto del Día o Lectura 3x1 (5-7 min) · 3º Cierre rápido (1 min). */
import { accion, campos, type Ctx, type Vista } from '../app';
import { BLOQUES_RETOS, siguienteRetoPendiente } from '../dominio/catalogo-retos';
import { nuevaTarjeta, previsualizar, repasar } from '../dominio/fsrs';
import { actualizar, nuevo } from '../dominio/registro';
import { sesionDeHoy } from '../dominio/sesion';
import type { Aprendizaje, Nota } from '../dominio/tipos';
import { fmtDuracion, fmtFechaLarga, plural } from '../lib/fmt';
import { esc, urlSegura } from '../lib/html';
import { cabecera } from './comun';

let reveladaHoy: string | null = null;

const NOTAS: { nota: Nota; texto: string }[] = [
  { nota: 1, texto: 'Otra vez' },
  { nota: 2, texto: 'Difícil' },
  { nota: 3, texto: 'Bien' },
  { nota: 4, texto: 'Fácil' },
];

function intervaloCorto(iso: string, ahora: Date): string {
  const min = Math.round((Date.parse(iso) - ahora.getTime()) / 60_000);
  if (min < 60) return `${Math.max(1, min)}m`;
  if (min < 1440) return `${Math.round(min / 60)}h`;
  return `${Math.round(min / 1440)}d`;
}

function renderCalentamiento(ctx: Ctx, s: ReturnType<typeof sesionDeHoy>): string {
  const vencidas = s.pendiente.tarjetasVencidas;
  const hecha = s.actividades.some((a) => a.actividad === 'repaso' && a.hecha) || vencidas.length === 0;
  const primera = vencidas[0];

  const cuerpo = primera
    ? (() => {
        const mostrar = reveladaHoy === primera.id;
        const prev = previsualizar(primera, ctx.ahora);
        return `
          <p class="m-sub">${plural(vencidas.length, 'tarjeta vencida hoy', 'tarjetas vencidas hoy')}. Repásalas aquí mismo o abre la cola completa.</p>
          <div class="flash-inline">
            <div class="lbl">Anverso</div>
            <p class="flash-q">${esc(primera.anverso).replace(/\n/g, '<br>')}</p>
            ${
              mostrar
                ? `<div class="lbl">Reverso</div>
                   <p class="flash-a">${esc(primera.reverso).replace(/\n/g, '<br>')}</p>
                   <div class="notas">
                     ${NOTAS.map((n) => `<button type="button" class="btn nota n${n.nota}" data-accion="repasar-inline" data-nota="${n.nota}"><b>${n.texto}</b><small>${intervaloCorto(prev[n.nota], ctx.ahora)}</small></button>`).join('')}
                   </div>`
                : `<div class="acciones"><button type="button" class="btn primario" data-accion="revelar-inline">[ Mostrar respuesta ]</button><a class="btn sutil" href="#repaso">Abrir #repaso</a></div>`
            }
          </div>`;
      })()
    : `<p>Mazo al día: 0 tarjetas vencidas ahora mismo.</p>
       <div class="acciones"><a class="btn sutil" href="#repaso">Ir a #repaso</a></div>`;

  return `
    <article class="act${hecha ? ' hecha' : ''}">
      <header>
        <i>1º</i>
        <h2>Calentamiento · FSRS (2–3 min)</h2>
        <span class="estado">${vencidas.length === 0 ? 'Al día' : `${vencidas.length} pendientes`}</span>
      </header>
      ${cuerpo}
    </article>`;
}

function renderPlatoPrincipal(ctx: Ctx, s: ReturnType<typeof sesionDeHoy>): string {
  const plan = s.actividades.map((a) => a.actividad);
  const tocaLectura = plan.includes('lectura') && !plan.includes('estudio');

  if (tocaLectura) {
    const hecha = s.actividades.some((a) => a.actividad === 'lectura' && a.hecha);
    const porEscribir = ctx.datos.lecturas.find((l) => !l.borrado && l.estado === 'leida');
    const siguiente = ctx.datos.lecturas.find((l) => !l.borrado && l.estado === 'pendiente');

    let cuerpo: string;
    if (porEscribir) {
      cuerpo = `
        <p>Lectura lista para comprimir: <b>«${esc(porEscribir.titulo)}»</b>.</p>
        <p class="m-sub">Extrae de memoria la tesis central, el mecanismo y el punto ciego (formato 3x1).</p>
        <div class="acciones">
          <a class="btn primario" href="#lectura/escribir/${esc(porEscribir.id)}">[ Completar síntesis 3x1 ]</a>
          <a class="btn sutil" href="#estudio">¿Prefieres jugar un reto?</a>
        </div>`;
    } else if (siguiente) {
      const url = urlSegura(siguiente.url);
      cuerpo = `
        <p>Siguiente en cola: <b>«${esc(siguiente.titulo)}»</b>${siguiente.medio ? ` (${esc(siguiente.medio)})` : ''}.</p>
        <div class="acciones">
          ${url ? `<a class="btn" href="${esc(url)}" target="_blank" rel="noopener noreferrer">Abrir lectura ↗</a>` : ''}
          <button type="button" class="btn primario" data-accion="lectura-leida" data-id="${esc(siguiente.id)}">[ Leída · Extraer 3x1 ]</button>
          <a class="btn sutil" href="#lectura">Ver cola</a>
        </div>`;
    } else {
      cuerpo = `
        <p>Hoy toca extracción de lectura 3x1, pero la cola está vacía.</p>
        <div class="acciones">
          <a class="btn primario" href="#lectura">[ Añadir lectura y extraer 3x1 ]</a>
          <a class="btn sutil" href="#estudio">Jugar un reto estratégico</a>
        </div>`;
    }

    return `
      <article class="act${hecha ? ' hecha' : ''}">
        <header>
          <i>2º</i>
          <h2>Plato principal · Lectura 3x1 (5–7 min)</h2>
          <span class="estado">${hecha ? 'Completado hoy' : 'En turno'}</span>
        </header>
        ${cuerpo}
      </article>`;
  }

  // Por defecto o cuando toca `estudio`: Reto del Día
  const hecha = s.actividades.some((a) => a.actividad === 'estudio' && a.hecha);
  const sesionEstudio = ctx.datos.sesiones.find((x) => !x.borrado && x.dia === ctx.hoy && x.actividad === 'estudio');
  const tiempo = sesionEstudio && sesionEstudio.segundos > 0 ? ` · ${fmtDuracion(sesionEstudio.segundos)}` : '';
  const reto = siguienteRetoPendiente(ctx.datos.intentos);
  const bloque = BLOQUES_RETOS.find((b) => b.id === reto.bloque);

  return `
    <article class="act${hecha ? ' hecha' : ''}">
      <header>
        <i>2º</i>
        <h2>Plato principal · Reto del Día (5–7 min)</h2>
        <span class="estado">${hecha ? `Hecho${tiempo}` : '1 reto basta'}</span>
      </header>
      <p class="m-sub">Bloque ${esc(reto.bloque)}: ${esc(bloque?.titulo ?? '')}</p>
      <p><b>${esc(reto.id)} · ${esc(reto.titulo)}</b></p>
      <p>${esc(reto.escenario.slice(0, 180))}…</p>
      <div class="acciones">
        <a class="btn primario" href="#estudio/reto/${esc(reto.id)}">${hecha ? '[ + Hacer otro reto ]' : '[ Jugar Reto del Día ]'}</a>
        <a class="btn sutil" href="#lectura">Ir a Lectura 3x1</a>
      </div>
    </article>`;
}

function renderCierreRapido(ctx: Ctx): string {
  const aprendizaje = ctx.datos.aprendizajes.find((x) => !x.borrado && x.dia === ctx.hoy);
  const hecha = Boolean(aprendizaje);

  const cuerpo = aprendizaje
    ? `<p><b>«${esc(aprendizaje.texto)}»</b>${aprendizaje.tarjetaId ? ' <span class="tag e-sin_ayuda">+ Tarjeta FSRS</span>' : ''}</p>
       <p class="m-sub">Registrado en el cierre de hoy.</p>`
    : `<form class="form-bloque" data-accion="aprendizaje">
         <label class="campo">
           Qué modelo mental o idea aprendí hoy (1 línea)
           <input id="ap-texto" name="texto" required placeholder="Ej.: Ley de Goodhart: toda métrica usada como meta rígida será manipulada.">
         </label>
         <label class="check-linea">
           <input type="checkbox" name="crearTarjeta" value="si" checked>
           <span>[ Convertir también en tarjeta FSRS ]</span>
         </label>
         <div class="acciones"><button class="btn primario">Guardar cierre</button></div>
       </form>`;

  return `
    <article class="act${hecha ? ' hecha' : ''}">
      <header>
        <i>3º</i>
        <h2>Cierre rápido · Modelo mental (1 min)</h2>
        <span class="estado">${hecha ? 'Guardado' : 'Por hacer'}</span>
      </header>
      ${cuerpo}
    </article>`;
}

export const hoy: Vista = {
  titulo: 'Hoy',
  render(ctx) {
    const s = sesionDeHoy(ctx.ahora, ctx.ajustes, ctx.datos);
    return `
      <section class="view">
        ${cabecera('Sprint Diario (10 min)', `${fmtFechaLarga(s.dia)} · Sin fricción: calienta, resuelve 1 reto o síntesis 3x1 y cierra con 1 idea.`)}
        <div class="acts sprint-grid">
          ${renderCalentamiento(ctx, s)}
          ${renderPlatoPrincipal(ctx, s)}
          ${renderCierreRapido(ctx)}
        </div>
      </section>`;
  },
  montar(ctx, raiz) {
    accion(raiz, 'click', 'revelar-inline', () => {
      const s = sesionDeHoy(ctx.ahora, ctx.ajustes, ctx.datos);
      reveladaHoy = s.pendiente.tarjetasVencidas[0]?.id ?? null;
      ctx.pintar();
    });

    accion(raiz, 'click', 'repasar-inline', async (b) => {
      const ahora = new Date();
      const s = sesionDeHoy(ahora, ctx.ajustes, ctx.datos);
      const t = s.pendiente.tarjetasVencidas[0];
      if (!t) return;
      const r = repasar(t, Number(b.dataset.nota) as Nota, ahora);
      reveladaHoy = null;
      await ctx.guardar({ coleccion: 'tarjetas', registro: r.tarjeta }, { coleccion: 'repasos', registro: r.repaso });
      await ctx.registrar('repaso', 15);
    });

    accion(raiz, 'click', 'lectura-leida', async (b) => {
      const l = ctx.datos.lecturas.find((x) => x.id === b.dataset.id);
      if (!l) return;
      const ahora = new Date();
      await ctx.guardar({ coleccion: 'lecturas', registro: actualizar(l, { estado: 'leida', leidaEl: ahora.toISOString() }, ahora) });
      ctx.ir(`#lectura/escribir/${l.id}`);
    });

    accion(raiz, 'submit', 'aprendizaje', async (form, e) => {
      e.preventDefault();
      const v = campos(form as HTMLFormElement);
      const texto = v.texto ?? '';
      if (!texto) return;
      const ahora = new Date();
      const baseAp: Aprendizaje = nuevo({ dia: ctx.hoy, texto }, ahora);

      if (v.crearTarjeta === 'si') {
        const tarjeta = nuevaTarjeta(
          `¿Cuál es la regla o modelo mental clave sobre: «${texto.slice(0, 70)}${texto.length > 70 ? '…' : ''}»?`,
          texto,
          ahora,
          { coleccion: 'aprendizajes', id: baseAp.id },
        );
        const apConTarjeta: Aprendizaje = { ...baseAp, tarjetaId: tarjeta.id };
        await ctx.guardar(
          { coleccion: 'aprendizajes', registro: apConTarjeta },
          { coleccion: 'tarjetas', registro: tarjeta },
        );
      } else {
        await ctx.guardar({ coleccion: 'aprendizajes', registro: baseAp });
      }
      await ctx.registrar('concepto');
      ctx.avisar(v.crearTarjeta === 'si' ? 'Modelo mental guardado y convertido en tarjeta FSRS.' : 'Modelo mental guardado.');
    });
  },
};
