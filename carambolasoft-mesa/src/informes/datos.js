// src/informes/datos.js — Datos y textos de los informes (funciones puras, sin pantalla).
import { partesFactura, resumenTurno, arqueo } from '../cuenta/caja.js';
import { PRODUCTO_GARITA_ID } from '../cuenta/garita.js';

export const fmt = (n) => '$' + Math.round(n ?? 0).toLocaleString('es-CO');
const cuentasDe = (f) => new Set([f.CuentaId, ...(f.CuentasIncluidas ?? [])]);
const entregados = (pedidos) => pedidos.filter((p) => p.EstadoPedido === 'ENTREGADO');

/** Productos vendidos con ingresos, costo y ganancia (costo = el de compra al momento de vender). */
export function informeDia({ facturas = [], pedidos = [], productos = [] }) {
  const cuentas = new Set(facturas.flatMap((f) => [...cuentasDe(f)]));
  const nombre = new Map(productos.map((p) => [p.Id, p.Nombre]));
  const por = new Map();
  for (const p of entregados(pedidos)) {
    if (!cuentas.has(p.CuentaId) || p.CategoriaConsumo === 'TIEMPO') continue;
    const n = nombre.get(p.ProductoId) ?? p.Detalle;
    if (!n) continue;
    const f = por.get(n) ?? { nombre: n, cant: 0, ingresos: 0, costo: 0 };
    f.cant += p.Cantidad; f.ingresos += (p.PrecioUnitarioHist ?? 0) * p.Cantidad; f.costo += (p.CostoCompraHist ?? 0) * p.Cantidad;
    por.set(n, f);
  }
  const tiempo = facturas.reduce((t, f) => t + (f.SubtotalTiempo ?? 0), 0);
  if (tiempo > 0) por.set('Tiempo de mesa', { nombre: 'Tiempo de mesa', cant: 0, ingresos: tiempo, costo: 0 });
  const filas = [...por.values()].map((f) => ({ ...f, ganancia: f.ingresos - f.costo })).sort((a, b) => b.ingresos - a.ingresos || a.nombre.localeCompare(b.nombre, 'es'));
  const suma = (k) => filas.reduce((t, f) => t + f[k], 0);
  return { filas, ingresos: suma('ingresos'), costo: suma('costo'), ganancia: suma('ganancia') };
}

/** Agotados o bajo mínimo, de más a menos vendidos. Sugerido = vendido + mínimo − stock (mínimo 1). */
export function sugeridoPedido({ productos = [], vendidos = [] }) {
  const vend = new Map(vendidos.map((f) => [f.nombre, f.cant]));
  return productos
    .filter((p) => p.Activo !== false && p.ControlaStock !== false && !p.Fraccion && p.Id !== PRODUCTO_GARITA_ID)
    .map((p) => ({ nombre: p.Nombre, stock: p.StockActual ?? 0, minimo: p.StockMinimo ?? 0, vendido: vend.get(p.Nombre) ?? 0 }))
    .filter((f) => (f.stock <= 0 && f.vendido > 0) || (f.minimo > 0 && f.stock <= f.minimo))
    .map((f) => ({ ...f, sugerido: Math.max(1, Math.ceil(f.vendido + f.minimo - f.stock)) }))
    .sort((a, b) => b.vendido - a.vendido || a.nombre.localeCompare(b.nombre, 'es'));
}

/** Una caja por factura del turno: título, número, hora, método(s), total y sus productos. */
export function detalleVentas({ facturas = [], pedidos = [], productos = [], etiquetaDe }) {
  const nombre = new Map(productos.map((p) => [p.Id, p.Nombre]));
  return [...facturas].sort((a, b) => (a.FechaHora ?? '').localeCompare(b.FechaHora ?? '')).map((f) => {
    const cs = cuentasDe(f), items = new Map();
    for (const p of entregados(pedidos)) {
      if (!cs.has(p.CuentaId) || p.CategoriaConsumo === 'TIEMPO') continue;
      const n = nombre.get(p.ProductoId) ?? p.Detalle ?? 'Producto';
      const k = `${n}|${p.PrecioUnitarioHist}`;
      const it = items.get(k) ?? { nombre: n, cant: 0, unit: p.PrecioUnitarioHist ?? 0, subtotal: 0 };
      it.cant += p.Cantidad; it.subtotal += (p.PrecioUnitarioHist ?? 0) * p.Cantidad; items.set(k, it);
    }
    const lista = [...items.values()];
    if ((f.SubtotalTiempo ?? 0) > 0) lista.unshift({ nombre: 'Tiempo de mesa', cant: 1, unit: f.SubtotalTiempo, subtotal: f.SubtotalTiempo });
    return { id: f.Id, titulo: etiquetaDe(f), numero: f.Numero ?? '', fecha: f.FechaHora, metodos: partesFactura(f).map((p) => p.metodo), total: f.TotalPagar ?? 0, items: lista };
  });
}

