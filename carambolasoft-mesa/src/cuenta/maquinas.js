// src/cuenta/maquinas.js — Reglas de las máquinas (funciones puras): premios que paga la barra y cuadres con el dueño.
// PREMIO sale del efectivo de la caja (entra al arqueo del turno). CUADRE es lo recibido del dueño; no toca el arqueo.
export const FILTROS_MAQ = [['turno', 'Turno actual'], ['semana', 'Semana'], ['quincena', 'Quincena'], ['mes', 'Mes'], ['rango', '📅 Rango']];

const inicioDia = (ms) => { const d = new Date(ms); d.setHours(0, 0, 0, 0); return d.getTime(); };

/** Movimientos del período, recientes primero. 'turno' = aún sin sellar (TurnoCajaId nulo). */
export function filtrarMovs(movs, filtro, { ahora = Date.now(), desde = '', hasta = '' } = {}) {
  const hoy0 = inicioDia(ahora); let d = -Infinity, h = Infinity;
  if (filtro === 'semana') d = hoy0 - 6 * 86400000;
  else if (filtro === 'quincena') d = hoy0 - 14 * 86400000;
  else if (filtro === 'mes') d = hoy0 - 29 * 86400000;
  else if (filtro === 'rango') { if (desde) d = new Date(`${desde}T00:00:00`).getTime(); if (hasta) h = new Date(`${hasta}T23:59:59`).getTime(); }
  return movs
    .filter((x) => (filtro === 'turno' ? x.TurnoCajaId == null : (() => { const t = new Date(x.FechaHora).getTime(); return t >= d && t <= h; })()))
    .sort((a, b) => (b.FechaHora ?? '').localeCompare(a.FechaHora ?? ''));
}

export function resumenMovs(movs) {
  const prem = movs.filter((x) => x.Tipo === 'PREMIO'), cuad = movs.filter((x) => x.Tipo === 'CUADRE');
  const totPremios = prem.reduce((t, x) => t + x.Monto, 0), totCuadres = cuad.reduce((t, x) => t + x.Monto, 0);
  return { totPremios, nPremios: prem.length, totCuadres, nCuadres: cuad.length, neto: totCuadres - totPremios };
}

/** El papelito para el dueño: por cada máquina activa, premios pagados desde su último cuadre. */
export function pendientePorMaquina(maquinas, movs) {
  return maquinas.filter((m) => m.Activa !== false).map((m) => {
    const mios = movs.filter((x) => x.MaquinaId === m.Id);
    const ultimoCuadre = mios.filter((x) => x.Tipo === 'CUADRE').map((x) => x.FechaHora).sort().pop() ?? null;
    const pend = mios.filter((x) => x.Tipo === 'PREMIO' && (!ultimoCuadre || x.FechaHora > ultimoCuadre));
    return { maquina: m, ultimoCuadre, nPremios: pend.length, pendiente: pend.reduce((t, x) => t + x.Monto, 0) };
  });
}

const sinTildes = (t) => String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
/** Valida el nombre de una máquina (único, sin importar tildes ni mayúsculas). Devuelve '' si está bien. */
export function validarNombreMaquina(nombre, maquinas, idActual = null) {
  const n = String(nombre ?? '').trim();
  if (!n) return 'Escribe el nombre.';
  if (maquinas.some((m) => m.Id !== idActual && sinTildes(m.Nombre) === sinTildes(n))) return 'Ya existe una máquina con ese nombre.';
  return '';
}

/** Un movimiento solo se edita/borra mientras su turno siga abierto. */
export const movEditable = (mov) => mov.TurnoCajaId == null;
