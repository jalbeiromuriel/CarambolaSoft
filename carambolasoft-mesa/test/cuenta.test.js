import { test } from 'node:test';
import assert from 'node:assert/strict';
import { msJugados, cobroTiempo, iniciarChico, terminarChico, estaCorriendo, msChicoActual } from '../src/cuenta/tiempo.js';
import { categoriaDe, filtrar, masVendidos, loDeSiempre, resumenPorCategoria, categoriasVisibles } from '../src/cuenta/catalogo.js';

const T0 = Date.parse('2026-10-07T20:00:00Z');
const min = (n) => n * 60000;
const nueva = { Estado: 'ABIERTA', TarifaPorHora: 6000, HoraApertura: new Date(T0).toISOString(), MsAcumulados: 0, InicioChico: null };

test('chico: no corre hasta INICIAR y suma los chicos terminados', () => {
  assert.equal(estaCorriendo(nueva), false);
  assert.equal(cobroTiempo(nueva, T0 + min(30)), 0);
  let c = iniciarChico(nueva, T0);
  assert.equal(estaCorriendo(c), true);
  assert.equal(msChicoActual(c, T0 + min(20)), min(20));
  c = terminarChico(c, T0 + min(20));
  assert.equal(c.MsAcumulados, min(20));
  assert.equal(cobroTiempo(c, T0 + min(90)), 2000);      // detenido: sigue en 20 min
  c = iniciarChico(c, T0 + min(40));
  assert.equal(msJugados(c, T0 + min(55)), min(35));       // 20 + 15
  assert.equal(cobroTiempo(c, T0 + min(55)), 3500);
});

test('tiempo: minutos hacia arriba y sin tarifa no cobra', () => {
  const c = iniciarChico(nueva, T0);
  assert.equal(cobroTiempo(c, T0 + 1000), 100);            // 1 s = 1 min cobrable
  assert.equal(cobroTiempo({ ...nueva, TarifaPorHora: null }, T0 + min(60)), 0);
});

test('cuenta vieja (sin MsAcumulados) corre desde la apertura y se puede terminar', () => {
  const vieja = { Estado: 'ABIERTA', TarifaPorHora: 6000, HoraApertura: new Date(T0).toISOString() };
  assert.equal(estaCorriendo(vieja), true);
  assert.equal(cobroTiempo(vieja, T0 + min(60)), 6000);
  assert.equal(terminarChico(vieja, T0 + min(30)).MsAcumulados, min(30));
});

test('categoría: nombre de CATEGORIAS manda, si no el enum', () => {
  assert.equal(categoriaDe({ CategoriaId: 'x' }, [{ Id: 'x', Nombre: 'Bebidas calientes' }]).emoji, '☕');
  assert.equal(categoriaDe({ CategoriaConsumo: 'BEBIDAS_ALCOHOLICAS' }).emoji, '🍺');
  assert.equal(categoriaDe({ CategoriaConsumo: 'SNACKS' }).emoji, '🍿');
  assert.equal(categoriaDe({ CategoriaConsumo: 'ZZZ' }).clave, 'otros');
});

test('búsqueda sin tildes ni mayúsculas', () => {
  const ps = [{ Nombre: 'Aromática' }, { Nombre: 'Tinto' }];
  assert.deepEqual(filtrar(ps, 'AROMATICA'), [ps[0]]);
  assert.equal(filtrar(ps, '').length, 2);
});

test('más vendidos y lo de siempre', () => {
  const ped = [
    { CuentaId: 'a', ProductoId: 'p1', Cantidad: 3, EstadoPedido: 'ENTREGADO' },
    { CuentaId: 'b', ProductoId: 'p1', Cantidad: 1, EstadoPedido: 'ENTREGADO' },
    { CuentaId: 'a', ProductoId: 'p2', Cantidad: 9, EstadoPedido: 'CANCELADO' },
    { CuentaId: 'b', ProductoId: 'p3', Cantidad: 2, EstadoPedido: 'ENTREGADO' },
  ];
  assert.deepEqual(masVendidos(ped), ['p1', 'p3']);
  const cuentas = [{ Id: 'a', ClienteId: 'k' }, { Id: 'b', ClienteId: 'k' }, { Id: 'c', ClienteId: 'k' }];
  assert.deepEqual(loDeSiempre(ped, cuentas, 'k', 'c'), ['p1', 'p3']);
  assert.deepEqual(loDeSiempre(ped, cuentas, null, 'c'), []);
});

