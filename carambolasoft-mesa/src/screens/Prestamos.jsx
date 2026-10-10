// src/screens/Prestamos.jsx — Préstamos al personal (solo Admin): la caja le presta efectivo a un empleado/admin y se lo devuelve. Reglas en cuenta/prestamos.js.
import { useState, useEffect, useCallback, useMemo } from 'react';
import Encabezado from '../components/Encabezado.jsx';
import { useSesion } from '../components/Sesion.jsx';
import { PinAdmin } from './Auth.jsx';
import { esAdmin } from '../cuenta/auth.js';
import { saldosPersonal, totalesPersonal, autorizaValido, validarPrestamo, validarDevolucion } from '../cuenta/prestamos.js';
import { cargarPrestamos, prestar, devolver } from '../cuenta/prestamosDb.js';
import { cargarTurno } from '../cuenta/cajaDb.js';
import './Panel.css';
import './Caja.css';
import './Prestamos.css';

const fmt = (n) => (n < 0 ? '−' : '') + '$' + Math.abs(Math.round(n)).toLocaleString('es-CO');
const num = (v) => Number(String(v).replace(/\D/g, '')) || 0;
const fechaHora = (iso) => new Date(iso).toLocaleString('es-CO', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

function PrestarModal({ personas, efectivo, cerrar, guardado }) {
  const { usuario } = useSesion();
  const [pid, setPid] = useState(personas[0]?.Id ?? ''); const [monto, setMonto] = useState(''); const [motivo, setMotivo] = useState('');
  const [pide, setPide] = useState(false); const [error, setError] = useState('');
  const persona = personas.find((p) => p.Id === pid);
  function seguir() {
    const e = validarPrestamo({ persona, monto: num(monto), efectivoCajon: efectivo });
    if (e) { setError(e); return; }
    setError(''); setPide(true);
  }
  return (
    <div className="pn-velo" onClick={(e) => e.target === e.currentTarget && cerrar()}>
      <div className="pn-modal cj-mod">
        <h3>＋ Prestar plata del cajón</h3>
        <p className="cj-nota">Sale efectivo de la caja. No es gasto: te lo devuelven.</p>
        <label>Persona</label>
        <select value={pid} onChange={(e) => setPid(e.target.value)}>{personas.map((p) => <option key={p.Id} value={p.Id}>{p.Nombre} · {esAdmin(p.Rol) ? 'Admin' : 'Empleado'}</option>)}</select>
        <label>Valor</label>
        <input className="cj-hi" autoFocus inputMode="numeric" value={monto ? fmt(num(monto)) : ''} placeholder="$50.000" onChange={(e) => setMonto(e.target.value)} />
        <label>Motivo (opcional)</label>
        <input value={motivo} placeholder="Adelanto para el arriendo" onChange={(e) => setMotivo(e.target.value)} />
        {num(monto) > 0 && <div style={{ border: '1px solid #e8c06a88', background: '#e8c06a14', borderRadius: 10, padding: 10, color: '#e8c06a', marginTop: 10 }}>⚠️ El efectivo esperado del cierre baja {fmt(num(monto))}. Hay {fmt(efectivo)} en el cajón.</div>}
        <p className="cj-nota">Lo autoriza un Admin con su PIN. Si quien pide es Admin, autoriza otro Admin: nadie se presta a sí mismo.</p>
        {error && <div className="pn-err">{error}</div>}
        <div className="cj-acc"><button onClick={cerrar}>Cancelar</button><button className="g" onClick={seguir}>Prestar {num(monto) ? fmt(num(monto)) : ''}</button></div>
      </div>
      {pide && <PinAdmin motivo={`Un Admin digita su PIN para autorizar el préstamo a ${persona?.Nombre}.`} cancelar={() => setPide(false)}
        ok={async (a) => {
          if (!autorizaValido(a, persona)) { setPide(false); setError('Este préstamo lo debe autorizar otro Admin: nadie se presta a sí mismo.'); return; }
          await prestar({ persona, monto: num(monto), motivo, usuario, autoriza: a }); guardado(`Préstamo de ${fmt(num(monto))} a ${persona.Nombre} registrado`);
        }} />}
    </div>
  );
}

function PagoModal({ persona, debe, cerrar, guardado }) {
  const { usuario } = useSesion();
  const [monto, setMonto] = useState(String(debe)); const [error, setError] = useState('');
  async function hacer() {
    const e = validarDevolucion({ debe, monto: num(monto) });
    if (e) { setError(e); return; }
    await devolver({ persona: { Id: persona.personaId, Nombre: persona.nombre }, monto: num(monto), usuario }); guardado(`${persona.nombre} abonó ${fmt(num(monto))}`);
  }
  return (
    <div className="pn-velo" onClick={(e) => e.target === e.currentTarget && cerrar()}>
      <div className="pn-modal cj-mod">
        <h3>↩ Abono de {persona.nombre}</h3>
        <p className="cj-nota">Debe: <b>{fmt(debe)}</b>. Entra efectivo al cajón.</p>
        <label>Valor del abono</label>
        <input className="cj-hi" autoFocus inputMode="numeric" value={monto ? fmt(num(monto)) : ''} onChange={(e) => setMonto(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && hacer()} />
        <div className="cj-acc"><button className="no" onClick={() => setMonto(String(Math.round(debe / 2)))}>Mitad</button><button className="no" onClick={() => setMonto(String(debe))}>Todo</button></div>
        {error && <div className="pn-err">{error}</div>}
        <div className="cj-acc"><button onClick={cerrar}>Cancelar</button><button className="g" onClick={hacer}>Abonar {fmt(num(monto))}</button></div>
      </div>
    </div>
  );
}

export default function Prestamos() {
  const [d, setD] = useState(null); const [efectivo, setEfectivo] = useState(0); const [modal, setModal] = useState(null); const [aviso, setAviso] = useState('');
  const cargar = useCallback(async () => { const [p, t] = await Promise.all([cargarPrestamos(), cargarTurno()]); setD(p); setEfectivo(t.resumen.efectivoEsperado); }, []);
  useEffect(() => { cargar(); }, [cargar]);
  const decir = (m) => { setAviso(m); setTimeout(() => setAviso(''), 2600); };
  const saldos = useMemo(() => (d ? saldosPersonal(d.movs) : []), [d]);
  if (!d) return <><Encabezado activo="prestamos" /><div className="cj" /></>;
  const tot = totalesPersonal(d.movs);
  const hecho = async (m) => { setModal(null); await cargar(); decir(m); };
  return (
    <>
      <Encabezado activo="prestamos" />
      <div className="cj">
        {aviso && <div className="cj-aviso">{aviso}</div>}
        <div className="pr-top"><div><h2>🤝 Préstamos al personal</h2><p>Plata que sale del cajón y te abonan. No es gasto ni fiado.</p></div>
          <button className="pr-nuevo" onClick={() => setModal({ t: 'prestar' })}><span>＋</span>PRESTAR</button></div>
        <div className="pr-kpis">
          <div className="pr-k" style={{ '--c': '#f5c04a' }}><small>DEBEN EN TOTAL</small><b>{fmt(tot.debenTotal)}</b></div>
          <div className="pr-k" style={{ '--c': '#e8ecf5' }}><small>PRESTADO EN EL TURNO</small><b>{fmt(tot.prestadoTurno)}</b></div>
          <div className="pr-k" style={{ '--c': '#4ade80' }}><small>ABONOS EN EL TURNO</small><b>{fmt(tot.devueltoTurno)}</b></div>
        </div>
        <div className="cj-sec">Por persona</div>
        <div className="cj-card">
          {saldos.length === 0 && <div className="cj-vacio">Aún no hay préstamos.</div>}
          {saldos.map((p) => (
            <div className="cj-mv" key={p.personaId}>
              <div><span>{p.nombre}</span><small>Prestado {fmt(p.prestado)} · abonado {fmt(p.devuelto)}</small></div>
              <span style={{ display: 'flex', gap: 10, alignItems: 'center' }}><b style={{ color: p.debe > 0 ? '#f5c04a' : '#7d8597' }}>{fmt(p.debe)}</b>
                {p.debe > 0 && <button className="pr-abonar" onClick={() => setModal({ t: 'pago', p })}>Abonar</button>}</span>
            </div>
          ))}
        </div>
        <div className="cj-sec">Historial</div>
        <div className="cj-card" style={{ maxHeight: 'calc(100vh - 430px)', minHeight: 120, overflowY: 'auto' }}>
          {d.movs.length === 0 && <div className="cj-vacio">Sin movimientos.</div>}
          {d.movs.map((m) => (
            <div className="cj-mv" key={m.Id}>
              <div><span className={m.Tipo === 'PRESTAMO' ? 'rojo' : 'ver'}>{m.Tipo === 'PRESTAMO' ? 'Préstamo a' : 'Abono de'} {m.PersonaNombre}</span>
                <small>{fechaHora(m.FechaHora)}{m.Motivo ? ` · ${m.Motivo}` : ''} · por {m.UsuarioNombre || '—'}{m.AutorizoId ? ' · autorizado' : ''}</small></div>
              <b className={m.Tipo === 'PRESTAMO' ? 'rojo' : 'ver'}>{m.Tipo === 'PRESTAMO' ? '−' : '+'}{fmt(m.Monto)}</b>
            </div>
          ))}
        </div>
      </div>
      {modal?.t === 'prestar' && <PrestarModal personas={d.personas} efectivo={efectivo} cerrar={() => setModal(null)} guardado={hecho} />}
      {modal?.t === 'pago' && <PagoModal persona={modal.p} debe={modal.p.debe} cerrar={() => setModal(null)} guardado={hecho} />}
    </>
  );
}
