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
