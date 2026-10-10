// src/components/DividirCobro.jsx — Dividir la cuenta entre varios pagadores: cada uno con su valor y su método (o fiado a su nombre).
// Reglas puras en cuenta/dividir.js. El padre (DetalleCuenta) crea una factura por pagador.
import { useState, useMemo, useEffect } from 'react';
import { listarClientes } from '../marcador/datos.js';
import SelectorCliente from './SelectorCliente.jsx';
import { METODOS } from '../cuenta/cobro.js';
import { repartirAuto, planDivision } from '../cuenta/dividir.js';

const fmt = (n) => '$' + Math.round(n).toLocaleString('es-CO');
const num = (v) => Number(String(v).replace(/\D/g, '')) || 0;

export default function DividirCobro({ total, jugadores = [], puedeFiar, pedirPin, cerrar, confirmar }) {
  // arranca con los jugadores de la mesa (sus cuentas); si la cuenta ya tiene cliente registrado, queda listo para fiar
  const n0 = Math.max(2, jugadores.length);
  const [filas, setFilas] = useState(() => repartirAuto(total, Array.from({ length: n0 }, (_, i) => ({ k: i, nombre: jugadores[i]?.nombre ?? '', cliente: null, metodo: 'EFECTIVO', monto: 0, resto: false, paga: true, fijo: false }))));
  useEffect(() => {
    listarClientes().then((l) => setFilas((fs) => fs.map((f, i) => (f.cliente || !jugadores[i]?.clienteId ? f : { ...f, cliente: l.find((c) => c.Id === jugadores[i].clienteId) ?? null }))));
  }, []);   // eslint-disable-line react-hooks/exhaustive-deps
  const [pick, setPick] = useState(null);   // índice de la fila que elige cliente
  const [sel, setSel] = useState({ cliente: null, nombre: '' }); const [errSel, setErrSel] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const cambiar = (i, p) => setFilas((l) => l.map((f, j) => (j === i ? { ...f, ...p } : f)));
  const cambiarYRepartir = (i, p) => setFilas((l) => repartirAuto(total, l.map((f, j) => (j === i ? { ...f, ...p } : f))));   // reparte solo lo que falta
  const quienes = filas.filter((f) => f.paga);
  const plan = useMemo(() => planDivision({ total, pagos: quienes.map((f) => ({ nombre: f.nombre, clienteId: f.cliente?.Id ?? null, metodo: f.metodo, monto: f.monto, resto: f.resto })) }), [total, filas]);
  const suma = plan.pagos ? total : quienes.reduce((s, f) => s + (f.resto ? 0 : f.monto), 0);
  const iguales = () => setFilas((l) => repartirAuto(total, l.map((f) => ({ ...f, fijo: false, resto: false }))));
  const agregar = () => setFilas((l) => repartirAuto(total, [...l, { k: Date.now(), nombre: '', cliente: null, metodo: 'EFECTIVO', monto: 0, resto: false, paga: true, fijo: false }]));
  const quitar = (i) => setFilas((l) => (l.length > 2 ? repartirAuto(total, l.filter((_, j) => j !== i)) : l));
  const marcarResto = (i) => setFilas((l) => repartirAuto(total, l.map((f, j) => ({ ...f, resto: j === i ? !f.resto : false }))));
  const elegirMetodo = (i, m) => {
    const poner = () => { cambiar(i, { metodo: m }); if (m === 'FIADO' && !filas[i].cliente) abrirCliente(i); };
    if (m === 'FIADO' && !puedeFiar) pedirPin(poner); else poner();
  };
  const abrirCliente = (i) => { setSel({ cliente: filas[i].cliente, nombre: '' }); setErrSel(''); setPick(i); };
  async function cobrar() {
    if (!plan.pagos || ocupado) return;
    setOcupado(true);
    try { await confirmar(plan.pagos.map((p, i) => ({ ...p, cliente: quienes[i].cliente }))); } finally { setOcupado(false); }
  }
  return (
    <div className="pn-velo alto" onClick={(e) => e.target === e.currentTarget && !ocupado && cerrar()}>
      <div className="pn-modal cb" style={{ width: 'min(760px,100%)', maxHeight: '92vh', overflowY: 'auto' }}>
        <h3>👥 Dividir la cuenta</h3>
        <div className="cb-tot" style={{ fontSize: 36 }}>{fmt(total)}</div><div className="cb-tl">TOTAL A COBRAR</div>
        <div style={{ display: 'flex', gap: 8, margin: '10px 0' }}>
          <button className="no" style={{ padding: '8px 12px', border: '1px solid #2a3350', borderRadius: 9, background: 'transparent', color: '#cbd0dc', cursor: 'pointer' }} onClick={iguales}>⚖️ Partes iguales</button>
          <button className="no" style={{ padding: '8px 12px', border: '1px solid #2a3350', borderRadius: 9, background: 'transparent', color: '#cbd0dc', cursor: 'pointer' }} onClick={agregar}>＋ Agregar pagador</button>
        </div>
        {filas.map((f, i) => (
          <div key={f.k} style={{ opacity: f.paga ? 1 : 0.45, border: `1px solid ${f.metodo === 'FIADO' ? '#f5c04a88' : '#1f2740'}`, background: f.metodo === 'FIADO' ? '#f5c04a0c' : '#0b0f19', borderRadius: 12, padding: 10, margin: '8px 0' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr auto', gap: 8, alignItems: 'center' }}>
              <div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: f.paga ? '#4ade80' : '#7d8597', marginBottom: 4, cursor: 'pointer' }}><input type="checkbox" checked={f.paga} onChange={(e) => cambiarYRepartir(i, { paga: e.target.checked, fijo: false })} style={{ width: 'auto' }} /> {f.paga ? 'Paga' : 'No paga'}</label>
                <input value={f.nombre} placeholder={`Jugador ${i + 1}`} onChange={(e) => cambiar(i, { nombre: e.target.value })} style={{ marginBottom: 4 }} />
                <button style={{ background: 'none', border: 0, color: f.cliente ? '#f5c04a' : '#7d8597', fontSize: 12, cursor: 'pointer', padding: 0 }} onClick={() => abrirCliente(i)}>
                  {f.cliente ? `👤 ${f.cliente.Nombre}  ✎` : '👤 Elegir cliente'}</button>
              </div>
              <div>
                <input inputMode="numeric" disabled={f.resto || !f.paga} style={{ textAlign: 'right', fontWeight: 700 }}
                  value={!f.paga ? '—' : f.resto ? (plan.pagos ? fmt(plan.pagos[quienes.indexOf(f)].monto) : 'el resto') : f.monto ? fmt(f.monto) : ''} placeholder="$ 0" onChange={(e) => { const v = num(e.target.value); cambiarYRepartir(i, { monto: v, fijo: v > 0 }); }} />
                <button style={{ background: 'none', border: 0, color: f.resto ? '#e8c06a' : '#7d8597', fontSize: 11, cursor: 'pointer', padding: 0, marginTop: 3 }} onClick={() => marcarResto(i)}>{f.resto ? '✓ el resto' : 'poner “el resto”'}</button>
              </div>
              <button title="Quitar pagador" disabled={filas.length <= 2} onClick={() => quitar(i)} style={{ background: 'none', border: 0, color: '#ff7a8a', fontSize: 16, cursor: 'pointer', opacity: filas.length <= 2 ? .3 : 1 }}>✕</button>
            </div>
            <div className="cb-met" style={{ marginTop: 8, gridTemplateColumns: 'repeat(6,1fr)' }}>
              {METODOS.map((m) => <button key={m.v} className={`${m.v === 'FIADO' ? 'fi' : ''} ${f.metodo === m.v ? 'on' : ''}`} style={{ padding: '8px 2px', fontSize: 11.5, minHeight: 38 }} onClick={() => elegirMetodo(i, m.v)}>{m.t}{m.v === 'FIADO' && !puedeFiar ? ' 🔒' : ''}</button>)}
            </div>
          </div>
        ))}
        <div style={{ border: `1px solid ${plan.pagos ? '#4ade8099' : '#f5c04a88'}`, background: plan.pagos ? '#4ade8012' : '#f5c04a12', color: plan.pagos ? '#4ade80' : '#f5c04a', borderRadius: 10, padding: '10px 12px', marginTop: 10, display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: 13 }}>
          <span>{plan.pagos ? '✓ Cuadra con el total' : plan.error}</span><span>Suma {fmt(suma)} de {fmt(total)}</span>
        </div>
        {plan.pagos?.some((p) => p.metodo === 'FIADO') && <div className="cb-alerta" style={{ marginTop: 8 }}>📒 Fiado: {plan.pagos.map((p, i) => (p.metodo === 'FIADO' ? `${quienes[i].cliente?.Nombre} ${fmt(p.monto)}` : null)).filter(Boolean).join(' · ')}. Queda en Fiados pendientes a nombre de cada uno.</div>}
        <div className="pn-acc"><button className="no" onClick={cerrar} disabled={ocupado}>CANCELAR</button><button className="si" disabled={!plan.pagos || ocupado} onClick={cobrar}>✓ COBRAR {fmt(total)}</button></div>
      </div>
      {pick !== null && (
        <div className="pn-velo alto" onClick={(e) => e.target === e.currentTarget && setPick(null)}>
          <div className="pn-modal">
            <h3>Cliente de {filas[pick]?.nombre || `Jugador ${pick + 1}`}</h3>
            <SelectorCliente valor={sel} onChange={setSel} error={errSel} setError={setErrSel} soloCliente />
            {errSel && <div className="pn-err">{errSel}</div>}
            <div className="pn-acc"><button className="no" onClick={() => setPick(null)}>CANCELAR</button>
              <button className="si" onClick={() => { if (!sel.cliente) { setErrSel('Elige un cliente o crea uno nuevo.'); return; } cambiar(pick, { cliente: sel.cliente, nombre: filas[pick].nombre || sel.cliente.Apodo || sel.cliente.Nombre }); setPick(null); }}>USAR ESTE CLIENTE</button></div>
          </div>
        </div>
      )}
    </div>
  );
}
