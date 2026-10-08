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
