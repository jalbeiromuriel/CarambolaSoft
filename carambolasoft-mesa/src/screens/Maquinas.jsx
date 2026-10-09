// src/screens/Maquinas.jsx — Máquinas (solo Admin): premios pagados, cuadres con el dueño y pendiente por máquina. Reglas en cuenta/maquinas.js.
import { useState, useEffect, useCallback, useMemo } from 'react';
import Encabezado from '../components/Encabezado.jsx';
import { useSesion } from '../components/Sesion.jsx';
import { PinAdmin } from './Auth.jsx';
import { Hoja } from '../informes/Hoja.jsx';
import { FILTROS_MAQ, filtrarMovs, resumenMovs, pendientePorMaquina, movEditable } from '../cuenta/maquinas.js';
import { cargarMaquinas, crearMaquina, renombrarMaquina, alternarMaquina, registrarPremio, registrarCuadre, editarMov, borrarMov } from '../cuenta/maquinasDb.js';
import './Panel.css';
import './Caja.css';

const fmt = (n) => (n < 0 ? '−' : '') + '$' + Math.abs(Math.round(n)).toLocaleString('es-CO');
const num = (v) => Number(String(v).replace(/\D/g, '')) || 0;
const fechaHora = (iso) => new Date(iso).toLocaleString('es-CO', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

/** Modal de premio: lo usa la pantalla y el botón del Panel. */
export function PremioModal({ maquinas, cerrar, guardado }) {
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
        <p className="cj-nota">Lo autoriza un Admin con su PIN. Sale del cajón: baja el efectivo esperado, como un gasto.</p>
        {error && <div className="pn-err">{error}</div>}
        <div className="cj-acc"><button onClick={cerrar}>Cancelar</button><button className="g" onClick={seguir}>Registrar premio</button></div>
      </div>
      {pide && <PinAdmin motivo="Un Admin digita su PIN para autorizar este premio." cancelar={() => setPide(false)}
        ok={async (a) => { await registrarPremio({ maquinaId: maq, monto: num(monto), usuario, autorizoId: a.Id }); guardado(); }} />}
    </div>
  );
}

