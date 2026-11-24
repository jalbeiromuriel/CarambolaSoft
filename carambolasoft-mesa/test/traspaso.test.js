import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planTraspaso, lineaSaldo, esLineaSaldo, saldoTraspasado, METODO_TRASPASO } from '../src/cuenta/traspaso.js';
import { resumenTurno, inventarioVendido } from '../src/cuenta/caja.js';
import { informeDia } from '../src/informes/datos.js';

const base = { total: 38500, origenId: 'juan', destinoId: 'pedro' };

test('traspaso: paga una parte en efectivo y el resto pasa como TRASPASO', () => {
  const p = planTraspaso({ ...base, paga: 20000, metodo: 'EFECTIVO' });
  assert.deepEqual(p, { met1: 'EFECTIVO', met2: METODO_TRASPASO, m1: 20000, m2: 18500, saldo: 18500 });
});

test('traspaso: no paga nada → todo el total pasa con un solo método', () => {
  assert.deepEqual(planTraspaso({ ...base, paga: 0 }), { met1: METODO_TRASPASO, met2: null, m1: 38500, m2: 0, saldo: 38500 });
});

test('traspaso: bloqueos (chico corriendo, sin destino, misma cuenta, paga todo, fiado, $0)', () => {
  assert.match(planTraspaso({ ...base, chicoCorriendo: true }).error, /Termina el chico/);
  assert.match(planTraspaso({ ...base, destinoId: null }).error, /Elige/);
  assert.match(planTraspaso({ ...base, destinoId: 'juan' }).error, /misma cuenta/);
  assert.match(planTraspaso({ ...base, paga: 38500 }).error, /usa Cobrar/);
  assert.match(planTraspaso({ ...base, paga: 10000, metodo: 'FIADO' }).error, /efectivo o un pago digital/);
  assert.match(planTraspaso({ ...base, total: 0 }).error, /\$0/);
});

test('traspaso: la línea de saldo va entregada, sin producto ni costo', () => {
  const l = lineaSaldo({ cuentaDestinoId: 'pedro', facturaId: 'f1', numeroFactura: 'F-0123', nombreOrigen: 'Juan', saldo: 18500, fechaHora: 'x' });
  assert.equal(l.Detalle, 'Saldo de Juan · F-0123');
  assert.equal(l.ProductoId, null); assert.equal(l.CostoCompraHist, 0); assert.equal(l.EstadoPedido, 'ENTREGADO');
  assert.ok(esLineaSaldo(l));
  assert.equal(saldoTraspasado([l, { CategoriaConsumo: 'SNACKS', PrecioUnitarioHist: 3000, Cantidad: 2, EstadoPedido: 'ENTREGADO' }]), 18500);
});

test('caja: Juan paga 20.000 y pasa 18.500 a Pedro; Pedro paga todo → venta contada una sola vez', () => {
  const pedidos = [
    { CuentaId: 'juan', ProductoId: 'agua', Cantidad: 3, PrecioUnitarioHist: 6500, CostoCompraHist: 4000, CategoriaConsumo: 'BEBIDAS_ALCOHOLICAS', EstadoPedido: 'ENTREGADO' },
    { CuentaId: 'juan', ProductoId: 'cerv', Cantidad: 4, PrecioUnitarioHist: 4750, CostoCompraHist: 3000, CategoriaConsumo: 'BEBIDAS_ALCOHOLICAS', EstadoPedido: 'ENTREGADO' },
    { CuentaId: 'pedro', ProductoId: 'papas', Cantidad: 4, PrecioUnitarioHist: 3000, CostoCompraHist: 2000, CategoriaConsumo: 'SNACKS', EstadoPedido: 'ENTREGADO' },
    lineaSaldo({ cuentaDestinoId: 'pedro', facturaId: 'fJ', numeroFactura: 'F-0123', nombreOrigen: 'Juan', saldo: 18500 }),
  ];
  const facturas = [
    { Id: 'fJ', CuentaId: 'juan', TotalPagar: 38500, MetodoPago: 'EFECTIVO', MontoPrimario: 20000, MetodoPagoSecundario: 'TRASPASO', MontoSecundario: 18500 },
    { Id: 'fP', CuentaId: 'pedro', TotalPagar: 30500, SubtotalTraspaso: 18500, MetodoPago: 'EFECTIVO' },
  ];
  const r = resumenTurno({ facturas });
  assert.equal(r.totalVendido, 38500 + 12000);       // lo consumido por Juan + lo consumido por Pedro
  assert.equal(r.cobrosTraspaso, 18500);
  assert.equal(r.traspasado, 18500);
  assert.equal(r.efectivoEsperado, 20000 + 30500);    // en el cajón entró todo
  const inv = inventarioVendido({ facturas, pedidos, productos: [{ Id: 'agua', Nombre: 'Aguardiente' }, { Id: 'cerv', Nombre: 'Cerveza' }, { Id: 'papas', Nombre: 'Papas' }] });
  assert.equal(inv.filas.some((f) => f.nombre.startsWith('Saldo de')), false);
  const dia = informeDia({ facturas, pedidos, productos: [] });
  assert.equal(dia.filas.some((f) => f.nombre.startsWith('Saldo de')), false);
});

