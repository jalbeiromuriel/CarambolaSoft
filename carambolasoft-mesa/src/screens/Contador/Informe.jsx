import { useState } from 'react';
// Informe de la partida (chico). Réplica del informe de la maqueta; imprime/guarda como PDF con window.print().
// Los VALORES (consumo, tiempo, total) solo llegan aquí tras el PIN de administrador.
import Replay from './Replay.jsx';
import Tablero from './Tablero.jsx';
import Tactico from './Tactico.jsx';
import { GLOSARIO } from '../../marcador/tactico.js';
import { compartirTarjeta } from '../../marcador/tarjeta.js';
import { estadisticas, ranking, hms, valorTiempo, analisisPartida } from '../../marcador/logica.js';

const cop = (n) => '$' + Math.round(n).toLocaleString('es-CO');
const num2 = (n) => n.toFixed(2);

/** Arma todo lo que muestra el informe a partir del estado final del chico. */
export function construirInforme({ mesa, cuenta, modo, jugadores, durSeg, ganador, reto, retoInicial, consumo }) {
  const filas = ranking(jugadores.map((j) => ({ ...j, ...estadisticas(j.marcas), puntajeOrden: estadisticas(j.marcas).puntaje, puntaje: estadisticas(j.marcas).puntaje })));
  const totalC = filas.reduce((s, j) => s + j.puntaje, 0);
  const totalE = filas.reduce((s, j) => s + j.entradas, 0);
  let hr = 0, hrN = '—';
  filas.forEach((j) => { if (j.mejor > hr) { hr = j.mejor; hrN = j.nombre; } });
  let bestAve = -1, bestAveN = '—';
  filas.forEach((j) => { if (j.entradas > 0 && j.promedio > bestAve) { bestAve = j.promedio; bestAveN = j.nombre; } });
  const eq = (n) => filas.filter((j) => j.Equipo === n).reduce((s, j) => s + j.puntaje, 0);
  const aTot = eq(1), bTot = eq(2);
  const dif = modo === 'ind' && filas.length >= 2 ? filas[0].puntaje - filas[1].puntaje : null;

  let textoGanador = '—';
  if (ganador.empate) textoGanador = 'Empate';
  else if (modo === 'par') textoGanador = ganador.equipo ? `Pareja ${ganador.equipo === 1 ? 'A' : 'B'}` : '—';
  else if (ganador.ids[0]) textoGanador = filas.find((j) => j.Id === ganador.ids[0])?.nombre ?? '—';

  const tarifa = cuenta.TarifaPorHora ?? 0;
  const tiempoSeg = Math.max(0, (Date.now() - new Date(cuenta.HoraApertura).getTime()) / 1000);
  const tiempoValor = tarifa ? valorTiempo(tiempoSeg, tarifa) : 0;
  const total = consumo.reduce((s, c) => s + c.valor, 0) + tiempoValor;

  return {
    fecha: new Date().toLocaleString('es-CO', { dateStyle: 'long', timeStyle: 'short' }),
    mesa: mesa.Numero, modo, dur: hms(durSeg), filas, totalC, totalE, hr, hrN, bestAve, bestAveN, aTot, bTot, dif,
    textoGanador, empate: ganador.empate, reto, rompioReto: Boolean(reto && reto.serie > retoInicial),
    consumo, tarifa, tiempo: hms(tiempoSeg), tiempoValor, total,
    analisis: analisisPartida(modo, jugadores),
  };
}

/** La carrera: puntaje acumulado de cada jugador (o pareja) jugada a jugada. Los puntos blancos son cambios de líder. */
function Carrera({ a }) {
  const w = 700, h = 230, px = 34, py = 18;
  const maxY = Math.max(1, ...a.lineas.map((l) => Math.max(...l.puntos)));
  const X = (i) => px + (i / Math.max(1, a.jugadas)) * (w - px * 2);
  const Y = (v) => h - py - (v / maxY) * (h - py * 2);
  const paso = (l) => l.puntos.map((v, i) => (i === 0 ? `M${X(0)},${Y(v)}` : `L${X(i)},${Y(l.puntos[i - 1])} L${X(i)},${Y(v)}`)).join(' ');
  return (
    <div>
      <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', display: 'block' }} role="img" aria-label="Carrera de la partida: carambolas acumuladas por jugada">
        {[0, 0.5, 1].map((f) => <g key={f}><line x1={px} x2={w - px} y1={Y(maxY * f)} y2={Y(maxY * f)} stroke="#e6e9ef" /><text x={px - 6} y={Y(maxY * f) + 4} fontSize="11" fill="#98a2b4" textAnchor="end">{Math.round(maxY * f)}</text></g>)}
        {a.lineas.map((l) => <path key={l.clave} d={paso(l)} fill="none" stroke={l.color} strokeWidth="3.5" strokeLinejoin="round" />)}
        {a.cambios.map((k) => <circle key={k.jugada} cx={X(k.jugada)} cy={Y(a.lineas[k.a].puntos[k.jugada])} r="6" fill="#fff" stroke={a.lineas[k.a].color} strokeWidth="3" />)}
        {a.lineas.map((l) => <text key={`t${l.clave}`} x={w - px + 4} y={Y(l.puntos.at(-1)) + 4} fontSize="12" fontWeight="700" fill={l.color}>{l.puntos.at(-1)}</text>)}
      </svg>
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 12, color: '#5a6678', marginTop: 4 }}>
        {a.lineas.map((l) => <span key={l.clave}><b style={{ color: l.color }}>━</b> {l.nombre}</span>)}
        <span style={{ marginLeft: 'auto' }}>○ cambio de líder · {a.cambios.length} en {a.jugadas} jugadas</span>
      </div>
    </div>
  );
}