test('resumen por categoría suma por grupo', () => {
  const prods = [{ Id: 'p1', CategoriaConsumo: 'SNACKS' }];
  const r = resumenPorCategoria([{ ProductoId: 'p1', PrecioUnitarioHist: 3000, Cantidad: 2 }], prods, []);
  assert.equal(r[0].total, 6000);
});

test('chips: las 7 categorías del POS siempre, más las extra', () => {
  assert.deepEqual(categoriasVisibles([]).map((c) => c.nombre),
    ['Licores', 'Snacks', 'Bebidas frías', 'Bebidas calientes', 'Cigarrillos', 'Juegos', 'Granizados']);
  assert.equal(categoriasVisibles([{ CategoriaConsumo: 'OTROS' }]).at(-1).clave, 'otros');
});

test('grupos: cuentas de una misma mesa quedan juntas, las viejas solas', async () => {
  const { agrupar, grupoDe } = await import('../src/cuenta/grupos.js');
  const cs = [
    { Id: 'a', GrupoMesaId: 'g', HoraApertura: '2026-10-07T20:00:00Z' },
    { Id: 'b', MesaId: 'm1', HoraApertura: '2026-10-07T20:01:00Z' },
    { Id: 'c', GrupoMesaId: 'g', HoraApertura: '2026-10-07T20:02:00Z' },
    { Id: 'd', HoraApertura: '2026-10-07T20:03:00Z' },
  ];
  assert.deepEqual(agrupar(cs).map((g) => g.map((c) => c.Id)), [['a', 'c'], ['b'], ['d']]);
  assert.equal(grupoDe(cs[3]), 'd');
});

test('cobro: efectivo con devuelta, exacto y pago insuficiente', async () => {
  const { planCobro } = await import('../src/cuenta/cobro.js');
  const base = { total: 15000, mixto: false, metodo: 'EFECTIVO', tieneCliente: false };
  assert.equal(planCobro({ ...base, pago: 20000 }).devolver, 5000);
  assert.equal(planCobro({ ...base, pago: 0 }).devolver, null);           // sin digitar = exacto
  assert.match(planCobro({ ...base, pago: 10000 }).error, /insuficiente/);
  assert.equal(planCobro({ ...base, metodo: 'NEQUI' }).devolver, null);   // solo efectivo da devuelta
});

test('cobro: fiado exige cliente; dos métodos reparten y piden métodos distintos', async () => {
  const { planCobro } = await import('../src/cuenta/cobro.js');
  assert.match(planCobro({ total: 8000, mixto: false, metodo: 'FIADO', tieneCliente: false }).error, /cliente/);
  assert.equal(planCobro({ total: 8000, mixto: false, metodo: 'FIADO', tieneCliente: true }).pendienteFiado, 8000);
  const mx = { total: 15000, mixto: true, metodo1: 'EFECTIVO', metodo2: 'FIADO', monto1: 10000, tieneCliente: true };
  const r = planCobro(mx);
  assert.deepEqual([r.m1, r.m2, r.pendienteFiado], [10000, 5000, 5000]);
  assert.match(planCobro({ ...mx, metodo2: 'EFECTIVO' }).error, /distintos/);
  assert.match(planCobro({ ...mx, monto1: 15000 }).error, /menor al total/);
  assert.match(planCobro({ ...mx, tieneCliente: false }).error, /cliente/);
});

// ── Garita
import { nuevoReloj, estadoReloj, avanzarReloj, marcadaPorDefecto, mmss, HORA_MS } from '../src/cuenta/garita.js';
import { grupoDe as grupoG } from '../src/cuenta/grupos.js';
test('garita: aviso a los 55 min y avance de hora', () => {
  const t0 = Date.parse('2026-10-07T20:00:00Z');
  const r = nuevoReloj(t0);
  assert.equal(estadoReloj(r, t0 + 54 * 60000).enAviso, false);
  assert.equal(estadoReloj(r, t0 + 55 * 60000).enAviso, true);
  const r2 = avanzarReloj(r);
  assert.equal(r2.Cobros, 2);
  assert.equal(estadoReloj(r2, t0 + 56 * 60000).enAviso, false);
  assert.equal(estadoReloj(r2, t0 + 115 * 60000).enAviso, true);
  assert.equal(estadoReloj(r, t0 + HORA_MS / 2).transcurrido, 30 * 60000);
});
test('garita: llegados recién no se marcan; mmss; grupo por reloj', () => {
  const t0 = Date.parse('2026-10-07T20:00:00Z');
  assert.equal(marcadaPorDefecto({ HoraApertura: new Date(t0 - 5 * 60000).toISOString() }, t0), false);
  assert.equal(marcadaPorDefecto({ HoraApertura: new Date(t0 - 20 * 60000).toISOString() }, t0), true);
  assert.equal(mmss(30 * 60000 + 52000), '30:52');
  assert.equal(grupoG({ Id: 'a', GaritaRelojId: 'g' }), 'g');
});

