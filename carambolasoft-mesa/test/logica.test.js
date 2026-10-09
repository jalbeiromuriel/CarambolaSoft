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

test('informes: ganancia del día, sugerido de pedido y detalle de ventas', async () => {
  const { informeDia, sugeridoPedido, detalleVentas, enlaceWhatsApp } = await import('../src/informes/datos.js');
  const productos = [{ Id: 'a', Nombre: 'Águila', StockActual: 8, StockMinimo: 24 }, { Id: 'b', Nombre: 'Papas', StockActual: 7, StockMinimo: 5 }, { Id: 'c', Nombre: 'Maní', StockActual: 0, StockMinimo: 0 }];
  const facturas = [{ Id: 'f1', CuentaId: 'c1', Numero: 'F-0001', FechaHora: '2026-10-08T20:00:00Z', TotalPagar: 30000, MetodoPago: 'EFECTIVO', SubtotalTiempo: 10000 }];
  const pedidos = [
    { CuentaId: 'c1', ProductoId: 'a', Cantidad: 4, EstadoPedido: 'ENTREGADO', PrecioUnitarioHist: 5000, CostoCompraHist: 3000 },
    { CuentaId: 'c1', ProductoId: 'c', Cantidad: 2, EstadoPedido: 'ENTREGADO', PrecioUnitarioHist: 2000, CostoCompraHist: 900 },
    { CuentaId: 'c1', ProductoId: 'a', Cantidad: 9, EstadoPedido: 'CANCELADO', PrecioUnitarioHist: 5000, CostoCompraHist: 3000 },
    { CuentaId: 'zz', ProductoId: 'a', Cantidad: 9, EstadoPedido: 'ENTREGADO', PrecioUnitarioHist: 5000, CostoCompraHist: 3000 },
  ];
  const i = informeDia({ facturas, pedidos, productos });
  assert.equal(i.ingresos, 34000);          // 20.000 + 4.000 + 10.000 de tiempo de mesa
  assert.equal(i.costo, 13800);             // 12.000 + 1.800
  assert.equal(i.ganancia, 20200);
  const s = sugeridoPedido({ productos, vendidos: i.filas });
  assert.deepEqual(s.map((x) => [x.nombre, x.sugerido]), [['Águila', 20], ['Maní', 2]]);   // 4+24−8 ; 2+0−0
  const d = detalleVentas({ facturas, pedidos, productos, etiquetaDe: () => 'Mesa 1 · Ana' });
  assert.equal(d[0].items.length, 3);       // tiempo + Águila + Maní
  assert.equal(d[0].total, 30000);
  assert.equal(enlaceWhatsApp('hola', '300 123 4567'), 'https://wa.me/573001234567?text=hola');
});

