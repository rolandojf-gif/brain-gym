/* «La web se acuerda de ti»: un fragmento que el usuario escribió hace tiempo (lo que haría en un reto, una objeción
   a una lectura, la hipótesis de una curiosidad, una idea) junto a lo que resultó. Puro: sale de los datos que ya se
   guardan, sin colección nueva. No es una métrica ni un deber: sólo devuelve al usuario su propia voz. */
import type { Reto } from './catalogo-retos';
import type { Colecciones, EstadoIntento } from './tipos';

export interface Recuerdo {
  /** Estable, para elegir el del día sin que cambie al repintar. */
  id: string;
  /** Cuándo lo escribió (ISO). */
  fecha: string;
  /** «En el reto…», «Sobre…»: de dónde sale. */
  contexto: string;
  /** Sus palabras, tal cual. */
  tuyo: string;
  /** Lo que resultó, si lo hubo: etiqueta corta y texto. */
  desenlace?: { etiqueta: string; texto: string };
  /** Dónde volver a verlo. */
  enlace: string;
}

const MARCA_LIBRE = 'Antes de ver opciones: ';
/** Menos que esto no dice nada de cómo pensabas («B», «no sé»). */
const MIN_CARACTERES = 15;
/** Un recuerdo necesita distancia; si no hay ninguno tan antiguo, vale cualquiera anterior a hoy. */
export const DIAS_DE_DISTANCIA = 7;

const RESULTADO_RETO: Record<EstadoIntento, string> = {
  sin_ayuda: 'Acertaste a la primera',
  con_pista: 'Acertaste con la pista',
  solucion: 'Caíste en la trampa',
  no_resuelto: 'No lo resolviste',
};

type Datos = Pick<Colecciones, 'intentos' | 'escritos' | 'lecturas' | 'curiosidades' | 'aprendizajes'>;

/** Todo lo que el usuario escribió con sus palabras, del más antiguo al más reciente. */
export function recuerdos(datos: Datos, retos: readonly Reto[]): Recuerdo[] {
  const salida: Recuerdo[] = [];

  for (const i of datos.intentos) {
    if (i.borrado) continue;
    const pos = i.notaError.indexOf(MARCA_LIBRE);
    const reto = retos.find((r) => r.id === i.ejercicio);
    if (pos < 0 || !reto || reto.generado?.reportado) continue;
    salida.push({
      id: `intentos:${i.id}`,
      fecha: i.creado,
      contexto: `En el reto «${reto.titulo}» dijiste que harías esto`,
      tuyo: i.notaError.slice(pos + MARCA_LIBRE.length),
      desenlace: { etiqueta: reto.debate ? 'Era un debate, sin respuesta correcta' : RESULTADO_RETO[i.estado], texto: reto.modeloMental },
      enlace: '#estudio',
    });
  }

  for (const e of datos.escritos) {
    if (e.borrado) continue;
    const titulo = datos.lecturas.find((l) => l.id === e.lecturaId)?.titulo ?? 'una lectura';
    const fb = e.feedbackIa;
    salida.push({
      id: `escritos:${e.id}`,
      fecha: e.enviadoEl,
      contexto: `Tu objeción a «${titulo}»`,
      tuyo: e.objecion,
      ...(fb ? { desenlace: { etiqueta: 'El Abogado del Diablo respondió', texto: fb.contraataque } } : {}),
      enlace: `#lectura/ver/${e.id}`,
    });
  }

  for (const c of datos.curiosidades) {
    if (c.borrado || !c.hipotesis.trim()) continue;
    salida.push({
      id: `curiosidades:${c.id}`,
      fecha: c.creado,
      contexto: `Te preguntaste «${c.pregunta}» y creías esto`,
      tuyo: c.hipotesis,
      ...(c.conclusion.trim() ? { desenlace: { etiqueta: 'Lo que te llevaste', texto: c.conclusion } } : {}),
      enlace: `#curiosidades/${c.id}`,
    });
  }

  for (const a of datos.aprendizajes) {
    if (a.borrado) continue;
    salida.push({ id: `aprendizajes:${a.id}`, fecha: a.creado, contexto: 'Una idea que apuntaste', tuyo: a.texto, enlace: '#repaso/tarjetas' });
  }

  return salida
    .map((r) => ({ ...r, tuyo: r.tuyo.trim() }))
    .filter((r) => r.tuyo.length >= MIN_CARACTERES)
    .sort((a, b) => a.fecha.localeCompare(b.fecha) || a.id.localeCompare(b.id));
}

/**
 * El recuerdo de hoy: el mismo durante todo el día (lo fija `hoy`, AAAA-MM-DD) y distinto al siguiente. `salto`
 * avanza al siguiente cuando el usuario pide otro. Prefiere los de hace una semana o más y con desenlace.
 */
export function recuerdoDelDia(todos: readonly Recuerdo[], hoy: string, salto = 0): Recuerdo | null {
  const antes = todos.filter((r) => r.fecha.slice(0, 10) < hoy);
  const limite = restarDias(hoy, DIAS_DE_DISTANCIA);
  const lejanos = antes.filter((r) => r.fecha.slice(0, 10) <= limite);
  const base = lejanos.length ? lejanos : antes;
  const conDesenlace = base.filter((r) => r.desenlace);
  const candidatos = conDesenlace.length ? conDesenlace : base;
  if (candidatos.length === 0) return null;
  return candidatos[(semilla(hoy) + salto) % candidatos.length] ?? null;
}

/** Cuántos hay para elegir hoy, para saber si tiene sentido ofrecer «otro». */
export function hayOtroRecuerdo(todos: readonly Recuerdo[], hoy: string): boolean {
  const a = recuerdoDelDia(todos, hoy, 0), b = recuerdoDelDia(todos, hoy, 1);
  return Boolean(a && b && a.id !== b.id);
}

function restarDias(dia: string, n: number): string {
  const d = new Date(`${dia}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

/* Un número estable por día, bien repartido para que días seguidos no den recuerdos seguidos. */
function semilla(dia: string): number {
  let h = 2166136261;
  for (let i = 0; i < dia.length; i++) h = Math.imul(h ^ dia.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** «hace 3 semanas», «hace 2 meses»: la distancia dicha como la diría una persona. */
export function haceCuanto(fecha: string, hoy: string): string {
  const dias = Math.round((Date.parse(`${hoy}T12:00:00Z`) - Date.parse(`${fecha.slice(0, 10)}T12:00:00Z`)) / 86_400_000);
  if (dias <= 1) return 'ayer';
  if (dias < 7) return `hace ${dias} días`;
  if (dias < 14) return 'hace una semana';
  if (dias < 60) return `hace ${Math.floor(dias / 7)} semanas`;
  if (dias < 365) return `hace ${Math.floor(dias / 30)} meses`;
  const anos = Math.floor(dias / 365);
  return anos === 1 ? 'hace un año' : `hace ${anos} años`;
}
