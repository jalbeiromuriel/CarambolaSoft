// ============================================================
//  CarambolaSoft — Mero Parche (Licores y Billar)
//  db/sync.js — Motor de sincronización (A4)
//
//  FASE 1: SUBIDA (subir) + BAJADA (bajar).
//
//  Regla de oro del orden causal: si un item falla por red/5xx,
//  se FRENA todo el drenaje. Nunca se salta un item para seguir
//  con el siguiente — el padre (CUENTA) debe subir antes que el
//  hijo (PEDIDO), y el server lo exige (422 si el orden se rompe).
// ============================================================

import {
  pendientesSync,
  borrarDeCola,
  moverADeadLetter,
  get,
  putSincronizado,
  leerMeta,
  escribirMeta,
} from './repository.js';


// subir() y bajar() ya viven en este mismo archivo.
// URL base del API. Hardcodeada en dev; a .env cuando vaya a producción.
const API_BASE = 'https://localhost:7186';

// Mapa tabla (store IndexedDB) → segmento de ruta del API.
const RUTA_SYNC = {
  CUENTAS:         'cuentas',
  PEDIDOS_CUENTAS: 'pedidos',
};

/**
 * Sube un registro individual al API.
 * @returns {number} el status HTTP de la respuesta
 */
async function subirRegistro(tabla, registro) {
  const segmento = RUTA_SYNC[tabla];
  const url = `${API_BASE}/api/sync/${segmento}/${registro.Id}`;

  const resp = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(registro),
  });

  return resp.status;
}

/**
 * Drena la cola de sincronización en orden estricto de seq.
 * @returns {Promise<object>} resumen del drenaje
 */
export async function subir() {
  const cola = await pendientesSync(); // ya viene ordenada por seq (keyPath autoincrement)

  const resumen = {
    subidos: 0,
    muertos: 0,
    saltados: 0,
    frenadoPor: null, // si algo detiene el drenaje, aquí queda el motivo
  };

  for (const item of cola) {
    // ── 1. ¿Hay endpoint para esta tabla? ──
    const segmento = RUTA_SYNC[item.tabla];
    if (!segmento) {
      // Tabla sin endpoint todavía (ej: FACTURAS). No se sube ni se mata:
      // se queda en cola esperando su controller. Log una sola vez.
      console.info(`[sync] "${item.tabla}" sin endpoint aún — parqueado en cola.`);
      resumen.saltados++;
      continue;
    }

    // ── 2. Traer el registro de negocio REAL (no la fila de cola) ──
    const registro = await get(item.tabla, item.registroId);
    if (!registro) {
      // Huérfano raro: la cola apunta a un registro que ya no existe.
      // No hay nada que subir → al cementerio para diagnóstico.
      await moverADeadLetter(item, 'Registro no existe en store local');
      resumen.muertos++;
      continue;
    }

    // ── 3. Disparar el PUT y decidir según el status ──
    let status;
    try {
      status = await subirRegistro(item.tabla, registro);
    } catch (err) {
      // fetch reventó = red caída o certificado. FRENA TODO.
      resumen.frenadoPor = `Red caída en seq ${item.seq}: ${err.message}`;
      console.warn(`[sync] ${resumen.frenadoPor} — drenaje detenido.`);
      break;
    }

    if (status === 200 || status === 201) {
      // Éxito. El server confirmó (pudo corregir precio, eso es normal).
      await borrarDeCola(item.seq);
      resumen.subidos++;
    } else if (status === 409 || status === 422) {
      // Integridad rota (FK, constraint). Reintentar no arregla nada.
      await moverADeadLetter(item, `Server rechazó con ${status}`);
      resumen.muertos++;
    } else {
      // 5xx u otro: problema del server, transitorio. FRENA TODO
      // para no romper el orden causal con los items siguientes.
      resumen.frenadoPor = `Status ${status} en seq ${item.seq}`;
      console.warn(`[sync] ${resumen.frenadoPor} — drenaje detenido.`);
      break;
    }
  }

  return resumen;
}

