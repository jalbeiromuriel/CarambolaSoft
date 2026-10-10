// src/cuenta/estadisticas.js — Tablero de estadísticas (funciones puras, sin pantalla). Solo Admin.
import { partesFactura } from './caja.js';
import { informeDia } from '../informes/datos.js';
import { productosBajoMargen, MARGEN_OBJETIVO } from './inventario.js';
import { saldoFondo, deudaCaja, BASE_FONDO } from './maquinas.js';
import { perdidaIncobrables } from './fiados.js';

export const PERIODOS = [['hoy', 'Hoy'], ['semana', 'Semana'], ['quincena', 'Quincena'], ['mes', 'Mes'], ['rango', '📅 Rango']];
export const BINS_HORA = ['4p', '6p', '8p', '10p', '12a', '2a'];   // franjas de 2 h desde las 4 p. m. hasta las 4 a. m.
const DIA = 86400000;
const inicioDia = (ms) => { const d = new Date(ms); d.setHours(0, 0, 0, 0); return d.getTime(); };
const fechaDe = (x) => new Date(x.FechaHora ?? x.UltimaModificacion ?? 0).getTime();

/** Rango [ini, fin) del periodo y el periodo anterior de igual largo (para comparar). Semana/quincena/mes = últimos 7/15/30 días. */
export function rangoPeriodo(filtro, { ahora = Date.now(), desde = '', hasta = '' } = {}) {
  const hoy0 = inicioDia(ahora); let ini = hoy0, fin = hoy0 + DIA;
  if (filtro === 'semana') ini = hoy0 - 6 * DIA;
  else if (filtro === 'quincena') ini = hoy0 - 14 * DIA;
  else if (filtro === 'mes') ini = hoy0 - 29 * DIA;
  else if (filtro === 'rango') {
    ini = desde ? new Date(`${desde}T00:00:00`).getTime() : hoy0 - 29 * DIA;
    fin = hasta ? new Date(`${hasta}T00:00:00`).getTime() + DIA : hoy0 + DIA;
  }
  const largo = Math.max(DIA, fin - ini);
  return { ini, fin, iniPrev: ini - largo, finPrev: ini };
}

const enRango = (x, ini, fin) => { const t = fechaDe(x); return t >= ini && t < fin; };
const vigentes = (facturas) => facturas.filter((f) => f.EstadoPago !== 'ANULADO' && !f.Migrado);   // los fiados importados del POS no son ventas nuevas
const suma = (l, f) => l.reduce((t, x) => t + f(x), 0);
const variacion = (act, prev) => (prev > 0 ? ((act - prev) / prev) * 100 : null);   // null = sin periodo anterior con qué comparar

function resumenPeriodo({ facturas, pedidos, productos, gastos }, ini, fin) {
  const f = vigentes(facturas).filter((x) => enRango(x, ini, fin));
  const g = gastos.filter((x) => enRango(x, ini, fin));
  const inf = informeDia({ facturas: f, pedidos, productos });
  const vendido = suma(f, (x) => x.TotalPagar ?? 0);
  return { facturas: f, vendido, ganancia: inf.ganancia, gastos: suma(g, (x) => x.Monto ?? 0), inf, nVentas: f.length };
}

