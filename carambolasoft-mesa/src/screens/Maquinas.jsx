// src/screens/Maquinas.jsx — Máquinas (solo Admin): premios pagados, cuadres con el dueño y pendiente por máquina. Reglas en cuenta/maquinas.js.
import { useState, useEffect, useCallback, useMemo } from 'react';
import Encabezado from '../components/Encabezado.jsx';
import { useSesion } from '../components/Sesion.jsx';
import { PinAdmin } from './Auth.jsx';
import { Hoja } from '../informes/Hoja.jsx';
import { FILTROS_MAQ, filtrarMovs, resumenMovs, saldoFondo, deudaCaja, premiosPorMaquina, movEditable } from '../cuenta/maquinas.js';
import { cargarMaquinas, crearMaquina, renombrarMaquina, alternarMaquina, registrarPremio, registrarReposicion, registrarPrestamo, registrarDevolucion, editarMov, borrarMov } from '../cuenta/maquinasDb.js';
import './Panel.css';
import './Caja.css';

const fmt = (n) => (n < 0 ? '−' : '') + '$' + Math.abs(Math.round(n)).toLocaleString('es-CO');
const num = (v) => Number(String(v).replace(/\D/g, '')) || 0;
const ROT = { PREMIO: 'Premio', REPOSICION: 'Reposición del dueño', CUADRE: 'Reposición del dueño', PRESTAMO: 'Préstamo de caja', DEVOLUCION: 'Devolución a caja' };
const fechaHora = (iso) => new Date(iso).toLocaleString('es-CO', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

/** Modal de premio: lo usa la pantalla y el botón del Panel. */
export function PremioModal({ maquinas, saldo, cerrar, guardado }) {
  const { usuario } = useSesion();
  const activas = maquinas.filter((m) => m.Activa !== false);
  const [maq, setMaq] = useState(activas[0]?.Id ?? ''); const [monto, setMonto] = useState('');
  const [pide, setPide] = useState(false); const [error, setError] = useState('');
  function seguir() {
    if (!maq) { setError(activas.length ? 'Elige la máquina.' : 'Crea primero una máquina en ⚙ Máquinas.'); return; }
    if (!(num(monto) > 0)) { setError('Escribe el valor del premio.'); return; }
    setError(''); setPide(true);
  }
  return (
    <div className="pn-velo" onClick={(e) => e.target === e.currentTarget && cerrar()}>
      <div className="pn-modal cj-mod">
        <h3>🎰 Premio de máquina</h3>
        <label>Máquina</label>
        <select value={maq} onChange={(e) => setMaq(e.target.value)}>{activas.map((m) => <option key={m.Id} value={m.Id}>{m.Nombre}</option>)}</select>
        <label>Valor del premio</label>
        <input className="cj-hi" autoFocus inputMode="numeric" value={monto ? fmt(num(monto)) : ''} placeholder="$50.000" onChange={(e) => setMonto(e.target.value)} />
        {num(monto) > saldo && <div style={{ border: '1px solid #e8c06a88', background: '#e8c06a14', borderRadius: 10, padding: 10, color: '#e8c06a', marginTop: 10 }}>⚠️ El fondo tiene {fmt(saldo)}. Faltan {fmt(num(monto) - Math.max(0, saldo))}.<br /><small style={{ color: '#7d8597' }}>Se registra el premio y un préstamo de caja por la diferencia.</small></div>}
        <p className="cj-nota">Lo autoriza un Admin con su PIN. Baja el fondo de máquinas; no toca el cajón.</p>
        {error && <div className="pn-err">{error}</div>}
        <div className="cj-acc"><button onClick={cerrar}>Cancelar</button><button className="g" onClick={seguir}>{num(monto) > saldo ? 'Registrar con préstamo' : 'Registrar premio'}</button></div>
      </div>
      {pide && <PinAdmin motivo="Un Admin digita su PIN para autorizar este premio." cancelar={() => setPide(false)}
        ok={async (a) => { await registrarPremio({ maquinaId: maq, monto: num(monto), usuario, autorizoId: a.Id }); guardado(); }} />}
    </div>
  );
}

const CFG = {
  REPOSICION: { t: '➕ Reposición del dueño', ayuda: 'Sube el fondo de máquinas. No toca el cajón.', pin: false, btn: 'Registrar reposición', fn: registrarReposicion },
  PRESTAMO: { t: '🏦 Préstamo de caja al fondo', ayuda: 'Sale del cajón y suma al fondo. Queda como deuda con la caja. PIN de Admin.', pin: true, btn: 'Registrar préstamo', fn: registrarPrestamo },
  DEVOLUCION: { t: '↩ Devolver a caja', ayuda: 'Baja el fondo y vuelve al cajón. Descuenta la deuda. PIN de Admin.', pin: true, btn: 'Registrar devolución', fn: registrarDevolucion },
};
function MontoModal({ tipo, deuda, saldo, cerrar, guardado }) {
  const { usuario } = useSesion(); const c = CFG[tipo];
  const [monto, setMonto] = useState(''); const [nota, setNota] = useState(''); const [pide, setPide] = useState(false); const [error, setError] = useState('');
  function seguir() {
    const m = num(monto);
    if (!(m > 0)) { setError('Escribe el valor.'); return; }
    if (tipo === 'DEVOLUCION' && m > deuda) { setError(`Solo debes ${fmt(deuda)} a la caja.`); return; }
    if (tipo === 'DEVOLUCION' && m > saldo) { setError(`El fondo solo tiene ${fmt(saldo)}.`); return; }
    setError(''); if (c.pin) setPide(true); else hacer(null);
  }
  async function hacer(a) { await c.fn({ monto: num(monto), nota, usuario, autorizoId: a?.Id }); guardado(); }
  return (
    <div className="pn-velo" onClick={(e) => e.target === e.currentTarget && cerrar()}>
      <div className="pn-modal cj-mod">
        <h3>{c.t}</h3>
        {tipo === 'DEVOLUCION' && <p className="cj-nota">Debe a la caja: <b>{fmt(deuda)}</b></p>}
        <label>Valor</label>
        <input className="cj-hi" autoFocus inputMode="numeric" value={monto ? fmt(num(monto)) : ''} placeholder="$0" onChange={(e) => setMonto(e.target.value)} />
        <label>Nota (opcional)</label>
        <input value={nota} placeholder={tipo === 'PRESTAMO' ? 'El dueño no ha mandado la plata' : ''} onChange={(e) => setNota(e.target.value)} />
        <p className="cj-nota">{c.ayuda}</p>
        {error && <div className="pn-err">{error}</div>}
        <div className="cj-acc"><button onClick={cerrar}>Cancelar</button><button className="g" onClick={seguir}>{c.btn}</button></div>
      </div>
      {pide && <PinAdmin motivo="Un Admin digita su PIN para autorizar este movimiento." cancelar={() => setPide(false)} ok={hacer} />}
    </div>
  );
}

function Admin({ maquinas, cerrar, cambio }) {
  const [nuevo, setNuevo] = useState(''); const [edit, setEdit] = useState(null); const [error, setError] = useState('');
  const run = async (fn) => { try { setError(''); await fn(); await cambio(); } catch (e) { setError(e.message); } };
  return (
    <div className="pn-velo" onClick={(e) => e.target === e.currentTarget && cerrar()}>
      <div className="pn-modal cj-mod">
        <h3>⚙ Máquinas</h3>
        {maquinas.length === 0 && <div className="cj-vacio">Aún no hay máquinas.</div>}
        {maquinas.map((m) => (
          <div className="cj-mv" key={m.Id}>
            {edit?.Id === m.Id
              ? <input autoFocus value={edit.Nombre} onChange={(e) => setEdit({ ...edit, Nombre: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && run(async () => { await renombrarMaquina(m, edit.Nombre); setEdit(null); })} />
              : <span style={m.Activa === false ? { opacity: .5 } : null}>{m.Nombre}{m.Activa === false ? ' · pausada' : ''}</span>}
            <span style={{ display: 'flex', gap: 6 }}>
              <button className="cj-b" onClick={() => (edit?.Id === m.Id ? run(async () => { await renombrarMaquina(m, edit.Nombre); setEdit(null); }) : setEdit({ Id: m.Id, Nombre: m.Nombre }))}>{edit?.Id === m.Id ? '✓' : '✏️'}</button>
              <button className="cj-b" onClick={() => run(() => alternarMaquina(m))}>{m.Activa === false ? 'Activar' : 'Pausar'}</button>
            </span>
          </div>
        ))}
        <label>Nueva máquina</label>
        <input value={nuevo} placeholder="Ej. Tragamonedas 1" onChange={(e) => setNuevo(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && run(async () => { await crearMaquina(nuevo); setNuevo(''); })} />
        <p className="cj-nota">Con historial una máquina solo se pausa (no se borra).</p>
        {error && <div className="pn-err">{error}</div>}
        <div className="cj-acc"><button onClick={cerrar}>Cerrar</button><button className="g" onClick={() => run(async () => { await crearMaquina(nuevo); setNuevo(''); })}>Agregar</button></div>
      </div>
    </div>
  );
}

export default function Maquinas() {
  const [d, setD] = useState(null); const [filtro, setFiltro] = useState('turno');
  const [desde, setDesde] = useState(''); const [hasta, setHasta] = useState('');
  const [modal, setModal] = useState(null); const [aviso, setAviso] = useState(''); const [borrar, setBorrar] = useState(null); const [editM, setEditM] = useState(null);
  const cargar = useCallback(async () => setD(await cargarMaquinas()), []);
  useEffect(() => { cargar(); }, [cargar]);
  const decir = (m) => { setAviso(m); setTimeout(() => setAviso(''), 2600); };
  const nombre = (id) => d?.maquinas.find((m) => m.Id === id)?.Nombre ?? 'Máquina';
  const lista = useMemo(() => (d ? filtrarMovs(d.movs, filtro, { desde, hasta }).sort((a, b) => b.FechaHora.localeCompare(a.FechaHora)) : []), [d, filtro, desde, hasta]);
  if (!d) return <><Encabezado activo="maquinas" /><div className="cj" /></>;
  const res = resumenMovs(lista), saldo = saldoFondo(d.movs, d.base), deuda = deudaCaja(d.movs), porMaq = premiosPorMaquina(d.maquinas, lista);
  const hecho = async (m) => { setModal(null); await cargar(); decir(m); };
  return (
    <>
      <Encabezado activo="maquinas" />
      <div className="cj">
        {aviso && <div className="cj-aviso">{aviso}</div>}
        <div className="cj-btns" style={{ marginBottom: 12 }}>
          <button className="cj-cierre" onClick={() => setModal('premio')}>🎰 Premio</button>
          <button className="cj-b ve" onClick={() => setModal('REPOSICION')}>➕ Reposición</button>
          <button className="cj-b" onClick={() => setModal('PRESTAMO')}>🏦 Préstamo de caja</button>
          <button className="cj-b" disabled={!deuda} onClick={() => setModal('DEVOLUCION')}>↩ Devolver a caja</button>
          <button className="cj-b" onClick={() => setModal('pdf')}>📄 Informe</button>
          <button className="cj-b" onClick={() => setModal('admin')}>⚙ Máquinas</button>
        </div>
        <div className="cj-tabs" style={{ justifyContent: 'flex-start', flexWrap: 'wrap' }}>
          {FILTROS_MAQ.map(([v, t]) => <button key={v} className={filtro === v ? 'on' : ''} onClick={() => setFiltro(v)}>{t}</button>)}
          {filtro === 'rango' && <><input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} /><input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} /></>}
        </div>
        <div className="cj-cols">
          <div>
            <div className="cj-card"><div className="cj-mr esp"><span>Saldo del fondo <small>(base {fmt(d.base)})</small></span><span className={`y${saldo < 0 ? ' rojo' : ''}`}>{fmt(saldo)}</span></div>
              <div className="cj-mr"><span className="rojo">Premios pagados ({res.nPremios})</span><span className="y rojo">−{fmt(res.totPremios)}</span></div>
              <div className="cj-mr"><span>Debe a la caja</span><span className={deuda ? 'y na' : 'z'}>{fmt(deuda)}</span></div></div>
            <div className="cj-sec">Premios por máquina</div>
            <div className="cj-card">
              {porMaq.length === 0 && <div className="cj-vacio">Crea una máquina en ⚙ Máquinas.</div>}
              {porMaq.map((p) => <div className="cj-mr" key={p.maquina.Id}><span>{p.maquina.Nombre} <small>{p.nPremios} premios</small></span><span className={p.total ? 'y rojo' : 'z'}>{p.total ? '−' : ''}{fmt(p.total)}</span></div>)}
            </div>
          </div>
          <div className="cj-card"><div className="cj-sec">Movimientos</div>
            {lista.length === 0 && <div className="cj-vacio">Sin movimientos en este periodo.</div>}
            {lista.map((m) => (
              <div className="cj-mv" key={m.Id}>
                <div><span className={m.Tipo === 'PREMIO' ? 'rojo' : m.Tipo === 'PRESTAMO' ? 'na' : 'ver'}>{ROT[m.Tipo] ?? m.Tipo}{m.MaquinaId ? ` · ${nombre(m.MaquinaId)}` : ''}</span><small>{fechaHora(m.FechaHora)}{m.UsuarioNombre ? ` · ${m.UsuarioNombre}` : ''}{m.Nota ? ` · ${m.Nota}` : ''}</small></div>
                <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <b className={m.Tipo === 'PREMIO' || m.Tipo === 'DEVOLUCION' ? 'rojo' : ''}>{m.Tipo === 'PREMIO' || m.Tipo === 'DEVOLUCION' ? '−' : '+'}{fmt(m.Monto)}</b>
                  {movEditable(m) ? <><button className="cj-b" onClick={() => setEditM(m)}>✏️</button><button className="cj-b" onClick={() => setBorrar(m)}>🗑</button></> : <span title="Turno cerrado">🔒</span>}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
      {modal === 'premio' && <PremioModal maquinas={d.maquinas} saldo={saldo} cerrar={() => setModal(null)} guardado={() => hecho('Premio registrado ✓')} />}
      {CFG[modal] && <MontoModal tipo={modal} deuda={deuda} saldo={saldo} cerrar={() => setModal(null)} guardado={() => hecho('Movimiento registrado ✓')} />}
      {modal === 'admin' && <Admin maquinas={d.maquinas} cerrar={() => setModal(null)} cambio={cargar} />}
      {modal === 'pdf' && <Hoja cerrar={() => setModal(null)} texto={textoMaq(res, saldo, deuda, porMaq, FILTROS_MAQ.find((f) => f[0] === filtro)[1])}>
        <h1>MERO PARCHE</h1><div className="sub">Informe de máquinas · {FILTROS_MAQ.find((f) => f[0] === filtro)[1]}</div>
        <table><tbody>
          <tr><td><b>Saldo del fondo</b> (base {fmt(d.base)})</td><td className="r"><b>{fmt(saldo)}</b></td></tr>
          <tr><td>Premios pagados ({res.nPremios})</td><td className="r">−{fmt(res.totPremios)}</td></tr>
          <tr><td>Reposiciones del dueño</td><td className="r">+{fmt(res.totReposiciones)}</td></tr>
          <tr><td>Debe a la caja</td><td className="r">{fmt(deuda)}</td></tr></tbody></table>
        <h2>PREMIOS POR MÁQUINA</h2>
        <table><tbody>{porMaq.map((p) => <tr key={p.maquina.Id}><td>{p.maquina.Nombre} ({p.nPremios})</td><td className="r">−{fmt(p.total)}</td></tr>)}</tbody></table>
        <h2>MOVIMIENTOS</h2>
        <table><tbody>{lista.map((m) => <tr key={m.Id}><td>{fechaHora(m.FechaHora)}</td><td>{ROT[m.Tipo] ?? m.Tipo}{m.MaquinaId ? ` · ${nombre(m.MaquinaId)}` : ''}</td><td className="r">{m.Tipo === 'PREMIO' || m.Tipo === 'DEVOLUCION' ? '−' : '+'}{fmt(m.Monto)}</td></tr>)}</tbody></table>
      </Hoja>}
      {borrar && <PinAdmin motivo={`Vas a borrar este movimiento (${(ROT[borrar.Tipo] ?? '').toLowerCase()}) de ${fmt(borrar.Monto)}. Un Admin digita su PIN.`} cancelar={() => setBorrar(null)} ok={async () => { await borrarMov(borrar); setBorrar(null); await cargar(); decir('Movimiento borrado'); }} />}
      {editM && <EditarMov mov={editM} cerrar={() => setEditM(null)} guardado={async () => { setEditM(null); await cargar(); decir('Movimiento actualizado ✓'); }} />}
    </>
  );
}

function EditarMov({ mov, cerrar, guardado }) {
  const [monto, setMonto] = useState(String(mov.Monto)); const [nota, setNota] = useState(mov.Nota ?? '');
  return (
    <div className="pn-velo" onClick={(e) => e.target === e.currentTarget && cerrar()}>
      <div className="pn-modal cj-mod">
        <h3>✏️ Editar {(ROT[mov.Tipo] ?? '').toLowerCase()}</h3>
        <label>Valor</label><input className="cj-hi" inputMode="numeric" value={fmt(num(monto))} onChange={(e) => setMonto(e.target.value)} />
        <label>Nota</label><input value={nota} onChange={(e) => setNota(e.target.value)} />
        <div className="cj-acc"><button onClick={cerrar}>Cancelar</button><button className="g" disabled={!num(monto)} onClick={async () => { await editarMov(mov, { monto: num(monto), nota }); guardado(); }}>Guardar</button></div>
      </div>
    </div>
  );
}

function textoMaq(res, saldo, deuda, porMaq, periodo) {
  const l = [`*MERO PARCHE — Máquinas (${periodo})*`, '', `Saldo del fondo: *${fmt(saldo)}*`, `Premios pagados: ${fmt(res.totPremios)} (${res.nPremios})`, `Reposiciones del dueño: ${fmt(res.totReposiciones)}`, `Debe a la caja: ${fmt(deuda)}`, '', '*Premios por máquina*'];
  for (const p of porMaq) l.push(`${p.maquina.Nombre}: ${fmt(p.total)}`);
  return l.join('\n');
}
