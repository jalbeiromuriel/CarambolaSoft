// src/db/respaldoLogica.js — Reglas PURAS del respaldo de datos (sin IndexedDB): validar y resumir un archivo.
// El archivo es JSON: { app, base, version, fecha, tablas: { CUENTAS: [...], META: [...], ... } }.
export const APP_RESPALDO = 'CarambolaSoft · Mero Parche';

/** '' si el archivo sirve para restaurar en esta base; si no, el motivo en español. */
export function validarRespaldo(r, { base, version, tablasConocidas }) {
  if (!r || typeof r !== 'object') return 'El archivo no es un respaldo de CarambolaSoft.';
  if (r.app !== APP_RESPALDO || !r.tablas || typeof r.tablas !== 'object') return 'El archivo no es un respaldo de CarambolaSoft.';
  if (r.base !== base) return `El respaldo es de otra base de datos (${r.base}).`;
  if (!Number.isInteger(r.version) || r.version > version) return 'El respaldo es de una versión más nueva de la app. Actualiza la app (git pull) antes de restaurar.';
  for (const [t, filas] of Object.entries(r.tablas)) {
    if (!tablasConocidas.includes(t)) return `El respaldo trae una tabla desconocida: ${t}.`;
    if (!Array.isArray(filas)) return `La tabla ${t} del respaldo está dañada.`;
  }
  return '';
}

/** Conteos para mostrar antes de restaurar: { fecha, total, cuentas, clientes, facturas, productos }. */
export function resumenRespaldo(r) {
  const n = (t) => r.tablas?.[t]?.length ?? 0;
  const total = Object.entries(r.tablas ?? {}).filter(([t]) => !['SYNC_QUEUE', 'DEAD_LETTER', 'META'].includes(t)).reduce((s, [, f]) => s + f.length, 0);
  return { fecha: r.fecha, total, cuentas: n('CUENTAS'), clientes: n('CLIENTES'), facturas: n('FACTURAS'), productos: n('PRODUCTOS') };
}

/** Nombre del archivo: MeroParche_respaldo_2026-11-24_0215.json (hora local). */
export function nombreArchivo(d = new Date()) {
  const p = (x) => String(x).padStart(2, '0');
  return `MeroParche_respaldo_${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}.json`;
}
