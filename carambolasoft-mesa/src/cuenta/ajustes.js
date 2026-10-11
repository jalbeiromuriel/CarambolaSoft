// src/cuenta/ajustes.js — Valores configurables del negocio (pantalla Configuración, solo Admin). Lógica pura, sin IndexedDB.
// `ajustes` es un objeto vivo: tiempo.js, garita.js y el Panel lo leen al momento de usarlo; ajustesDb.js lo llena al arrancar.
export const AJUSTES_BASE = { tarifaBillar: 6000, redondeo: 100, avisoGaritaMin: 5, horasAtencion: 10, precioGarita: 1000 };
export const ajustes = { ...AJUSTES_BASE };

/** Devuelve un texto de error o null. Todos los valores son enteros dentro de rangos razonables. */
export function validarAjustes(a) {
  const ent = (v) => Number.isInteger(v);
  if (!ent(a.tarifaBillar) || a.tarifaBillar < 500 || a.tarifaBillar > 100000) return 'La tarifa de billar por hora debe estar entre $500 y $100.000.';
  if (![1, 10, 50, 100, 500, 1000].includes(a.redondeo)) return 'El redondeo debe ser 1, 10, 50, 100, 500 o 1.000 pesos.';
  if (!ent(a.precioGarita) || a.precioGarita < 100 || a.precioGarita > 50000) return 'El precio de la garita por persona debe estar entre $100 y $50.000.';
  if (!ent(a.avisoGaritaMin) || a.avisoGaritaMin < 1 || a.avisoGaritaMin > 30) return 'El aviso de la garita debe estar entre 1 y 30 minutos.';
  if (!ent(a.horasAtencion) || a.horasAtencion < 1 || a.horasAtencion > 24) return 'Las horas de atención deben estar entre 1 y 24.';
  return null;
}
