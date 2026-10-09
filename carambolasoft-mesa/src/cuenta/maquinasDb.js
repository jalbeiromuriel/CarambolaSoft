// src/cuenta/maquinasDb.js — Máquinas, premios y cuadres en IndexedDB (MAQUINAS + MAQUINAS_MOVIMIENTOS). Reglas puras en maquinas.js.
import { getAll, put, borrarLocal, leerMeta } from '../db/repository.js';
import { validarNombreMaquina, movEditable, saldoFondo, BASE_FONDO } from './maquinas.js';

export async function cargarMaquinas() {
  const [maquinas, movs] = await Promise.all([getAll('MAQUINAS'), getAll('MAQUINAS_MOVIMIENTOS')]);
  const base = (await leerMeta('maquinas.base')) ?? BASE_FONDO;
  return { maquinas: maquinas.sort((a, b) => (a.Nombre ?? '').localeCompare(b.Nombre ?? '')), movs, base };
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

const mov = (Tipo, monto, { maquinaId = null, nota = '', usuario, autorizoId = null, fecha } = {}) =>
  put('MAQUINAS_MOVIMIENTOS', { MaquinaId: maquinaId, Tipo, Monto: monto, TurnoCajaId: null, Nota: (nota ?? '').trim(), FechaHora: fecha ?? new Date().toISOString(), UsuarioId: usuario?.Id ?? null, UsuarioNombre: usuario?.Nombre ?? '', AutorizoId: autorizoId });

/** Premio: baja el fondo. Si el fondo no alcanza, primero la caja le presta la diferencia (sale del cajón). */
export async function registrarPremio({ maquinaId, monto, usuario, autorizoId }) {
  const { movs, base } = await cargarMaquinas();
  const falta = monto - Math.max(0, saldoFondo(movs, base));
  const t = Date.now();
  if (falta > 0) await mov('PRESTAMO', falta, { nota: 'Para completar un premio', usuario, autorizoId, fecha: new Date(t - 1).toISOString() });
  return mov('PREMIO', monto, { maquinaId, usuario, autorizoId, fecha: new Date(t).toISOString() });
}
/** Lo que manda el dueño: sube el fondo. No toca el cajón. */
export const registrarReposicion = ({ monto, nota, usuario }) => mov('REPOSICION', monto, { nota, usuario });
/** La caja le presta al fondo (sale del cajón, queda deuda). */
export const registrarPrestamo = ({ monto, nota, usuario, autorizoId }) => mov('PRESTAMO', monto, { nota, usuario, autorizoId });
/** El fondo le devuelve a la caja (vuelve al cajón). */
export const registrarDevolucion = ({ monto, nota, usuario, autorizoId }) => mov('DEVOLUCION', monto, { nota, usuario, autorizoId });

export async function editarMov(mov, { monto, nota, maquinaId }) {
  if (!movEditable(mov)) throw new Error('Turno cerrado: el movimiento ya no se edita.');
  return put('MAQUINAS_MOVIMIENTOS', { ...mov, Monto: monto, Nota: nota ?? mov.Nota ?? '', MaquinaId: maquinaId ?? mov.MaquinaId });
}
export async function borrarMov(mov) {
  if (!movEditable(mov)) throw new Error('Turno cerrado: el movimiento ya no se borra.');
  await borrarLocal('MAQUINAS_MOVIMIENTOS', [mov.Id]);
}
