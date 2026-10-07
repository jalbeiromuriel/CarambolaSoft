// src/cuenta/cobro.js — Reglas del cobro (funciones puras). Devuelve { error } o el plan para facturar.
// Bancolombia se guarda como TARJETA (el valor del enum no cambia; solo la etiqueta).
export const METODOS = [
  { v: 'EFECTIVO', t: '💵 Efectivo' },
  { v: 'NEQUI', t: '🟣 Nequi' },
  { v: 'DAVIPLATA', t: '🔴 Daviplata' },
  { v: 'TARJETA', t: '🟡 Bancolombia' },
  { v: 'TRANSFERENCIA', t: '🔁 Transferencia' },
  { v: 'FIADO', t: '📒 Fiado' },
];

export function planCobro({ total, mixto, metodo, metodo1, metodo2, monto1 = 0, pago = 0, tieneCliente }) {
  const met1 = mixto ? metodo1 : metodo;
  const met2 = mixto ? metodo2 : null;
  const m1 = mixto ? monto1 : total;
  const m2 = mixto ? total - monto1 : 0;

  if (mixto) {
    if (!(m1 > 0) || m1 >= total) return { error: 'El monto del método 1 debe ser mayor a 0 y menor al total.' };
    if (met1 === met2) return { error: 'Elige dos métodos distintos.' };
  }
  if (!mixto && met1 === 'EFECTIVO' && pago > 0 && pago < total) return { error: `Pago insuficiente: faltan $${Math.round(total - pago).toLocaleString('es-CO')}.` };
  if ((met1 === 'FIADO' || met2 === 'FIADO') && !tieneCliente) return { error: 'El fiado necesita un cliente registrado.' };

  const pendienteFiado = met1 === 'FIADO' ? m1 : met2 === 'FIADO' ? m2 : 0;
  const devolver = !mixto && met1 === 'EFECTIVO' && pago >= total ? pago - total : null;
  return { met1, met2, m1, m2, pendienteFiado, devolver };
}
