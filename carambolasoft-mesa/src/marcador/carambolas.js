import { etiquetaCliente } from '../cuenta/nombres.js';
// ============================================================
//  CarambolaSoft — Mero Parche
//  marcador/carambolas.js — reglas PURAS de las pantallas de Carambolas (sin React ni IndexedDB).
//  Inicio "¿Quién juega?": solo 1 contra 1 o 2 contra 2, se deduce de cuántos hay por lado.
//  Carrito de lectura: "total aproximado" = consumo + tiempo de ahora y 2 minutos, redondeado a $100.
// ============================================================
import { redondearArriba } from '../cuenta/tiempo.js';
import { estadisticas, vigentes } from './logica.js';

export const MAX_POR_LADO = 2;
export const AUTOOCULTAR_MS = 10_000;     // el total del carrito se oculta solo a los 10 s
export const MARGEN_TOTAL_MS = 2 * 60_000; // el total aproximado mira 2 minutos adelante

/**
 * ¿Se puede empezar con a jugadores en Parchados 1 y b en Parchados 2?
 * @returns {{puedeEmpezar:boolean, modo:'ind'|'par'|null, tono:'normal'|'alerta', mensaje:string}}
 */
export function evaluarInicio(a, b) {
  if (a === 0 && b === 0) {
    return { puedeEmpezar: false, modo: null, tono: 'normal', mensaje: 'Agrega los jugadores en cada lado: 1 contra 1 o 2 contra 2. Al empezar ya no se agregan.' };
  }
  if (a === 1 && b === 1) return { puedeEmpezar: true, modo: 'ind', tono: 'normal', mensaje: '1 contra 1. Toca la X para quitar a alguien. Al empezar ya no se agregan jugadores.' };
  if (a === 2 && b === 2) return { puedeEmpezar: true, modo: 'par', tono: 'normal', mensaje: '2 contra 2. Toca la X para quitar a alguien. Al empezar ya no se agregan jugadores.' };
  if (a === 0 || b === 0) {
    const falta = a === 0 ? 1 : 2;
    return { puedeEmpezar: false, modo: null, tono: 'alerta', mensaje: `Falta al menos un jugador en Parchados ${falta}: 1 contra 1 o 2 contra 2.` };
  }
  // 2 contra 1 (o 1 contra 2): ni 1v1 ni 2v2
  const corto = a < b ? 1 : 2, largo = corto === 1 ? 2 : 1;
  return {
    puedeEmpezar: false, modo: null, tono: 'alerta',
    mensaje: `Falta un jugador en Parchados ${corto} para jugar 2 contra 2, o quita a uno de Parchados ${largo} para jugar 1 contra 1.`,
  };
}

/** Los dos lados de la partida. 1v1: un jugador por lado. 2v2: cada pareja (Equipo 1 y 2). */
export function ladosDe(modo, jugadores) {
  if (modo === 'par') return [1, 2].map((eq) => ({ equipo: eq, miembros: jugadores.filter((j) => j.Equipo === eq) }));
  return jugadores.slice(0, 2).map((j) => ({ equipo: null, miembros: [j] }));
}

/** Estadísticas de un lado (suma las marcas de todos sus integrantes). */
export function statsLado(lado) {
  return estadisticas(lado.miembros.flatMap((j) => j.marcas));
}

/** Índice del lado que va ganando (0 | 1), o null si hay empate o nadie ha anotado. */
export function ladoGanando(statsA, statsB) {
  if (statsA.puntaje === statsB.puntaje) return null;
  return statsA.puntaje > statsB.puntaje ? 0 : 1;
}

/** Última serie vigente entre los jugadores dados: { jugador, marca } o null. */
export function ultimaMarca(jugadores) {
  let u = null;
  for (const j of jugadores) for (const m of vigentes(j.marcas)) if (!u || m.MarcaTiempo >= u.marca.MarcaTiempo) u = { jugador: j, marca: m };
  return u;
}

/** Marcador corto para la tarjeta de la Entrada: "17 — 25". */
export function marcadorCorto(modo, jugadores) {
  const [a, b] = ladosDe(modo, jugadores).map((l) => statsLado(l).puntaje);
  return `${a ?? 0} — ${b ?? 0}`;
}

/** Total aproximado del carrito: consumo + tiempo (ya calculado a ahora + 2 min), redondeado hacia arriba a $100. */
export function totalAproximado(valorConsumo, valorTiempo) {
  return redondearArriba(Math.round(valorConsumo) + Math.round(valorTiempo));
}

/** $25.600 (puntos de miles, sin decimales). */
export function pesos(v) {
  return `$${String(Math.round(v)).replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;
}

/**
 * Nombre de un jugador en el Contador: igual que en las cuentas, PRIMERO el nombre y luego el apodo
 * («Albeiro «El papá»»; sin apodo, «Luis A.»). Un invitado sale tal como lo escribieron.
 */
export const etiquetaJugador = (j) => (j.esInvitado ? (j.nombre || '—') : (etiquetaCliente({ Nombre: j.nombre, Apodo: j.apodo }) || '—'));

/**
 * ¿Dónde está ocupado este cliente? (Pierde y Paga, 2026-11-24)
 * Nadie puede estar en el billar y en la garita a la vez, ni en dos mesas de billar.
 * @param clienteId   cliente que se quiere agregar
 * @param cuentasAbiertas  cuentas ABIERTA (para ver la garita)
 * @param alineaciones  { [mesaId]: [{ clienteId }] } jugadores cargados en cada mesa
 * @param mesaActualId  la mesa donde se está armando (no cuenta como choque)
 * @param nombreMesa  (mesaId) => 'Mesa 3'
 * @returns {{ donde: 'GARITA'|'BILLAR', texto: string } | null}
 */
export function ocupadoEn(clienteId, { cuentasAbiertas = [], alineaciones = {}, mesaActualId = null, nombreMesa = () => 'otra mesa' } = {}) {
  if (!clienteId) return null;
  const garita = cuentasAbiertas.find((c) => c.TipoCuenta === 'GARITA' && c.Estado === 'ABIERTA' && c.ClienteId === clienteId);
  if (garita) return { donde: 'GARITA', texto: 'EN GARITA' };
  for (const [mesaId, lista] of Object.entries(alineaciones)) {
    if (mesaId === mesaActualId) continue;
    if ((lista ?? []).some((j) => j.clienteId === clienteId)) return { donde: 'BILLAR', texto: `EN ${nombreMesa(mesaId).toUpperCase()}` };
  }
  return null;
}
