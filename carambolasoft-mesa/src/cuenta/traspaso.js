// src/cuenta/traspaso.js — "Pasar saldo a…" (funciones puras).
// Un cliente paga lo que tiene y el resto (el saldo) pasa a la cuenta de un amigo, de esta mesa o de otra.
// Reglas (aprobadas 2026-11-24):
// - Se pasa el SALDO, nunca los productos: los productos se quedan en la factura de quien consumió
//   (así licores, snacks, tiempo y márgenes quedan en su categoría y la venta cuenta una sola vez).
// - En la cuenta del amigo entra UNA línea «Saldo de <nombre> · F-0123» con CategoriaConsumo 'TRASPASO'.
//   Cuando el amigo paga, esa línea NO es venta nueva (como el cobro de un fiado).
// - Con el chico corriendo no se puede pasar: todavía no se sabe cuánto es la deuda.

export const METODO_TRASPASO = 'TRASPASO';
export const CATEGORIA_TRASPASO = 'TRASPASO';

/** ¿Es la línea de saldo traspasado (no es un producto)? */
export const esLineaSaldo = (p) => p?.CategoriaConsumo === CATEGORIA_TRASPASO;

/**
 * Valida y arma el pago de la cuenta de origen.
 * paga = lo que el cliente paga ahora (0 = pasa todo); metodo = con qué paga esa parte.
 * Devuelve { error } o { met1, met2, m1, m2, saldo } listo para la factura
 * (paga 0 → un solo método TRASPASO por el total).
 */
export function planTraspaso({ total, paga = 0, metodo = 'EFECTIVO', chicoCorriendo = false, destinoId = null, origenId = null }) {
  if (chicoCorriendo) return { error: 'Termina el chico antes de pasar el saldo: todavía no se sabe cuánto es la deuda.' };
  if (!(total > 0)) return { error: 'La cuenta está en $0: no hay saldo para pasar.' };
  if (!destinoId) return { error: 'Elige a qué cuenta pasa el saldo.' };
  if (destinoId === origenId) return { error: 'El saldo no puede pasar a la misma cuenta.' };
  if (!(paga >= 0)) return { error: 'El valor que paga no es válido.' };
  if (paga >= total) return { error: 'Si paga todo, no hay saldo para pasar: usa Cobrar.' };
  if (paga > 0 && (metodo === 'FIADO' || metodo === METODO_TRASPASO)) return { error: 'Lo que paga ahora debe ser en efectivo o un pago digital.' };
  const saldo = total - paga;
  if (paga === 0) return { met1: METODO_TRASPASO, met2: null, m1: total, m2: 0, saldo };
  return { met1: metodo, met2: METODO_TRASPASO, m1: paga, m2: saldo, saldo };
}

/** La línea que entra a la cuenta del amigo (PEDIDOS_CUENTAS). Ya entregada: no toca inventario. */
export function lineaSaldo({ cuentaDestinoId, facturaId, numeroFactura, nombreOrigen, saldo, fechaHora }) {
  return {
    CuentaId: cuentaDestinoId, ProductoId: null,
    Detalle: `Saldo de ${nombreOrigen}${numeroFactura ? ` · ${numeroFactura}` : ''}`,
    Cantidad: 1, PrecioUnitarioHist: saldo, CostoCompraHist: 0,
    CategoriaConsumo: CATEGORIA_TRASPASO, EstadoPedido: 'ENTREGADO',
    TraspasoDeFacturaId: facturaId, FechaHora: fechaHora,
  };
}

/** Lo que una lista de pedidos trae de saldos traspasados (no es venta nueva al cobrarse). */
export const saldoTraspasado = (pedidos = []) =>
  pedidos.filter((p) => esLineaSaldo(p) && p.EstadoPedido === 'ENTREGADO').reduce((t, p) => t + (p.PrecioUnitarioHist ?? 0) * (p.Cantidad ?? 1), 0);
