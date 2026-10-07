// ============================================================
//  CarambolaSoft — Mero Parche
//  marcador/pin.js — PIN de administrador (Finalizar, informe con valores, teléfonos).
//  El PIN NUNCA vive en el código. Se guarda solo un hash con sal (PBKDF2) en META de IndexedDB,
//  para poder validar SIN internet. Con red, el API es la fuente oficial (pendiente: endpoint).
//  [RIESGO] Mientras no exista el endpoint, el primer PIN lo crea quien llegue primero a la tablet:
//  configurarlo el día de la instalación y no dejar la tablet sin PIN.
// ============================================================
import { leerMeta, escribirMeta } from '../db/repository.js';

const ITER = 150_000;
const MAX_INTENTOS = 5;
const BLOQUEO_MS = 60_000;
const enc = new TextEncoder();
const b64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
const deB64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

/** Hash PBKDF2-SHA256 del PIN con una sal. Pura: la usan las pruebas. */
export async function derivarHash(pin, salt, iter = ITER) {
  const clave = await crypto.subtle.importKey('raw', enc.encode(pin), 'PBKDF2', false, ['deriveBits']);
  return b64(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: iter }, clave, 256));
}

export const pinValido = (pin) => /^\d{4}$/.test(pin);

function iguales(a, b) {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

export async function pinConfigurado() {
  return Boolean(await leerMeta('admin.pin'));
}

export async function configurarPin(pin) {
  if (!pinValido(pin)) throw new Error('El PIN son 4 números.');
  const salt = crypto.getRandomValues(new Uint8Array(16));
  await escribirMeta('admin.pin', { salt: b64(salt), hash: await derivarHash(pin, salt), iter: ITER });
  await escribirMeta('admin.pin.intentos', { n: 0, hasta: 0 });
}

/** @returns {Promise<{ok:boolean, bloqueadoSeg?:number, restantes?:number}>} */
export async function verificarPin(pin) {
  const reg = await leerMeta('admin.pin');
  if (!reg) return { ok: false };
  const est = (await leerMeta('admin.pin.intentos')) ?? { n: 0, hasta: 0 };
  if (est.hasta > Date.now()) return { ok: false, bloqueadoSeg: Math.ceil((est.hasta - Date.now()) / 1000) };

  const hash = await derivarHash(pin, deB64(reg.salt), reg.iter);
  if (iguales(hash, reg.hash)) {
    await escribirMeta('admin.pin.intentos', { n: 0, hasta: 0 });
    return { ok: true };
  }
  const n = est.n + 1;
  const bloquear = n >= MAX_INTENTOS;
  await escribirMeta('admin.pin.intentos', { n: bloquear ? 0 : n, hasta: bloquear ? Date.now() + BLOQUEO_MS : 0 });
  return bloquear ? { ok: false, bloqueadoSeg: BLOQUEO_MS / 1000 } : { ok: false, restantes: MAX_INTENTOS - n };
}