/** Todo el tablero listo para pintar. `fiados` = lista de cargarFiados() ({ cliente, deuda, facturas:[{saldo, FechaHora}] }). */
export function estadisticas({ facturas = [], pedidos = [], productos = [], gastos = [], cuentas = [], fiados = [], maq = [], baseFondo = BASE_FONDO, cierres = [], objetivo = MARGEN_OBJETIVO, filtro = 'mes', desde = '', hasta = '', ahora = Date.now() }) {
  const r = rangoPeriodo(filtro, { ahora, desde, hasta });
  const act = resumenPeriodo({ facturas, pedidos, productos, gastos }, r.ini, r.fin);
  const prev = resumenPeriodo({ facturas, pedidos, productos, gastos }, r.iniPrev, r.finPrev);
  const dias = Math.round((r.fin - r.ini) / DIA);

  // Fiados: por cobrar y antigüedad del saldo
  const filas = fiados.flatMap((g) => g.facturas.map((f) => ({ cliente: g.cliente?.Nombre ?? '—', saldo: f.saldo ?? 0, dias: Math.floor((ahora - fechaDe(f)) / DIA) })));
  const cubo = (a, b) => suma(filas.filter((x) => x.dias >= a && x.dias <= b), (x) => x.saldo);
  const porCobrar = suma(filas, (x) => x.saldo);
  const deudores = fiados.map((g) => ({ nombre: g.cliente?.Nombre ?? '—', deuda: g.deuda, masVieja: Math.max(0, ...g.facturas.map((f) => Math.floor((ahora - fechaDe(f)) / DIA))) })).sort((a, b) => b.deuda - a.deuda);

  // Ventas por día (máx. 31 barras: lo último del periodo)
  const nBarras = Math.min(dias, 31), porDia = [];
  for (let i = nBarras - 1; i >= 0; i--) {
    const d0 = inicioDia(r.fin - 1) - i * DIA;
    porDia.push({ fecha: d0, total: suma(act.facturas.filter((f) => enRango(f, d0, d0 + DIA)), (f) => f.TotalPagar ?? 0) });
  }

  // Mapa de calor día de la semana (lun=0) × franja de 2 h desde las 4 p. m.
  const calor = Array.from({ length: 7 }, () => Array(BINS_HORA.length).fill(0));
  for (const f of act.facturas) {
    const d = new Date(fechaDe(f)); const bin = Math.floor(((d.getHours() - 16 + 24) % 24) / 2);
    if (bin < BINS_HORA.length) calor[(d.getDay() + 6) % 7][bin] += f.TotalPagar ?? 0;
  }

  // Origen de la plata
  const garitas = new Set(cuentas.filter((c) => c.TipoCuenta === 'GARITA').map((c) => c.Id));
  const esGarita = (f) => garitas.has(f.CuentaId);
  const origen = {
    tiempo: suma(act.facturas, (f) => f.SubtotalTiempo ?? 0),
    licor: suma(act.facturas, (f) => f.SubtotalLicor ?? 0),
    snacks: suma(act.facturas.filter((f) => !esGarita(f)), (f) => (f.SubtotalSnacks ?? 0) + (f.SubtotalOtros ?? 0)),
    garita: suma(act.facturas.filter(esGarita), (f) => (f.SubtotalSnacks ?? 0) + (f.SubtotalOtros ?? 0) + (f.SubtotalLicor ?? 0) + (f.SubtotalTiempo ?? 0)),
  };
  if (origen.garita) { origen.licor -= suma(act.facturas.filter(esGarita), (f) => f.SubtotalLicor ?? 0); origen.tiempo -= suma(act.facturas.filter(esGarita), (f) => f.SubtotalTiempo ?? 0); }

  // Métodos de pago (lo cobrado al vender; el fiado va aparte)
  const metodos = {};
  for (const f of act.facturas) for (const p of partesFactura(f)) metodos[p.metodo] = (metodos[p.metodo] ?? 0) + (p.monto ?? 0);

  const top = act.inf.filas.filter((x) => x.nombre !== 'Tiempo de mesa' && x.ingresos > 0)
    .map((x) => ({ ...x, margen: (x.ganancia / x.ingresos) * 100 })).sort((a, b) => b.ganancia - a.ganancia).slice(0, 5);

  // Alertas
  const alertas = [];
  const bajos = productosBajoMargen(productos, objetivo);
  if (bajos.length) alertas.push({ tipo: 'margen', texto: `Margen bajo el objetivo (${objetivo} %): ${bajos.slice(0, 3).map((x) => `${x.p.Nombre} ${Math.round(x.margen)} %`).join(', ')}${bajos.length > 3 ? ` y ${bajos.length - 3} más` : ''}` });
  const viejos = deudores.filter((d) => d.masVieja > 30);
  if (viejos.length) alertas.push({ tipo: 'fiado', texto: `Fiados de más de 30 días: ${viejos.slice(0, 3).map((d) => `${d.nombre} ${d.masVieja} d`).join(', ')}${viejos.length > 3 ? ` y ${viejos.length - 3} más` : ''}` });
  const saldo = saldoFondo(maq, baseFondo), deuda = deudaCaja(maq);
  if (deuda > 0 || saldo < baseFondo * 0.25) alertas.push({ tipo: 'fondo', texto: `Fondo de máquinas en ${Math.round(saldo).toLocaleString('es-CO')}${deuda > 0 ? ` · debe a la caja ${Math.round(deuda).toLocaleString('es-CO')}` : ''}`, saldo, deuda });
  const desc = cierres.filter((c) => c.Confirmado && (c.Descuadre ?? 0) !== 0 && ahora - new Date(c.FechaCierre ?? c.Fecha).getTime() <= 7 * DIA);
  if (desc.length >= 2) alertas.push({ tipo: 'descuadre', texto: `${desc.length} descuadres de caja en los últimos 7 días` });

  return {
    rango: r, dias,
    kpi: {
      vendido: act.vendido, vVendido: variacion(act.vendido, prev.vendido),
      ganancia: act.ganancia, vGanancia: variacion(act.ganancia, prev.ganancia), margen: act.vendido > 0 ? (act.ganancia / act.vendido) * 100 : 0,
      gastos: act.gastos, vGastos: variacion(act.gastos, prev.gastos),
      porCobrar, incobrables: perdidaIncobrables(facturas, r.ini, r.fin), nDeudores: fiados.length, nViejos: viejos.length, nVentas: act.nVentas,
    },
    porDia, calor, origen, metodos, top, alertas, deudores: deudores.slice(0, 5),
    fiadosEdad: { reciente: cubo(0, 7), medio: cubo(8, 30), viejo: cubo(31, Infinity) },
  };
}
