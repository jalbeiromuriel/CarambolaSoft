// INFORME TÁCTICO — pantalla principal tras finalizar un chico. Mezcla del informe de terminal ("core system")
// con la carrera y los premios neón. Misma fuente de datos que la tarjeta PNG: resumenTactico(d).
import { resumenTactico, GLOSARIO } from '../../marcador/tactico.js';

const MONO = "'JetBrains Mono','Fira Code',ui-monospace,SFMono-Regular,Consolas,'Courier New',monospace";
const K = { fondo: '#060a12', borde: '#1e3a4a', cian: '#2dd4ee', oro: '#fbbf24', mag: '#e879f9', verde: '#4ade80', txt: '#d7e4f5', mute: '#6b8199' };
const marco = (color = K.borde) => ({ border: `3px double ${color}`, borderRadius: 4, padding: '10px 14px', background: 'rgba(8,16,26,.7)' });
const sec = (t, c = K.cian) => <div style={{ color: c, fontWeight: 800, letterSpacing: 2, fontSize: 12, marginBottom: 8 }}>▌{t}</div>;

function negrita(s) { return s.split('**').map((p, i) => (i % 2 ? <b key={i} style={{ color: K.oro }}>{p}</b> : <span key={i}>{p}</span>)); }

function Carrera({ a }) {
  const w = 700, h = 210, px = 30, py = 14;
  const maxY = Math.max(1, ...a.lineas.map((l) => Math.max(...l.puntos)));
  const X = (i) => px + (i / Math.max(1, a.jugadas)) * (w - px - 30), Y = (v) => h - py - (v / maxY) * (h - py * 2);
  const paso = (l) => l.puntos.map((v, i) => (i === 0 ? `M${X(0)},${Y(v)}` : `L${X(i)},${Y(l.puntos[i - 1])} L${X(i)},${Y(v)}`)).join(' ');
  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', display: 'block' }} role="img" aria-label="Carrera de la partida">
      {[0, 0.5, 1].map((f) => <g key={f}><line x1={px} x2={w - 30} y1={Y(maxY * f)} y2={Y(maxY * f)} stroke={K.borde} strokeDasharray="3 5" /><text x={px - 5} y={Y(maxY * f) + 4} fontSize="10" fill={K.mute} textAnchor="end" fontFamily={MONO}>{Math.round(maxY * f)}</text></g>)}
      {a.lineas.map((l) => <path key={l.clave} d={paso(l)} fill="none" stroke={l.neon} strokeWidth="3.5" strokeLinejoin="round" style={{ filter: `drop-shadow(0 0 5px ${l.neon})` }} />)}
      {a.cambios.map((k) => <circle key={k.jugada} cx={X(k.jugada)} cy={Y(a.lineas[k.a].puntos[k.jugada])} r="6" fill="#fff" stroke={a.lineas[k.a].neon} strokeWidth="3" />)}
      {a.lineas.map((l) => <text key={`t${l.clave}`} x={w - 24} y={Y(l.puntos.at(-1)) + 4} fontSize="12" fontWeight="800" fill={l.neon} fontFamily={MONO}>{l.puntos.at(-1)}</text>)}
    </svg>
  );
}

