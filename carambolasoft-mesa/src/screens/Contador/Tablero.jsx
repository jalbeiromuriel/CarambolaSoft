// Tablero de la partida (estilo Power BI): KPIs + 5 visuales con FILTRO CRUZADO.
// Toca un jugador (leyenda, barra o columna) y todos los gráficos se filtran a la vez. Vuelve a tocarlo para limpiar.
import { useState } from 'react';

const C = { fondo: '#0b0f19', card: '#111b28', borde: '#243449', txt: '#eaf1fb', mute: '#8497b0', cian: '#2dd4ee', oro: '#fbbf24', verde: '#4ade80', mag: '#e879f9' };
const card = { background: C.card, border: `1px solid ${C.borde}`, borderRadius: 14, padding: '12px 14px', minWidth: 0 };
const titulo = { fontSize: 11, letterSpacing: 2, color: C.cian, fontWeight: 700, marginBottom: 8, textTransform: 'uppercase' };

function Kpi({ etiqueta, valor, sub, color = C.txt }) {
  return (
    <div style={{ ...card, padding: '10px 14px' }}>
      <div style={{ fontSize: 10, letterSpacing: 1.5, color: C.mute, textTransform: 'uppercase' }}>{etiqueta}</div>
      <div style={{ fontSize: 34, fontWeight: 800, color, lineHeight: 1.1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{valor}</div>
      {sub && <div style={{ fontSize: 11, color: C.mute, marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

export default function Tablero({ d, onCerrar }) {
  const a = d.analisis;
  const [sel, setSel] = useState(null);                 // índice de línea filtrada
  const [hover, setHover] = useState(null);             // jugada bajo el puntero en la carrera
  const alternar = (i) => setSel((s) => (s === i ? null : i));
  const op = (i) => (sel === null || sel === i ? 1 : 0.16);
  const claveDe = (j) => (a.modo === 'par' ? `eq${j.Equipo}` : j.Id);
  const lineaDe = (j) => a.lineas.findIndex((l) => l.clave === claveDe(j));

  const filas = d.filas.map((j) => ({ ...j, linea: lineaDe(j) }));
  const prom = d.totalE ? d.totalC / d.totalE : 0;
  const reto = d.reto?.serie ?? 0;
  const maxFinal = Math.max(1, ...a.lineas.map((l) => l.puntos.at(-1)));
  const sFilt = sel === null ? a.series : a.series.filter((s) => s.linea === sel);
  const kpiTotal = sel === null ? d.totalC : a.lineas[sel].puntos.at(-1);
  const kpiEnt = sFilt.length;
  const kpiMejor = sFilt.length ? Math.max(...sFilt.map((s) => s.valor)) : 0;
  const kpiProm = sFilt.length ? sFilt.reduce((t, s) => t + s.valor, 0) / sFilt.length : 0;

  // ---- carrera ----
  const cw = 760, ch = 270, px = 36, py = 16;
  const X = (i) => px + (i / Math.max(1, a.jugadas)) * (cw - px - 14);
  const Y = (v) => ch - py - (v / maxFinal) * (ch - py * 2);
  const paso = (l) => l.puntos.map((v, i) => (i === 0 ? `M${X(0)},${Y(v)}` : `L${X(i)},${Y(l.puntos[i - 1])} L${X(i)},${Y(v)}`)).join(' ');
  const mover = (e) => {
    const r = e.currentTarget.getBoundingClientRect(); const x = ((e.clientX - r.left) / r.width) * cw;
    setHover(Math.round(Math.min(a.jugadas, Math.max(0, ((x - px) / (cw - px - 14)) * a.jugadas))));
  };

  // ---- serie por serie ----
  const sw = 560, sh = 230, sx = 30, sy = 14;
  const maxV = Math.max(1, d.hr, reto);
  const bw = Math.min(46, (sw - sx - 8) / Math.max(1, a.series.length) - 4);
  const SX = (i) => sx + i * ((sw - sx - 8) / Math.max(1, a.series.length));
  const SY = (v) => sh - sy - (v / maxV) * (sh - sy * 2);

  // ---- histograma ----
  const cubos = [[1, 3, '1–3'], [4, 6, '4–6'], [7, 9, '7–9'], [10, 14, '10–14'], [15, 99, '15+']];
  const hist = cubos.map(([lo, hi, et]) => ({ et, por: a.lineas.map((_, n) => a.series.filter((s) => s.linea === n && s.valor >= lo && s.valor <= hi).length) }));
  const maxCubo = Math.max(1, ...hist.map((h) => h.por.reduce((x, y) => x + y, 0)));

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 80, background: C.fondo, color: C.txt, overflow: 'auto', fontFamily: 'inherit', padding: 14, textAlign: 'left' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
        <div style={{ fontWeight: 800, fontSize: 20, letterSpacing: 1 }}><span style={{ color: C.oro }}>MERO</span> <span style={{ color: C.cian }}>PARCHE</span> <span style={{ color: C.mute, fontWeight: 600, fontSize: 13, letterSpacing: 3 }}> · TABLERO DE LA PARTIDA · MESA {String(d.mesa).padStart(2, '0')}</span></div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginLeft: 'auto', alignItems: 'center' }}>
          {a.lineas.map((l, i) => (
            <button key={l.clave} onClick={() => alternar(i)} style={{ background: sel === i ? l.neon : 'transparent', color: sel === i ? '#06141a' : l.neon, border: `1.5px solid ${l.neon}`, borderRadius: 20, padding: '5px 14px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', opacity: op(i) < 1 ? 0.5 : 1 }}>{l.nombre}</button>
          ))}
          {sel !== null && <button onClick={() => setSel(null)} style={{ background: 'transparent', color: C.mute, border: `1px solid ${C.borde}`, borderRadius: 20, padding: '5px 12px', cursor: 'pointer', fontFamily: 'inherit' }}>limpiar filtro</button>}
          <button onClick={onCerrar} style={{ background: 'transparent', color: C.verde, border: `1px solid ${C.verde}`, borderRadius: 10, padding: '6px 14px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>✕ CERRAR</button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 10, marginBottom: 10 }}>
        <Kpi etiqueta="Ganador" valor={d.textoGanador} color={C.oro} sub={d.empate ? 'sin ganador' : `${d.dur} de juego`} />
        <Kpi etiqueta="Carambolas" valor={kpiTotal} sub={sel === null ? 'entre todos' : a.lineas[sel].nombre} />
        <Kpi etiqueta="Entradas" valor={kpiEnt} />
        <Kpi etiqueta="Mejor tacada" valor={kpiMejor} color={C.mag} sub={reto ? `récord a tumbar: ${reto}` : 'sin récord'} />
        <Kpi etiqueta="Promedio" valor={kpiProm.toFixed(2)} color={C.cian} sub="carambolas por entrada" />
        <Kpi etiqueta="Cambios de líder" valor={a.cambios.length} color={C.verde} sub={`en ${a.jugadas} jugadas`} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(340px,1fr))', gap: 10, marginBottom: 10 }}>
        <div style={{ ...card, gridColumn: 'span 2' }}>
          <div style={titulo}>La carrera · carambolas acumuladas por jugada</div>
          <svg viewBox={`0 0 ${cw} ${ch}`} style={{ width: '100%', display: 'block' }} onMouseMove={mover} onMouseLeave={() => setHover(null)} onTouchMove={(e) => mover(e.touches[0] && { currentTarget: e.currentTarget, clientX: e.touches[0].clientX })}>
            {[0, 0.5, 1].map((f) => <g key={f}><line x1={px} x2={cw - 14} y1={Y(maxFinal * f)} y2={Y(maxFinal * f)} stroke={C.borde} /><text x={px - 6} y={Y(maxFinal * f) + 4} fontSize="11" fill={C.mute} textAnchor="end">{Math.round(maxFinal * f)}</text></g>)}
            {a.lineas.map((l, i) => <path key={l.clave} d={paso(l)} fill="none" stroke={l.neon} strokeWidth="3.5" strokeLinejoin="round" opacity={op(i)} onClick={() => alternar(i)} style={{ cursor: 'pointer' }} />)}
            {a.cambios.map((k) => <circle key={k.jugada} cx={X(k.jugada)} cy={Y(a.lineas[k.a].puntos[k.jugada])} r="6" fill="#fff" stroke={a.lineas[k.a].neon} strokeWidth="3" opacity={op(k.a)} />)}
            {hover !== null && (<g pointerEvents="none">
              <line x1={X(hover)} x2={X(hover)} y1={py} y2={ch - py} stroke={C.mute} strokeDasharray="4 4" />
              {a.lineas.map((l, i) => <circle key={l.clave} cx={X(hover)} cy={Y(l.puntos[hover])} r="5" fill={l.neon} opacity={op(i)} />)}
              <g transform={`translate(${Math.min(X(hover) + 10, cw - 150)},${py + 4})`}>
                <rect width="140" height={22 + a.lineas.length * 18} rx="8" fill="#0b0f19" stroke={C.borde} />
                <text x="10" y="16" fontSize="11" fill={C.mute}>JUGADA {hover}</text>
                {a.lineas.map((l, i) => <text key={l.clave} x="10" y={34 + i * 18} fontSize="12" fontWeight="700" fill={l.neon}>{l.nombre}: {l.puntos[hover]}</text>)}
              </g>
            </g>)}
          </svg>
        </div>

        <div style={card}>
          <div style={titulo}>Carambolas por jugador</div>
          <div style={{ display: 'grid', gap: 10 }}>
            {filas.map((j) => {
              const l = a.lineas[j.linea] ?? a.lineas[0]; const dim = sel !== null && sel !== j.linea;
              return (
                <div key={j.Id} onClick={() => alternar(j.linea)} style={{ cursor: 'pointer', opacity: dim ? 0.2 : 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 700 }}><span>{j.nombre}{j.esInvitado && <span style={{ color: C.oro, fontSize: 10 }}> (invitado)</span>}</span><span style={{ color: l.neon }}>{j.puntaje}</span></div>
                  <div style={{ height: 14, background: '#0b1220', borderRadius: 7, overflow: 'hidden' }}><div style={{ width: `${(j.puntaje / Math.max(1, ...filas.map((x) => x.puntaje))) * 100}%`, height: '100%', background: l.neon, borderRadius: 7 }} /></div>
                  <div style={{ fontSize: 11, color: C.mute, marginTop: 2 }}>prom {j.promedio.toFixed(2)} · {j.entradas} entr. · mejor {j.mejor}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(320px,1fr))', gap: 10 }}>
        <div style={{ ...card, gridColumn: 'span 2' }}>
          <div style={titulo}>Serie por serie · cada columna es una entrada {reto > 0 && <span style={{ color: C.oro, letterSpacing: 0 }}>— — récord {reto}</span>}</div>
          <svg viewBox={`0 0 ${sw} ${sh}`} style={{ width: '100%', display: 'block' }}>
            {[0, 0.5, 1].map((f) => <g key={f}><line x1={sx} x2={sw - 8} y1={SY(maxV * f)} y2={SY(maxV * f)} stroke={C.borde} /><text x={sx - 5} y={SY(maxV * f) + 4} fontSize="10" fill={C.mute} textAnchor="end">{Math.round(maxV * f)}</text></g>)}
            {a.series.map((s, i) => (
              <g key={i} opacity={op(s.linea)} onClick={() => alternar(s.linea)} style={{ cursor: 'pointer' }}>
                <rect x={SX(i)} y={SY(s.valor)} width={Math.max(4, bw)} height={sh - sy - SY(s.valor)} rx="3" fill={a.lineas[s.linea].neon}><title>{s.jugador}: {s.valor}</title></rect>
                {a.series.length <= 24 && <text x={SX(i) + Math.max(4, bw) / 2} y={SY(s.valor) - 4} fontSize="10" fill={C.txt} textAnchor="middle">{s.valor}</text>}
              </g>
            ))}
            {reto > 0 && <g><line x1={sx} x2={sw - 8} y1={SY(reto)} y2={SY(reto)} stroke={C.oro} strokeDasharray="6 5" strokeWidth="1.5" /><text x={sw - 10} y={SY(reto) - 4} fontSize="10" fill={C.oro} textAnchor="end">récord del Parche</text></g>}
          </svg>
        </div>

        <div style={card}>
          <div style={titulo}>¿Qué tan grandes fueron las series?</div>
          <svg viewBox="0 0 330 200" style={{ width: '100%', display: 'block' }}>
            {hist.map((h, ci) => {
              const bx = 14 + ci * 62; let acc = 0;
              return (
                <g key={h.et}>
                  {h.por.map((n, li) => { if (!n) return null; const hh = (n / maxCubo) * 140, y = 160 - acc - hh; acc += hh; return <rect key={li} x={bx} y={y} width="48" height={hh} rx="3" fill={a.lineas[li].neon} opacity={op(li)} onClick={() => alternar(li)} style={{ cursor: 'pointer' }}><title>{a.lineas[li].nombre}: {n}</title></rect>; })}
                  <text x={bx + 24} y="180" fontSize="11" fill={C.mute} textAnchor="middle">{h.et}</text>
                  <text x={bx + 24} y={160 - acc - 5} fontSize="11" fill={C.txt} textAnchor="middle">{h.por.reduce((x, y) => x + y, 0) || ''}</text>
                </g>
              );
            })}
          </svg>
        </div>

        <div style={card}>
          <div style={titulo}>Frente al récord del Parche</div>
          <div style={{ display: 'grid', gap: 12 }}>
            {filas.map((j) => {
              const l = a.lineas[j.linea] ?? a.lineas[0]; const dim = sel !== null && sel !== j.linea; const tope = Math.max(1, reto, j.mejor);
              return (
                <div key={j.Id} style={{ opacity: dim ? 0.2 : 1, cursor: 'pointer' }} onClick={() => alternar(j.linea)}>
                  <div style={{ fontSize: 12, display: 'flex', justifyContent: 'space-between' }}><b>{j.nombre}</b><span style={{ color: C.mute }}>mejor {j.mejor}{reto ? ` · ${Math.min(100, Math.round((j.mejor / reto) * 100))}% del récord` : ''}</span></div>
                  <div style={{ position: 'relative', height: 14, background: '#0b1220', borderRadius: 7, marginTop: 3 }}>
                    <div style={{ width: `${(j.mejor / tope) * 100}%`, height: '100%', background: l.neon, borderRadius: 7 }} />
                    {reto > 0 && <div style={{ position: 'absolute', left: `${(reto / tope) * 100}%`, top: -3, height: 20, width: 3, background: C.oro, borderRadius: 2 }} />}
                  </div>
                </div>
              );
            })}
            {a.premios.length > 0 && <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
              {a.premios.map((p) => <span key={p.titulo} title={p.detalle} style={{ border: `1px solid ${C.borde}`, borderRadius: 16, padding: '3px 10px', fontSize: 12 }}>{p.emoji} {p.titulo.replace('EL ', '')}: <b>{p.nombre}</b></span>)}
            </div>}
          </div>
        </div>
      </div>
    </div>
  );
}
