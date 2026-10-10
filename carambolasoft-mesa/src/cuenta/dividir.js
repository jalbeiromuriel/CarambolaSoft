// src/cuenta/dividir.js — Dividir una cuenta entre varios pagadores (funciones puras). Cada pagador paga con su método
// (o fía a su nombre) y genera su propia factura; la mesa cuenta como UNA sola venta.

/** Partes iguales; el sobrante del redondeo va al último para que siempre sume el total. */
export function repartirIgual(total, n) {
  if (!(n > 0)) return [];
  const base = Math.floor(total / n);
  return Array.from({ length: n }, (_, i) => (i === n - 1 ? total - base * (n - 1) : base));
}

/**
 * Reparto automático al agregar/quitar pagadores o marcar quién paga: las filas con valor fijado a mano (`fijo`) lo conservan y
 * lo que falta se reparte en partes iguales entre las demás que pagan. Las que no pagan quedan en 0. Con una fila "el resto" no se toca nada.
 * filas: [{ paga, fijo, resto, monto }] → filas con `monto` actualizado.
 */
export function repartirAuto(total, filas) {
  if (filas.some((f) => f.resto && f.paga)) return filas.map((f) => (f.paga ? f : { ...f, monto: 0 }));
  const fijas = filas.filter((f) => f.paga && f.fijo).reduce((s, f) => s + (f.monto || 0), 0);
  const libres = filas.filter((f) => f.paga && !f.fijo);
  const partes = repartirIgual(Math.max(0, total - fijas), libres.length);
  let k = 0;
  return filas.map((f) => (!f.paga ? { ...f, monto: 0 } : f.fijo ? f : { ...f, monto: partes[k++] }));
}

/**
 * Valida la división y fija el monto del pagador marcado "el resto".
 * pagos: [{ nombre, clienteId, metodo, monto, resto? }] → { error } | { pagos: [{ ..., monto }] }
 */
export function planDivision({ total, pagos }) {
  if (!Array.isArray(pagos) || pagos.length < 2) return { error: 'Agrega al menos dos pagadores.' };
  if (pagos.filter((p) => p.resto).length > 1) return { error: 'Solo un pagador puede llevar “el resto”.' };
  const fijos = pagos.filter((p) => !p.resto).reduce((s, p) => s + (Number(p.monto) || 0), 0);
  const lista = pagos.map((p) => (p.resto ? { ...p, monto: total - fijos } : { ...p, monto: Number(p.monto) || 0 }));
  if (lista.some((p) => !(p.monto > 0))) return { error: 'Cada pagador debe tener un valor mayor a 0.' };
  const suma = lista.reduce((s, p) => s + p.monto, 0);
  if (suma !== total) return { error: suma < total ? `Faltan $${(total - suma).toLocaleString('es-CO')} para completar el total.` : `Se pasan $${(suma - total).toLocaleString('es-CO')} del total.` };
  const sinCliente = lista.find((p) => p.metodo === 'FIADO' && !p.clienteId);
  if (sinCliente) return { error: `${sinCliente.nombre?.trim() || 'Un pagador'} va fiado: elige un cliente registrado.` };
  if (lista.some((p) => !p.metodo)) return { error: 'Elige cómo paga cada uno.' };
  return { pagos: lista };
}

/**
 * Reparte los subtotales (tiempo, licor, snacks, otros) de la cuenta entre los pagadores, proporcional a su valor.
 * Cada categoría suma exacta entre todos; el ajuste de ±1 peso por pagador va a su categoría mayor.
 */
export function repartirSubtotales(sub, montos) {
  const total = montos.reduce((s, m) => s + m, 0);
  const cats = Object.keys(sub);
  let acum = 0;
  const partes = montos.map((m) => {
    const antes = acum; acum += m;
    const fila = Object.fromEntries(cats.map((k) => [k, total ? Math.round((sub[k] * acum) / total) - Math.round((sub[k] * antes) / total) : 0]));
    const dif = m - Object.values(fila).reduce((s, v) => s + v, 0);
    if (dif) { const mayor = cats.reduce((a, b) => (fila[b] > fila[a] ? b : a), cats[0]); fila[mayor] += dif; }
    return fila;
  });
  return partes;
}