const bt = (c) => ({ background: 'rgba(0,0,0,.5)', border: `1.5px solid ${c}`, color: c, borderRadius: 10, padding: '11px 16px', fontWeight: 800, letterSpacing: 1, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13 });

export default function Informe({ d, onPdf, onInicio, onCobrar, textoInicio = '▶ VOLVER AL INICIO' }) {
  const [msg, setMsg] = useState('');
  const [replay, setReplay] = useState(false);
  const [tablero, setTablero] = useState(false);
  const maxScore = Math.max(1, ...d.filas.map((j) => j.puntaje));
  return (
    <div className="ct-modal on" style={{ background: 'rgba(2,5,12,.78)' }}>
      <Tactico d={d} acciones={<>
          {msg && <div style={{ width: '100%', textAlign: 'center', color: 'var(--verde)', fontSize: 13 }}>{msg}</div>}
          {d.analisis?.series && d.analisis.jugadas > 0 && <button style={bt('var(--cian)')} onClick={() => setTablero(true)}>📊 TABLERO</button>}
          {d.analisis?.jugadas > 0 && <button style={bt('var(--amarillo)')} onClick={() => setReplay(true)}>🎬 REPLAY</button>}
          <button style={bt('var(--magenta)')} onClick={async () => { const r = await compartirTarjeta(d); setMsg(r === 'descargada' ? 'Tarjeta descargada ✔' : ''); }}>📲 COMPARTIR</button>
          <button style={bt('var(--cian)')} onClick={onPdf}>⬇ PDF</button>
          {onCobrar && <button style={bt('var(--verde)')} onClick={onCobrar}>💵 COBRAR LA CUENTA</button>}
          <button style={bt('var(--verde)')} onClick={onInicio}>{textoInicio}</button>
      </>} />
      <div className="ct-repwrap ct-paper">
        <div className="ct-report ct-print-area">
          <div className="ct-rep-head">
            <div className="ct-rep-title">MERO PARCHE<small>INFORME DE PARTIDA · CARAMBOLA</small></div>
            <div className="ct-rep-meta">{d.fecha}<br />Mesa {String(d.mesa).padStart(2, '0')} · Modo {d.modo === 'ind' ? 'Individual' : 'Parejas'}<br />Duración: {d.dur}</div>
          </div>
          <div className="ct-rep-cards">
            <div className="ct-rep-card"><div className="ct-l">Ganador</div><div className="ct-v oro">{d.textoGanador}</div></div>
            <div className="ct-rep-card"><div className="ct-l">Total carambolas</div><div className="ct-v">{d.totalC}</div></div>
            <div className="ct-rep-card"><div className="ct-l">Entradas</div><div className="ct-v">{d.totalE}</div></div>
            <div className="ct-rep-card"><div className="ct-l">Serie más alta</div><div className="ct-v oro">{d.hr}</div></div>
          </div>

          {d.modo === 'par' && (<>
            <div className="ct-rep-sec">Marcador por pareja</div>
            <table className="rep"><tbody>
              <tr className={d.aTot > d.bTot ? 'win' : ''}><td>Pareja A{d.aTot > d.bTot ? ' 🏆' : ''}</td><td className="num" style={{ fontSize: 20 }}>{d.aTot}</td></tr>
              <tr className={d.bTot > d.aTot ? 'win' : ''}><td>Pareja B{d.bTot > d.aTot ? ' 🏆' : ''}</td><td className="num" style={{ fontSize: 20 }}>{d.bTot}</td></tr>
            </tbody></table>
          </>)}

          {d.analisis && d.analisis.jugadas > 0 && (<>
            <div className="ct-rep-sec">La carrera</div>
            <Carrera a={d.analisis} />
            {d.analisis.premios.length > 0 && (<>
              <div className="ct-rep-sec">Los premios de la noche</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 10 }}>
                {d.analisis.premios.map((p) => (
                  <div key={p.titulo} style={{ border: '1px solid #e6e9ef', borderRadius: 10, padding: '10px 12px', display: 'flex', gap: 10, alignItems: 'center', breakInside: 'avoid' }}>
                    <span style={{ fontSize: 30 }}>{p.emoji}</span>
                    <div style={{ textAlign: 'left' }}><div style={{ fontSize: 10, letterSpacing: 1.5, color: '#c026d3', fontWeight: 700 }}>{p.titulo.replace(/^EL /, '')}</div><div style={{ fontWeight: 700, fontSize: 16, color: '#0e1524' }}>{p.nombre}</div><div style={{ fontSize: 11.5, color: '#5a6678' }}>{p.detalle}</div></div>
                  </div>
                ))}
              </div>
            </>)}
          </>)}

          <div className="ct-rep-sec">Ranking de jugadores</div>
          <table className="rep">
            <thead><tr><th>Pos</th><th>Jugador</th><th style={{ textAlign: 'right' }}>Caramb.</th><th style={{ textAlign: 'right' }}>Entr.</th><th style={{ textAlign: 'right' }}>Prom.</th><th style={{ textAlign: 'right' }}>Mejor</th><th>Progreso</th></tr></thead>
            <tbody>
              {d.filas.map((j, i) => {
                const gana = !d.empate && (d.modo === 'ind' ? i === 0 && j.puntaje > 0 : false);
                return (
                  <tr key={j.Id} className={gana ? 'win' : ''}>
                    <td>{i + 1}{gana ? ' 🏆' : ''}</td>
                    <td>{j.nombre}{j.esInvitado && <span style={{ color: '#c98a17', fontSize: 11 }}> (invitado)</span>}{d.modo === 'par' && <span style={{ color: '#98a2b4', fontSize: 12 }}> · {j.Equipo === 1 ? 'Pareja A' : 'Pareja B'}</span>}</td>
                    <td className="num">{j.puntaje}</td><td className="num">{j.entradas}</td>
                    <td className="num oro">{num2(j.promedio)}</td><td className="num">{j.mejor}</td>
                    <td style={{ width: 120 }}><div className="ct-bar"><span style={{ width: `${Math.round((j.puntaje / maxScore) * 100)}%` }} /></div></td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <div className="ct-rep-sec">Análisis del juego</div>
          <div className="ct-rep-insights"><ul>
            <li>Serie más larga de la partida: <b>{d.hr} carambolas</b>{d.hrN !== '—' && ` (${d.hrN})`}.</li>
            {d.bestAveN !== '—' && <li>Mejor promedio: <b>{d.bestAveN}</b> con {num2(d.bestAve)} carambolas por entrada.</li>}
            {d.dif !== null && <li>{d.dif === 0 ? <>El primer y segundo lugar terminaron <b>empatados</b>.</> : <>Diferencia entre 1° y 2°: <b>{d.dif} carambola{d.dif === 1 ? '' : 's'}</b>.</>}</li>}
            <li>{d.rompioReto
              ? <>🏆 <b>¡Récord del Parche roto!</b> {d.reto.nombre} clavó una tacada de {d.reto.serie} — nuevo récord a tumbar.</>
              : <>Récord a tumbar: <b>{d.reto ? `${d.reto.nombre} · ${d.reto.serie}` : 'sin marca'}</b>. {d.reto ? 'Nadie lo superó esta partida.' : 'El primero en anotar lo estrena.'}</>}</li>
          </ul></div>

          <div className="ct-rep-sec">Consumo de la mesa (caja)</div>
          <table className="rep"><tbody>
            {d.consumo.map((c) => <tr key={c.productoId}><td>{c.nombre} <span style={{ color: '#98a2b4' }}>x{c.cantidad}</span></td><td className="num">{cop(c.valor)}</td></tr>)}
            {d.tarifa > 0 && <tr><td>Tiempo de mesa <span style={{ color: '#98a2b4' }}>{d.tiempo}</span></td><td className="num">{cop(d.tiempoValor)}</td></tr>}
            {d.consumo.length === 0 && d.tarifa === 0 && <tr><td colSpan={2} style={{ color: '#98a2b4' }}>Sin consumo registrado.</td></tr>}
          </tbody></table>
          <div className="ct-rep-total"><span>TOTAL A COBRAR</span><span>{cop(d.total)}</span></div>
          <div className="ct-rep-sec">Glosario para los despistados</div>
          <table className="rep"><tbody>
            {[...GLOSARIO.premios, ...GLOSARIO.terminos].map(([t, x]) => <tr key={t}><td style={{ width: '32%', fontWeight: 700 }}>{t}</td><td style={{ color: '#3a4658', fontWeight: 400 }}>{x}</td></tr>)}
          </tbody></table>
          <div className="ct-rep-foot">Generado por CarambolaSoft · {d.fecha} · Documento interno de Mero Parche</div>
        </div>
      </div>
      {replay && <Replay d={d} onCerrar={() => setReplay(false)} />}
      {tablero && <Tablero d={d} onCerrar={() => setTablero(false)} />}
    </div>
  );
}
