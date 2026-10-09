// src/cuenta/maquinas.js — Reglas de las máquinas (funciones puras). Las máquinas tienen un FONDO propio, separado del cajón.
// PREMIO baja el fondo. REPOSICION (lo que manda el dueño) lo sube. PRESTAMO: la caja le presta al fondo (sale del cajón, queda deuda).
// DEVOLUCION: el fondo le devuelve a la caja (vuelve al cajón). Solo PRESTAMO y DEVOLUCION tocan el arqueo. CUADRE = dato viejo, vale como reposición.
export const BASE_FONDO = 200000;
const SUBE = new Set(['REPOSICION', 'CUADRE', 'PRESTAMO']);
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
  const de = (t) => movs.filter((x) => (t === 'REPOSICION' ? x.Tipo === 'REPOSICION' || x.Tipo === 'CUADRE' : x.Tipo === t));
  const suma = (l) => l.reduce((t, x) => t + x.Monto, 0);
  return { totPremios: suma(de('PREMIO')), nPremios: de('PREMIO').length, totReposiciones: suma(de('REPOSICION')), totPrestamos: suma(de('PRESTAMO')), totDevoluciones: suma(de('DEVOLUCION')) };
}

/** Saldo del fondo (todo el historial, no solo el período): base + lo que entra − lo que sale. */
export function saldoFondo(movs, base = BASE_FONDO) {
  return movs.reduce((s, x) => s + (SUBE.has(x.Tipo) ? x.Monto : x.Tipo === 'PREMIO' || x.Tipo === 'DEVOLUCION' ? -x.Monto : 0), base);
}
/** Lo que el fondo le debe a la caja (préstamos − devoluciones). */
export const deudaCaja = (movs) => Math.max(0, movs.reduce((s, x) => s + (x.Tipo === 'PRESTAMO' ? x.Monto : x.Tipo === 'DEVOLUCION' ? -x.Monto : 0), 0));

/** Premios por máquina en el período que se está viendo. */
export const premiosPorMaquina = (maquinas, movs) => maquinas.filter((m) => m.Activa !== false).map((m) => {
  const p = movs.filter((x) => x.MaquinaId === m.Id && x.Tipo === 'PREMIO');
  return { maquina: m, nPremios: p.length, total: p.reduce((t, x) => t + x.Monto, 0) };
});

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
