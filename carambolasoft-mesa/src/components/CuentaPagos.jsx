// src/components/CuentaPagos.jsx — Cuentas para recibir pagos: tarjeta para mostrar al cliente (una a la vez) y administración (solo Admin).
// Los datos viven en META 'negocio.cuentasPago' (solo este equipo); nunca van en el código.
import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { leerCuentasPago, guardarCuentasPago } from '../cuenta/fiadosDb.js';
import { TIPOS_CUENTA, pieDe, cuentasActivas, cuentaNueva, conPrincipal, validarCuenta } from '../cuenta/cuentasPago.js';
import './CuentaPagos.css';

const agrupar = (n) => String(n);

export default function CuentaPagos({ admin, cerrar }) {
  const [lista, setLista] = useState(null);
  const [vista, setVista] = useState('tarjeta'); // 'tarjeta' | 'admin' | 'form'
  const [i, setI] = useState(0); const [form, setForm] = useState(null); const [error, setError] = useState(''); const [copiado, setCopiado] = useState(false);

  useEffect(() => { leerCuentasPago().then((l) => { setLista(l); if (!cuentasActivas(l).length && admin) setVista('admin'); }); }, [admin]);
  if (!lista) return null;

  const activas = cuentasActivas(lista);
  const actual = activas[Math.min(i, activas.length - 1)];
  const guardar = async (nueva) => { const l = conPrincipal(nueva); setLista(l); await guardarCuentasPago(l); };
  const copiar = () => { navigator.clipboard?.writeText(actual.numero).then(() => { setCopiado(true); setTimeout(() => setCopiado(false), 1600); }); };

  async function guardarForm() {
    const e = validarCuenta(form); if (e) { setError(e); return; }
    const existe = lista.some((c) => c.Id === form.Id);
    await guardar(existe ? lista.map((c) => (c.Id === form.Id ? form : c)) : [...lista, form]);
    setForm(null); setError(''); setVista('admin');
  }
  function subirQr(ev) {
    const f = ev.target.files?.[0]; if (!f) return;
    if (f.size > 300 * 1024) { setError('El QR pesa más de 300 KB. Usa una imagen más liviana.'); return; }
    const r = new FileReader(); r.onload = () => setForm((x) => ({ ...x, qr: r.result })); r.readAsDataURL(f);
  }

  return createPortal(
    <div className="pn-velo" onClick={(e) => e.target === e.currentTarget && cerrar()}>
      <div className={`pn-modal cp-mod${vista === 'tarjeta' ? ' cp-gran' : ''}`}>
        {vista === 'tarjeta' && (
          <>
            <h3>💳 Para el cliente</h3>
            {actual ? (
              <>
                <div className="cp-tj">
                  <div className="cp-top"><span className="cp-chip" /><span>CUENTA PARA PAGOS</span><small>MERO PARCHE</small></div>
                  <div className="cp-cuerpo">
                    <div>
                      <div className="cp-banco">{actual.banco}</div>
                      <div className="cp-num">{agrupar(actual.numero)}</div>
                      <div className="cp-tit">{actual.titular}</div>
                    </div>
                    {actual.qr && <img className="cp-qr" src={actual.qr} alt="QR de pago" />}
                  </div>
                  <div className="cp-pie">✦ {pieDe(actual.tipo).toUpperCase()} ✦</div>
                </div>
                {activas.length > 1 && (
                  <div className="cp-nav">
                    <button onClick={() => setI((i + activas.length - 1) % activas.length)} aria-label="Anterior">‹</button>
                    {activas.map((c, k) => <span key={c.Id} className={`cp-dot${k === i ? ' on' : ''}`} onClick={() => setI(k)} />)}
                    <button onClick={() => setI((i + 1) % activas.length)} aria-label="Siguiente">›</button>
                  </div>
                )}
                <div className="cp-cont">{i + 1} de {activas.length}{actual.principal ? ' · ⭐ Principal' : ''}</div>
              </>
            ) : <div className="pn-vacio">Aún no hay cuentas de pago. Un Admin debe agregarlas.</div>}
            <div className="pn-acc"><button className="no" onClick={cerrar}>CERRAR</button>
              {admin && <button className="no" onClick={() => setVista('admin')}>⚙ ADMINISTRAR</button>}
              {actual && <button className="si" onClick={copiar}>{copiado ? '✓ COPIADO' : '📋 COPIAR NÚMERO'}</button>}</div>
          </>
        )}

        {vista === 'admin' && (
          <>
            <h3>⚙ Administrar cuentas</h3>
            {lista.length === 0 && <div className="pn-vacio">No hay cuentas. Agrega la primera.</div>}
            {lista.map((c) => (
              <div key={c.Id} className={`cp-fila${c.activa === false ? ' off' : ''}`}>
                <div><b>{c.banco}</b>{c.principal && <span className="cp-star">⭐ Principal</span>}{c.activa === false && <span className="mut"> (oculta)</span>}<small>{c.numero} · {c.titular}</small></div>
                <div className="cp-ic">
                  {!c.principal && c.activa !== false && <button title="Hacer principal" onClick={() => guardar(lista.map((x) => ({ ...x, principal: x.Id === c.Id })))}>⭐</button>}
                  <button title={c.activa === false ? 'Mostrar' : 'Ocultar'} onClick={() => guardar(lista.map((x) => (x.Id === c.Id ? { ...x, activa: x.activa === false } : x)))}>{c.activa === false ? '👁' : '🙈'}</button>
                  <button title="Editar" onClick={() => { setForm({ ...c }); setError(''); setVista('form'); }}>✏️</button>
                  <button title="Borrar" onClick={() => { if (window.confirm(`¿Borrar la cuenta ${c.banco}?`)) guardar(lista.filter((x) => x.Id !== c.Id)); }}>🗑</button>
                </div>
              </div>
            ))}
            <p className="au-nota">Estos datos se guardan solo en este equipo; no se publican en el código. Ocultar no borra la cuenta.</p>
            <div className="pn-acc"><button className="no" onClick={() => setVista('tarjeta')}>VOLVER</button>
              <button className="si" onClick={() => { setForm(cuentaNueva()); setError(''); setVista('form'); }}>+ AGREGAR CUENTA</button></div>
          </>
        )}

        {vista === 'form' && form && (
          <>
            <h3>{lista.some((c) => c.Id === form.Id) ? '✏️ Editar cuenta' : '+ Nueva cuenta'}</h3>
            <label>Tipo</label>
            <select value={form.tipo} onChange={(e) => { const t = e.target.value; setForm({ ...form, tipo: t, banco: !form.banco || ['Nequi', 'Daviplata'].includes(form.banco) ? cuentaNueva(t).banco : form.banco }); }}>
              {TIPOS_CUENTA.map((t) => <option key={t.v} value={t.v}>{t.t}</option>)}</select>
            <label>Banco o nombre</label><input value={form.banco} onChange={(e) => setForm({ ...form, banco: e.target.value })} placeholder="Bancolombia · Cuenta de ahorros" />
            <label>Número</label><input value={form.numero} onChange={(e) => setForm({ ...form, numero: e.target.value })} placeholder="000 000000 00" />
            <label>Titular</label><input value={form.titular} onChange={(e) => setForm({ ...form, titular: e.target.value })} />
            <label>QR de cobro (opcional)</label>
            <div className="cp-qrrow">{form.qr && <img className="cp-qr mini" src={form.qr} alt="QR" />}<input type="file" accept="image/*" onChange={subirQr} />
              {form.qr && <button className="no" onClick={() => setForm({ ...form, qr: '' })}>Quitar</button>}</div>
            {error && <div className="pn-err">{error}</div>}
            <div className="pn-acc"><button className="no" onClick={() => { setForm(null); setError(''); setVista('admin'); }}>CANCELAR</button><button className="si" onClick={guardarForm}>GUARDAR</button></div>
          </>
        )}
      </div>
    </div>, document.body
  );
}
