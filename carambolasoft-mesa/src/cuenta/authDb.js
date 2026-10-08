// src/cuenta/authDb.js — Usuarios y PIN en IndexedDB (USUARIOS). El hash nunca sale en claro; la tabla aún no se sincroniza.
import { put, get, getAll, borrarLocal } from '../db/repository.js';
import { hashPin, nuevaSal, codigoRescate, normCodigo, pinValido, estaBloqueado, conFallo, conAcierto, intentosRestantes, esAdmin, adminsActivos } from './auth.js';

export const listarUsuarios = async () => (await getAll('USUARIOS')).sort((a, b) => a.Nombre.localeCompare(b.Nombre, 'es'));

async function credenciales(pin) {
  const Salt = nuevaSal();
  return { Salt, PinHash: await hashPin(pin, Salt) };
}
async function rescateNuevo() {
  const codigo = codigoRescate(); const RescateSalt = nuevaSal();
  return { codigo, campos: { RescateSalt, RescateHash: await hashPin(normCodigo(codigo), RescateSalt) } };
}

/** Crea un usuario. Los ADMIN reciben código de rescate (se muestra una sola vez). */
export async function crearUsuario({ nombre, rol, pin, temporal = false }) {
  if (!nombre?.trim()) throw new Error('Falta el nombre.');
  if (!pinValido(pin)) throw new Error('El PIN debe tener de 4 a 6 dígitos.');
  const rescate = esAdmin(rol) ? await rescateNuevo() : null;
  const u = await put('USUARIOS', {
    Nombre: nombre.trim(), Rol: rol, Activo: true, Intentos: 0, BloqueadoHasta: null, DebeCambiarPin: temporal,
    ...(await credenciales(pin)), ...(rescate?.campos ?? {}),
  });
  return { usuario: u, codigo: rescate?.codigo ?? null };
}

/** Login: devuelve { usuario } o { error, restantes?, bloqueado? }. */
export async function verificarLogin(id, pin) {
  const u = await get('USUARIOS', id);
  if (!u || u.Activo === false) return { error: 'Usuario no disponible.' };
  if (estaBloqueado(u)) return { error: 'Bloqueado por intentos fallidos.', bloqueado: u };
  if ((await hashPin(pin, u.Salt)) === u.PinHash) return { usuario: await put('USUARIOS', { ...conAcierto(u), UltimoIngreso: new Date().toISOString() }) };
  const n = await put('USUARIOS', conFallo(u));
  return estaBloqueado(n) ? { error: 'Bloqueado por intentos fallidos.', bloqueado: n } : { error: 'PIN incorrecto.', restantes: intentosRestantes(n) };
}

/** ¿Este PIN es de algún ADMIN activo? (autoriza una acción restringida a un Empleado) */
export async function autorizaAdmin(pin) {
  for (const a of adminsActivos(await listarUsuarios())) {
    if (!estaBloqueado(a) && (await hashPin(pin, a.Salt)) === a.PinHash) return a;
  }
  return null;
}

export async function cambiarPin(id, pinNuevo, { temporal = false } = {}) {
  if (!pinValido(pinNuevo)) throw new Error('El PIN debe tener de 4 a 6 dígitos.');
  const u = await get('USUARIOS', id);
  return put('USUARIOS', { ...u, ...(await credenciales(pinNuevo)), DebeCambiarPin: temporal, Intentos: 0, BloqueadoHasta: null });
}
export const restablecerPin = (id, pinTemporal) => cambiarPin(id, pinTemporal, { temporal: true });

export async function activar(id, activo) {
  const u = await get('USUARIOS', id);
  return put('USUARIOS', { ...u, Activo: activo });
}

/** "Olvidé mi PIN" de un ADMIN con su código de rescate. Devuelve el código nuevo (el anterior queda inservible). */
export async function rescatar(id, codigo, pinNuevo) {
  const u = await get('USUARIOS', id);
  if (!u || !u.RescateHash) return { error: 'Este usuario no tiene código de rescate.' };
  if ((await hashPin(normCodigo(codigo), u.RescateSalt)) !== u.RescateHash) return { error: 'Código de rescate incorrecto.' };
  const r = await rescateNuevo();
  await put('USUARIOS', { ...(await cambiarPin(id, pinNuevo)), ...r.campos });
  return { codigo: r.codigo };
}

export async function nuevoCodigoRescate(id) {
  const u = await get('USUARIOS', id); const r = await rescateNuevo();
  await put('USUARIOS', { ...u, ...r.campos });
  return r.codigo;
}

/** Edita nombre, nota y rol. Admin→Empleado exige que quede otro Admin; Empleado→Admin genera su código de rescate. */
export async function editarUsuario(id, { nombre, rol, nota }) {
  if (!nombre?.trim()) throw new Error('Falta el nombre.');
  const todos = await listarUsuarios();
  const u = todos.find((x) => x.Id === id);
  let extra = {}; let codigo = null;
  if (esAdmin(u.Rol) && !esAdmin(rol)) {
    if (adminsActivos(todos).filter((a) => a.Id !== id).length === 0) throw new Error('Debe quedar al menos un Admin.');
    extra = { RescateHash: null, RescateSalt: null };
  } else if (!esAdmin(u.Rol) && esAdmin(rol)) {
    const r = await rescateNuevo(); extra = r.campos; codigo = r.codigo;
  }
  const guardado = await put('USUARIOS', { ...u, Nombre: nombre.trim(), Rol: rol, Nota: (nota ?? '').trim(), ...extra });
  return { usuario: guardado, codigo };
}

/** Eliminar de verdad solo si nunca cobró ni autorizó nada (si no, se desactiva para no perder quién cobró). */
export async function tieneMovimientos(id) {
  const facturas = await getAll('FACTURAS');
  return facturas.some((f) => f.UsuarioId === id || f.AutorizoId === id);
}
export async function eliminarUsuario(id) {
  const todos = await listarUsuarios();
  const u = todos.find((x) => x.Id === id);
  if (await tieneMovimientos(id)) throw new Error('Tiene facturas a su nombre: desactívalo en vez de eliminarlo.');
  if (u && esAdmin(u.Rol) && adminsActivos(todos).filter((a) => a.Id !== id).length === 0) throw new Error('No puedes eliminar al único Admin.');
  await borrarLocal('USUARIOS', [id]);
}
