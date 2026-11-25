// src/components/PierdePaga.jsx — «Terminar chico» en billar: la barra marca quién perdió (maqueta 4, aprobada 2026-11-24).
// Pierde y paga TODO el chico (tiempo + consumo). Individual: uno. Parejas: los dos, mitad y mitad. Reglas en cuenta/pierdePaga.js.
import { useState } from 'react';
import { planPierdePaga } from '../cuenta/pierdePaga.js';

const fmt = (n) => '$' + Math.round(n).toLocaleString('es-CO');

export default function PierdePaga({ mesa, jugadores, marcados: inicial = [], total, cerrar, cobrar, aNombreDeMesa }) {
  const [marcados, setMarcados] = useState(() => new Set(inicial));
  const [ocupado, setOcupado] = useState(false);
  const seleccion = jugadores.filter((j) => marcados.has(j.key));
  const plan = planPierdePaga({ seleccion, total });
  const alternar = (k) => setMarcados((s) => { const n = new Set(s); if (n.has(k)) n.delete(k); else n.add(k); return n; });
  async function ir(fn) { if (ocupado) return; setOcupado(true); try { await fn(); } finally { setOcupado(false); } }

  return (
    <div className="pn-velo alto" onClick={(e) => e.target === e.currentTarget && !ocupado && cerrar()}>
      <div className="pn-modal cb pp" style={{ width: 'min(560px,100%)' }}>
        <h3>Terminar chico · {mesa}</h3>
        <p className="pp-sub">¿Quién perdió? Pierde y paga el chico completo: tiempo y consumo.</p>
        {jugadores.length > 0 ? (<>
          <div className="cb-lab">JUGADORES DE LA MESA · MARCA LOS QUE PIERDEN</div>
          <div className="pp-lista">
            {jugadores.map((j) => (
              <button key={j.key} type="button" className={`pp-j ${marcados.has(j.key) ? 'on' : ''}`} aria-pressed={marcados.has(j.key)} onClick={() => alternar(j.key)}>
                <i aria-hidden="true">{marcados.has(j.key) ? '✓' : ''}</i><span>{j.nombre}</span>
              </button>
            ))}
          </div>
          {inicial.length > 0 && <div className="pp-nota">Marcados según el resultado del Contador. Corrige si hace falta.</div>}
        </>) : (
          <div className="pp-nota">No hay jugadores cargados en esta mesa. Agrégalos en el Contador, o cobra el chico a nombre de la mesa.</div>
        )}
        <div className="pp-total">
          <span>Total del chico{plan.pareja ? ' · cada uno' : ''}</span>
          <b>{plan.pareja ? fmt(plan.partes[0]) : fmt(total)}</b>
        </div>
        {plan.pareja && <div className="pp-nota bien">Pareja perdedora: {plan.nombre}, mitad y mitad ({fmt(total)} en total).</div>}
        {plan.error && jugadores.length > 0 && marcados.size > 0 && <div className="pp-nota">{plan.error}</div>}
        <div className="pn-acc" style={{ marginTop: 16 }}>
          <button className="no" disabled={ocupado} onClick={cerrar}>CANCELAR</button>
          {jugadores.length > 0
            ? <button className="si" disabled={!!plan.error || ocupado} onClick={() => ir(() => cobrar(plan, seleccion))}>{plan.error ? 'MARCA QUIÉN PERDIÓ' : `COBRAR A ${plan.nombre.toUpperCase()}`}</button>
            : <button className="si" disabled={ocupado} onClick={() => ir(aNombreDeMesa)}>COBRAR A NOMBRE DE LA MESA</button>}
        </div>
      </div>
    </div>
  );
}
