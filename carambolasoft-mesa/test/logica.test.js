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
