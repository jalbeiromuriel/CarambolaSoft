// src/cuenta/grupos.js — Una mesa = un grupo de cuentas (billar: por MesaId; licores: por GrupoMesaId; viejas: su propio Id).
export const grupoDe = (c) => c.MesaId ?? c.GrupoMesaId ?? c.Id;

/** Agrupa cuentas por mesa, conservando el orden de apertura. */
export function agrupar(cuentas) {
  const por = new Map();
  for (const c of [...cuentas].sort((a, b) => (a.HoraApertura ?? '').localeCompare(b.HoraApertura ?? ''))) {
    const k = grupoDe(c);
    if (!por.has(k)) por.set(k, []);
    por.get(k).push(c);
  }
  return [...por.values()];
}
