// ============================================================
//  CarambolaSoft — El Parche de Jony
//  db/repository.js — acceso genérico Offline-First
//
//  Regla de oro: TODA escritura pasa por put().
//  put() garantiza:
//    · GUID generado en cliente si no viene
//    · EsSincronizado = false + UltimaModificacion estampados
//    · Escritura ATÓMICA a store de negocio + SYNC_QUEUE
//      (misma transacción: o entran las dos, o ninguna)
// ============================================================

import { openDb, SYNC_QUEUE } from './schema.js';

/** GUID v4 generado en cliente (offline-first, idempotencia en sync) */
export function nuevoGuid() {
  return crypto.randomUUID();
}

/**
 * Inserta o actualiza un registro (upsert).
 * @param {string} tabla   - nombre del store (ej: 'CUENTAS')
 * @param {object} entidad - objeto con o sin Id
 * @returns {Promise<object>} la entidad ya estampada (con Id)
 */
export async function put(tabla, entidad) {
  const db = await openDb();

  const registro = {
    ...entidad,
    Id: entidad.Id ?? nuevoGuid(),
    EsSincronizado: false,
    UltimaModificacion: new Date().toISOString(),
  };

  return new Promise((resolve, reject) => {
    // Una sola transacción sobre ambos stores = atomicidad real
    const tx = db.transaction([tabla, SYNC_QUEUE], 'readwrite');

    tx.objectStore(tabla).put(registro);
    tx.objectStore(SYNC_QUEUE).add({
      tabla,
      registroId: registro.Id,
      timestamp: registro.UltimaModificacion,
    });

    tx.oncomplete = () => resolve(registro);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error(`Transacción abortada en ${tabla}`));
  });
}

/** Lee un registro por Id. Devuelve undefined si no existe. */
export async function get(tabla, id) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const req = db.transaction(tabla).objectStore(tabla).get(id);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** Lee todos los registros de un store. */
export async function getAll(tabla) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const req = db.transaction(tabla).objectStore(tabla).getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Lee por índice (definidos en schema.js).
 * Ej: porIndice('CUENTAS', 'porEstado', 'ABIERTA')
 */
export async function porIndice(tabla, indice, valor) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const req = db.transaction(tabla).objectStore(tabla).index(indice).getAll(valor);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** Operaciones pendientes de subir, en orden de llegada. */
export async function pendientesSync() {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const req = db.transaction(SYNC_QUEUE).objectStore(SYNC_QUEUE).getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// NOTA: no hay delete() físico a propósito.
// Regla de la casa: nunca borrar registros con historial — solo desactivar
// o cambiar estado (CANCELADO, ANULADO...), siempre vía put().