// ============================================================
//  BAJADA — traer catálogo del server por cursor incremental
// ============================================================

const BAJADA_STORES = {
  productos:    'PRODUCTOS',
  categorias:   'CATEGORIAS',
  promociones:  'PROMOCIONES',
  mesas:        'MESAS_BILLAR',
};

const CURSOR_KEY = 'sync.cursor';

// Traductor: el backend serializa en camelCase (id, nombre...) pero
// IndexedDB usa PascalCase (Id, Nombre...). Capitaliza la 1ª letra de
// cada clave. Descarta navegaciones EF vacías (categoria, promociones...).
function aPascalCase(obj) {
  const salida = {};
  for (const [clave, valor] of Object.entries(obj)) {
    // Saltar navegaciones EF (objetos/arrays que no son datos planos)
    if (Array.isArray(valor) || (valor !== null && typeof valor === 'object')) continue;
    const clavePascal = clave.charAt(0).toUpperCase() + clave.slice(1);
    salida[clavePascal] = valor;
  }
  return salida;
}

export async function bajar() {
  // 1. Leer el cursor. Primera vez → undefined → baja todo.
  const cursor = await leerMeta(CURSOR_KEY);

  const url = cursor
    ? `${API_BASE}/api/sync/cambios?desde=${encodeURIComponent(cursor)}`
    : `${API_BASE}/api/sync/cambios`;

  // 2. Pedir los cambios
  let data;
  try {
    const resp = await fetch(url, { headers: { 'Accept': 'application/json' } });
    if (!resp.ok) {
      console.warn(`[sync] bajar() status ${resp.status} — cursor intacto.`);
      return { error: `status ${resp.status}` };
    }
    data = await resp.json();
  } catch (err) {
    console.warn(`[sync] bajar() red caída: ${err.message} — cursor intacto.`);
    return { error: err.message };
  }

  // 3. Guardar cada array con putSincronizado (NO encola = no loop)
  const resumen = {};
  for (const [clave, store] of Object.entries(BAJADA_STORES)) {
    const lista = data[clave] ?? [];
    for (const registro of lista) {
      await putSincronizado(store, aPascalCase(registro));
    }
    resumen[clave] = lista.length;
  }

  // 4. Avanzar el cursor con el reloj del SERVER (nunca el de la tablet)
  if (data.servidorAhora) {
    await escribirMeta(CURSOR_KEY, data.servidorAhora);
    resumen.cursor = data.servidorAhora;
  }

  return resumen;
}

// ============================================================
//  A4 · Paso 6 — Orquestador de sincronización + Web Locks
//  SE AGREGA al final de db/sync.js.
//  No toca subir() ni bajar() (ya certificados, pasos 3-5).
// ============================================================



const NOMBRE_LOCK      = 'carambola-sync';
const CLAVE_META       = 'sync-estado';            // ⚠ NO reutilizar la clave del cursor de bajar()
const INTERVALO_ESCALA = [20_000, 60_000, 120_000]; // backoff: sano → 1 fallo → 2+ fallos

let _idHeartbeat = null;
let _fallos      = 0;      // espejo en memoria de META.fallosConsecutivos
let _online      = null;   // referencia al listener para poder removerlo
let _iniciado    = false;  // evita doble arranque (StrictMode / remounts)

// ------------------------------------------------------------
//  Orquestador — punto único de entrada
// ------------------------------------------------------------
export async function sincronizar(motivo = 'manual') {
  // Guarda barata: sin red no gastamos ni el lock.
  if (!navigator.onLine) {
    return { ok: false, saltado: true, motivo: 'offline', disparador: motivo };
  }

  // Todo el tramo crítico va dentro del lock exclusivo.
  // ifAvailable: si otra pestaña lo tiene, la callback recibe null → saltamos (no encolamos).
  return navigator.locks.request(
    NOMBRE_LOCK,
    { mode: 'exclusive', ifAvailable: true },
    async (lock) => {
      if (lock === null) {
        return { ok: false, saltado: true, motivo: 'lock-ocupado', disparador: motivo };
      }
      return _correrCiclo(motivo);
    }
  );
}

