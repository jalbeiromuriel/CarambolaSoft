// src/cuenta/comprobante.js — Comprobante de pago digital como evidencia para la patrona (la foto NO se guarda en la app).
const DIGITALES = new Set(['NEQUI', 'DAVIPLATA', 'TARJETA', 'TRANSFERENCIA']); // TARJETA = Bancolombia
const NOMBRE = { NEQUI: 'Nequi', DAVIPLATA: 'Daviplata', TARJETA: 'Bancolombia', TRANSFERENCIA: 'Transferencia / Bre-B' };

export const esDigital = (m) => DIGITALES.has(m);
export const nombreDigital = (m) => NOMBRE[m] ?? m;

/** Texto que acompaña la foto del comprobante. */
export function textoComprobante({ cliente = '', monto = 0, metodos = [], usuario = '', motivo = 'Pago', fecha = new Date() }) {
  const m = metodos.filter(Boolean).map(nombreDigital).join(' + ');
  const hora = fecha.toLocaleString('es-CO', { day: '2-digit', month: '2-digit', hour: 'numeric', minute: '2-digit' });
  const l = [`*Comprobante — Mero Parche*`, motivo, cliente && `Cliente: ${cliente}`, monto > 0 && `Valor: $${Math.round(monto).toLocaleString('es-CO')}`, m && `Método: ${m}`, `Hora: ${hora}`, usuario && `Registró: ${usuario}`];
  return l.filter(Boolean).join('\n');
}
