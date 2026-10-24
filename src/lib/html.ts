/* Escapa texto para interpolarlo en plantillas HTML. Todo dato del usuario pasa por aquí antes de pintarse. */
const MAP: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

export function esc(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, (c) => MAP[c] ?? c);
}

/** Sólo deja pasar enlaces http(s); cualquier otro esquema (javascript:, data:…) se descarta. */
export function urlSegura(u: string | undefined): string {
  if (!u) return '';
  try {
    const url = new URL(u);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : '';
  } catch {
    return '';
  }
}
