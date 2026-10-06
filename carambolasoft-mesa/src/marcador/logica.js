// ============================================================
//  CarambolaSoft — Mero Parche
//  marcador/logica.js — reglas PURAS del Marcador (sin React ni IndexedDB).
//  Reglas confirmadas por Albeiro (2026-10-06):
//    · Solo se registra el número de carambolas de cada serie; NO existe la entrada en 0.
//    · Récord por jugador = su tacada (serie) más alta. Se supera solo con una serie MAYOR.
//    · Invitados juegan y suman, pero no cuentan para récord ni rivalidades.
//    · Máximo 4 jugadores por chico. Un empate no marca ganador.
//    · Corregir última = anular la serie y, si el valor corregido es >= 1, registrar otra (nunca se edita ni se borra).
// ============================================================

export const MAX_JUGADORES = 4;
export const MAX_SERIE = 99;           // dos dígitos: bolas 1-9 y el botón "+"

/** Marcas vigentes (no anuladas), en el orden en que llegaron. */
export function vigentes(marcas) {
  return marcas.filter((m) => !m.Anulada);
}

/** Estadísticas de una tarjeta. Entradas = series contadas (no hay entrada en 0). */
export function estadisticas(marcas) {
  const v = vigentes(marcas);
  const puntaje = v.reduce((s, m) => s + m.CarambolasEnMarca, 0);
  const entradas = v.length;
  return {
    puntaje,
    entradas,
    ultima: entradas ? v[entradas - 1].CarambolasEnMarca : 0,
    mejor: entradas ? Math.max(...v.map((m) => m.CarambolasEnMarca)) : 0,
    promedio: entradas ? puntaje / entradas : 0,
  };
}

/** ¿Cabe otro jugador? Máximo 4 (decisión #2). */
export function puedeAgregar(participantes) {
  return participantes.length < MAX_JUGADORES;
}

/** Serie de dos dígitos con la bola 0: "1","2" → 12. "05" → 5. "00" → null (no existe la serie en 0). */
export function componerSerie(digitos) {
  const v = parseInt(digitos, 10);
  return Number.isFinite(v) && v > 0 ? Math.min(v, MAX_SERIE) : null;
}

/**
 * Plan para "Corregir última" (−/+). Devuelve null si no hay cambio.
 * { anular: <Id de la serie>, nueva: <valor >= 1 | null> }  (nueva null = solo se anula)
 */
export function planCorreccion(ultimaMarca, delta) {
  if (!ultimaMarca || ultimaMarca.Anulada) return null;
  const nv = Math.min(MAX_SERIE, ultimaMarca.CarambolasEnMarca + delta);
  if (nv === ultimaMarca.CarambolasEnMarca) return null;
  return { anular: ultimaMarca.Id, nueva: nv >= 1 ? nv : null };
}

/** Récord de un jugador = su mejor serie vigente, sobre TODAS sus marcas. */
export function recordDeMarcas(marcas) {
  const v = vigentes(marcas);
  return v.length ? Math.max(...v.map((m) => m.CarambolasEnMarca)) : 0;
}

/** Una serie rompe el récord solo si es estrictamente mayor. */
export function rompeRecord(serie, recordActual) {
  return serie > recordActual;
}

/**
 * Reto del Parche: la tacada más alta de todos los jugadores REGISTRADOS.
 * @param {{Id:string, Nombre:string, RecordCarambolas:number}[]} jugadores
 * @returns {{jugadorId, nombre, serie}|null} null = aún sin récord
 */
export function retoDelParche(jugadores) {
  let mejor = null;
  for (const j of jugadores) {
    if (j.RecordCarambolas > 0 && (!mejor || j.RecordCarambolas > mejor.serie)) {
      mejor = { jugadorId: j.Id, nombre: j.Nombre, serie: j.RecordCarambolas };
    }
  }
  return mejor;
}

