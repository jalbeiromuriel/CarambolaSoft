// src/db/respaldo.js — Respaldo y restauración de TODOS los datos locales (IndexedDB).
// [RIESGO] Hasta que exista el sync completo, cuentas, caja, fiados, clientes y usuarios viven solo en este
// navegador: este archivo es la única copia fuera del PC. Restaurar REEMPLAZA todo lo de este PC.
import { openDb, DB_NAME, DB_VERSION, STORES, SYNC_QUEUE, DEAD_LETTER, META } from './schema.js';
import { APP_RESPALDO, validarRespaldo } from './respaldoLogica.js';

export const TABLAS_RESPALDO = [...STORES, SYNC_QUEUE, DEAD_LETTER, META];

/** Lee todo y devuelve el objeto de respaldo (una sola transacción de lectura: foto consistente). */
export async function exportarTodo() {
  const db = await openDb();
  const tablas = TABLAS_RESPALDO.filter((t) => db.objectStoreNames.contains(t));
  const datos = await new Promise((resolve, reject) => {
    const tx = db.transaction(tablas, 'readonly');
    const out = {};
    for (const t of tablas) { const req = tx.objectStore(t).getAll(); req.onsuccess = () => { out[t] = req.result; }; }
    tx.oncomplete = () => resolve(out);
    tx.onerror = () => reject(tx.error);
  });
  return { app: APP_RESPALDO, base: DB_NAME, version: DB_VERSION, fecha: new Date().toISOString(), tablas: datos };
}

/** Descarga el respaldo como archivo .json. */
export function descargar(respaldo, nombre) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(respaldo)], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url; a.download = nombre; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Valida contra esta base. '' = se puede restaurar. */
export const revisar = (r) => validarRespaldo(r, { base: DB_NAME, version: DB_VERSION, tablasConocidas: TABLAS_RESPALDO });

/**
 * Reemplaza TODO lo local por el respaldo, en UNA transacción: o entra completo o no cambia nada.
 * Los registros se guardan tal cual (sin volver a marcarlos para subir).
 */
export async function restaurarTodo(r) {
  const error = revisar(r);
  if (error) throw new Error(error);
  const db = await openDb();
  const tablas = TABLAS_RESPALDO.filter((t) => db.objectStoreNames.contains(t));
  await new Promise((resolve, reject) => {
    const tx = db.transaction(tablas, 'readwrite');
    for (const t of tablas) {
      const s = tx.objectStore(t);
      s.clear();
      for (const fila of r.tablas[t] ?? []) s.put(fila);
    }
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error('La restauración se canceló; no se cambió nada.'));
  });
}

/** Pide al navegador que no borre estos datos solo por falta de espacio. Devuelve true si quedó persistente. */
export async function pedirPersistencia() {
  try {
    if (!navigator.storage?.persist) return false;
    return (await navigator.storage.persisted()) || (await navigator.storage.persist());
  } catch { return false; }
}
