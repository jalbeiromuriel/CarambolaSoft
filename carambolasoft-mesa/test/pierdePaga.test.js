import { test } from 'node:test';
import assert from 'node:assert/strict';
import { jugadoresDeMesa, perdedoresDe, preseleccion, planPierdePaga } from '../src/cuenta/pierdePaga.js';

const clientes = [{ Id: 'c1', Nombre: 'Carlos' }, { Id: 'e1', Nombre: 'Elkin', Apodo: 'El Mago' }];
const alin = [{ clienteId: 'c1', lado: 1 }, { clienteId: 'e1', lado: 2 }, { invitado: 'Andrés', lado: 2 }, { clienteId: 'borrado', lado: 1 }];

test('pierde y paga: jugadores de la mesa (clientes e invitados, sin los que ya no existen)', () => {
  const j = jugadoresDeMesa(alin, clientes);
  assert.deepEqual(j.map((x) => [x.key, x.corto, x.clienteId]), [['c1', 'Carlos', 'c1'], ['e1', 'El Mago', 'e1'], ['inv:Andrés', 'Andrés', null]]);
});

test('pierde y paga: perdedores del Contador y preselección', () => {
  const part = [{ Id: 'p1', clienteId: 'c1', nombre: 'Carlos' }, { Id: 'p2', clienteId: 'e1', nombre: 'El Mago' }, { Id: 'p3', clienteId: null, nombre: 'Andrés' }];
  assert.deepEqual(perdedoresDe([], part), []);   // empate: la barra marca
  const per = perdedoresDe(['p1'], part);
  assert.deepEqual(per.map((p) => p.nombre), ['El Mago', 'Andrés']);
  assert.deepEqual(preseleccion(jugadoresDeMesa(alin, clientes), per), ['e1', 'inv:Andrés']);
});

test('pierde y paga: individual paga todo; pareja mitad y mitad; validaciones', () => {
  const j = jugadoresDeMesa(alin, clientes);
  assert.match(planPierdePaga({ seleccion: [], total: 1000 }).error, /Marca/);
  assert.match(planPierdePaga({ seleccion: j, total: 1000 }).error, /pareja/);
  const uno = planPierdePaga({ seleccion: [j[1]], total: 21300 });
  assert.deepEqual([uno.nombre, uno.clienteId, uno.pareja, uno.partes], ['El Mago', 'e1', false, [21300]]);
  const par = planPierdePaga({ seleccion: [j[1], j[2]], total: 21300 });
  assert.deepEqual([par.nombre, par.pareja, par.partes], ['El Mago y Andrés', true, [10650, 10650]]);
  assert.deepEqual(planPierdePaga({ seleccion: [j[1], j[2]], total: 21301 }).partes, [10651, 10650]);
});
