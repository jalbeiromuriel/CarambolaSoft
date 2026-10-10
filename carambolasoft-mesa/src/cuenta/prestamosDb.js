// src/cuenta/prestamosDb.js — Préstamos al personal en IndexedDB (PRESTAMOS_PERSONAL). Reglas puras en prestamos.js.
import { getAll, put } from '../db/repository.js';
import { autorizaValido } from './prestamos.js';

export async function cargarPrestamos() {
  const [movs, usuarios] = await Promise.all([getAll('PRESTAMOS_PERSONAL'), getAll('USUARIOS')]);
  return { movs: movs.sort((a, b) => (b.FechaHora ?? '').localeCompare(a.FechaHora ?? '')), personas: usuarios.filter((u) => u.Activo !== false).sort((a, b) => a.Nombre.localeCompare(b.Nombre, 'es')) };
}

const mov = (Tipo, { persona, monto, motivo = '', usuario, autorizoId = null }) =>
  put('PRESTAMOS_PERSONAL', { PersonaId: persona.Id, PersonaNombre: persona.Nombre, Tipo, Monto: monto, Motivo: (motivo ?? '').trim(), TurnoCajaId: null, FechaHora: new Date().toISOString(), UsuarioId: usuario?.Id ?? null, UsuarioNombre: usuario?.Nombre ?? '', AutorizoId: autorizoId });

/** Préstamo: sale efectivo del cajón. `autoriza` = el Admin que digitó su PIN; no puede ser quien recibe la plata. */
export async function prestar({ persona, monto, motivo, usuario, autoriza }) {
  if (!autorizaValido(autoriza, persona)) throw new Error('Este préstamo lo debe autorizar otro Admin: nadie se presta a sí mismo.');
  return mov('PRESTAMO', { persona, monto, motivo, usuario, autorizoId: autoriza.Id });
}
/** Devolución en efectivo: entra al cajón. */
export const devolver = ({ persona, monto, motivo, usuario }) => mov('DEVOLUCION', { persona, monto, motivo: motivo || 'Pago de préstamo', usuario });
