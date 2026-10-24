/* 01 · Hoy: lo que toca según el plan, lo pendiente y el registro de «algo nuevo». */
import { accion, campos, type Ctx, type Vista } from '../app';
import { ETIQUETA_ESTADO } from '../dominio/estudio';
import { nuevo } from '../dominio/registro';
import { sesionDeHoy } from '../dominio/sesion';
import type { Actividad, Aprendizaje } from '../dominio/tipos';
import { fmtDuracion, fmtFechaLarga, fmtRelativo } from '../lib/fmt';
import { esc, urlSegura } from '../lib/html';
import * as temporizador from '../lib/temporizador';
import { NOMBRE_ACTIVIDAD, VISTA_ACTIVIDAD, cabecera } from './comun';

function detalle(ctx: Ctx, a: Actividad, pend: ReturnType<typeof sesionDeHoy>['pendiente']): string {
  const d = ctx.datos;
  switch (a) {
    case 'estudio': {
      const ultimo = [...d.intentos].filter((i) => !i.borrado).sort((x, y) => y.creado.localeCompare(x.creado))[0];
      return ultimo
        ? `45–60 min. Último: cap. ${esc(ultimo.capitulo)}, ej. ${esc(ultimo.ejercicio)} (${esc(ETIQUETA_ESTADO[ultimo.estado].toLowerCase())}, ${esc(fmtRelativo(ultimo.dia, ctx.hoy))}).`
        : '45–60 min. Resuelve cada ejercicio antes de mirar la solución, sin IA.';
    }
    case 'lectura': {
      const siguiente = d.lecturas.find((l) => !l.borrado && l.estado === 'pendiente');
      const porEscribir = d.lecturas.find((l) => !l.borrado && l.estado === 'leida');
      if (porEscribir) return `Pendiente de escribir: «${esc(porEscribir.titulo)}».`;
      return siguiente ? `45 min. Siguiente: «${esc(siguiente.titulo)}».` : '45 min. La cola está vacía: añade una lectura.';
    }
    case 'repaso':
      return pend.tarjetasVencidas.length ? `${pend.tarjetasVencidas.length} tarjetas vencidas.` : 'Nada vencido ahora mismo.';
    case 'calibracion':
      return `20 min. Registra 3–5 predicciones${pend.prediccionesPorResolver.length ? ` y resuelve ${pend.prediccionesPorResolver.length} vencidas` : ''}.`;
    case 'concepto':
      return '';
  }
}

function tarjetaActividad(ctx: Ctx, a: Actividad, hecha: boolean, i: number, pend: ReturnType<typeof sesionDeHoy>['pendiente']): string {
  const t = temporizador.actual();
  const midiendo = t?.actividad === a;
  const sesion = ctx.datos.sesiones.find((s) => !s.borrado && s.dia === ctx.hoy && s.actividad === a);
  const tiempo = sesion && sesion.segundos > 0 ? ` · ${fmtDuracion(sesion.segundos)}` : '';
  const aprendizaje = ctx.datos.aprendizajes.find((x) => !x.borrado && x.dia === ctx.hoy);
  const cuerpo = a === 'concepto'
    ? aprendizaje
      ? `<p>${esc(aprendizaje.texto)}${urlSegura(aprendizaje.fuenteUrl) ? ` <a href="${esc(urlSegura(aprendizaje.fuenteUrl))}" target="_blank" rel="noopener noreferrer">fuente ↗</a>` : ''}</p>`
      : `<form class="form-linea" data-accion="aprendizaje">
           <label class="sr-only" for="ap-texto">Qué he aprendido hoy</label>
           <input id="ap-texto" name="texto" required placeholder="Qué he aprendido hoy, en una frase">
           <label class="sr-only" for="ap-url">Fuente</label>
           <input id="ap-url" name="url" type="url" placeholder="Fuente (URL, opcional)">
           <button class="btn">Guardar</button>
         </form>`
    : `<p>${detalle(ctx, a, pend)}</p>`;
  const ir = a !== 'concepto' ? `<a class="btn primario" href="#${VISTA_ACTIVIDAD[a]}">Ir</a>` : '';
  const crono = a !== 'concepto'
    ? `<button class="btn" data-accion="crono" data-actividad="${a}" aria-pressed="${midiendo}">${midiendo ? 'Terminar' : 'Temporizador'}</button>`
    : '';
  const marcar = !hecha && a !== 'concepto' ? `<button class="btn sutil" data-accion="hecha" data-actividad="${a}">Marcar hecha</button>` : '';
  return `
    <article class="act${hecha ? ' hecha' : ''}">
      <header><i>${String(i + 1).padStart(2, '0')}</i><h2>${esc(NOMBRE_ACTIVIDAD[a])}</h2><span class="estado">${hecha ? `Hecha${tiempo}` : 'Por hacer'}</span></header>
      ${cuerpo}
      <div class="acciones">${ir}${crono}${marcar}</div>
    </article>`;
}

export const hoy: Vista = {
  titulo: 'Hoy',
  render(ctx) {
    const s = sesionDeHoy(ctx.ahora, ctx.ajustes, ctx.datos);
    const p = s.pendiente;
    const extra: string[] = [];
    const enPlan = new Set(s.actividades.map((x) => x.actividad));
    if (!enPlan.has('repaso') && p.tarjetasVencidas.length) extra.push(`<li><a href="#repaso">${p.tarjetasVencidas.length} tarjetas vencidas</a></li>`);
    if (p.prediccionesPorResolver.length) extra.push(`<li><a href="#calibracion">${p.prediccionesPorResolver.length} predicciones por resolver</a></li>`);
    if (p.calibracionAtrasada) extra.push('<li><a href="#calibracion">Calibración semanal sin hacer en los últimos 7 días</a></li>');
    const actividades = s.actividades.length
      ? s.actividades.map((x, i) => tarjetaActividad(ctx, x.actividad, x.hecha, i, p)).join('')
      : '<div class="empty">Hoy no hay nada en el plan. El plan semanal se cambia en Datos.</div>';
    return `
      <section class="view">
        ${cabecera('Hoy', fmtFechaLarga(s.dia))}
        <div class="acts">${actividades}</div>
        ${extra.length ? `<h2 class="sec">Pendiente</h2><ul class="pendiente">${extra.join('')}</ul>` : ''}
      </section>`;
  },
  montar(ctx, raiz) {
    accion(raiz, 'submit', 'aprendizaje', async (form, e) => {
      e.preventDefault();
      const { texto = '', url = '' } = campos(form as HTMLFormElement);
      if (!texto) return;
      const registro: Aprendizaje = nuevo({ dia: ctx.hoy, texto, ...(url ? { fuenteUrl: url } : {}) }, new Date());
      await ctx.guardar({ coleccion: 'aprendizajes', registro });
      await ctx.registrar('concepto');
    });
    accion(raiz, 'click', 'hecha', async (b) => {
      await ctx.registrar(b.dataset.actividad as Actividad);
    });
    accion(raiz, 'click', 'crono', async (b) => {
      const a = b.dataset.actividad as Actividad;
      const t = temporizador.actual();
      if (t) {
        const r = temporizador.detener();
        if (r) {
          await ctx.registrar(r.actividad, r.segundos);
          ctx.avisar(`${NOMBRE_ACTIVIDAD[r.actividad]}: ${fmtDuracion(r.segundos)} registrados.`);
        }
        if (t.actividad === a) return;
      }
      temporizador.iniciar(a);
      ctx.pintar();
    });
  },
};
