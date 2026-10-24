/* Aplica el tema guardado antes del primer pintado para evitar el parpadeo. Sin elección guardada, automático. */
try {
  const t = localStorage.getItem('bg.theme');
  if (t === 'light' || t === 'dark' || t === 'auto') document.documentElement.dataset.theme = t;
} catch {
  /* sin almacenamiento: tema automático */
}
