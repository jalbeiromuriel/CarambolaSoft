import { test } from 'node:test';
import assert from 'node:assert/strict';
import { APP_RESPALDO, validarRespaldo, resumenRespaldo, nombreArchivo } from '../src/db/respaldoLogica.js';

const ctx = { base: 'ElParcheDeJony', version: 7, tablasConocidas: ['CUENTAS', 'CLIENTES', 'META', 'SYNC_QUEUE'] };
const bueno = { app: APP_RESPALDO, base: 'ElParcheDeJony', version: 7, fecha: '2026-11-24T07:00:00Z', tablas: { CUENTAS: [{ Id: 'a' }, { Id: 'b' }], CLIENTES: [{ Id: 'c' }], META: [{ clave: 'x' }] } };

test('respaldo: acepta un archivo bueno y rechaza los malos', () => {
  assert.equal(validarRespaldo(bueno, ctx), '');
  assert.match(validarRespaldo({ hola: 1 }, ctx), /no es un respaldo/);
  assert.match(validarRespaldo(null, ctx), /no es un respaldo/);
  assert.match(validarRespaldo({ ...bueno, base: 'Otra' }, ctx), /otra base/);
  assert.match(validarRespaldo({ ...bueno, version: 8 }, ctx), /más nueva/);
  assert.equal(validarRespaldo({ ...bueno, version: 6 }, ctx), '');   // uno viejo sí se puede
  assert.match(validarRespaldo({ ...bueno, tablas: { RARA: [] } }, ctx), /desconocida: RARA/);
  assert.match(validarRespaldo({ ...bueno, tablas: { CUENTAS: {} } }, ctx), /dañada/);
});

test('respaldo: resumen sin contar cola ni META, y nombre del archivo', () => {
  const r = resumenRespaldo({ ...bueno, tablas: { ...bueno.tablas, SYNC_QUEUE: [{}, {}] } });
  assert.deepEqual([r.total, r.cuentas, r.clientes, r.facturas], [3, 2, 1, 0]);
  assert.equal(nombreArchivo(new Date(2026, 10, 24, 2, 5)), 'MeroParche_respaldo_2026-11-24_0205.json');
});
