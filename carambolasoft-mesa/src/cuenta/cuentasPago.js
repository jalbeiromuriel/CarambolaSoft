// src/cuenta/cuentasPago.js — Cuentas para recibir pagos (lógica pura). Varias cuentas; una es la principal.
export const TIPOS_CUENTA = [
  { v: 'BANCOLOMBIA', t: 'Bancolombia', banco: 'Bancolombia · Cuenta de ahorros', pie: 'Transfiere y muéstranos el comprobante' },
  { v: 'BREB', t: 'Llave Bre-B', banco: 'Bre-B · Llave', pie: 'Paga con tu app bancaria a esta llave y muéstranos el comprobante' },
  { v: 'NEQUI', t: 'Nequi', banco: 'Nequi', pie: 'Envía a este número y muéstranos el comprobante' },
  { v: 'DAVIPLATA', t: 'Daviplata', banco: 'Daviplata', pie: 'Envía a este número y muéstranos el comprobante' },
  { v: 'BANCO', t: 'Otro banco', banco: '', pie: 'Transfiere y muéstranos el comprobante' },
  { v: 'OTRA', t: 'Otra', banco: '', pie: 'Paga y muéstranos el comprobante' },
];
export const pieDe = (tipo) => (TIPOS_CUENTA.find((t) => t.v === tipo) ?? TIPOS_CUENTA[5]).pie;

const id = () => (globalThis.crypto?.randomUUID?.() ?? `c-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);

/** Acepta lo guardado: lista nueva, o el dato antiguo de una sola cuenta {banco, cuenta, titular} (la migra como principal). */
export function normalizarCuentas(raw) {
  if (Array.isArray(raw)) return raw.map((c) => ({ Id: c.Id ?? id(), tipo: c.tipo ?? 'BANCO', banco: c.banco ?? '', numero: c.numero ?? '', titular: c.titular ?? '', principal: !!c.principal, activa: c.activa !== false, qr: c.qr ?? '' }));
  if (raw && raw.cuenta) return [{ Id: id(), tipo: /bancolombia/i.test(raw.banco ?? '') ? 'BANCOLOMBIA' : 'BANCO', banco: raw.banco ?? '', numero: raw.cuenta, titular: raw.titular ?? '', principal: true, activa: true, qr: '' }];
  return [];
}

export const cuentaNueva = (tipo = 'BANCOLOMBIA') => ({ Id: id(), tipo, banco: TIPOS_CUENTA.find((t) => t.v === tipo)?.banco ?? '', numero: '', titular: '', principal: false, activa: true, qr: '' });

/** Cuentas visibles al cliente: activas, con número, la principal primero. */
export const cuentasActivas = (lista = []) =>
  lista.filter((c) => c.activa !== false && String(c.numero ?? '').trim() !== '').sort((a, b) => Number(!!b.principal) - Number(!!a.principal));

/** Deja exactamente una principal (la marcada; si ninguna, la primera). */
export function conPrincipal(lista, idPrincipal) {
  const alguna = idPrincipal ?? lista.find((c) => c.principal)?.Id ?? lista[0]?.Id;
  return lista.map((c) => ({ ...c, principal: c.Id === alguna }));
}

export const validarCuenta = (c) => (!String(c.numero ?? '').trim() ? 'Escribe el número.' : !String(c.titular ?? '').trim() ? 'Escribe el titular.' : !String(c.banco ?? '').trim() ? 'Escribe el banco o nombre.' : '');
