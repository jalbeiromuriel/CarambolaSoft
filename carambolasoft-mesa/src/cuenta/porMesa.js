// src/cuenta/porMesa.js — Ingresos por mesa: tiempo (plata de la mesa), consumo servido, horas jugadas y ocupación.
// Funciones puras. Una venta dividida cuenta una sola vez, en la mesa de la factura principal.
import { msCobrables } from './tiempo.js';

export const HORAS_ATENCION = 10;   // horas de atención por día (para la ocupación); configurable en META negocio.horasAtencion
const H = 3600000;

/** `facturas` ya filtradas (vigentes y en el rango). Devuelve { filas, totales, masRentable, menosUsada }. */
export function ingresosPorMesa({ facturas = [], cuentas = [], mesas = [], dias = 1, horasAtencion = HORAS_ATENCION }) {
  const cuenta = new Map(cuentas.map((c) => [c.Id, c]));
  const factura = new Map(facturas.map((f) => [f.Id, f]));
  const mesa = new Map(mesas.map((m) => [m.Id, m]));
  const filas = new Map();
  const fila = (clave, nombre, tipo) => { if (!filas.has(clave)) filas.set(clave, { clave, nombre, tipo, tiempo: 0, consumo: 0, ms: 0, cuentas: 0, esMesa: clave !== 'garita' && clave !== 'sin' }); return filas.get(clave); };

  for (const f of facturas) {
    const principal = f.DivisionDeFacturaId ? (factura.get(f.DivisionDeFacturaId) ?? f) : f;
    const c = cuenta.get(principal.CuentaId);
    let r;
    if (c?.TipoCuenta === 'GARITA') r = fila('garita', '🚧 Garita', 'reloj');
    else if (c?.MesaId) { const m = mesa.get(c.MesaId); r = fila(c.MesaId, `🎱 Billar ${m?.Numero ?? '?'}`, m?.Tipo ?? ''); r.numero = m?.Numero ?? 999; }
    else r = fila('sin', 'Sin mesa · barra e histórico', '');
    r.tiempo += f.SubtotalTiempo ?? 0;
    r.consumo += (f.SubtotalLicor ?? 0) + (f.SubtotalSnacks ?? 0) + (f.SubtotalOtros ?? 0);
    if (f.DivisionDeFacturaId) continue;   // las horas y cuentas se cuentan en la factura principal
    for (const id of [f.CuentaId, ...(f.CuentasIncluidas ?? [])]) { const x = cuenta.get(id); if (x) { r.cuentas++; if (r.esMesa) r.ms += msCobrables(x); } }
  }

  const disponibles = Math.max(1, dias) * horasAtencion * H;
  const lista = [...filas.values()].map((r) => ({ ...r, total: r.tiempo + r.consumo, horas: r.ms / H, ocupacion: r.esMesa ? Math.min(100, (r.ms / disponibles) * 100) : null, porHora: r.esMesa && r.ms > 0 ? (r.tiempo + r.consumo) / (r.ms / H) : null }))
    .sort((a, b) => (a.esMesa === b.esMesa ? (a.numero ?? 0) - (b.numero ?? 0) : a.esMesa ? -1 : 1));
  const mesasR = lista.filter((r) => r.esMesa);
  const horasT = mesasR.reduce((t, r) => t + r.horas, 0), tiempoT = mesasR.reduce((t, r) => t + r.tiempo, 0), consT = mesasR.reduce((t, r) => t + r.consumo, 0);
  const conUso = mesasR.filter((r) => r.porHora);
  return {
    filas: lista,
    totales: { tiempo: lista.reduce((t, r) => t + r.tiempo, 0), consumo: lista.reduce((t, r) => t + r.consumo, 0), total: lista.reduce((t, r) => t + r.total, 0), horas: horasT, cuentas: lista.reduce((t, r) => t + r.cuentas, 0),
      tiempoMesas: tiempoT, consumoMesas: consT, ocupacion: mesasR.length ? mesasR.reduce((t, r) => t + r.ocupacion, 0) / mesasR.length : 0, porHora: horasT > 0 ? (tiempoT + consT) / horasT : null },
    masRentable: conUso.length ? conUso.reduce((a, b) => (b.porHora > a.porHora ? b : a)) : null,
    menosUsada: mesasR.length > 1 ? mesasR.reduce((a, b) => (b.ocupacion < a.ocupacion ? b : a)) : null,
  };
}
