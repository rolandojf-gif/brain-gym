/* Piezas de interfaz compartidas por las vistas. */
import type { Actividad } from '../dominio/tipos';
import { esc } from '../lib/html';

export const NOMBRE_ACTIVIDAD: Record<Actividad, string> = {
  estudio: 'Retos',
  lectura: 'Lectura 3x1',
  repaso: 'Repaso',
  calibracion: 'Calibración',
  concepto: 'Modelo mental',
};

export const VISTA_ACTIVIDAD: Record<Actividad, string> = {
  estudio: 'estudio',
  lectura: 'lectura',
  repaso: 'repaso',
  calibracion: 'progreso',
  concepto: 'hoy',
};

export function cabecera(titulo: string, lede = ''): string {
  return `<div class="view-head"><h1>${esc(titulo)}</h1>${lede ? `<p class="lede">${esc(lede)}</p>` : ''}</div>`;
}

export function vacio(texto: string): string {
  return `<div class="empty">${esc(texto)}</div>`;
}

export function opciones<T extends string>(valores: readonly T[], etiquetas: Record<T, string>, actual?: string): string {
  return valores.map((v) => `<option value="${esc(v)}"${v === actual ? ' selected' : ''}>${esc(etiquetas[v])}</option>`).join('');
}

/** Descarga un texto como archivo. */
export function descargar(nombre: string, contenido: string, tipo = 'application/json'): void {
  const url = URL.createObjectURL(new Blob([contenido], { type: tipo }));
  const a = Object.assign(document.createElement('a'), { href: url, download: nombre });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
