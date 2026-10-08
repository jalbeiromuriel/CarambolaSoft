// src/cuenta/auth.js — Reglas de usuarios y PIN (lógica pura + hash). Sin IndexedDB.
// Roles: ADMIN (Albeiro y Dahiana, la Patrona) y EMPLEADO. PATRONA se acepta como ADMIN por compatibilidad con la BD v6.3.
export const MAX_INTENTOS = 5;
export const BLOQUEO_MS = 5 * 60000;
export const MIN_ADMINS = 2;               // política: siempre dos usuarios que puedan restablecer PIN

export const esAdmin = (rol) => rol === 'ADMIN' || rol === 'PATRONA';
export const SECCIONES_EMPLEADO = ['panel', 'clientes'];
export const seccionVisible = (id, rol) => esAdmin(rol) || SECCIONES_EMPLEADO.includes(id);

export const pinValido = (pin) => /^\d{4,6}$/.test(String(pin ?? ''));

/** Hash del PIN con sal. SHA-256 si el navegador lo ofrece (HTTPS/localhost); si no, un hash iterado de respaldo. */
export async function hashPin(pin, salt) {
  const texto = `${salt}:${pin}`;
  if (globalThis.crypto?.subtle) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(texto));
    return 'S256:' + [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
  }
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;           // cyrb53 × 2000 vueltas (solo respaldo en http sin TLS)
  for (let r = 0; r < 2000; r++) for (let i = 0; i < texto.length; i++) {
    const c = texto.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 2654435761); h2 = Math.imul(h2 ^ c, 1597334677);
  }
  return 'C53:' + (h1 >>> 0).toString(16) + (h2 >>> 0).toString(16);
}

export const nuevaSal = () => crypto.randomUUID();

/** Código de rescate de un solo uso: XXXX-XXXX-XXXX (sin 0/O/1/I para no confundir al imprimir). */
export function codigoRescate() {
  const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const r = crypto.getRandomValues(new Uint8Array(12));
  const s = [...r].map((b) => A[b % A.length]).join('');
  return `${s.slice(0, 4)}-${s.slice(4, 8)}-${s.slice(8)}`;
}
export const normCodigo = (c) => String(c ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');

export const estaBloqueado = (u, ahora = Date.now()) => !!u.BloqueadoHasta && new Date(u.BloqueadoHasta).getTime() > ahora;
export const msBloqueo = (u, ahora = Date.now()) => Math.max(0, new Date(u.BloqueadoHasta).getTime() - ahora);

/** Tras un PIN errado: suma intento y, al quinto, bloquea BLOQUEO_MS. */
export function conFallo(u, ahora = Date.now()) {
  const n = (u.Intentos ?? 0) + 1;
  return n >= MAX_INTENTOS
    ? { ...u, Intentos: 0, BloqueadoHasta: new Date(ahora + BLOQUEO_MS).toISOString() }
    : { ...u, Intentos: n };
}
export const conAcierto = (u) => ({ ...u, Intentos: 0, BloqueadoHasta: null });
export const intentosRestantes = (u) => MAX_INTENTOS - (u.Intentos ?? 0);

export const adminsActivos = (usuarios) => usuarios.filter((u) => u.Activo !== false && esAdmin(u.Rol));
