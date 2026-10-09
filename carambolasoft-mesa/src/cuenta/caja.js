// src/cuenta/caja.js — Reglas de la caja (funciones puras). El "turno abierto" son los registros con TurnoCajaId nulo:
// al cerrar la caja se sellan con el Id del turno y salen del turno abierto.
import { PRODUCTO_GARITA_ID } from './garita.js';

export const CATEGORIAS_GASTO = ['Insumos', 'Transporte', 'Servicios', 'Adelanto empleado', 'Otros'];
export const METODOS_CAJA = ['EFECTIVO', 'NEQUI', 'DAVIPLATA', 'TARJETA', 'TRANSFERENCIA'];   // TARJETA = Bancolombia en pantalla

/** Cómo se pagó una factura: lista de { metodo, monto } (una o dos partes). */
export function partesFactura(f) {
  const total = f.TotalPagar ?? 0;
  const partes = [{ metodo: f.MetodoPago, monto: f.MontoPrimario ?? total }];
  if (f.MetodoPagoSecundario) partes.push({ metodo: f.MetodoPagoSecundario, monto: f.MontoSecundario ?? 0 });
  return partes;
}

const suma = (l, f) => l.reduce((t, x) => t + f(x), 0);
const cero = () => Object.fromEntries([...METODOS_CAJA, 'FIADO'].map((m) => [m, 0]));

/**
 * Resumen del turno abierto.
 * - porMetodo: lo vendido por método (FIADO = lo que quedó por cobrar al vender).
 * - cobrosFiado: abonos recibidos en el turno, por método.
 * - efectivoEsperado = efectivo vendido + abonos en efectivo − gastos en efectivo.
 */
export function resumenTurno({ facturas = [], abonos = [], gastos = [] }) {
  const porMetodo = cero(), cobrosFiado = cero(), gastosPorMetodo = cero();
  for (const f of facturas) for (const p of partesFactura(f)) porMetodo[p.metodo] = (porMetodo[p.metodo] ?? 0) + p.monto;
  for (const a of abonos) cobrosFiado[a.MetodoPago] = (cobrosFiado[a.MetodoPago] ?? 0) + a.Monto;
  for (const g of gastos) gastosPorMetodo[g.MetodoPago] = (gastosPorMetodo[g.MetodoPago] ?? 0) + g.Monto;
  const totalVendido = suma(facturas, (f) => f.TotalPagar ?? 0);
  const totalCobros = suma(abonos, (a) => a.Monto);
  const totalGastos = suma(gastos, (g) => g.Monto);
  return {
    nVentas: facturas.length, porMetodo, totalVendido, fiado: porMetodo.FIADO,
    cobrosFiado, totalCobros, nCobros: new Set(abonos.map((a) => `${a.FechaHora}|${a.MetodoPago}`)).size,
    gastosPorMetodo, totalGastos, nGastos: gastos.length,
    efectivoEsperado: porMetodo.EFECTIVO + cobrosFiado.EFECTIVO - gastosPorMetodo.EFECTIVO,
  };
}

/** Arqueo: diferencia = contado − esperado. Negativa = faltante, positiva = sobrante. */
export function arqueo(esperado, contado) {
  const diferencia = Math.round(contado - esperado);
  return { diferencia, estado: diferencia === 0 ? 'CUADRA' : diferencia > 0 ? 'SOBRANTE' : 'FALTANTE' };
}

/** Movimientos del turno, recientes primero: ventas (+), abonos (+) y gastos (−). */
export function movimientos({ facturas = [], abonos = [], gastos = [], etiquetaDe }) {
  const m = [];
  for (const f of facturas) m.push({ tipo: 'VENTA', id: f.Id, fecha: f.FechaHora, monto: f.TotalPagar ?? 0, titulo: etiquetaDe(f), detalle: partesFactura(f).map((p) => p.metodo) });
  const porPago = new Map();
  for (const a of abonos) {
    const k = `${a.FechaHora}|${a.MetodoPago}`;
    porPago.set(k, { ...(porPago.get(k) ?? { tipo: 'ABONO', id: k, fecha: a.FechaHora, monto: 0, metodo: a.MetodoPago, facturaIds: [] }), monto: (porPago.get(k)?.monto ?? 0) + a.Monto, facturaIds: [...(porPago.get(k)?.facturaIds ?? []), a.FacturaId] });
  }
  for (const p of porPago.values()) m.push({ ...p, titulo: etiquetaDe({ abono: p }), detalle: [p.metodo] });
  for (const g of gastos) m.push({ tipo: 'GASTO', id: g.Id, fecha: g.FechaHora, monto: g.Monto, titulo: g.Concepto, detalle: [g.MetodoPago, g.Categoria] });
  return m.sort((a, b) => (b.fecha ?? '').localeCompare(a.fecha ?? ''));
}

/**
 * Inventario vendido (para cuadrar la nevera): unidades por producto de las cuentas facturadas en el turno,
 * de mayor a menor. No cuenta tiempo, garita, pedidos cancelados ni pagos de fiado.
 */
export function inventarioVendido({ facturas = [], pedidos = [], productos = [] }) {
  const cuentas = new Set(facturas.flatMap((f) => [f.CuentaId, ...(f.CuentasIncluidas ?? [])]));
  const nombre = new Map(productos.map((p) => [p.Id, p.Nombre]));
  const conteo = new Map();
  for (const p of pedidos) {
    if (!cuentas.has(p.CuentaId) || p.EstadoPedido !== 'ENTREGADO') continue;
    if (p.CategoriaConsumo === 'TIEMPO' || p.ProductoId === PRODUCTO_GARITA_ID) continue;
    const n = nombre.get(p.ProductoId) ?? p.Detalle;
    if (!n) continue;
    conteo.set(n, (conteo.get(n) ?? 0) + p.Cantidad);
  }
  const filas = [...conteo].map(([n, cant]) => ({ nombre: n, cant })).sort((a, b) => b.cant - a.cant || a.nombre.localeCompare(b.nombre, 'es'));
  return { filas, total: filas.reduce((t, f) => t + f.cant, 0) };
}
