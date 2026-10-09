import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  estadisticas, componerSerie, planCorreccion, recordDeMarcas, rompeRecord, retoDelParche,
  ganadores, puedeAgregar, valorTiempo, minutosCobrables, hms, ranking,
} from '../src/marcador/logica.js';

const m = (id, v, extra = {}) => ({ Id: id, CarambolasEnMarca: v, Anulada: false, ...extra });

test('estadísticas: total, entradas, última, mejor y promedio (sin entradas en 0)', () => {
  const e = estadisticas([m('a', 10), m('b', 5), m('c', 10), m('d', 3, { Anulada: true })]);
  assert.deepEqual(e, { puntaje: 25, entradas: 3, ultima: 10, mejor: 10, promedio: 25 / 3 });
  assert.deepEqual(estadisticas([]), { puntaje: 0, entradas: 0, ultima: 0, mejor: 0, promedio: 0 });
});

test('serie de dos dígitos: "00" no existe, "05" es 5', () => {
  assert.equal(componerSerie('12'), 12);
  assert.equal(componerSerie('05'), 5);
  assert.equal(componerSerie('00'), null);
});

test('corregir última: anula y reinserta; a 0 solo anula; sin cambio no hace nada', () => {
  assert.deepEqual(planCorreccion(m('x', 10), -1), { anular: 'x', nueva: 9 });
  assert.deepEqual(planCorreccion(m('x', 10), +1), { anular: 'x', nueva: 11 });
  assert.deepEqual(planCorreccion(m('x', 1), -1), { anular: 'x', nueva: null });
  assert.equal(planCorreccion(m('x', 99), +1), null);
  assert.equal(planCorreccion(m('x', 5, { Anulada: true }), 1), null);
  assert.equal(planCorreccion(null, 1), null);
});

test('récord: bajar la serie que lo rompió lo baja; subirla por encima de la mejor lo sube', () => {
  const marcas = [m('a', 8), m('b', 12)];
  assert.equal(recordDeMarcas(marcas), 12);
  const corregidas = [m('a', 8), m('b', 12, { Anulada: true }), m('c', 9, { CorrigeA: 'b' })];
  assert.equal(recordDeMarcas(corregidas), 9);
  const subida = [m('a', 8), m('b', 12, { Anulada: true }), m('c', 13, { CorrigeA: 'b' })];
  assert.equal(recordDeMarcas(subida), 13);
});

test('rompe récord solo si es estrictamente mayor', () => {
  assert.equal(rompeRecord(10, 10), false);
  assert.equal(rompeRecord(11, 10), true);
  assert.equal(rompeRecord(1, 0), true);
});

test('Reto del Parche: la tacada más alta; sin récords devuelve null', () => {
  assert.equal(retoDelParche([{ Id: '1', Nombre: 'Ana', RecordCarambolas: 0 }]), null);
  assert.deepEqual(
    retoDelParche([{ Id: '1', Nombre: 'Ana', RecordCarambolas: 7 }, { Id: '2', Nombre: 'Luis', RecordCarambolas: 12 }]),
    { jugadorId: '2', nombre: 'Luis', serie: 12 },
  );
});

test('ganador individual: empate o partido en 0 no marca ganador', () => {
  assert.deepEqual(ganadores('ind', [{ Id: 'a', puntaje: 25 }, { Id: 'b', puntaje: 14 }]), { ids: ['a'], empate: false, equipo: null });
  assert.deepEqual(ganadores('ind', [{ Id: 'a', puntaje: 20 }, { Id: 'b', puntaje: 20 }]), { ids: [], empate: true, equipo: null });
  assert.deepEqual(ganadores('ind', [{ Id: 'a', puntaje: 0 }, { Id: 'b', puntaje: 0 }]), { ids: [], empate: false, equipo: null });
});

test('ganador en parejas: ganan ambos de la pareja; el empate no declara ganador', () => {
  const js = [
    { Id: 'a', Equipo: 1, puntaje: 6 }, { Id: 'b', Equipo: 1, puntaje: 4 },
    { Id: 'c', Equipo: 2, puntaje: 9 }, { Id: 'd', Equipo: 2, puntaje: 3 },
  ];
  assert.deepEqual(ganadores('par', js), { ids: ['c', 'd'], empate: false, equipo: 2 });
  js[2].puntaje = 7; js[3].puntaje = 3;   // 10 vs 10
  assert.deepEqual(ganadores('par', js), { ids: [], empate: true, equipo: null });
});

test('máximo 4 jugadores', () => {
  assert.equal(puedeAgregar([1, 2, 3]), true);
  assert.equal(puedeAgregar([1, 2, 3, 4]), false);
});

