// src/cuenta/ajustesDb.js — Lee y guarda los ajustes del negocio (META + precio del producto Garita).
import { get, put, leerMeta, escribirMeta } from '../db/repository.js';
import { ajustes, AJUSTES_BASE, validarAjustes } from './ajustes.js';
import { PRODUCTO_GARITA_ID } from './garita.js';

const CLAVES = { tarifaBillar: 'config.tarifaBillar', redondeo: 'config.redondeo', avisoGaritaMin: 'config.avisoGaritaMin', horasAtencion: 'negocio.horasAtencion' };

/** Carga los ajustes guardados al objeto vivo `ajustes` (lo no guardado queda en el valor base). */
export async function cargarAjustes() {
  const n = { ...AJUSTES_BASE };
  for (const [k, clave] of Object.entries(CLAVES)) { const v = await leerMeta(clave); if (Number.isInteger(v)) n[k] = v; }
  const g = await get('PRODUCTOS', PRODUCTO_GARITA_ID);
  if (g && g.PrecioVenta > 0) n.precioGarita = g.PrecioVenta;
  Object.assign(ajustes, n);
  return { ...ajustes, ultimo: await leerMeta('config.ultimoCambio') };
}

/** Guarda: valida, escribe cada valor, actualiza el precio del producto Garita y deja quién/cuándo. */
export async function guardarAjustes(nuevo, usuario) {
  const error = validarAjustes(nuevo);
  if (error) return { error };
  for (const [k, clave] of Object.entries(CLAVES)) await escribirMeta(clave, nuevo[k]);
  const g = await get('PRODUCTOS', PRODUCTO_GARITA_ID);
  if (g && g.PrecioVenta !== nuevo.precioGarita) await put('PRODUCTOS', { ...g, PrecioVenta: nuevo.precioGarita });
  const ultimo = { por: usuario?.Nombre ?? '—', fecha: new Date().toISOString(), antes: { ...ajustes }, despues: { ...nuevo } };
  await escribirMeta('config.ultimoCambio', ultimo);
  Object.assign(ajustes, nuevo);
  return { ok: true, ultimo };
}
