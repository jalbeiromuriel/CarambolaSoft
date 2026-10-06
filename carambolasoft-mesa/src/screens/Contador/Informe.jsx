// Informe de la partida (chico). Réplica del informe de la maqueta; imprime/guarda como PDF con window.print().
// Los VALORES (consumo, tiempo, total) solo llegan aquí tras el PIN de administrador.
import { estadisticas, ranking, hms, valorTiempo } from '../../marcador/logica.js';

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
  };
}

export default function Informe({ d, onPdf, onInicio, onCobrar }) {
  const maxScore = Math.max(1, ...d.filas.map((j) => j.puntaje));
  return (
    <div className="ct-modal on" style={{ background: 'rgba(2,5,12,.78)' }}>
      <div className="ct-repwrap">
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
          <div className="ct-rep-foot">Generado por CarambolaSoft · {d.fecha} · Documento interno de Mero Parche</div>
        </div>
        <div className="ct-rep-actions">
          <button className="ct-finPdf" onClick={onPdf}>⬇ DESCARGAR PDF</button>
          <button className="ct-finInicio" onClick={onInicio}>▶ VOLVER AL INICIO</button>
          <button className="ct-finInicio" onClick={onCobrar}>💵 COBRAR LA CUENTA</button>
        </div>
      </div>
    </div>
  );
}