test('tiempo de mesa: minuto completo hacia arriba (como Liquidar), $6.000/h', () => {
  assert.equal(minutosCobrables(3), 1);
  assert.equal(minutosCobrables(61), 2);
  assert.equal(valorTiempo(3, 6000), 100);
  assert.equal(valorTiempo(3600, 6000), 6000);
  assert.equal(valorTiempo(0, 6000), 0);
});

test('hms y ranking', () => {
  assert.equal(hms(3725), '01:02:05');
  assert.deepEqual(ranking([{ Id: 'a', puntaje: 5 }, { Id: 'b', puntaje: 9 }]).map((x) => x.Id), ['b', 'a']);
});

import { derivarHash, pinValido } from '../src/marcador/pin.js';

test('PIN: el hash depende de la sal y es repetible; solo 4 números', async () => {
  const s1 = new Uint8Array(16).fill(1), s2 = new Uint8Array(16).fill(2);
  const a = await derivarHash('1234', s1, 1000);
  assert.equal(a, await derivarHash('1234', s1, 1000));
  assert.notEqual(a, await derivarHash('1234', s2, 1000));
  assert.notEqual(a, await derivarHash('1235', s1, 1000));
  assert.equal(pinValido('1234'), true);
  assert.equal(pinValido('12a4'), false);
  assert.equal(pinValido('123'), false);
});

import { analisisPartida } from '../src/marcador/logica.js';
const mk = (Id, nombre, vals, t0 = 0, Equipo = null) => ({ Id, nombre, Equipo, esInvitado: false, marcas: vals.map(([v, t]) => ({ Id: `${Id}${t}`, CarambolasEnMarca: v, MarcaTiempo: new Date(1e12 + t * 1000).toISOString(), Anulada: false })) });
test('analisis: cambios de liderato, remontada y premios', () => {
  const a = mk('a', 'Ana', [[2, 1], [2, 3], [20, 5]]);
  const b = mk('b', 'Beto', [[9, 2], [9, 4], [1, 6]]);
  const r = analisisPartida('ind', [a, b]);
  assert.equal(r.jugadas, 6);
  assert.deepEqual(r.lineas[0].puntos, [0, 2, 2, 4, 4, 24, 24]);
  assert.equal(r.cambios.length, 2);                       // Ana→Beto→Ana
  assert.equal(r.cambios.at(-1).nombre, 'Ana');
  assert.ok(r.remontada && r.remontada.nombre === 'Ana' && r.remontada.deficit === 14);
  const t = r.premios.map((p) => p.titulo);
  assert.ok(t.includes('MERA TACADA') && t.includes('MERO REMONTADOR') && t.includes('MERA PUNTERÍA'));
});
test('analisis: wire to wire = dominador; parejas = 2 líneas', () => {
  const r = analisisPartida('ind', [mk('a', 'Ana', [[5, 1], [5, 3]]), mk('b', 'Beto', [[1, 2], [1, 4]])]);
  assert.ok(r.premios.some((p) => p.titulo === 'MERO PATRÓN'));
  const p = analisisPartida('par', [mk('a', 'A1', [[3, 1]], 0, 1), mk('b', 'A2', [[3, 2]], 0, 1), mk('c', 'B1', [[4, 3]], 0, 2)]);
  assert.equal(p.lineas.length, 2);
});

import { selloEpico } from '../src/marcador/logica.js';
test('analisis: ventaja máxima, letalidad y sello', () => {
  const r = analisisPartida('ind', [mk('a', 'Ana', [[5, 1], [5, 3]]), mk('b', 'Beto', [[1, 2], [1, 4]])]);
  assert.equal(r.ventaja.valor, 9);
  assert.equal(r.porJugador.find((p) => p.Id === 'a').letalidad, 100);   // promedio mesa 3: las dos series de Ana ≥ 3
  assert.equal(r.porJugador.find((p) => p.Id === 'b').letalidad, 0);
  assert.equal(selloEpico(r.premios, 'a'), 'Mero Patrón');
  assert.equal(selloEpico(r.premios, 'zz'), 'Jugador del Parche');
});

