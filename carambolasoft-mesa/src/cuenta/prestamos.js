// src/cuenta/prestamos.js — Préstamos al personal (reglas puras). La caja le presta efectivo a un empleado/admin y se lo devuelve.
// No es gasto (no baja la utilidad) ni fiado (sí mueve efectivo). Mueve el efectivo esperado del cierre.

/** Saldo por persona a partir de los movimientos (PRESTAMO / DEVOLUCION). Más deuda primero. */
export function saldosPersonal(movs = []) {
  const por = new Map();
  for (const m of movs) {
    const p = por.get(m.PersonaId) ?? { personaId: m.PersonaId, nombre: m.PersonaNombre ?? '', prestado: 0, devuelto: 0 };
    if (m.Tipo === 'PRESTAMO') p.prestado += m.Monto; else if (m.Tipo === 'DEVOLUCION') p.devuelto += m.Monto;
    por.set(m.PersonaId, p);
  }
  return [...por.values()].map((p) => ({ ...p, debe: p.prestado - p.devuelto })).sort((a, b) => b.debe - a.debe || a.nombre.localeCompare(b.nombre, 'es'));
}

/** Totales del tablero: lo que deben, y lo prestado/devuelto desde `desde` (inicio del turno abierto: TurnoCajaId nulo). */
export function totalesPersonal(movs = []) {
  const abiertos = movs.filter((m) => m.TurnoCajaId == null);
  const suma = (l, t) => l.filter((m) => m.Tipo === t).reduce((s, m) => s + m.Monto, 0);
  return { debenTotal: saldosPersonal(movs).reduce((s, p) => s + Math.max(0, p.debe), 0), prestadoTurno: suma(abiertos, 'PRESTAMO'), devueltoTurno: suma(abiertos, 'DEVOLUCION') };
}

/** Quién puede autorizar: un Admin distinto de quien recibe la plata (nadie se presta a sí mismo). */
export const autorizaValido = (autoriza, persona) => !!autoriza && autoriza.Id !== persona?.Id;

/** Valida un préstamo; devuelve '' si está bien. `efectivoCajon` = esperado actual en el cajón. */
export function validarPrestamo({ persona, monto, efectivoCajon = Infinity }) {
  if (!persona) return 'Elige la persona.';
  if (!(monto > 0)) return 'Escribe el valor del préstamo.';
  if (monto > efectivoCajon) return `En el cajón solo hay $${Math.round(efectivoCajon).toLocaleString('es-CO')}.`;
  return '';
}
/** Valida una devolución: no puede pasar de lo que la persona debe. */
export function validarDevolucion({ debe, monto }) {
  if (!(monto > 0)) return 'Escribe el valor.';
  if (monto > debe) return `Solo debe $${Math.round(debe).toLocaleString('es-CO')}.`;
  return '';
}
