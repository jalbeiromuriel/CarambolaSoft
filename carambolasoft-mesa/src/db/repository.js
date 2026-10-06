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


import { openDb, SYNC_QUEUE, DEAD_LETTER, META } from './schema.js';
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

// ============================================================
//  MOTOR DE SINCRONIZACIÓN (A4) — helpers de apoyo
//  Se suman a put(); no lo reemplazan.
// ============================================================

/**
 * Escribe un registro que YA viene sincronizado del servidor.
 * Estampa EsSincronizado = true y NO encola.
 *
 * [CLAVE] Esta es la vacuna anti-loop: bajar() usa ESTO, nunca put().
 */
export async function putSincronizado(tabla, entidad) {
  const db = await openDb();

  const registro = {
    ...entidad,
    EsSincronizado: true,
    UltimaModificacion: entidad.UltimaModificacion ?? new Date().toISOString(),
  };

  return new Promise((resolve, reject) => {
    const tx = db.transaction(tabla, 'readwrite');
    tx.objectStore(tabla).put(registro);
    tx.oncomplete = () => resolve(registro);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error(`Transacción abortada en ${tabla}`));
  });
}

/**
 * Saca un registro de la cola tras un 200/201 confirmado.
 * @param {number} seq - clave autoincrement de la fila en SYNC_QUEUE
 */
export async function borrarDeCola(seq) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(SYNC_QUEUE, 'readwrite');
    tx.objectStore(SYNC_QUEUE).delete(seq);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Mueve un registro rechazado por integridad (409/422) de la cola
 * al cementerio DEAD_LETTER, en UNA SOLA transacción atómica.
 */
export async function moverADeadLetter(itemCola, motivo) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([SYNC_QUEUE, DEAD_LETTER], 'readwrite');

    tx.objectStore(DEAD_LETTER).add({
      tabla:       itemCola.tabla,
      entidadId:   itemCola.registroId,
      payload:     itemCola,
      motivo:      motivo ?? 'Sin detalle',
      fechaMuerte: new Date().toISOString(),
    });
    tx.objectStore(SYNC_QUEUE).delete(itemCola.seq);

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error('No se pudo mover a DEAD_LETTER'));
  });
}

/** Lee un valor del store META (ej: el cursor de bajada). undefined si no existe. */
export async function leerMeta(clave) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const req = db.transaction(META).objectStore(META).get(clave);
    req.onsuccess = () => resolve(req.result?.valor);
    req.onerror = () => reject(req.error);
  });
}

/** Escribe un valor en el store META (ej: guardar el cursor tras una bajada). */
export async function escribirMeta(clave, valor) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(META, 'readwrite');
    tx.objectStore(META).put({ clave, valor });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
/**
 * Borrado físico LOCAL, solo para datos efímeros (el detalle de un chico del Marcador).
 * Quita el registro y cualquier operación suya pendiente en la cola. NO sincroniza el borrado hacia el server.
 * Las demás tablas siguen la regla de la casa: nunca borrar con historial.
 */
export async function borrarLocal(tabla, ids) {
  const db = await openDb();
  const set = new Set(ids);
  return new Promise((resolve, reject) => {
    const tx = db.transaction([tabla, SYNC_QUEUE], 'readwrite');
    const negocio = tx.objectStore(tabla);
    for (const id of set) negocio.delete(id);
    const cola = tx.objectStore(SYNC_QUEUE).openCursor();
    cola.onsuccess = () => {
      const c = cola.result;
      if (!c) return;
      if (c.value.tabla === tabla && set.has(c.value.registroId)) c.delete();
      c.continue();
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error(`No se pudo borrar en ${tabla}`));
  });
}
