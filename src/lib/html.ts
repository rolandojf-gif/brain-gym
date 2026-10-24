/* Escapa texto para interpolarlo en plantillas HTML. Todo dato del usuario pasa por aquí antes de pintarse. */
const MAP: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

export function esc(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, (c) => MAP[c] ?? c);
}
