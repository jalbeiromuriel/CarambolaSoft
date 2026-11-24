import { test } from 'node:test';
import assert from 'node:assert/strict';
import { repararNumeros } from '../src/cuenta/mesas.js';

const SEM = 'semilla';
const m = (Id, Numero, Estado = 'DISPONIBLE') => ({ Id, Numero, Estado });

test('mesas: la Mesa 1 repetida pasa al número que falta (8)', () => {
  const mesas = [m(SEM, 1), m('x', 1), ...[2, 3, 4, 5, 6, 7, 9, 10].map((n) => m(`m${n}`, n))];
  const c = repararNumeros(mesas, SEM);
  assert.deepEqual(c.map((x) => [x.Id, x.Numero]), [['x', 8]]);
});

test('mesas: no toca la ocupada ni hace nada si no hay repetidas', () => {
  assert.deepEqual(repararNumeros([m(SEM, 1), m('b', 2)], SEM), []);
  const c = repararNumeros([m(SEM, 1), m('x', 1, 'OCUPADA'), m('b', 2)], SEM);
  assert.deepEqual(c.map((x) => [x.Id, x.Numero]), [[SEM, 3]]);
});
