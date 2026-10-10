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

/** Ms que se le cobran a la cuenta: lo que corrió su reloj ± lo que se repartió al terminar un chico (MsAjuste). */
export function msCobrables(c, ahora = Date.now()) {
  return Math.max(0, msJugados(c, ahora) + (c.MsAjuste ?? 0));
}

/** Tarifa por hora con que se cobra el tiempo de la cuenta (la del taxímetro, o la heredada al repartirle tiempo). */
export const tarifaDe = (c) => c.TarifaPorHora || c.TarifaCargada || 0;

/** Dinero del tiempo: minutos redondeados hacia arriba × tarifa/60 (igual que el API). */
export function cobroTiempo(c, ahora = Date.now()) {
  const tarifa = tarifaDe(c);
  if (!tarifa) return 0;
  return Math.round((Math.ceil(msCobrables(c, ahora) / 60000) * tarifa) / 60);
}

/**
 * Al terminar un chico en una mesa con varias cuentas (como el POS): detiene el taxímetro y reparte los minutos del chico.
 * modo 'dividir' = entre todas las cuentas (el sobrante, de a un minuto a las primeras); 'una' = todo a `destinoId`.
 * Devuelve las cuentas a guardar. El reloj de la cuenta con taxímetro conserva su historia; el reparto va en MsAjuste.
 */
export function repartirChico(grupo, taxi, { modo = 'dividir', destinoId = null } = {}, ahora = Date.now()) {
  const ms = msChicoActual(taxi, ahora), min = Math.ceil(ms / 60000);
  const parado = terminarChico(taxi, ahora);
  const quienes = modo === 'una' ? grupo.filter((c) => c.Id === (destinoId ?? taxi.Id)) : grupo;
  const reparto = new Map(quienes.map((c) => [c.Id, 0]));
  if (quienes.length) { const base = Math.floor(min / quienes.length); let resto = min - base * quienes.length; for (const c of quienes) reparto.set(c.Id, base + (resto-- > 0 ? 1 : 0)); }
  return grupo.map((c) => {
    const x = c.Id === taxi.Id ? parado : { ...c };
    const share = (reparto.get(c.Id) ?? 0) * 60000;
    const ajuste = share - (c.Id === taxi.Id ? ms : 0);
    if (!ajuste && !share) return x;
    return { ...x, MsAjuste: (x.MsAjuste ?? 0) + ajuste, ...(c.TarifaPorHora ? {} : { TarifaCargada: taxi.TarifaPorHora }) };
  });
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