/**
 * Ganador(es). Un empate o un partido en 0 NO marca ganador (decisión #8: la rivalidad cuenta al declarar ganador).
 * @param {'ind'|'par'} modo
 * @param {{Id:string, Equipo:number|null, puntaje:number}[]} jugadores
 * @returns {{ids:string[], empate:boolean, equipo:number|null}}
 */
export function ganadores(modo, jugadores) {
  if (modo === 'par') {
    const tot = { 1: 0, 2: 0 };
    for (const j of jugadores) if (j.Equipo === 1 || j.Equipo === 2) tot[j.Equipo] += j.puntaje;
    if (tot[1] === tot[2]) return { ids: [], empate: tot[1] > 0, equipo: null };
    const eq = tot[1] > tot[2] ? 1 : 2;
    return { ids: jugadores.filter((j) => j.Equipo === eq).map((j) => j.Id), empate: false, equipo: eq };
  }
  const max = Math.max(0, ...jugadores.map((j) => j.puntaje));
  const tops = jugadores.filter((j) => j.puntaje === max);
  if (max === 0) return { ids: [], empate: false, equipo: null };
  if (tops.length > 1) return { ids: [], empate: true, equipo: null };
  return { ids: [tops[0].Id], empate: false, equipo: null };
}

/** Ranking por puntaje (mayor a menor). Estable: a igual puntaje, mantiene el orden de llegada. */
export function ranking(jugadores) {
  return [...jugadores].sort((a, b) => b.puntaje - a.puntaje);
}

/** Tiempo de mesa: minuto completo hacia arriba, igual que CuentasController.Liquidar (ceil(min) × tarifa / 60). */
export function minutosCobrables(segundos) {
  return Math.ceil(Math.max(0, segundos) / 60);
}
export function valorTiempo(segundos, tarifaPorHora) {
  return Math.round((minutosCobrables(segundos) * tarifaPorHora) / 60);
}

export function hms(segundos) {
  const s = Math.max(0, Math.floor(segundos));
  const p = (n) => String(n).padStart(2, '0');
  return `${p(Math.floor(s / 3600))}:${p(Math.floor((s % 3600) / 60))}:${p(s % 60)}`;
}

// ============================================================
//  Análisis de la partida (carrera, premios). Se calcula al finalizar, ANTES de borrar el detalle,
//  y queda dentro del informe guardado.
// ============================================================
const COLORES_PAPEL = ['#0891b2', '#c026d3', '#16a34a', '#d97706'];   // legibles sobre el informe blanco
const COLORES_NEON = ['#2dd4ee', '#e879f9', '#4ade80', '#fbbf24'];     // para la tarjeta oscura

/**
 * @param {'ind'|'par'} modo
 * @param {{Id:string, nombre:string, Equipo:number|null, esInvitado:boolean, marcas:object[]}[]} jugadores
 * @returns carrera (una línea por jugador, o por pareja), cambios de liderato, remontada y premios.
 */
