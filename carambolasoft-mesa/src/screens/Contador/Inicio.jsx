// Inicio — bienvenida, Reto del Parche (tacada más alta) y accesos. Réplica de MeroParche_Inicio.html.
import { useState, useEffect } from 'react';
import { cargarReto, mesasConCuenta } from '../../marcador/datos.js';

function Bola({ clase, n }) {
  return (
    <svg className={`ct-wball ${clase}`} viewBox="0 0 200 200" aria-hidden="true">
      <g fill="none" stroke="currentColor" strokeWidth="1.4" opacity=".9">
        <circle cx="100" cy="100" r="86" /><ellipse cx="100" cy="100" rx="86" ry="28" /><ellipse cx="100" cy="100" rx="86" ry="56" />
        <ellipse cx="100" cy="100" rx="28" ry="86" /><ellipse cx="100" cy="100" rx="56" ry="86" />
      </g>
      <circle cx="100" cy="100" r="32" fill="#0b0f19" stroke="currentColor" strokeWidth="1.6" />
      <text x="100" y="113" textAnchor="middle" fill="currentColor" fontSize="38" fontWeight="800">{n}</text>
    </svg>
  );
}

export default function Inicio({ salir, abrirSelector, irClientes, jugar }) {
  const [reto, setReto] = useState(null);
  const [mesas, setMesas] = useState(null);
  const [selector, setSelector] = useState(Boolean(abrirSelector));

  useEffect(() => { cargarReto().then(setReto); }, []);
  useEffect(() => { if (selector) mesasConCuenta().then(setMesas); }, [selector]);

  const ocupadas = (mesas ?? []).filter((m) => m.cuenta);

  return (
    <div className="ct-inicio">
      <Bola clase="ct-b3" n="3" /><Bola clase="ct-b9" n="9" /><Bola clase="ct-b2" n="2" />
      <div className="ct-stage">
        <div className="ct-welcome">BIENVENIDO A</div>
        <h1 className="ct-title"><span className="ct-mero">MERO</span> <span className="ct-parche">PARCHE</span></h1>
        <div className="ct-sub">LICORES &amp; BILLAR · SANTA CRUZ</div>

        <div className="ct-reto">
          <div className="ct-pill">👑 RETO DEL PARCHE 👑</div>
          <div className="ct-num">{reto?.serie ?? 0}</div>
          <div className="ct-cap">CARAMBOLAS EN UNA TACADA · RÉCORD A TUMBAR</div>
          <div className="ct-vs">{reto ? 'JUGADOR A VENCER' : 'AÚN SIN RÉCORD'}</div>
          <div className="ct-who">{reto ? reto.nombre : 'El primero lo estrena'}</div>
        </div>

        <button className="ct-cta" onClick={() => setSelector(true)}>¡ TOCÁ AQUÍ PARA JUGAR !</button>
        <button className="ct-cta2" onClick={irClientes}>👥 GESTIONAR CLIENTES</button>
        {salir && <button className="ct-cta2" style={{ marginTop: 10, fontSize: 12, padding: '10px 20px' }} onClick={salir}>◂ VOLVER AL TABLERO DE LA BARRA</button>}
      </div>

      {selector && (
        <div className="ct-selector" onClick={(e) => e.target === e.currentTarget && setSelector(false)}>
          <div className="ct-selcard">
            <h4>¿EN QUÉ MESA VAS A JUGAR? <span onClick={() => setSelector(false)} style={{ cursor: 'pointer', color: 'var(--muted)' }}>✕</span></h4>
            {mesas === null && <p className="ct-selnota">Cargando…</p>}
            {mesas && ocupadas.length === 0 && <p className="ct-selnota">No hay mesas abiertas. Pídele a la barra que abra tu mesa y vuelve a tocar aquí.</p>}
            {ocupadas.map(({ mesa, cuenta }) => (
              <button key={mesa.Id} className="ct-selmesa" onClick={() => jugar(mesa.Id)}>
                <b>MESA {mesa.Numero}</b><span>{cuenta.NombreLibre}</span>
              </button>
            ))}
            {mesas && mesas.filter((m) => !m.cuenta).length > 0 && ocupadas.length > 0 && (
              <p className="ct-selnota">Las mesas sin cuenta las abre la barra.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
