// src/cuenta/estadisticasDb.js — Carga los datos del tablero desde IndexedDB.
import { getAll, leerMeta } from '../db/repository.js';
import { cargarFiados } from './fiadosDb.js';
import { MARGEN_OBJETIVO } from './inventario.js';
import { BASE_FONDO } from './maquinas.js';

export async function cargarEstadisticas() {
  const [facturas, pedidos, productos, gastos, cuentas, maq, cierres, fi, objetivo, base] = await Promise.all([
    getAll('FACTURAS'), getAll('PEDIDOS_CUENTAS'), getAll('PRODUCTOS'), getAll('GASTOS_CAJA'), getAll('CUENTAS'),
    getAll('MAQUINAS_MOVIMIENTOS'), getAll('CIERRE_DIA'), cargarFiados(), leerMeta('negocio.margenObjetivo'), leerMeta('maquinas.base'),
  ]);
  return { facturas, pedidos, productos, gastos, cuentas, maq, cierres, fiados: fi.lista, objetivo: objetivo ?? MARGEN_OBJETIVO, baseFondo: base ?? BASE_FONDO };
}
