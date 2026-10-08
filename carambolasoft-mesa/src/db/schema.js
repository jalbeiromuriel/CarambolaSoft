// ============================================================
//  CarambolaSoft — Mero Parche (Licores y Billar)
//  db/schema.js — IndexedDB espejo de BD v6 (19 stores + cola)
//  Offline-First: toda operación escribe local primero.
//  v2: agrega DEAD_LETTER (rechazos del server) y META (cursor de sync)
// ============================================================

export const DB_NAME = 'ElParcheDeJony';   // nombre técnico — NO renombrar sin migración
export const DB_VERSION = 4;                // v4: USUARIOS

// Espejo 1:1 de las 19 tablas SQL (keyPath = Id, GUID generado en cliente)
export const STORES = [
  'CLIENTES',
  'JUGADORES',
  'RIVALIDADES',
  'CATEGORIAS',
  'PRODUCTOS',
  'PROMOCIONES',
  'MESAS_BILLAR',
  'TURNOS_CAJA',
  'GASTOS_CAJA',
  'MAQUINAS',
  'MAQUINAS_MOVIMIENTOS',
  'CUENTAS',
  'SESIONES_MESAS',
  'PARTICIPANTES',
  'PARTICIPANTE_MARCAS_TIEMPO',
  'PEDIDOS_CUENTAS',
  'FACTURAS',
  'ABONOS_FIADO',
  'CIERRE_DIA',
  'GARITAS_RELOJ',
  'USUARIOS',
];

// Cola de sincronización: registro de operaciones pendientes de subir
export const SYNC_QUEUE  = 'SYNC_QUEUE';
export const DEAD_LETTER = 'DEAD_LETTER';   // registros que el server rechazó por integridad (409/422)
export const META        = 'META';          // cursor de bajada y banderas del motor de sync

// Índices por store (para las consultas de las pantallas)
const INDEXES = {
  CUENTAS:          [['porEstado', 'Estado'], ['porTurno', 'TurnoCajaId']],
  PEDIDOS_CUENTAS:  [['porCuenta', 'CuentaId']],
  PRODUCTOS:        [['porCategoria', 'CategoriaId'], ['porNombre', 'Nombre']],
  SESIONES_MESAS:   [['porCuenta', 'CuentaId'], ['porMesa', 'MesaId']],
  PARTICIPANTES:    [['porSesion', 'SesionMesaId']],
  PARTICIPANTE_MARCAS_TIEMPO: [['porParticipante', 'ParticipanteId']],
  FACTURAS:         [['porEstadoPago', 'EstadoPago'], ['porTurno', 'TurnoCajaId']],
  ABONOS_FIADO:     [['porFactura', 'FacturaId']],
  GASTOS_CAJA:      [['porTurno', 'TurnoCajaId']],
  MAQUINAS_MOVIMIENTOS: [['porMaquina', 'MaquinaId']],
  CLIENTES:         [['porNombre', 'Nombre']],
  JUGADORES:        [['porUsername', 'Username']],
  USUARIOS:         [['porNombre', 'Nombre']],
};

let _dbPromise = null;

/**
 * Abre (o crea/migra) la base. Singleton: todas las pantallas
 * comparten la misma conexión.
 */
export function openDb() {
  if (_dbPromise) return _dbPromise;

  _dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (e) => {
      const db = e.target.result;

      for (const name of STORES) {
        if (!db.objectStoreNames.contains(name)) {
          const store = db.createObjectStore(name, { keyPath: 'Id' });
          for (const [idxName, keyPath] of INDEXES[name] ?? []) {
            store.createIndex(idxName, keyPath, { unique: false });
          }
        }
      }

      if (!db.objectStoreNames.contains(SYNC_QUEUE)) {
        const q = db.createObjectStore(SYNC_QUEUE, {
          keyPath: 'seq',
          autoIncrement: true, // orden de llegada = orden de subida
        });
        q.createIndex('porTabla', 'tabla', { unique: false });
      }

      // --- v2: cementerio de registros rechazados por el server ---
      if (!db.objectStoreNames.contains(DEAD_LETTER)) {
        const dl = db.createObjectStore(DEAD_LETTER, {
          keyPath: 'seq',
          autoIncrement: true,
        });
        dl.createIndex('porTabla',   'tabla',       { unique: false });
        dl.createIndex('porEntidad', 'entidadId',   { unique: false });
        dl.createIndex('porFecha',   'fechaMuerte', { unique: false });
      }

      // --- v2: metadatos del motor (cursor de bajada, último intento, etc.) ---
      // keyPath 'clave' → registros tipo { clave: 'sync.cursor', valor: '2026-07-23T20:15:00Z' }
      if (!db.objectStoreNames.contains(META)) {
        db.createObjectStore(META, { keyPath: 'clave' });
      }
    };

    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    req.onblocked = () =>
      console.warn('[IndexedDB] Upgrade bloqueado: cerrá otras pestañas del POS.');
  });

  return _dbPromise;
}