test('informes: recibo de cuenta, recibo de fiado y cartera', async () => {
  const { reciboCuenta, reciboFiado, carteraFiados, textoReciboFiado } = await import('../src/informes/datos.js');
  const productos = [{ Id: 'a', Nombre: 'Águila' }, { Id: 'b', Nombre: 'Papas' }];
  const pedidos = [
    { CuentaId: 'c1', ProductoId: 'a', Cantidad: 2, EstadoPedido: 'ENTREGADO', PrecioUnitarioHist: 5000, FechaHora: '2026-10-08T20:40:00Z' },
    { CuentaId: 'c1', ProductoId: 'a', Cantidad: 1, EstadoPedido: 'ENTREGADO', PrecioUnitarioHist: 5000, FechaHora: '2026-10-08T20:50:00Z' },
    { CuentaId: 'c1', ProductoId: 'b', Cantidad: 1, EstadoPedido: 'ENTREGADO', PrecioUnitarioHist: 3500, FechaHora: '2026-10-08T20:55:00Z' },
    { CuentaId: 'c1', ProductoId: 'b', Cantidad: 4, EstadoPedido: 'CANCELADO', PrecioUnitarioHist: 3500 },
  ];
  const r = reciboCuenta({ pedidos, productos, tiempo: 10000 });
  assert.equal(r.total, 28500);                       // 15.000 + 3.500 + 10.000 de tiempo
  assert.deepEqual(r.items.map((i) => [i.nombre, i.cant]), [['Tiempo de mesa', 1], ['Águila', 3], ['Papas', 1]]);
  assert.equal(r.historial.length, 3);
  const g = { cliente: { Nombre: 'Carlos' }, deuda: 34000, facturas: [
    { Numero: 'F-0003', CuentaId: 'c1', FechaHora: '2026-09-01T20:00:00Z', original: 25000, abonado: 0, saldo: 25000 },
    { Numero: 'F-0004', CuentaId: 'c2', FechaHora: '2026-10-08T21:00:00Z', original: 21000, abonado: 12000, saldo: 9000 } ] };
  const f = reciboFiado({ g, pedidos, productos, pagos: [] });
  assert.equal(f.consumido, 46000); assert.equal(f.abonado, 12000); assert.equal(f.pendiente, 34000);
  assert.equal(f.facturas[0].items.length, 2);
  const c = carteraFiados([g], new Date('2026-10-08T23:00:00Z').getTime());
  assert.equal(c.total, 34000);
  assert.deepEqual(c.clientes[0].facturas.map((x) => x.vieja), [true, false]);   // F-0003 tiene más de 15 días
  assert.match(textoReciboFiado(f, [{ banco: 'Banco', numero: '123', titular: 'Ana' }, { banco: 'Nequi', numero: '300', titular: 'Ana' }]), /Pendiente por pagar: \$34\.000[\s\S]*123[\s\S]*300/);
});

test('copiaFactura: pagada, pendiente con abonos y tiempo', async () => {
  const { copiaFactura } = await import('../src/informes/datos.js');
  const productos = [{ Id: 'p', Nombre: 'Cerveza' }];
  const pedidos = [{ CuentaId: 'c', ProductoId: 'p', Cantidad: 6, PrecioUnitarioHist: 5000, EstadoPedido: 'ENTREGADO' }, { CuentaId: 'x', ProductoId: 'p', Cantidad: 1, PrecioUnitarioHist: 5000, EstadoPedido: 'ENTREGADO' }];
  const pag = copiaFactura({ factura: { Numero: 'F-0002', CuentaId: 'c', TotalPagar: 30000, TotalPendienteFiado: 0, MetodoPago: 'EFECTIVO', MetodoPagoSecundario: 'NEQUI', FechaHora: '2026-09-21T21:14:00Z' }, pedidos, productos });
  assert.equal(pag.estado, 'PAGADA'); assert.equal(pag.items.length, 1); assert.equal(pag.items[0].cant, 6); assert.equal(pag.saldo, 0); assert.equal(pag.pagado, 30000);
  const pen = copiaFactura({ factura: { CuentaId: 'c', TotalPagar: 35000, SubtotalTiempo: 5000, TotalPendienteFiado: 20000 }, pedidos, productos, abonos: [{ Monto: 15000, MetodoPago: 'NEQUI', FechaHora: 'z' }] });
  assert.equal(pen.estado, 'PENDIENTE'); assert.equal(pen.numero, 'F-—'); assert.equal(pen.items[0].nombre, 'Tiempo de mesa'); assert.equal(pen.pagado, 15000); assert.equal(pen.pagos.length, 1);
});

test('buscarFacturas: por número, cliente, fecha, estado y periodo', async () => {
  const { buscarFacturas } = await import('../src/cuenta/caja.js');
  const ahora = new Date('2026-10-09T15:00:00').getTime();
  const cuentas = [{ Id: 'c1', ClienteId: 'k1', NombreLibre: 'x' }, { Id: 'c2', NombreLibre: 'Venta rápida' }];
  const clientes = [{ Id: 'k1', Nombre: 'Chalo Pérez' }];
  const facturas = [
    { Id: 'f1', Numero: 'F-0004', CuentaId: 'c1', TotalPagar: 50000, TotalPendienteFiado: 20000, FechaHora: '2026-10-02T21:00:00' },
    { Id: 'f2', Numero: 'F-0012', CuentaId: 'c2', TotalPagar: 12000, TotalPendienteFiado: 0, FechaHora: '2026-10-09T10:00:00' },
  ];
  const b = (o) => buscarFacturas({ facturas, cuentas, clientes, ahora, ...o }).map((r) => r.numero);
  assert.deepEqual(b({}), ['F-0012', 'F-0004']);
  assert.deepEqual(b({ texto: 'f-0004' }), ['F-0004']);
  assert.deepEqual(b({ texto: '4' }), ['F-0004']);
  assert.deepEqual(b({ texto: 'perez' }), ['F-0004']);
  assert.deepEqual(b({ texto: '02/10' }), ['F-0004']);
  assert.deepEqual(b({ estado: 'pendientes' }), ['F-0004']);
  assert.deepEqual(b({ estado: 'pagadas' }), ['F-0012']);
  assert.deepEqual(b({ periodo: 'hoy' }), ['F-0012']);
  assert.deepEqual(b({ texto: 'zzz' }), []);
});

