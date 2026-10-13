// src/db/subirInventario.js — Subida MANUAL y ordenada del inventario (categorías → productos) al servidor.
// No enciende el motor de sync ni toca la cola: es una acción del administrador, con vista previa y resultado por fila.
import { getAll, putSincronizado } from './repository.js';
import { API_BASE, cabecerasApi, sesionApi } from './apiSesion.js';
import { categoriaADto, productoADto, planSubida } from '../cuenta/syncMapas.js';

export async function previsualizar() {
  const plan = planSubida(await getAll('CATEGORIAS'), await getAll('PRODUCTOS'));
  return { ...plan, servidor: API_BASE, conSesion: !!sesionApi() };
}

async function enviar(segmento, dto) {
  const resp = await fetch(`${API_BASE}/api/sync/${segmento}/${dto.Id}`, { method: 'PUT', headers: cabecerasApi({ 'Content-Type': 'application/json' }), body: JSON.stringify(dto) });
  if (resp.ok) return { ok: true };
  let msg = '';
  try { msg = (await resp.json())?.error ?? ''; } catch { /* sin cuerpo */ }
  return { ok: false, status: resp.status, error: msg || `Servidor respondió ${resp.status}` };
}

/** Sube todo. Si la red o la sesión fallan se detiene (no sigue a ciegas). Devuelve { subidas, fallos[], detenido }. */
export async function subirInventario(alAvance = () => {}) {
  if (!sesionApi()) return { subidas: 0, fallos: [], detenido: 'Sin sesión del servidor: entra de nuevo con internet y con el API prendido.' };
  const plan = await previsualizar();
  const total = plan.categorias.length + plan.productos.length;
  const res = { subidas: 0, fallos: [], detenido: null };
  const tareas = [...plan.categorias.map((r) => ['categorias', 'CATEGORIAS', r, categoriaADto(r)]), ...plan.productos.map((r) => ['productos', 'PRODUCTOS', r, productoADto(r)])];
  for (const [segmento, store, registro, dto] of tareas) {
    let r;
    try { r = await enviar(segmento, dto); }
    catch (err) { res.detenido = `Sin conexión con el servidor (${err.message}).`; break; }
    if (r.status === 401 || r.status === 403) { res.detenido = r.status === 401 ? 'La sesión del servidor venció: entra de nuevo.' : 'Tu usuario no tiene permiso para subir inventario.'; break; }
    if (r.ok) { await putSincronizado(store, { ...registro, EsSincronizado: true }); res.subidas++; }
    else res.fallos.push({ nombre: registro.Nombre, error: r.error });
    alAvance(res.subidas + res.fallos.length, total);
  }
  return res;
}