async function _correrCiclo(motivo) {
  try {
    // 1) SIEMPRE subir primero.
    const rSubir = await subir();

    // 2) COMPUERTA. Si subir abortó por red/5xx → NO bajamos, reintentamos el ciclo completo luego.
    //    (DEAD_LETTER NO aborta: es fallo permanente, no transitorio → bajar() sigue.)
    //    ⚠ CONTRATO #1 — ajusta esta condición a lo que devuelva TU subir() en el break de red.
    if (rSubir?.abortadoPorRed) {
      await _registrarFallo();
      return { ok: false, saltado: true, motivo: 'subir-incompleto',
               disparador: motivo, subir: rSubir };
    }

    // 3) Bajar con cursor incremental (paso 5). bajar() persiste SU propio cursor.
    const rBajar = await bajar();

    // 4) Ciclo limpio → resetear contador y sellar salud del sync.
    _fallos = 0;
    await escribirMeta(CLAVE_META, {              // ⚠ CONTRATO #2 — firma (clave, valor)
      ultimaSyncOk: rBajar?.serverTime ?? new Date().toISOString(),
      ultimoResultado: { motivo, subir: rSubir, bajar: rBajar },
      fallosConsecutivos: 0,
      ultimoError: null,
    });

    return { ok: true, saltado: false, disparador: motivo, subir: rSubir, bajar: rBajar };

  } catch (err) {
    // Nunca tumbamos el POS. Log a consola (F12) + contador para backoff e IndicadorSync.
    console.error(`[sync] ciclo "${motivo}" falló:`, err);
    await _registrarFallo(err);
    return { ok: false, saltado: false, motivo: 'error', disparador: motivo, error: String(err) };
  }
}

async function _registrarFallo(err) {
  _fallos += 1;
  try {
    const meta = (await leerMeta(CLAVE_META)) ?? {};
    await escribirMeta(CLAVE_META, {
      ...meta,
      fallosConsecutivos: _fallos,
      ultimoError: err ? String(err) : (meta.ultimoError ?? null),
    });
  } catch (e) {
    console.error('[sync] no pude persistir META de fallo:', e);
  }
}

// ------------------------------------------------------------
//  Disparadores
// ------------------------------------------------------------
function _calcularIntervalo() {
  return INTERVALO_ESCALA[Math.min(_fallos, INTERVALO_ESCALA.length - 1)];
}

function _programarHeartbeat() {
  clearTimeout(_idHeartbeat);
  _idHeartbeat = setTimeout(async () => {
    await sincronizar('heartbeat');
    _programarHeartbeat();   // reprograma según el estado actual (backoff)
  }, _calcularIntervalo());
}

export async function iniciarSync() {
  if (_iniciado) return;     // idempotente: un solo motor por pestaña
  _iniciado = true;

  // Semilla del contador desde META (por si arrancamos tras una sesión con fallos).
  try {
    const meta = await leerMeta(CLAVE_META);
    _fallos = meta?.fallosConsecutivos ?? 0;
  } catch { _fallos = 0; }

  // Reconexión: sincroniza ya y vuelve al ritmo base.
  _online = () => { _fallos = 0; sincronizar('reconexion'); _programarHeartbeat(); };
  window.addEventListener('online', _online);

  // Primer ciclo al arrancar + heartbeat.
  await sincronizar('arranque');
  _programarHeartbeat();
}

export function detenerSync() {
  clearTimeout(_idHeartbeat);
  _idHeartbeat = null;
  if (_online) window.removeEventListener('online', _online);
  _online = null;
  _iniciado = false;
}

// Azúcar para acciones críticas (liquidar cuenta, cerrar turno, etc.)
export const sincronizarAhora = (motivo = 'accion-critica') => sincronizar(motivo);