function CuadreModal({ maquinas, pend, cerrar, guardado }) {
  const { usuario } = useSesion();
  const activas = maquinas.filter((m) => m.Activa !== false);
  const [maq, setMaq] = useState(activas[0]?.Id ?? ''); const [monto, setMonto] = useState(''); const [nota, setNota] = useState(''); const [error, setError] = useState('');
  const p = pend.find((x) => x.maquina.Id === maq)?.pendiente ?? 0;
  async function ok() {
    if (!maq) { setError('Elige la máquina.'); return; }
    if (!(num(monto) > 0)) { setError('Escribe el total recibido.'); return; }
    await registrarCuadre({ maquinaId: maq, monto: num(monto), nota, usuario }); guardado();
  }
  return (
    <div className="pn-velo" onClick={(e) => e.target === e.currentTarget && cerrar()}>
      <div className="pn-modal cj-mod">
        <h3>🤝 Cuadre con el dueño</h3>
        <label>Máquina</label>
        <select value={maq} onChange={(e) => setMaq(e.target.value)}>{activas.map((m) => <option key={m.Id} value={m.Id}>{m.Nombre}</option>)}</select>
        <p className="cj-nota">Premios por reponer desde el último cuadre: <b>{fmt(p)}</b></p>
        <label>Total recibido</label>
        <input className="cj-hi" inputMode="numeric" value={monto ? fmt(num(monto)) : ''} placeholder="$0" onChange={(e) => setMonto(e.target.value)} />
        <label>Nota (opcional)</label>
        <input value={nota} placeholder="Reposición + 50 %, quincena…" onChange={(e) => setNota(e.target.value)} />
        <p className="cj-nota">Deja en cero lo pendiente de esa máquina. No altera el arqueo del cajón.</p>
        {error && <div className="pn-err">{error}</div>}
        <div className="cj-acc"><button onClick={cerrar}>Cancelar</button><button className="g" onClick={ok}>Registrar cuadre</button></div>
      </div>
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
  const res = resumenMovs(lista), pend = pendientePorMaquina(d.maquinas.filter((m) => m.Activa !== false), d.movs);
  const hecho = async (m) => { setModal(null); await cargar(); decir(m); };
  return (
    <>
      <Encabezado activo="maquinas" />
      <div className="cj">
        {aviso && <div className="cj-aviso">{aviso}</div>}
        <div className="cj-btns" style={{ marginBottom: 12 }}>
          <button className="cj-cierre" onClick={() => setModal('premio')}>🎰 Premio</button>
          <button className="cj-b ve" onClick={() => setModal('cuadre')}>🤝 Cuadre</button>
          <button className="cj-b" onClick={() => setModal('pdf')}>📄 Informe</button>
          <button className="cj-b" onClick={() => setModal('admin')}>⚙ Máquinas</button>
        </div>
        <div className="cj-tabs" style={{ justifyContent: 'flex-start', flexWrap: 'wrap' }}>
          {FILTROS_MAQ.map(([v, t]) => <button key={v} className={filtro === v ? 'on' : ''} onClick={() => setFiltro(v)}>{t}</button>)}
          {filtro === 'rango' && <><input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} /><input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} /></>}
        </div>
        <div className="cj-cols">
          <div>
            <div className="cj-card"><div className="cj-mr"><span className="rojo">Premios pagados ({res.nPremios})</span><span className="y rojo">−{fmt(res.totPremios)}</span></div>
              <div className="cj-mr"><span className="ver">Recibido en cuadres ({res.nCuadres})</span><span className="y ver">+{fmt(res.totCuadres)}</span></div>
              <div className="cj-mr esp"><span>Neto</span><span className="y">{fmt(res.neto)}</span></div></div>
            <div className="cj-sec">Pendiente por máquina</div>
            <div className="cj-card">
              {pend.length === 0 && <div className="cj-vacio">Crea una máquina en ⚙ Máquinas.</div>}
              {pend.map((p) => <div className="cj-mr" key={p.maquina.Id}><span>{p.maquina.Nombre} <small>{p.nPremios} premios{p.ultimoCuadre ? ` · cuadre ${fechaHora(p.ultimoCuadre)}` : ' · sin cuadre'}</small></span><span className={p.pendiente ? 'y na' : 'z'}>{fmt(p.pendiente)}</span></div>)}
            </div>
          </div>
          <div className="cj-card"><div className="cj-sec">Movimientos</div>
            {lista.length === 0 && <div className="cj-vacio">Sin movimientos en este periodo.</div>}
            {lista.map((m) => (
              <div className="cj-mv" key={m.Id}>
                <div><span className={m.Tipo === 'PREMIO' ? 'rojo' : 'ver'}>{m.Tipo === 'PREMIO' ? 'Premio' : 'Cuadre'} · {nombre(m.MaquinaId)}</span><small>{fechaHora(m.FechaHora)}{m.Nota ? ` · ${m.Nota}` : ''}</small></div>
                <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <b className={m.Tipo === 'PREMIO' ? 'rojo' : ''}>{m.Tipo === 'PREMIO' ? '−' : '+'}{fmt(m.Monto)}</b>
                  {movEditable(m) ? <><button className="cj-b" onClick={() => setEditM(m)}>✏️</button><button className="cj-b" onClick={() => setBorrar(m)}>🗑</button></> : <span title="Turno cerrado">🔒</span>}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
      {modal === 'premio' && <PremioModal maquinas={d.maquinas} cerrar={() => setModal(null)} guardado={() => hecho('Premio registrado ✓')} />}
      {modal === 'cuadre' && <CuadreModal maquinas={d.maquinas} pend={pend} cerrar={() => setModal(null)} guardado={() => hecho('Cuadre registrado ✓')} />}
      {modal === 'admin' && <Admin maquinas={d.maquinas} cerrar={() => setModal(null)} cambio={cargar} />}
      {modal === 'pdf' && <Hoja cerrar={() => setModal(null)} texto={textoMaq(res, pend, FILTROS_MAQ.find((f) => f[0] === filtro)[1])}>
        <h1>MERO PARCHE</h1><div className="sub">Informe de máquinas · {FILTROS_MAQ.find((f) => f[0] === filtro)[1]}</div>
        <table><tbody>
          <tr><td>Premios pagados ({res.nPremios})</td><td className="r">−{fmt(res.totPremios)}</td></tr>
          <tr><td>Recibido en cuadres ({res.nCuadres})</td><td className="r">+{fmt(res.totCuadres)}</td></tr>
          <tr><td><b>Neto</b></td><td className="r"><b>{fmt(res.neto)}</b></td></tr></tbody></table>
        <h2>PENDIENTE POR MÁQUINA</h2>
        <table><tbody>{pend.map((p) => <tr key={p.maquina.Id}><td>{p.maquina.Nombre}</td><td className="r">{fmt(p.pendiente)}</td></tr>)}</tbody></table>
        <h2>MOVIMIENTOS</h2>
        <table><tbody>{lista.map((m) => <tr key={m.Id}><td>{fechaHora(m.FechaHora)}</td><td>{m.Tipo === 'PREMIO' ? 'Premio' : 'Cuadre'} · {nombre(m.MaquinaId)}</td><td className="r">{m.Tipo === 'PREMIO' ? '−' : '+'}{fmt(m.Monto)}</td></tr>)}</tbody></table>
      </Hoja>}
      {borrar && <PinAdmin motivo={`Vas a borrar este ${borrar.Tipo === 'PREMIO' ? 'premio' : 'cuadre'} de ${fmt(borrar.Monto)}. Un Admin digita su PIN.`} cancelar={() => setBorrar(null)} ok={async () => { await borrarMov(borrar); setBorrar(null); await cargar(); decir('Movimiento borrado'); }} />}
      {editM && <EditarMov mov={editM} cerrar={() => setEditM(null)} guardado={async () => { setEditM(null); await cargar(); decir('Movimiento actualizado ✓'); }} />}
    </>
  );
}

function EditarMov({ mov, cerrar, guardado }) {
  const [monto, setMonto] = useState(String(mov.Monto)); const [nota, setNota] = useState(mov.Nota ?? '');
  return (
    <div className="pn-velo" onClick={(e) => e.target === e.currentTarget && cerrar()}>
      <div className="pn-modal cj-mod">
        <h3>✏️ Editar {mov.Tipo === 'PREMIO' ? 'premio' : 'cuadre'}</h3>
        <label>Valor</label><input className="cj-hi" inputMode="numeric" value={fmt(num(monto))} onChange={(e) => setMonto(e.target.value)} />
        <label>Nota</label><input value={nota} onChange={(e) => setNota(e.target.value)} />
        <div className="cj-acc"><button onClick={cerrar}>Cancelar</button><button className="g" disabled={!num(monto)} onClick={async () => { await editarMov(mov, { monto: num(monto), nota }); guardado(); }}>Guardar</button></div>
      </div>
    </div>
  );
}

function textoMaq(res, pend, periodo) {
  const l = [`*MERO PARCHE — Máquinas (${periodo})*`, '', `Premios pagados: ${fmt(res.totPremios)} (${res.nPremios})`, `Recibido en cuadres: ${fmt(res.totCuadres)} (${res.nCuadres})`, `Neto: *${fmt(res.neto)}*`, '', '*Pendiente por máquina*'];
  for (const p of pend) l.push(`${p.maquina.Nombre}: ${fmt(p.pendiente)}`);
  return l.join('\n');
}
