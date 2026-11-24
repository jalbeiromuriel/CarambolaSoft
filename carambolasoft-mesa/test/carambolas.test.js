import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluarInicio, ladosDe, statsLado, ladoGanando, ultimaMarca, marcadorCorto, totalAproximado, pesos } from '../src/marcador/carambolas.js';

const m = (id, v, t, extra = {}) => ({ Id: id, CarambolasEnMarca: v, MarcaTiempo: t, Anulada: false, ...extra });
const j = (Id, nombre, marcas, Equipo = null) => ({ Id, nombre, Equipo, marcas });

test('inicio: solo 1v1 o 2v2; 2v1 queda apagado con aviso', () => {
  assert.equal(evaluarInicio(0, 0).puedeEmpezar, false);
  assert.deepEqual([evaluarInicio(1, 1).puedeEmpezar, evaluarInicio(1, 1).modo], [true, 'ind']);
  assert.deepEqual([evaluarInicio(2, 2).puedeEmpezar, evaluarInicio(2, 2).modo], [true, 'par']);
  const dosUno = evaluarInicio(2, 1);
  assert.equal(dosUno.puedeEmpezar, false);
  assert.equal(dosUno.tono, 'alerta');
  assert.match(dosUno.mensaje, /Falta un jugador en Parchados 2 para jugar 2 contra 2, o quita a uno de Parchados 1 para jugar 1 contra 1\./);
  assert.match(evaluarInicio(1, 2).mensaje, /Falta un jugador en Parchados 1 .* quita a uno de Parchados 2/);
  assert.equal(evaluarInicio(1, 0).puedeEmpezar, false);
  assert.equal(evaluarInicio(2, 0).puedeEmpezar, false);
});

test('lados: 1v1 por jugador, 2v2 por pareja; gana el mayor y el empate no marca oro', () => {
  const ind = [j('a', 'Albeiro', [m('1', 5, 't1'), m('2', 12, 't3')]), j('b', 'Liliana', [m('3', 25, 't2')])];
  const [A, B] = ladosDe('ind', ind).map(statsLado);
  assert.deepEqual([A.puntaje, B.puntaje], [17, 25]);
  assert.equal(ladoGanando(A, B), 1);
  assert.equal(ladoGanando(A, A), null);
  assert.equal(ladoGanando({ puntaje: 0 }, { puntaje: 0 }), null);

  const par = [j('a', 'A', [m('1', 11, 't1')], 1), j('c', 'C', [m('2', 13, 't2')], 1), j('l', 'L', [m('3', 19, 't3')], 2), j('m', 'M', [m('4', 12, 't4')], 2)];
  const [P1, P2] = ladosDe('par', par).map(statsLado);
  assert.deepEqual([P1.puntaje, P2.puntaje], [24, 31]);
  assert.equal(marcadorCorto('par', par), '24 — 31');
  assert.equal(ladoGanando(P1, P2), 1);
});

test('última serie: la más reciente vigente; ignora las anuladas', () => {
  const js = [j('a', 'A', [m('1', 3, '2026-10-24T10:00:00Z'), m('2', 9, '2026-10-24T10:05:00Z', { Anulada: true })]), j('b', 'B', [m('3', 4, '2026-10-24T10:02:00Z')])];
  const u = ultimaMarca(js);
  assert.equal(u.marca.Id, '3');
  assert.equal(u.jugador.Id, 'b');
  assert.equal(ultimaMarca([j('x', 'X', [])]), null);
});

test('total aproximado: sube a $100 y pesos() da puntos de miles', () => {
  assert.equal(totalAproximado(16500, 9093), 25600);
  assert.equal(totalAproximado(16500, 9200), 25700);
  assert.equal(totalAproximado(0, 0), 0);
  assert.equal(pesos(25600), '$25.600');
  assert.equal(pesos(800), '$800');
  assert.equal(pesos(1234567), '$1.234.567');
});

test('ocupadoEn: no se puede estar en garita y billar, ni en dos billares', async () => {
  const { ocupadoEn } = await import('../src/marcador/carambolas.js');
  const cuentas = [{ TipoCuenta: 'GARITA', Estado: 'ABIERTA', ClienteId: 'liliana' }, { TipoCuenta: 'LICORES', Estado: 'ABIERTA', ClienteId: 'carlos' }];
  const alineaciones = { m2: [{ clienteId: 'pablo' }], m3: [{ clienteId: 'elkin' }] };
  const ctx = { cuentasAbiertas: cuentas, alineaciones, mesaActualId: 'm2', nombreMesa: (id) => (id === 'm3' ? 'Mesa 3' : 'Mesa 2') };
  assert.equal(ocupadoEn('liliana', ctx).donde, 'GARITA');
  assert.equal(ocupadoEn('elkin', ctx).texto, 'EN MESA 3');
  assert.equal(ocupadoEn('pablo', ctx), null);   // ya está en esta misma mesa
  assert.equal(ocupadoEn('carlos', ctx), null);  // una mesa de licores sí se permite
  assert.equal(ocupadoEn(null, ctx), null);
});
