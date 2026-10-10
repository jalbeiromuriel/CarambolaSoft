// src/cuenta/fiados.js — Reglas del fiado (puras): deuda por cliente, abono a la factura más antigua primero, antigüedad.
const t = (iso) => new Date(iso ?? 0).getTime();

/** Reparte un abono entre facturas fiadas (más antigua primero). `facturas`: [{ Id, FechaHora, saldo }]. */
export function repartirAbono(facturas, monto) {
  const orden = [...facturas].sort((a, b) => t(a.FechaHora) - t(b.FechaHora));
  let resta = Math.round(monto);
  const aplicaciones = [];
  for (const f of orden) {
    if (resta <= 0) break;
    const aplicado = Math.min(resta, f.saldo);
    if (aplicado > 0) { aplicaciones.push({ facturaId: f.Id, aplicado, saldo: f.saldo - aplicado }); resta -= aplicado; }
  }
  return { aplicaciones, sobrante: resta };
}

/** Antigüedad de la deuda: verde hoy · ámbar +7 días · rojo +15. */
export function antiguedad(fechaIso, ahora = Date.now()) {
  const dias = Math.floor((ahora - t(fechaIso)) / 86400000);
  return { dias, clase: dias >= 15 ? 'r' : dias >= 7 ? 'a' : 'v', texto: dias <= 0 ? 'hoy' : dias === 1 ? 'hace 1 día' : `hace ${dias} días` };
}

/** Siguiente número de factura (F-0001…) a partir de las existentes. */
export const siguienteNumero = (facturas) => 1 + facturas.reduce((m, f) => Math.max(m, Number(String(f.Numero ?? '').replace(/\D/g, '')) || 0), 0);
export const etiquetaFactura = (n) => `F-${String(n).padStart(4, '0')}`;

// ---- Castigo de fiados incobrables y limpieza de fiados de prueba ----
/** Solo los fiados importados del POS se pueden eliminar (nunca una venta hecha en CarambolaSoft). */
export const esDePrueba = (f) => !!f?.Migrado && !!f?.OrigenPosId;

const CALCULADOS = ['saldo', 'abonado', 'original'];
const sinCalculados = (f) => Object.fromEntries(Object.entries(f).filter(([k]) => !CALCULADOS.includes(k)));

/** Castigo: el saldo pasa a 0 y la factura queda marcada (no se borra; no mueve la caja). Lanza si falta el motivo o no hay saldo. */
export function castigarFactura(f, { motivo, usuarioId = null, autorizoId = null, ahora = new Date().toISOString() }) {
  const saldo = f.TotalPendienteFiado ?? f.saldo ?? 0;
  if (!String(motivo ?? '').trim()) throw new Error('Escribe el motivo del castigo.');
  if (!(saldo > 0)) throw new Error('Esa factura no tiene saldo.');
  return { ...sinCalculados(f), TotalPendienteFiado: 0, Castigado: true, MontoCastigado: saldo, MotivoCastigo: motivo.trim(), FechaCastigo: ahora, CastigoUsuarioId: usuarioId, CastigoAutorizoId: autorizoId };
}
/** Reabrir: el castigo se deshace y el saldo vuelve a ser deuda. */
export function reabrirFactura(f) {
  if (!f.Castigado) throw new Error('Esa factura no está castigada.');
  const { Castigado, MontoCastigado, MotivoCastigo, FechaCastigo, CastigoUsuarioId, CastigoAutorizoId, ...resto } = sinCalculados(f);
  return { ...resto, TotalPendienteFiado: MontoCastigado ?? 0, EstadoPago: 'FIADO' };
}
/** Pérdida por incobrables castigada entre dos fechas (ms). */
export const perdidaIncobrables = (facturas, ini, fin) =>
  facturas.filter((f) => f.Castigado && f.FechaCastigo && new Date(f.FechaCastigo) >= ini && new Date(f.FechaCastigo) < fin).reduce((s, f) => s + (f.MontoCastigado ?? 0), 0);
