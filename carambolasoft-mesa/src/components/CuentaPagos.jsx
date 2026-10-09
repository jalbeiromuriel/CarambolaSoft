// src/components/CuentaPagos.jsx — Ventana grande con la cuenta de pagos del negocio (para mostrársela al cliente).
// Los datos se configuran una vez (solo Admin edita) y viven en META 'negocio.datosPago'; nunca van en el código.
import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { leerDatosPago, guardarDatosPago } from '../cuenta/fiadosDb.js';
import './CuentaPagos.css';

export default function CuentaPagos({ admin, cerrar }) {
  const [d, setD] = useState(null); const [editar, setEditar] = useState(false); const [copiado, setCopiado] = useState(false);
  useEffect(() => { leerDatosPago().then((x) => { const v = x ?? { banco: '', cuenta: '', titular: '' }; setD(v); setEditar(admin && !v.cuenta); }); }, [admin]);
  if (!d) return null;
  const copiar = () => { navigator.clipboard?.writeText(d.cuenta).then(() => { setCopiado(true); setTimeout(() => setCopiado(false), 1600); }); };
  return createPortal(
    <div className="pn-velo" onClick={(e) => e.target === e.currentTarget && cerrar()}>
      <div className="pn-modal cp-mod">
        <h3>💳 Cuenta para pagos</h3>
        {editar ? (
          <>
            <label>Banco y tipo</label><input autoFocus value={d.banco} onChange={(e) => setD({ ...d, banco: e.target.value })} placeholder="Bancolombia · Cuenta de ahorros" />
            <label>Número</label><input value={d.cuenta} onChange={(e) => setD({ ...d, cuenta: e.target.value })} />
            <label>Titular</label><input value={d.titular} onChange={(e) => setD({ ...d, titular: e.target.value })} />
            <div className="pn-acc"><button className="no" onClick={() => (d.cuenta ? setEditar(false) : cerrar())}>CANCELAR</button>
              <button className="si" onClick={async () => { await guardarDatosPago({ banco: d.banco, cuenta: d.cuenta, titular: d.titular }); setEditar(false); }}>GUARDAR</button></div>
          </>
        ) : (
          <>
            {d.cuenta
              ? <div className="cp-box"><div className="cp-banco">{d.banco}</div><div className="cp-num">{d.cuenta}</div><div className="cp-tit">{d.titular}</div></div>
              : <div className="pn-vacio">Aún no hay datos de pago. Un Admin debe configurarlos.</div>}
            <div className="pn-acc"><button className="no" onClick={cerrar}>CERRAR</button>
              {admin && <button className="no" onClick={() => setEditar(true)}>✏️ EDITAR</button>}
              {d.cuenta && <button className="si" onClick={copiar}>{copiado ? '✓ COPIADO' : '📋 COPIAR NÚMERO'}</button>}</div>
          </>
        )}
      </div>
    </div>, document.body
  );
}