export default function Tactico({ d, acciones }) {
  const r = resumenTactico(d), a = d.analisis;
  return (
    <div className="ct-tactico" style={{ position: 'fixed', inset: 0, zIndex: 40, overflow: 'auto', background: `radial-gradient(900px 400px at 50% -5%, #0d2b36 0%, transparent 60%), ${K.fondo}`, color: K.txt, fontFamily: MONO, textAlign: 'left', padding: '14px 12px 40px' }}>
      <div style={{ maxWidth: 780, margin: '0 auto', display: 'grid', gap: 12 }}>
        <div style={{ ...marco(K.cian), display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ fontWeight: 800, letterSpacing: 1 }}>⚡ <span style={{ color: K.oro }}>MERO</span> <span style={{ color: K.cian }}>PARCHE</span> <span style={{ color: K.mute }}>· CORE SYSTEM</span></div>
          <div style={{ color: K.cian, fontSize: 13 }}>[ MESA {String(d.mesa).padStart(2, '0')} · INFORME TÁCTICO ]</div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 10 }}>
          {r.kpis.map((k, i) => (
            <div key={k.et} style={{ ...marco(), textAlign: 'center' }}>
              <div style={{ fontSize: 10, color: K.mute, letterSpacing: 1.5 }}>{k.et}</div>
              <div style={{ fontSize: 26, fontWeight: 800, color: [K.cian, K.mag, K.oro, K.verde][i], margin: '4px 0' }}>{k.v}</div>
              <div style={{ fontSize: 11, color: K.mute }}>{k.sub}</div>
            </div>
          ))}
        </div>

        <div style={{ ...marco(K.oro), background: 'linear-gradient(135deg,rgba(251,191,36,.10),rgba(8,16,26,.8))' }}>
          {sec(r.mvp.empate ? 'EMPATE EN LA CIMA' : 'EL MVP DE LA PARTIDA', K.oro)}
          <div style={{ fontSize: 'clamp(28px,7vw,44px)', fontWeight: 900, color: '#fff', textShadow: `0 0 18px ${K.oro}88`, lineHeight: 1.1 }}>{r.mvp.empate ? '¡REVANCHA YA!' : `👑 ${r.mvp.nombre.toUpperCase()}`}</div>
          <div style={{ marginTop: 6, fontSize: 13 }}>Puntaje: <b style={{ color: K.oro }}>{r.mvp.puntaje} pts</b>{r.mvp.promedio !== null && <> &nbsp;|&nbsp; Promedio: <b style={{ color: K.cian }}>{r.mvp.promedio.toFixed(2)} / entrada</b></>}</div>
          {!r.mvp.empate && <div style={{ marginTop: 4, fontSize: 13 }}>🔥 Sello: <b style={{ color: K.mag }}>{r.mvp.sello}</b>{r.mvp.letalidad !== null && <span style={{ color: K.mute }}> (letalidad: {r.mvp.letalidad}% de sus entradas ≥ promedio de la mesa)</span>}</div>}
        </div>

        {a?.jugadas > 0 && (
          <div style={marco()}>
            {sec('LA CARRERA · CAMBIOS DE LÍDER ○', K.cian)}
            <Carrera a={a} />
            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: 12, color: K.mute }}>{a.lineas.map((l) => <span key={l.clave}><b style={{ color: l.neon }}>━</b> {l.nombre}</span>)}<span style={{ marginLeft: 'auto' }}>{a.cambios.length} cambios en {a.jugadas} jugadas</span></div>
          </div>
        )}

        <div style={marco()}>
          {sec('MATRIZ DE RENDIMIENTO · COMPARATIVA DE JUGADORES', K.verde)}
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead><tr style={{ color: K.mute, fontSize: 10, letterSpacing: 1 }}>{['#', 'JUGADOR', 'CARAMB.', 'ENTR.', 'PROM.', 'MEJOR', 'GRÁFICO DE IMPACTO'].map((h) => <th key={h} style={{ textAlign: h === 'JUGADOR' || h === '#' ? 'left' : 'right', padding: '4px 6px', borderBottom: `1px solid ${K.borde}` }}>{h}</th>)}</tr></thead>
              <tbody>
                {r.matriz.map((m, i) => (
                  <tr key={m.nombre + i}>
                    <td style={{ padding: '7px 6px' }}>{m.pos}</td>
                    <td style={{ padding: '7px 6px', fontWeight: 700 }}>{m.nombre}{m.invitado && <span style={{ color: K.oro, fontSize: 10 }}> (inv.)</span>}{d.modo === 'par' && <span style={{ color: K.mute, fontSize: 11 }}> · {m.equipo === 1 ? 'A' : 'B'}</span>}</td>
                    <td style={{ textAlign: 'right', padding: '7px 6px', color: '#fff', fontWeight: 800 }}>{m.caramb}</td>
                    <td style={{ textAlign: 'right', padding: '7px 6px' }}>{m.entr}</td>
                    <td style={{ textAlign: 'right', padding: '7px 6px', color: K.cian }}>{m.prom.toFixed(2)}</td>
                    <td style={{ textAlign: 'right', padding: '7px 6px', color: K.mag }}>{m.mejor}</td>
                    <td style={{ textAlign: 'right', padding: '7px 6px', color: a?.lineas?.[i]?.neon ?? K.verde, whiteSpace: 'nowrap' }}>{m.bloques} {m.pct}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {a?.premios?.length > 0 && (
          <div style={marco(K.mag)}>
            {sec('LOS PREMIOS DE LA NOCHE', K.mag)}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 8 }}>
              {a.premios.map((p) => (
                <div key={p.titulo} style={{ display: 'flex', gap: 10, alignItems: 'center', border: `1px solid ${K.mag}55`, borderRadius: 8, padding: '8px 10px' }}>
                  <span style={{ fontSize: 28 }}>{p.emoji}</span>
                  <div><div style={{ fontSize: 10, letterSpacing: 1.5, color: K.mag, fontWeight: 800 }}>{p.titulo.replace(/^EL /, '')}</div><div style={{ fontWeight: 800, color: '#fff' }}>{p.nombre}</div><div style={{ fontSize: 11, color: K.mute }}>{p.detalle}</div></div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div style={marco()}>
          {sec('INSIGHTS AUTOMÁTICOS DEL PARCHE', K.oro)}
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, lineHeight: 1.75 }}>{r.ins.map((t, i) => <li key={i}>{negrita(t)}</li>)}</ul>
        </div>

        <div style={marco()}>
          {sec('GLOSARIO PARA LOS DESPISTADOS', K.verde)}
          <div style={{ fontSize: 11, letterSpacing: 1.5, color: K.mag, margin: '2px 0 6px' }}>LOS PREMIOS</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: '6px 18px', fontSize: 12.5, lineHeight: 1.5 }}>
            {GLOSARIO.premios.map(([t, x]) => <div key={t}><b style={{ color: '#fff' }}>{t}:</b> <span style={{ color: K.txt }}>{x}</span></div>)}
          </div>
          <div style={{ fontSize: 11, letterSpacing: 1.5, color: K.cian, margin: '12px 0 6px' }}>LAS PALABRAS DEL INFORME</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: '6px 18px', fontSize: 12.5, lineHeight: 1.5 }}>
            {GLOSARIO.terminos.map(([t, x]) => <div key={t}><b style={{ color: K.oro }}>{t}:</b> <span style={{ color: K.txt }}>{x}</span></div>)}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>{acciones}</div>
        <div style={{ textAlign: 'center', color: K.mute, fontSize: 11 }}>{d.fecha} · CarambolaSoft · Mero Parche, Santa Cruz</div>
      </div>
    </div>
  );
}
