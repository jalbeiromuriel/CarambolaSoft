// src/cuenta/mesas.js — Reglas puras de las mesas de billar.

/**
 * Repara números repetidos (ej. dos "Mesa 1" y falta la 8): cada mesa repetida y libre pasa al
 * primer número que falte. Nunca renumera una mesa ocupada ni la que tiene el Id de la semilla.
 * @param mesas  registros MESAS_BILLAR
 * @param idSemilla  Id fijo de la Mesa 1 que crea la app (se conserva)
 * @returns mesas a guardar con su Numero nuevo (vacío si no hay nada que arreglar)
 */
export function repararNumeros(mesas = [], idSemilla = null) {
  const porNumero = new Map();
  for (const m of mesas) porNumero.set(m.Numero, [...(porNumero.get(m.Numero) ?? []), m]);
  const usados = new Set(porNumero.keys());
  const faltantes = [];
  for (let n = 1; faltantes.length < mesas.length; n++) if (!usados.has(n)) faltantes.push(n);
  const cambios = [];
  for (const grupo of porNumero.values()) {
    if (grupo.length < 2) continue;
    // Se queda con su número: la ocupada, si no la semilla, si no la primera.
    const orden = [...grupo].sort((a, b) => (b.Estado === 'OCUPADA') - (a.Estado === 'OCUPADA') || (b.Id === idSemilla) - (a.Id === idSemilla));
    for (const m of orden.slice(1)) {
      if (m.Estado === 'OCUPADA') continue;
      cambios.push({ ...m, Numero: faltantes.shift() });
    }
  }
  return cambios;
}
