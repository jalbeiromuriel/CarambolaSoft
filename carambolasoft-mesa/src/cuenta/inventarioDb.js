// src/cuenta/inventarioDb.js — Stock con fraccionados contra IndexedDB.
import { get, put, getAll, leerMeta, escribirMeta } from '../db/repository.js';
import { descargar, abrirEnvase, esFraccionado } from './inventario.js';

const origenDe = (p) => (esFraccionado(p) ? get('PRODUCTOS', p.Fraccion.OrigenId) : Promise.resolve(null));

/** Descuenta q al entregar; abre envases si hace falta. Devuelve cuántos envases se abrieron (o null si no alcanza). */
export async function descontarStock(prod, q) {
  const origen = await origenDe(prod);
  const r = descargar(prod, origen, q);
  if (!r) return null;
  await put('PRODUCTOS', r.prod);
  if (r.origen) await put('PRODUCTOS', r.origen);
  return r.abiertos;
}
/** Al cancelar desde PENDIENTE/quitar: las unidades vuelven como sueltas. */
export async function devolverStock(prod, q) { await put('PRODUCTOS', { ...prod, StockActual: (prod.StockActual ?? 0) + q }); }

export async function abrirEnvaseDb(prod) {
  const r = abrirEnvase(prod, await origenDe(prod));
  if (!r) return false;
  await put('PRODUCTOS', r.prod); await put('PRODUCTOS', r.origen);
  return true;
}

/** Registra una compra recibida: suma el stock, deja el costo de compra (por unidad) y guarda el historial. Devuelve el producto guardado. */
export async function registrarCompra(p, uds, costoU, nuevoPrecio = null) {
  const hist = [{ Fecha: new Date().toISOString(), Costo: costoU }, ...(p.HistorialCostos ?? [])].slice(0, 10);
  return put('PRODUCTOS', { ...p, StockActual: (p.StockActual ?? 0) + uds, CostoCompra: costoU, HistorialCostos: hist, ...(nuevoPrecio ? { PrecioVenta: nuevoPrecio } : {}) });
}

// ── Registro de cambios de precio de venta (store CAMBIOS_PRECIO; sube al servidor con el sync)
const CLAVE_VIEJA = 'precios.cambios';          // antes vivía en META como lista; se pasa al store una sola vez
const claveVisto = (usuarioId) => `precios.visto.${usuarioId}`;
let migrando = null;
function migrarCambiosViejos() {
  migrando ??= (async () => {
    const viejos = await leerMeta(CLAVE_VIEJA);
    if (Array.isArray(viejos) && viejos.length) {
      const ya = new Set((await getAll('CAMBIOS_PRECIO')).map((c) => c.Id));
      for (const c of viejos) if (!ya.has(c.Id)) await put('CAMBIOS_PRECIO', c);
    }
    await escribirMeta(CLAVE_VIEJA, []);
  })();
  return migrando;
}
/** Más nuevo primero. */
export async function leerCambiosPrecio() {
  await migrarCambiosViejos();
  return (await getAll('CAMBIOS_PRECIO')).sort((a, b) => b.Fecha.localeCompare(a.Fecha));
}
/** Anota un cambio de precio de venta. Si el precio no cambió de verdad (o es un producto nuevo), no hace nada. */
export async function anotarCambioPrecio({ p, antes, despues, usuario, motivo }) {
  if (typeof antes !== 'number' || typeof despues !== 'number' || antes === despues) return;
  await migrarCambiosViejos();
  await put('CAMBIOS_PRECIO', { Id: crypto.randomUUID(), Fecha: new Date().toISOString(), ProductoId: p.Id, Nombre: p.Nombre, Antes: antes, Despues: despues, UsuarioId: usuario?.Id ?? null, Usuario: usuario?.Nombre ?? '', Motivo: motivo ?? '', Avisado: false });
}
/** Marca como avisados (ya se mandó el WhatsApp al grupo). */
export async function marcarAvisados(ids) {
  const set = new Set(ids);
  for (const c of (await getAll('CAMBIOS_PRECIO')).filter((x) => set.has(x.Id))) await put('CAMBIOS_PRECIO', { ...c, Avisado: true });
}
export const leerVisto = (usuarioId) => leerMeta(claveVisto(usuarioId));
export const marcarVisto = (usuarioId) => escribirMeta(claveVisto(usuarioId), new Date().toISOString());