test('reposición: vendido + mínimo − stock, fraccionados cuentan en su envase', async () => {
  const { reposicion } = await import('../src/cuenta/inventario.js');
  const prods = [
    { Id: 'a', Nombre: 'Águila', StockActual: 8, StockMinimo: 24, CostoCompra: 3000 },
    { Id: 'b', Nombre: 'Papas', StockActual: 7, StockMinimo: 5, CostoCompra: 2000 },
    { Id: 'bot', Nombre: 'Media', StockActual: 1, StockMinimo: 1, CostoCompra: 42000 },
    { Id: 'copa', Nombre: 'Copa', StockActual: 0, Fraccion: { OrigenId: 'bot', Rinde: 10 } },
    { Id: 'off', Nombre: 'Viejo', Activo: false, StockActual: 0, StockMinimo: 9 },
  ];
  const d = (dia) => new Date(dia + 'T12:00:00').toISOString();
  const ped = [
    { ProductoId: 'a', Cantidad: 86, EstadoPedido: 'ENTREGADO', FechaHora: d('2026-10-05') },
    { ProductoId: 'a', Cantidad: 10, EstadoPedido: 'CANCELADO', FechaHora: d('2026-10-05') },
    { ProductoId: 'a', Cantidad: 50, EstadoPedido: 'ENTREGADO', FechaHora: d('2026-09-01') },   // fuera de rango
    { ProductoId: 'copa', Cantidad: 25, EstadoPedido: 'ENTREGADO', FechaHora: d('2026-10-06') },
  ];
  const r = reposicion(prods, ped, '2026-09-24', '2026-10-08');
  const f = (id) => r.find((x) => x.p.Id === id);
  assert.equal(f('a').pedir, 102);          // 86 + 24 − 8
  assert.equal(f('b').pedir, 0);            // sin ventas y stock sobre el mínimo
  assert.equal(f('bot').vendido, 2.5);      // 25 copas ÷ 10
  assert.equal(f('bot').pedir, 3);          // 2.5 + 1 − 1 = 2.5 → 3
  assert.equal(r.some((x) => x.p.Id === 'copa' || x.p.Id === 'off'), false);
  assert.equal(r[0].p.Id, 'a');             // los de más pedido primero
});

test('caja: resumen del turno, efectivo esperado y arqueo', async () => {
  const { resumenTurno, arqueo, inventarioVendido } = await import('../src/cuenta/caja.js');
  const facturas = [
    { Id: 'f1', CuentaId: 'c1', TotalPagar: 27000, MetodoPago: 'EFECTIVO', MetodoPagoSecundario: null, MontoPrimario: null },
    { Id: 'f2', CuentaId: 'c2', TotalPagar: 18000, MetodoPago: 'FIADO', MetodoPagoSecundario: null, MontoPrimario: null },
    { Id: 'f3', CuentaId: 'c3', TotalPagar: 20000, MetodoPago: 'NEQUI', MontoPrimario: 12000, MetodoPagoSecundario: 'EFECTIVO', MontoSecundario: 8000 },
  ];
  const abonos = [{ MetodoPago: 'EFECTIVO', Monto: 15000, FechaHora: 't', FacturaId: 'x' }];
  const gastos = [{ MetodoPago: 'EFECTIVO', Monto: 20000, Concepto: 'Vasos', Categoria: 'Insumos', FechaHora: 't' }];
  const r = resumenTurno({ facturas, abonos, gastos });
  assert.equal(r.totalVendido, 65000);
  assert.equal(r.porMetodo.EFECTIVO, 35000);      // 27.000 + 8.000 de la venta mixta
  assert.equal(r.porMetodo.NEQUI, 12000);
  assert.equal(r.fiado, 18000);
  assert.equal(r.efectivoEsperado, 30000);        // 35.000 + 15.000 de abonos − 20.000 de gastos
  assert.deepEqual(arqueo(30000, 30000), { diferencia: 0, estado: 'CUADRA' });
  assert.equal(arqueo(30000, 28000).estado, 'FALTANTE');
  assert.equal(arqueo(30000, 31000).diferencia, 1000);
  const inv = inventarioVendido({
    facturas: [{ CuentaId: 'c1' }, { CuentaId: 'c9', CuentasIncluidas: ['c2'] }],
    productos: [{ Id: 'a', Nombre: 'Águila' }, { Id: 'g', Nombre: 'Garita' }],
    pedidos: [
      { CuentaId: 'c1', ProductoId: 'a', Cantidad: 3, EstadoPedido: 'ENTREGADO' },
      { CuentaId: 'c2', ProductoId: 'a', Cantidad: 2, EstadoPedido: 'ENTREGADO' },
      { CuentaId: 'c1', ProductoId: 'a', Cantidad: 5, EstadoPedido: 'CANCELADO' },
      { CuentaId: 'c1', ProductoId: 'a', Cantidad: 4, EstadoPedido: 'ENTREGADO', CategoriaConsumo: 'TIEMPO' },
      { CuentaId: 'zz', ProductoId: 'a', Cantidad: 9, EstadoPedido: 'ENTREGADO' },
    ],
  });
  assert.deepEqual(inv, { filas: [{ nombre: 'Águila', cant: 5 }], total: 5 });
});