test('cuentasPago: migra la cuenta antigua, principal primero, ocultas fuera, una sola principal', async () => {
  const { normalizarCuentas, cuentasActivas, conPrincipal, validarCuenta, cuentaNueva } = await import('../src/cuenta/cuentasPago.js');
  const vieja = normalizarCuentas({ banco: 'Bancolombia', cuenta: '123', titular: 'T' });
  assert.equal(vieja.length, 1); assert.equal(vieja[0].principal, true); assert.equal(vieja[0].numero, '123');
  assert.deepEqual(normalizarCuentas(null), []); assert.deepEqual(normalizarCuentas({ banco: '', cuenta: '' }), []);
  const l = normalizarCuentas([{ Id: 'a', numero: '1', banco: 'A' }, { Id: 'b', numero: '2', banco: 'B', principal: true }, { Id: 'c', numero: '3', banco: 'C', activa: false }, { Id: 'd', numero: ' ', banco: 'D' }]);
  assert.deepEqual(cuentasActivas(l).map((c) => c.Id), ['b', 'a']);
  assert.deepEqual(conPrincipal(l, 'a').filter((c) => c.principal).map((c) => c.Id), ['a']);
  assert.equal(conPrincipal([{ Id: 'x' }, { Id: 'y' }])[0].principal, true);
  assert.notEqual(validarCuenta({ numero: '', titular: 't', banco: 'b' }), ''); assert.equal(validarCuenta({ numero: '1', titular: 't', banco: 'b' }), '');
  assert.equal(cuentaNueva('NEQUI').banco, 'Nequi');
  const { TIPOS_CUENTA, pieDe } = await import('../src/cuenta/cuentasPago.js');
  assert.ok(TIPOS_CUENTA.some((t) => t.v === 'BANCOLOMBIA') && TIPOS_CUENTA.some((t) => t.v === 'BREB'));
  assert.equal(cuentaNueva('BANCOLOMBIA').banco, 'Bancolombia · Cuenta de ahorros'); assert.equal(cuentaNueva('BREB').banco, 'Bre-B · Llave');
  assert.match(pieDe('BREB'), /llave/);
  assert.equal(normalizarCuentas({ banco: 'Bancolombia · Ahorros', cuenta: '1' })[0].tipo, 'BANCOLOMBIA');
});

test('comprobante: métodos digitales y texto para la patrona', async () => {
  const { esDigital, textoComprobante } = await import('../src/cuenta/comprobante.js');
  assert.ok(['NEQUI', 'DAVIPLATA', 'TARJETA', 'TRANSFERENCIA'].every(esDigital)); assert.ok(!esDigital('EFECTIVO') && !esDigital('FIADO'));
  const t = textoComprobante({ cliente: 'Chalo', monto: 50000, metodos: ['NEQUI', 'TARJETA'], usuario: 'Liliana', motivo: 'Abono de fiado', fecha: new Date('2026-10-09T15:00:00') });
  assert.match(t, /Abono de fiado/); assert.match(t, /Cliente: Chalo/); assert.match(t, /Valor: \$50\.000/); assert.match(t, /Nequi \+ Bancolombia/); assert.match(t, /Registró: Liliana/);
  assert.ok(!/Valor/.test(textoComprobante({ monto: 0, metodos: ['NEQUI'] })));
});