import { etiquetaCliente, duplicadoDe } from '../src/cuenta/nombres.js';

test('nombres: primer nombre + apodo; sin apodo, primer nombre + inicial', () => {
  assert.equal(etiquetaCliente({ Nombre: 'Jorge Albeiro Muriel', Apodo: 'El Profe' }), 'Jorge «El Profe»');
  assert.equal(etiquetaCliente({ Nombre: 'Luis Arango', Apodo: '' }), 'Luis A.');
  assert.equal(etiquetaCliente({ Nombre: 'Luis', Apodo: 'luis' }), 'Luis');
  assert.equal(etiquetaCliente({ Nombre: '', Apodo: 'Chiqui' }), 'Chiqui');
});

test('nombres: no deja crear clientes repetidos ni que se vean iguales', () => {
  const hay = [{ Id: '1', Nombre: 'Luis Arango', Apodo: 'Chiqui' }, { Id: '2', Nombre: 'Pedro Gómez', Apodo: null }];
  assert.match(duplicadoDe(hay, { Nombre: 'luis arango', Apodo: 'chiqui' }), /Ya existe/);
  assert.match(duplicadoDe(hay, { Nombre: 'Luis Ángel', Apodo: 'Chiqui' }), /apodo distinto/);
  assert.match(duplicadoDe(hay, { Nombre: 'Pedro Gil', Apodo: '' }), /apodo distinto/);   // los dos serían «Pedro G.»
  assert.equal(duplicadoDe(hay, { Nombre: 'Luis Ángel', Apodo: 'El Mono' }), '');
});

import { cuentaQueChoca, revisarAperturas } from '../src/cuenta/nombres.js';

test('una cuenta abierta por cliente: licores y garita juntas, billar aparte', () => {
  const abiertas = [
    { Id: 'a', ClienteId: 'luis', TipoCuenta: 'LICORES', Estado: 'ABIERTA', NombreLibre: 'Luis «Chiqui»' },
    { Id: 'b', ClienteId: 'pedro', TipoCuenta: 'BILLAR', Estado: 'ABIERTA', NombreLibre: 'Pedro G.' },
  ];
  assert.equal(cuentaQueChoca(abiertas, 'luis', 'GARITA')?.Id, 'a');      // garita choca con licores
  assert.equal(cuentaQueChoca(abiertas, 'luis', 'LICORES')?.Id, 'a');
  assert.equal(cuentaQueChoca(abiertas, 'luis', 'BILLAR'), null);         // puede jugar billar y tener licores
  assert.equal(cuentaQueChoca(abiertas, 'pedro', 'BILLAR')?.Id, 'b');     // no dos billares
  assert.equal(cuentaQueChoca(abiertas, 'pedro', 'LICORES'), null);       // el del chico puede invitar en licores
  assert.equal(cuentaQueChoca(abiertas, 'luis', 'VENTA_RAPIDA'), null);
  assert.equal(cuentaQueChoca(abiertas, null, 'LICORES'), null);          // nombre libre: no se revisa
  assert.match(revisarAperturas(abiertas, [{ cliente: { Id: 'luis' }, etiqueta: 'Luis «Chiqui»' }], 'GARITA').error, /ya tiene cuenta abierta en una mesa de licores/);
  assert.match(revisarAperturas([], [{ cliente: { Id: 'x' }, etiqueta: 'X' }, { cliente: { Id: 'x' }, etiqueta: 'X' }], 'LICORES').error, /dos veces/);
  assert.equal(revisarAperturas(abiertas, [{ cliente: null, etiqueta: 'La Mona' }], 'LICORES').error, '');
});
