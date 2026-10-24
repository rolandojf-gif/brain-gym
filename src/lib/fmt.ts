/* Formatos en español. Los días de la rutina son AAAA-MM-DD; se formatean como fecha local a mediodía para no
   depender de la zona horaria. */

const fechaCorta = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short' });
const fechaLarga = new Intl.DateTimeFormat('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
const hora = new Intl.DateTimeFormat('es-ES', { hour: '2-digit', minute: '2-digit' });

function aFecha(diaOIso: string): Date {
  return diaOIso.length === 10 ? new Date(`${diaOIso}T12:00:00`) : new Date(diaOIso);
}

export const fmtFecha = (d: string) => fechaCorta.format(aFecha(d));
export const fmtFechaLarga = (d: string) => fechaLarga.format(aFecha(d));
export const fmtHora = (iso: string) => hora.format(new Date(iso));

/** «hoy», «mañana», «en 3 d», «hace 2 d», comparando días AAAA-MM-DD. */
export function fmtRelativo(dia: string, hoy: string): string {
  const n = Math.round((Date.parse(`${dia.slice(0, 10)}T12:00:00Z`) - Date.parse(`${hoy}T12:00:00Z`)) / 86_400_000);
  if (n === 0) return 'hoy';
  if (n === 1) return 'mañana';
  if (n === -1) return 'ayer';
  return n > 0 ? `en ${n} d` : `hace ${-n} d`;
}

export function fmtDuracion(segundos: number): string {
  if (segundos < 60) return 'menos de 1 min';
  const min = Math.round(segundos / 60);
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60), m = min % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

export function fmtReloj(segundos: number): string {
  const h = Math.floor(segundos / 3600), m = Math.floor((segundos % 3600) / 60), s = Math.floor(segundos % 60);
  const p = (n: number) => String(n).padStart(2, '0');
  return h ? `${h}:${p(m)}:${p(s)}` : `${p(m)}:${p(s)}`;
}

export const fmtPct = (x: number | null, decimales = 0) => (x === null ? '—' : `${(x * 100).toFixed(decimales).replace('.', ',')} %`);
export const fmtNum = (x: number | null, decimales = 3) => (x === null ? '—' : x.toFixed(decimales).replace('.', ','));

/** «1 tarjeta», «3 tarjetas». */
export const plural = (n: number, uno: string, varios = `${uno}s`) => `${n} ${n === 1 ? uno : varios}`;
