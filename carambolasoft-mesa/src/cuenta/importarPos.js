// src/cuenta/importarPos.js — Importa desde el backup del POS (MeroParche_backup_*.json): inventario, clientes y fiados pendientes.
// Funciones puras: arman un PLAN (con vista previa); importarPosDb.js lo aplica. No se importan ventas, cierres, gastos, máquinas ni datos de pago.
import { norm } from './catalogo.js';

const hoyIso = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const OMITIR_NOMBRE = (p) => !!(p.oculto || p.tiempo);

/** "11:26 p. m." / "9:05 a. m." / "21:05" → "HH:MM:00" (24 h). */
export function hora24(txt) {
  const m = String(txt ?? '').match(/(\d{1,2}):(\d{2})\s*([ap])?/i);
  if (!m) return '12:00:00';
  let h = Number(m[1]); const pm = (m[3] ?? '').toLowerCase();
  if (pm === 'p' && h < 12) h += 12; if (pm === 'a' && h === 12) h = 0;
  return `${String(h).padStart(2, '0')}:${m[2]}:00`;
}
const fechaIso = (v, hFallback) => { const f = v.fecha || hFallback || hoyIso(); return new Date(`${f}T${hora24(v.hora)}`).toISOString(); };

/** Valor original de un fiado (antes de abonos): totalOrig, o la suma de sus productos si es mayor al saldo (fiados viejos). */
export function infoFiado(v) {
  let orig = v.totalOrig;
  if (orig == null) { const is = (v.items ?? []).reduce((t, i) => t + (i.pr ?? 0) * (i.q ?? 0), 0); orig = is > (v.total ?? 0) + 1 ? Math.round(is) : v.total; }
  const saldo = v.total ?? 0;
  return { orig: Math.max(orig, saldo), saldo, abon: Math.max(0, orig - saldo) };
}

export function validarBackup(b) {
  if (!b || typeof b !== 'object' || !Array.isArray(b.productos) || !Array.isArray(b.clientes)) return 'No parece un backup del POS (faltan productos o clientes).';
  return '';
}

/**
 * Plan de importación. `existentes` = { productos, clientes, facturas } de CarambolaSoft.
 * Productos y clientes se comparan por nombre (sin tildes ni mayúsculas); los fiados por OrigenPosId (no se duplican al reimportar).
 */
export function planImportacion(b, { productos = [], clientes = [], facturas = [] } = {}, hoy = hoyIso()) {
  const prodPorNombre = new Map(productos.map((p) => [norm(p.Nombre).trim(), p]));
  const omitidos = [], prods = [];
  for (const p of b.productos) {
    if (!p?.n || OMITIR_NOMBRE(p)) { if (p?.n) omitidos.push(p.n); continue; }
    const promoVigente = p.promo && p.promo.fin >= hoy;
    const ex = prodPorNombre.get(norm(p.n).trim()) ?? null;
    prods.push({
      pos: p.id, existenteId: ex?.Id ?? null, catNombre: p.cat, fracOrigenPos: p.frac?.origen ?? null,
      datos: {
        Nombre: p.n.trim(), PrecioVenta: p.p ?? 0, CostoCompra: p.c ?? 0, StockActual: p.s ?? 0, StockMinimo: p.sm ?? 0,
        Favorito: !!p.fav, ControlaStock: !p.finito, Activo: true, Codigo: p.id,
        Promo: promoVigente ? { Precio: p.promo.p, Ini: p.promo.ini, Fin: p.promo.fin, HoraIni: p.promo.horaIni ?? null, HoraFin: p.promo.horaFin ?? null } : null,
        ...(p.frac ? { Fraccion: { OrigenId: null, Rinde: p.frac.rinde } } : {}),
      },
    });
  }

  // Clientes: los repetidos por nombre se unen en uno (los ids sobrantes apuntan al que se queda)
  const cliPorNombre = new Map(clientes.filter((c) => c.Activo !== false).map((c) => [norm(c.Nombre).trim(), c]));
  const vistos = new Map(), cli = [], unidos = [];
  for (const c of b.clientes) {
    if (!c?.n) continue;
    const k = norm(c.n).trim();
    if (vistos.has(k)) { vistos.get(k).alias.push(c.id); unidos.push(c.n); continue; }
    const ex = cliPorNombre.get(k) ?? null;
    const fila = { pos: c.id, alias: [], existenteId: ex?.Id ?? null, datos: { Nombre: c.n.trim(), Apodo: c.ap && c.ap !== c.n ? c.ap : '', Visitas: c.vis ?? 0 } };
    vistos.set(k, fila); cli.push(fila);
  }
  const clientePosPorId = new Map(); for (const f of cli) { clientePosPorId.set(f.pos, f); f.alias.forEach((a) => clientePosPorId.set(a, f)); }
  const clientePosPorNombre = new Map(cli.map((f) => [norm(f.datos.Nombre).trim(), f]));

  // Fiados pendientes (en curso + historial de cierres), uno por factura
  const ya = new Set(facturas.map((f) => f.OrigenPosId).filter(Boolean));
  const todas = [...(b.ventas ?? []).map((v) => ({ v, f: v.fecha })), ...(b.historial ?? []).flatMap((h) => (h.ventas ?? []).map((v) => ({ v, f: v.fecha || h.fecha })))];
  const fiados = [], sinCliente = [];
  for (const { v, f } of todas) {
    if (v.metodo !== 'Fiado' || v.pagado || v.esPagoFiado || v.anulado) continue;
    if (ya.has(v.id)) continue;
    const cl = clientePosPorId.get(v.cliId) ?? clientePosPorNombre.get(norm(v.cuenta ?? '').trim());
    if (!cl) { sinCliente.push(v.cuenta ?? '(sin nombre)'); continue; }
    const i = infoFiado(v);
    fiados.push({ posId: v.id, clientePos: cl.pos, nombreCuenta: v.cuenta || cl.datos.Nombre, numero: v.factura ?? null, fechaHora: fechaIso(v, f), mesa: v.mesa ?? '', ...i,
      items: (v.items ?? []).filter((x) => x.n && !String(x.n).startsWith('Fiado pendiente')).map((x) => ({ nombre: x.n, cant: x.q ?? 1, precio: x.pr ?? 0 })) });
  }
  const ultimoNumero = Math.max(0, ...b.historial?.flatMap?.((h) => (h.ventas ?? []).map((v) => Number(String(v.factura ?? '').replace(/\D/g, '')) || 0)) ?? [0], ...(b.ventas ?? []).map((v) => Number(String(v.factura ?? '').replace(/\D/g, '')) || 0), (b.nextFactura ?? 1) - 1);

  const clientesConFiado = new Set(fiados.map((x) => x.clientePos));
  return {
    productos: prods, omitidos, clientes: cli, fiados, ultimoNumero,
    resumen: {
      productos: prods.length, productosNuevos: prods.filter((p) => !p.existenteId).length, productosActualizan: prods.filter((p) => p.existenteId).length, omitidos: omitidos.length,
      clientes: cli.length, clientesUnidos: unidos.length, unidos,
      fiados: fiados.length, fiadoTotal: fiados.reduce((t, x) => t + x.saldo, 0), fiadoClientes: clientesConFiado.size, fiadosYaImportados: 0, sinCliente,
    },
  };
}
