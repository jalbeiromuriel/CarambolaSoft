// src/cuenta/pierdePaga.js — Reglas PURAS de «Pierde y Paga» (aprobadas 2026-11-24).
// El chico lo cierra la barra: se marca quién perdió y paga TODO el chico (tiempo + consumo).
// Individual: un perdedor. Parejas: los dos de la pareja perdedora, mitad y mitad.

/** Jugadores cargados en la mesa (alineación) → filas para marcar: { key, nombre, clienteId }. */
export function jugadoresDeMesa(alineacion = [], clientes = []) {
  const porId = new Map(clientes.map((c) => [c.Id, c]));
  return alineacion.flatMap((a) => {
    if (a.clienteId) {
      const c = porId.get(a.clienteId);
      return c ? [{ key: c.Id, nombre: c.Apodo ? `${c.Nombre} (${c.Apodo})` : c.Nombre, corto: c.Apodo || c.Nombre, clienteId: c.Id, lado: a.lado }] : [];
    }
    return a.invitado ? [{ key: `inv:${a.invitado}`, nombre: `${a.invitado} (invitado)`, corto: a.invitado, clienteId: null, lado: a.lado }] : [];
  });
}

/** Del resultado del Contador: los que NO ganaron. Empate o sin ganador = nadie (la barra marca). */
export function perdedoresDe(ganadorIds = [], participantes = []) {
  if (!ganadorIds.length) return [];
  const ganan = new Set(ganadorIds);
  return participantes.filter((p) => !ganan.has(p.Id)).map((p) => ({ clienteId: p.clienteId ?? null, nombre: p.nombre }));
}

/** Claves de la lista de jugadores que vienen marcadas (perdedores que dejó el Contador). */
export function preseleccion(jugadores = [], perdedores = []) {
  return jugadores.filter((j) => perdedores.some((p) => (p.clienteId ? p.clienteId === j.clienteId : !j.clienteId && p.nombre === j.corto))).map((j) => j.key);
}

/**
 * Qué se cobra y a quién. seleccion = filas marcadas (1 o 2).
 * @returns { error } | { nombre, clienteId, pareja, partes: [monto, monto?] }
 */
export function planPierdePaga({ seleccion = [], total = 0 }) {
  if (seleccion.length === 0) return { error: 'Marca quién perdió.' };
  if (seleccion.length > 2) return { error: 'Pierde y paga: marca al perdedor o a los dos de la pareja que perdió.' };
  const nombre = seleccion.map((j) => j.corto).join(' y ');
  if (seleccion.length === 1) return { nombre, clienteId: seleccion[0].clienteId ?? null, pareja: false, partes: [total] };
  const a = Math.ceil(total / 2);
  return { nombre, clienteId: null, pareja: true, partes: [a, total - a] };
}