export function analisisPartida(modo, jugadores) {
  const claveDe = (j) => (modo === 'par' ? `eq${j.Equipo}` : j.Id);
  const lineas = [];
  const idx = new Map();
  jugadores.forEach((j) => {
    const k = claveDe(j);
    if (!idx.has(k)) { idx.set(k, lineas.length); lineas.push({ clave: k, nombre: modo === 'par' ? `Pareja ${j.Equipo === 1 ? 'A' : 'B'}` : j.nombre, color: COLORES_PAPEL[lineas.length % 4], neon: COLORES_NEON[lineas.length % 4], puntos: [0] }); }
  });

  // Todas las series vigentes en orden de llegada = "jugadas" de la partida.
  const jugadas = jugadores
    .flatMap((j) => vigentes(j.marcas).map((m) => ({ k: claveDe(j), jugadorId: j.Id, nombre: j.nombre, valor: m.CarambolasEnMarca, t: m.MarcaTiempo })))
    .sort((a, b) => (a.t < b.t ? -1 : a.t > b.t ? 1 : 0));

  const acum = lineas.map(() => 0);
  const cambios = [];
  let lider = null, maxDeficit = new Map();
  jugadas.forEach((jg, i) => {
    acum[idx.get(jg.k)] += jg.valor;
    lineas.forEach((l, n) => l.puntos.push(acum[n]));
    const max = Math.max(...acum);
    const tops = acum.filter((a) => a === max).length;
    const nuevo = tops === 1 ? acum.indexOf(max) : lider;       // un empate no cambia al líder
    if (nuevo !== lider) { if (lider !== null) cambios.push({ jugada: i + 1, de: lider, a: nuevo, jugadorId: jg.jugadorId, nombre: jg.nombre }); lider = nuevo; }
    lineas.forEach((l, n) => { maxDeficit.set(n, Math.max(maxDeficit.get(n) ?? 0, max - acum[n])); });
  });

  const finales = acum.slice();
  const maxFinal = Math.max(0, ...finales);
  const ganadorLinea = maxFinal > 0 && finales.filter((f) => f === maxFinal).length === 1 ? finales.indexOf(maxFinal) : null;
  const remontada = ganadorLinea !== null && (maxDeficit.get(ganadorLinea) ?? 0) >= 5
    ? { linea: ganadorLinea, nombre: lineas[ganadorLinea].nombre, deficit: maxDeficit.get(ganadorLinea) } : null;

  // ---- premios (por jugador, también en parejas) ----
  const st = jugadores.map((j) => ({ j, ...estadisticas(j.marcas), serie: vigentes(j.marcas).map((m) => m.CarambolasEnMarca) }));
  const premios = [];
  const dar = (emoji, titulo, jugador, detalle) => premios.push({ emoji, titulo, jugadorId: jugador.Id, nombre: jugador.nombre, detalle });
  const mayor = (arr, f) => arr.reduce((b, x) => (b === null || f(x) > f(b) ? x : b), null);

  const conVarias = st.filter((s) => s.entradas >= 2);
  const fr = mayor(conVarias.length ? conVarias : st.filter((s) => s.entradas >= 1), (s) => s.promedio);
  if (fr && fr.entradas) dar('🎯', 'EL FRANCOTIRADOR', fr.j, `promedio ${fr.promedio.toFixed(2)} por entrada`);
  const tk = mayor(st, (s) => s.mejor);
  if (tk && tk.mejor > 0) dar('🔨', 'EL TANQUE', tk.j, `tacada de ${tk.mejor}`);
  const regulares = st.filter((s) => s.entradas >= 3).map((s) => {
    const m = s.promedio; const sd = Math.sqrt(s.serie.reduce((a, v) => a + (v - m) ** 2, 0) / s.entradas);
    return { ...s, sd };
  });
  const fr2 = regulares.length ? regulares.reduce((b, s) => (s.sd < b.sd ? s : b)) : null;
  if (fr2) dar('🧊', 'EL FRÍO', fr2.j, 'el más parejo: casi siempre la misma serie');
  if (remontada) {
    const j = jugadores.find((x) => claveDe(x) === lineas[remontada.linea].clave && st.find((s) => s.j === x)?.entradas) ?? jugadores[0];
    const quien = modo === 'par' ? jugadores.find((x) => claveDe(x) === lineas[remontada.linea].clave) : j;
    dar('🔥', 'EL REMONTADOR', quien, `venía ${remontada.deficit} abajo y la volteó`);
  } else if (ganadorLinea !== null && cambios.length === 0) {
    const g = jugadores.find((x) => claveDe(x) === lineas[ganadorLinea].clave);
    dar('👑', 'EL DOMINADOR', g, 'mandó de principio a fin');
  }
  if (cambios.length) {
    const u = cambios[cambios.length - 1];
    dar('🧨', 'EL VERDUGO', jugadores.find((x) => x.Id === u.jugadorId), `la serie que le dio el partido (jugada ${u.jugada})`);
  }
  const series = jugadas.map((jg) => ({ linea: idx.get(jg.k), valor: jg.valor, jugador: jg.nombre }));
  return { modo, lineas, jugadas: jugadas.length, series, cambios, remontada, premios };
}
