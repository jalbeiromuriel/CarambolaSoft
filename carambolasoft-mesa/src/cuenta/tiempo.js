// src/cuenta/tiempo.js — Taxímetro por chico (billar). Funciones puras, sin React.
// Una cuenta nueva de billar guarda MsAcumulados (chicos ya terminados) e InicioChico (chico en curso).
// Las cuentas viejas (sin MsAcumulados) corren desde HoraApertura, como antes.

const ms = (iso) => Date.parse(iso);
const esLegado = (c) => c.MsAcumulados === undefined;

export function estaCorriendo(c) {
  if (!c.TarifaPorHora) return false;
  return esLegado(c) ? c.Estado === 'ABIERTA' : !!c.InicioChico;
}

/** Milisegundos jugados: chicos terminados + el que va en curso. */
export function msJugados(c, ahora = Date.now()) {
  if (!c.TarifaPorHora) return 0;
  if (esLegado(c)) return Math.max(0, ahora - ms(c.HoraApertura));
  return c.MsAcumulados + (c.InicioChico ? Math.max(0, ahora - ms(c.InicioChico)) : 0);
}

/** Ms del chico en curso (0 si está detenido). */
export function msChicoActual(c, ahora = Date.now()) {
  if (!estaCorriendo(c)) return 0;
  return Math.max(0, ahora - ms(esLegado(c) ? c.HoraApertura : c.InicioChico));
}

/** Dinero del tiempo: minutos redondeados hacia arriba × tarifa/60 (igual que el API). */
export function cobroTiempo(c, ahora = Date.now()) {
  if (!c.TarifaPorHora) return 0;
  return Math.round((Math.ceil(msJugados(c, ahora) / 60000) * c.TarifaPorHora) / 60);
}

export function iniciarChico(c, ahora = Date.now()) {
  if (estaCorriendo(c)) return c;
  return { ...c, MsAcumulados: c.MsAcumulados ?? 0, InicioChico: new Date(ahora).toISOString() };
}

export function terminarChico(c, ahora = Date.now()) {
  if (!estaCorriendo(c)) return c;
  return { ...c, MsAcumulados: msJugados(c, ahora), InicioChico: null };
}

export function hms(msTotal) {
  const s = Math.max(0, Math.floor(msTotal / 1000));
  return [Math.floor(s / 3600), Math.floor((s % 3600) / 60), s % 60].map((x) => String(x).padStart(2, '0')).join(':');
}
