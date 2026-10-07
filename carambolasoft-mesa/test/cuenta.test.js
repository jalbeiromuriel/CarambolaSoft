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
