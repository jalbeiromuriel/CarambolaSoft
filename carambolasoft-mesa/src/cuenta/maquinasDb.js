// src/cuenta/maquinasDb.js — Máquinas, premios y cuadres en IndexedDB (MAQUINAS + MAQUINAS_MOVIMIENTOS). Reglas puras en maquinas.js.
import { getAll, put, borrarLocal } from '../db/repository.js';
import { validarNombreMaquina, movEditable } from './maquinas.js';

export async function cargarMaquinas() {
  const [maquinas, movs] = await Promise.all([getAll('MAQUINAS'), getAll('MAQUINAS_MOVIMIENTOS')]);
  return { maquinas: maquinas.sort((a, b) => (a.Nombre ?? '').localeCompare(b.Nombre ?? '')), movs };
}

export async function crearMaquina(nombre) {
  const { maquinas } = await cargarMaquinas();
  const e = validarNombreMaquina(nombre, maquinas); if (e) throw new Error(e);
  return put('MAQUINAS', { Nombre: nombre.trim(), Activa: true });
}
export async function renombrarMaquina(m, nombre) {
  const { maquinas } = await cargarMaquinas();
  const e = validarNombreMaquina(nombre, maquinas, m.Id); if (e) throw new Error(e);
  return put('MAQUINAS', { ...m, Nombre: nombre.trim() });
}
export const alternarMaquina = (m) => put('MAQUINAS', { ...m, Activa: m.Activa === false });

/** Premio pagado: sale del efectivo de la caja. Lo autoriza un Admin (PIN verificado antes de llamar aquí). */
export const registrarPremio = ({ maquinaId, monto, usuario, autorizoId }) =>
  put('MAQUINAS_MOVIMIENTOS', { MaquinaId: maquinaId, Tipo: 'PREMIO', Monto: monto, TurnoCajaId: null, Nota: '', FechaHora: new Date().toISOString(), UsuarioId: usuario?.Id ?? null, UsuarioNombre: usuario?.Nombre ?? '', AutorizoId: autorizoId ?? null });

/** Cuadre con el dueño de la máquina: pone en cero lo pendiente. No toca el arqueo del cajón. */
export const registrarCuadre = ({ maquinaId, monto, nota, usuario }) =>
  put('MAQUINAS_MOVIMIENTOS', { MaquinaId: maquinaId, Tipo: 'CUADRE', Monto: monto, TurnoCajaId: null, Nota: (nota ?? '').trim(), FechaHora: new Date().toISOString(), UsuarioId: usuario?.Id ?? null, UsuarioNombre: usuario?.Nombre ?? '' });

export async function editarMov(mov, { monto, nota, maquinaId }) {
  if (!movEditable(mov)) throw new Error('Turno cerrado: el movimiento ya no se edita.');
  return put('MAQUINAS_MOVIMIENTOS', { ...mov, Monto: monto, Nota: nota ?? mov.Nota ?? '', MaquinaId: maquinaId ?? mov.MaquinaId });
}
export async function borrarMov(mov) {
  if (!movEditable(mov)) throw new Error('Turno cerrado: el movimiento ya no se borra.');
  await borrarLocal('MAQUINAS_MOVIMIENTOS', [mov.Id]);
}