/** Todo lo del cierre/turno listo para pintar: resumen, arqueo (si está sellado) y detalle. */
export function datosCierre({ facturas, abonos, gastos, pedidos, productos, etiquetaDe, cierre = null }) {
  const resumen = resumenTurno({ facturas, abonos, gastos });
  return {
    resumen, cierre, sellado: !!cierre,
    arqueo: cierre ? { esperado: cierre.EfectivoEsperado ?? resumen.efectivoEsperado, contado: cierre.EfectivoReportado, ...arqueo(cierre.EfectivoEsperado ?? resumen.efectivoEsperado, cierre.EfectivoReportado) } : null,
    detalle: detalleVentas({ facturas, pedidos, productos, etiquetaDe }),
    gastos: [...gastos].sort((a, b) => (a.FechaHora ?? '').localeCompare(b.FechaHora ?? '')),
  };
}

const METODO = { EFECTIVO: 'Efectivo', NEQUI: 'Nequi', DAVIPLATA: 'Daviplata', TARJETA: 'Bancolombia', TRANSFERENCIA: 'Transferencia', FIADO: 'Fiado' };
export const nombreMetodo = (m) => METODO[m] ?? m;

/** Texto para WhatsApp: resumen corto del cierre. */
export function textoCierre(d, fecha) {
  const r = d.resumen, l = [`*MERO PARCHE — ${d.sellado ? 'Cierre de caja' : 'Resumen del turno'}*`, fecha, ''];
  l.push(`Vendido: *${fmt(r.totalVendido)}* (${r.nVentas} ventas)`);
  for (const m of Object.keys(r.porMetodo)) if (r.porMetodo[m]) l.push(`• ${nombreMetodo(m)}: ${fmt(r.porMetodo[m])}`);
  if (r.totalCobros) l.push(`Cobros de fiado: +${fmt(r.totalCobros)}`);
  if (r.totalGastos) l.push(`Gastos: −${fmt(r.totalGastos)}`);
  l.push(`Efectivo esperado: *${fmt(r.efectivoEsperado)}*`);
  if (d.arqueo) l.push(`Contado: ${fmt(d.arqueo.contado)} · ${d.arqueo.estado === 'CUADRA' ? 'Cuadra ✓' : `${d.arqueo.estado === 'SOBRANTE' ? 'Sobrante' : 'Faltante'} ${fmt(Math.abs(d.arqueo.diferencia))}`}`);
  return l.join('\n');
}

/** Texto para WhatsApp: ganancia del día. */
export function textoInformeDia(i, fecha) {
  const l = [`*MERO PARCHE — Informe del día*`, fecha, '', `Ingresos: ${fmt(i.ingresos)}`, `Costo: ${fmt(i.costo)}`, `Ganancia: *${fmt(i.ganancia)}*`, '', 'Lo más vendido:'];
  for (const f of i.filas.slice(0, 5)) l.push(`• ${f.nombre}${f.cant ? ` ×${f.cant}` : ''}: ${fmt(f.ingresos)}`);
  return l.join('\n');
}

export const enlaceWhatsApp = (texto, telefono) => {
  const num = String(telefono ?? '').replace(/\D/g, '');
  const conPais = num.length === 10 ? '57' + num : num;   // celulares colombianos: 10 dígitos
  return `https://wa.me/${conPais}?text=${encodeURIComponent(texto)}`;
};
