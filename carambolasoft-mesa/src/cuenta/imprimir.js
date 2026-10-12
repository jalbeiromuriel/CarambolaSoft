// src/cuenta/imprimir.js — Imprimir / guardar PDF con un nombre de archivo útil.
// Chrome propone como nombre de archivo el título de la pestaña; sin esto sale siempre "carambolasoft-mesa".

/** "Reposición 2026-10-12": nombre sugerido para el PDF (sin caracteres que Windows no acepta). */
export const nombrePdf = (base, fechaIso) => `${base} ${fechaIso}`.replace(/[\\/:*?"<>|]/g, '-').trim();

/** Fecha local YYYY-MM-DD (no UTC: en Colombia a las 8 p. m. UTC ya es mañana). */
export const fechaLocalIso = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Imprime con el título cambiado y lo devuelve a como estaba al terminar (o cancelar). */
export function imprimirComo(titulo) {
  const antes = document.title;
  const restaurar = () => { document.title = antes; window.removeEventListener('afterprint', restaurar); };
  window.addEventListener('afterprint', restaurar);
  document.title = titulo;
  window.print();
}