// ── Usuarios y PIN
import { hashPin, pinValido, conFallo, conAcierto, estaBloqueado, codigoRescate, normCodigo, seccionVisible, esAdmin, MAX_INTENTOS } from '../src/cuenta/auth.js';
test('auth: PIN válido y hash con sal', async () => {
  assert.ok(pinValido('1234') && pinValido('123456'));
  assert.ok(!pinValido('12') && !pinValido('12a4') && !pinValido('1234567'));
  assert.notEqual(await hashPin('1234', 'a'), await hashPin('1234', 'b'));
  assert.equal(await hashPin('1234', 'a'), await hashPin('1234', 'a'));
});
test('auth: 5 fallos bloquean y un acierto limpia', () => {
  let u = { Intentos: 0 }; const t = Date.parse('2026-10-07T22:00:00Z');
  for (let i = 0; i < MAX_INTENTOS - 1; i++) u = conFallo(u, t);
  assert.equal(estaBloqueado(u, t), false);
  u = conFallo(u, t);
  assert.equal(estaBloqueado(u, t + 60000), true);
  assert.equal(estaBloqueado(u, t + 6 * 60000), false);
  assert.equal(conAcierto(u).Intentos, 0);
});
test('auth: rescate y secciones por rol', () => {
  assert.match(codigoRescate(), /^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
  assert.equal(normCodigo('abcd-efgh-jklm'), 'ABCDEFGHJKLM');
  assert.ok(seccionVisible('caja', 'ADMIN') && seccionVisible('adm', 'PATRONA'));
  assert.ok(seccionVisible('panel', 'EMPLEADO') && seccionVisible('clientes', 'EMPLEADO'));
  assert.ok(!seccionVisible('caja', 'EMPLEADO') && !seccionVisible('adm', 'EMPLEADO'));
  assert.ok(esAdmin('PATRONA') && !esAdmin('EMPLEADO'));
});

import { estadoInactividad, INACTIVIDAD_MS } from '../src/cuenta/auth.js';
test('auth: inactividad avisa 30 s antes y cierra a los 10 min', () => {
  const t = 1_000_000;
  assert.equal(estadoInactividad(t, t + 60000), 'activa');
  assert.equal(estadoInactividad(t, t + INACTIVIDAD_MS - 20000), 'aviso');
  assert.equal(estadoInactividad(t, t + INACTIVIDAD_MS), 'cerrar');
});

import { repartirAbono, antiguedad, siguienteNumero, etiquetaFactura } from '../src/cuenta/fiados.js';
test('fiados: el abono salda primero la factura más antigua', () => {
  const fs = [{ Id: 'b', FechaHora: '2026-10-05T10:00:00Z', saldo: 18000 }, { Id: 'a', FechaHora: '2026-10-01T10:00:00Z', saldo: 20000 }];
  const r = repartirAbono(fs, 25000);
  assert.deepEqual(r.aplicaciones, [{ facturaId: 'a', aplicado: 20000, saldo: 0 }, { facturaId: 'b', aplicado: 5000, saldo: 13000 }]);
  assert.equal(r.sobrante, 0);
  assert.equal(repartirAbono(fs, 50000).sobrante, 12000);
  assert.deepEqual(repartirAbono(fs, 15000).aplicaciones, [{ facturaId: 'a', aplicado: 15000, saldo: 5000 }]);
});
test('fiados: antigüedad y numeración', () => {
  const ahora = Date.parse('2026-10-20T12:00:00Z');
  assert.equal(antiguedad('2026-10-20T08:00:00Z', ahora).clase, 'v');
  assert.equal(antiguedad('2026-10-11T08:00:00Z', ahora).clase, 'a');
  assert.equal(antiguedad('2026-10-01T08:00:00Z', ahora).texto, 'hace 19 días');
  assert.equal(antiguedad('2026-10-01T08:00:00Z', ahora).clase, 'r');
  assert.equal(siguienteNumero([{ Numero: 'F-0003' }, { Numero: 'F-0007' }, {}]), 8);
  assert.equal(etiquetaFactura(8), 'F-0008');
});

// ── Inventario (Fase 3)
import * as inv from '../src/cuenta/inventario.js';
test('margen y precio para margen', () => {
  assert.equal(Math.round(inv.margenPct(4000, 2367)), 41);
  assert.equal(inv.precioParaMargen(3000, 40), 5000);
  assert.equal(inv.precioParaMargen(0, 40), null);
  assert.equal(inv.precioParaMargen(3000, 95), null);
  assert.equal(inv.nivelMargen(41), 'ok'); assert.equal(inv.nivelMargen(33), 'medio'); assert.equal(inv.nivelMargen(25), 'bajo');
});
test('simulador: incremento hasta 500 %', () => {
  assert.equal(inv.precioConIncremento(4000, 40), 5600);
  assert.equal(inv.precioConIncremento(4000, 500), 24000);
  assert.equal(inv.precioConIncremento(4000, 900), 24000);
  assert.equal(inv.incrementoDe(4000, 5600), 40);
  const s = inv.simular({ costo: 2367, precio: 5600, unidades: 30 });
  assert.equal(s.gana, 3233); assert.equal(s.mes, 96990); assert.equal(Math.round(s.margen), 58);
});
test('reabastecer: alerta y sugerido', () => {
  const r = inv.compararCompra({ precio: 5000, costoAntes: 3100, costoNuevo: 3400 });
  assert.equal(r.bajo, true); assert.equal(r.sugerido, 5700); assert.equal(Math.round(r.despues.margen), 32);
  assert.equal(inv.compararCompra({ precio: 5000, costoAntes: 3100, costoNuevo: 2900 }).bajo, false);
});
test('productos bajo margen: ordenados y sin garita', () => {
  const l = inv.productosBajoMargen([{ PrecioVenta: 4000, CostoCompra: 2500 }, { PrecioVenta: 5000, CostoCompra: 4000 }, { PrecioVenta: 1000, CostoCompra: 0, ControlaStock: false }, { PrecioVenta: 5000, CostoCompra: 2500 }]);
  assert.equal(l.length, 2); assert.equal(l[0].p.CostoCompra, 4000);
});
test('promo: fechas y franja horaria (cruza medianoche)', () => {
  const p = { PrecioVenta: 4000, Promo: { Precio: 3000, Ini: '2026-10-01', Fin: '2026-10-31', HoraIni: '14:00', HoraFin: '17:00' } };
  assert.equal(inv.precioVigente(p, new Date(2026, 9, 8, 15, 0)), 3000);
  assert.equal(inv.precioVigente(p, new Date(2026, 9, 8, 18, 0)), 4000);
  assert.equal(inv.promoEstado(p.Promo, new Date(2026, 10, 2, 15, 0)), 'VENCIDA');
  assert.equal(inv.promoEstado(p.Promo, new Date(2026, 8, 20, 15, 0)), 'FUTURA');
  const n = { Precio: 3000, Ini: '2026-10-01', Fin: '2026-10-31', HoraIni: '22:00', HoraFin: '02:00' };
  assert.equal(inv.promoEstado(n, new Date(2026, 9, 8, 1, 0)), 'ACTIVA');
  assert.equal(inv.validarPromo({ Precio: 0 }), 'Escribe el precio promocional');
  assert.equal(inv.descuentoPct(4000, 3000), 25);
});

test('fraccionados: abre envase solo cuando faltan sueltas', () => {
  const botella = { Id: 'B', StockActual: 3 };
  const copa = { Id: 'C', StockActual: 1, Fraccion: { OrigenId: 'B', Rinde: 12 } };
  assert.equal(inv.disponible(copa, botella), 37);
  assert.equal(inv.textoStock(copa, botella), '1 sueltas · 3 env.');
  const r1 = inv.descargar(copa, botella, 1);
  assert.equal(r1.prod.StockActual, 0); assert.equal(r1.abiertos, 0); assert.equal(r1.origen, null);
  const r2 = inv.descargar({ ...copa, StockActual: 0 }, botella, 1);
  assert.equal(r2.prod.StockActual, 11); assert.equal(r2.origen.StockActual, 2); assert.equal(r2.abiertos, 1);
  assert.equal(inv.descargar({ ...copa, StockActual: 0 }, { StockActual: 0 }, 1), null);
  assert.equal(inv.descargar({ ...copa, StockActual: 0 }, botella, 40), null);
  const a = inv.abrirEnvase(copa, botella); assert.equal(a.prod.StockActual, 13); assert.equal(a.origen.StockActual, 2);
  assert.equal(inv.abrirEnvase(copa, { StockActual: 0 }), null);
  assert.equal(inv.descargar({ StockActual: 2 }, null, 3), null);
});
