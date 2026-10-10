// src/screens/FiadosLimpieza.jsx — Eliminar fiados de prueba (importados del POS) y castigar deudas incobrables. Solo Admin, con PIN.
import { useState, useEffect } from 'react';
import { useSesion } from '../components/Sesion.jsx';
import { PinAdmin } from './Auth.jsx';
import { esDePrueba } from '../cuenta/fiados.js';
import { castigarFiados, eliminarFiadosPrueba, cargarCastigados, reabrirFiado } from '../cuenta/fiadosDb.js';
import './Caja.css';

const fmt = (n) => '$' + Math.abs(Math.round(n)).toLocaleString('es-CO');
const fecha = (iso) => new Date(iso).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });

/** Lista de fiados con casillas. `filas` = [{ f (factura con saldo), cliente }]. */
function Lista({ filas, sel, setSel }) {
  return filas.map(({ f, cliente }) => (
    <label key={f.Id} className="cj-mv" style={{ cursor: 'pointer' }}>
      <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}><input type="checkbox" style={{ width: 'auto' }} checked={sel.has(f.Id)} onChange={() => { const n = new Set(sel); n.has(f.Id) ? n.delete(f.Id) : n.add(f.Id); setSel(n); }} />{cliente} · {f.Numero ?? 'F-—'} · {fecha(f.FechaHora)}</span>
      <b>{fmt(f.saldo)}</b>
    </label>
  ));
}

export function EliminarPrueba({ grupos, clienteId, cerrar, hecho }) {
  const filas = grupos.flatMap((g) => g.facturas.filter(esDePrueba).map((f) => ({ f, cliente: g.cliente.Nombre, cid: g.cliente.Id })));
  const [sel, setSel] = useState(new Set(clienteId ? filas.filter((x) => x.cid === clienteId).map((x) => x.f.Id) : []));
  const [pide, setPide] = useState(false); const [error, setError] = useState('');
  const elegidas = filas.filter((x) => sel.has(x.f.Id));
  return (
    <div className="pn-velo" onClick={(e) => e.target === e.currentTarget && cerrar()}>
      <div className="pn-modal cj-mod">
        <h3>🗑 Eliminar fiados de prueba</h3>
        <p className="cj-nota">Solo los importados del POS. No toca la caja ni las ventas.</p>
        {filas.length === 0 && <div className="cj-vacio">No hay fiados importados del POS.</div>}
        <div style={{ maxHeight: '45vh', overflowY: 'auto' }}><Lista filas={filas} sel={sel} setSel={setSel} /></div>
        {elegidas.length > 0 && <div style={{ border: '1px solid #e8c06a88', background: '#e8c06a14', borderRadius: 10, padding: 10, color: '#e8c06a', marginTop: 10 }}>Se borran {elegidas.length} fiado{elegidas.length > 1 ? 's' : ''} por {fmt(elegidas.reduce((s, x) => s + x.f.saldo, 0))}. No se vuelven a traer si reimportas el respaldo.</div>}
        {error && <div className="pn-err">{error}</div>}
        <div className="cj-acc"><button onClick={cerrar}>Cancelar</button><button className="g" disabled={!elegidas.length} onClick={() => setPide(true)}>Eliminar {elegidas.length || ''}</button></div>
      </div>
      {pide && <PinAdmin motivo="Un Admin digita su PIN para eliminar estos fiados de prueba." cancelar={() => setPide(false)}
        ok={async () => { try { const n = await eliminarFiadosPrueba(elegidas.map((x) => x.f)); hecho(`${n} fiado${n > 1 ? 's' : ''} de prueba eliminado${n > 1 ? 's' : ''}`); } catch (e) { setPide(false); setError(e.message); } }} />}
    </div>
  );
}

export function Castigar({ g, cerrar, hecho }) {
  const { usuario } = useSesion();
  const [sel, setSel] = useState(new Set(g.facturas.map((f) => f.Id))); const [motivo, setMotivo] = useState('');
  const [pide, setPide] = useState(false); const [error, setError] = useState('');
  const filas = g.facturas.map((f) => ({ f, cliente: g.cliente.Nombre })); const elegidas = g.facturas.filter((f) => sel.has(f.Id));
  const total = elegidas.reduce((s, f) => s + f.saldo, 0);
  function seguir() {
    if (!elegidas.length) { setError('Marca al menos una factura.'); return; }
    if (!motivo.trim()) { setError('Escribe el motivo del castigo.'); return; }
    setError(''); setPide(true);
  }
  return (
    <div className="pn-velo" onClick={(e) => e.target === e.currentTarget && cerrar()}>
      <div className="pn-modal cj-mod">
        <h3>⋯ Castigar deuda (incobrable)</h3>
        <p className="cj-nota">{g.cliente.Nombre}</p>
        <Lista filas={filas} sel={sel} setSel={setSel} />
        <label>Motivo (obligatorio)</label>
        <input value={motivo} placeholder="No aparece hace 6 meses, no contesta" onChange={(e) => setMotivo(e.target.value)} />
        <div style={{ border: '1px solid #e8c06a88', background: '#e8c06a14', borderRadius: 10, padding: 10, color: '#e8c06a', marginTop: 10 }}>El saldo pasa a $0 y sale de «Por cobrar». Queda como <b>pérdida por incobrables</b>. No mueve la caja. Si luego paga, se puede reabrir.</div>
        {error && <div className="pn-err">{error}</div>}
        <div className="cj-acc"><button onClick={cerrar}>Cancelar</button><button className="g" onClick={seguir}>Castigar {fmt(total)}</button></div>
      </div>
      {pide && <PinAdmin motivo={`Un Admin digita su PIN para castigar ${fmt(total)} de ${g.cliente.Nombre}.`} cancelar={() => setPide(false)}
        ok={async (a) => { try { await castigarFiados({ facturas: elegidas, motivo, usuario, autorizoId: a.Id }); hecho(`Castigados ${fmt(total)} de ${g.cliente.Nombre}`); } catch (e) { setPide(false); setError(e.message); } }} />}
    </div>
  );
}

/** Castigados: lista y reabrir (con PIN). */
export function Castigados({ version, cambio }) {
  const [lista, setLista] = useState([]); const [abrir, setAbrir] = useState(null);
  useEffect(() => { cargarCastigados().then(setLista); }, [version]);
  if (!lista.length) return null;
  return (
    <>
      <div className="cj-sec" style={{ marginTop: 18 }}>Castigados (pérdida por incobrables)</div>
      <div className="cj-card">
        {lista.map((f) => (
          <div className="cj-mv" key={f.Id}>
            <div><span>{f.cliente} · {f.Numero ?? 'F-—'}</span><small>{fecha(f.FechaCastigo)} · {f.MotivoCastigo}</small></div>
            <span style={{ display: 'flex', gap: 10, alignItems: 'center' }}><b className="rojo">{fmt(f.MontoCastigado)}</b><button className="cj-b" onClick={() => setAbrir(f)}>Reabrir</button></span>
          </div>
        ))}
      </div>
      {abrir && <PinAdmin motivo={`Reabrir la deuda de ${fmt(abrir.MontoCastigado)} de ${abrir.cliente}. Un Admin digita su PIN.`} cancelar={() => setAbrir(null)}
        ok={async () => { await reabrirFiado(abrir); setAbrir(null); cambio(`Deuda reabierta: ${fmt(abrir.MontoCastigado)} de ${abrir.cliente}`); }} />}
    </>
  );
}
