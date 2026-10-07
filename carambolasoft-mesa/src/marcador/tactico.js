// Resumen táctico de la partida: UNA sola fuente de datos para la pantalla (Tactico.jsx) y la tarjeta PNG.
import { selloEpico } from './logica.js';

const aSeg = (hms) => hms.split(':').reduce((t, x) => t * 60 + Number(x), 0);
const bloques = (pct, n = 10) => '█'.repeat(Math.round((pct / 100) * n)) + '░'.repeat(n - Math.round((pct / 100) * n));
const cop = (n) => '$' + Math.round(n).toLocaleString('es-CO');

export function resumenTactico(d) {
  const a = d.analisis, filas = d.filas;
  const top = [...filas].sort((x, y) => y.puntaje - x.puntaje)[0];
  const ganadorId = !d.empate && top?.puntaje > 0 ? top.Id : null;
  const mvp = d.modo === 'ind' && top
    ? { nombre: top.nombre, puntaje: top.puntaje, promedio: top.promedio, letalidad: a?.porJugador?.find((x) => x.Id === top.Id)?.letalidad ?? null, sello: a ? selloEpico(a.premios, top.Id) : 'Jugador del Parche', empate: d.empate }
    : { nombre: d.textoGanador, puntaje: Math.max(d.aTot, d.bTot), promedio: null, letalidad: null, sello: 'Pareja del Parche', empate: d.empate };
  const maxP = Math.max(1, ...filas.map((j) => j.puntaje));
  const matriz = filas.map((j, i) => ({ pos: i + 1, nombre: j.nombre, caramb: j.puntaje, entr: j.entradas, prom: j.promedio, mejor: j.mejor, pct: Math.round((j.puntaje / maxP) * 100), bloques: bloques(Math.round((j.puntaje / maxP) * 100)), invitado: j.esInvitado, equipo: j.Equipo }));

  const ins = [];
  ins.push(`Serie más alta de la mesa: **${d.hr} carambolas** consecutivas${d.hrN !== '—' ? ` (${d.hrN})` : ''}.`);
  if (a?.cambios?.length) {
    const u = a.cambios.at(-1);
    ins.push(`Quiebre de juego detectado en la **jugada #${u.jugada}** (${ganadorId && a.porJugador?.find((x) => x.Id === u.jugadorId)?.Id === ganadorId ? 'definición del campeonato' : 'último cambio de líder'}).`);
  }
  if (a?.ventaja?.valor > 0) ins.push(`Mayor ventaja: **${a.lineas[a.ventaja.linea].nombre}** llegó a **+${a.ventaja.valor}** en la jugada #${a.ventaja.jugada}.`);
  if (a?.remontada) ins.push(`Remontada: **${a.remontada.nombre}** venía **${a.remontada.deficit} abajo** y la volteó.`);
  const seg = aSeg(d.dur);
  if (d.totalE > 0 && seg / d.totalE >= 1) ins.push(`Ritmo de mesa: una entrada cada **${Math.round(seg / d.totalE)} s**.`);
  if (a?.series?.length) ins.push(`Mesa caliente: **${Math.round((100 * a.series.filter((s) => s.valor >= 5).length) / a.series.length)}%** de las series fueron de 5 o más.`);
  ins.push(d.rompioReto ? `🏆 **¡Récord del Parche roto!** ${d.reto.nombre} · ${d.reto.serie}.` : d.reto ? `Récord a tumbar: **${d.reto.nombre} · ${d.reto.serie}** — ${d.hr >= d.reto.serie ? 'igualado' : `faltaron ${d.reto.serie - d.hr}`}.` : 'El récord está libre: el primero en anotar lo estrena.');

  const kpis = [
    { et: 'TIEMPO DE COMBATE', v: d.dur, sub: '⏱ duración activa' },
    { et: 'ENTRADAS TOTALES', v: String(d.totalE), sub: '🎯 rondas jugadas' },
    { et: 'CARAMBOLAS', v: String(d.totalC), sub: `⚡ promedio ${(d.totalE ? d.totalC / d.totalE : 0).toFixed(2)}` },
    { et: 'CONSUMO TOTAL MESA', v: cop(d.total), sub: '🍺 consumo + tiempo' },
  ];
  return { mvp, matriz, ins, kpis, ganadorId };
}

/** Glosario para los despistados: lo que significa cada premio y cada término del informe. */
export const GLOSARIO = {
  premios: [
    ['🎯 Mera Puntería', 'El mejor promedio de carambolas por entrada.'],
    ['🎱 Mera Tacada', 'La tacada (serie) más alta de la partida.'],
    ['🔥 Mero Remontador', 'Ganó después de ir perdiendo por 5 o más carambolas.'],
    ['🚀 Mero Patrón', 'Ganó sin que nadie le quitara el primer lugar en toda la partida.'],
  ],
  terminos: [
    ['Carambola', 'Un punto de la partida.'],
    ['Entrada', 'Cada turno de un jugador, en el que anota su serie.'],
    ['Serie o tacada', 'Las carambolas seguidas que hace un jugador en una misma entrada.'],
    ['Promedio', 'Carambolas divididas entre entradas.'],
    ['Letalidad', 'Porcentaje de sus entradas que igualaron o superaron el promedio de la mesa.'],
    ['Cambio de líder', 'Cuando alguien pasa al frente del marcador (el círculo blanco de la carrera).'],
    ['Quiebre de juego', 'La jugada donde se definió el partido: el último cambio de líder.'],
    ['Mayor ventaja', 'La diferencia más grande que sacó el líder sobre el segundo.'],
    ['Mesa caliente', 'Porcentaje de series de 5 o más carambolas.'],
    ['Récord del Parche', 'La tacada más alta de todos los jugadores registrados. Hay que tumbarla para quedarse con él.'],
    ['Sello', 'El premio más pesado que ganó el MVP.'],
    ['Invitado', 'Juega y suma, pero no cuenta para el récord.'],
  ],
};
