// src/db/apiSesion.js — Sesión del equipo contra el API en la nube (token). Offline-first: la app NUNCA depende de esto para entrar.
// Al entrar con el PIN (local), si hay internet, se pide además un token al API con el mismo usuario y PIN.
// El token vive solo en esta pestaña (sessionStorage): al cerrar la pestaña o la sesión desaparece. Sin token no se sincroniza.
import { sesionApiVigente } from '../cuenta/auth.js';

export const API_BASE = import.meta.env.VITE_API_URL ?? 'https://localhost:7186';
const CLAVE = 'cs.apiSesion';
let enMemoria = null;

const leer = () => {
  if (enMemoria) return enMemoria;
  try { const t = sessionStorage.getItem(CLAVE); if (t) enMemoria = JSON.parse(t); } catch { /* sin storage */ }
  return enMemoria;
};

export const sesionApi = () => { const s = leer(); return sesionApiVigente(s) ? s : null; };
export const cabecerasApi = (extra = {}) => { const s = sesionApi(); return s ? { ...extra, Authorization: `Bearer ${s.token}` } : extra; };

export function cerrarSesionApi() {
  enMemoria = null;
  try { sessionStorage.removeItem(CLAVE); } catch { /* nada */ }
}

/** Pide el token al API. No lanza: devuelve { ok } o { ok:false, sinRed?, bloqueado?, error }. */
export async function iniciarSesionApi(nombre, pin) {
  try {
    const resp = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ usuario: nombre, pin }),
    });
    if (resp.ok) {
      const d = await resp.json();
      enMemoria = { token: d.token, vence: d.vence, usuarioId: d.usuarioId, nombre: d.nombre, rol: d.rol };
      try { sessionStorage.setItem(CLAVE, JSON.stringify(enMemoria)); } catch { /* sin storage */ }
      return { ok: true };
    }
    cerrarSesionApi();
    return { ok: false, bloqueado: resp.status === 429, error: resp.status === 401 ? 'El servidor no reconoce este usuario o PIN.' : `Servidor respondió ${resp.status}.` };
  } catch (err) {
    return { ok: false, sinRed: true, error: String(err?.message ?? err) };   // sin internet o servidor apagado: la app sigue normal
  }
}
