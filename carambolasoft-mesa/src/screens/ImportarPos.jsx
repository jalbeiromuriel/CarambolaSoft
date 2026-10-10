// src/screens/ImportarPos.jsx — Importar desde el POS (solo Admin): elige el backup, ve la vista previa y confirma.
import { useState } from 'react';
import { validarBackup, planImportacion } from '../cuenta/importarPos.js';
import { datosExistentes, aplicarImportacion } from '../cuenta/importarPosDb.js';
import './Panel.css';
import './Caja.css';

const fmt = (n) => '$' + Math.round(n ?? 0).toLocaleString('es-CO');

export default function ImportarPos({ cerrar, listo }) {
  const [plan, setPlan] = useState(null); const [archivo, setArchivo] = useState(''); const [error, setError] = useState(''); const [ocupado, setOcupado] = useState(false);
  const [sel, setSel] = useState({ productos: true, clientes: true, fiados: true });
  async function elegir(e) {
    const f = e.target.files?.[0]; if (!f) return;
    setError(''); setPlan(null); setArchivo(f.name);
    try {
      const b = JSON.parse(await f.text()); const err = validarBackup(b);
      if (err) { setError(err); return; }
      setPlan(planImportacion(b, await datosExistentes()));
    } catch { setError('No pude leer el archivo. ¿Es el .json que descarga el POS?'); }
  }
  async function importar() {
    setOcupado(true);
    try {
      const p = { ...plan, productos: sel.productos ? plan.productos : [], clientes: sel.clientes || sel.fiados ? plan.clientes : [], fiados: sel.fiados ? plan.fiados : [], ultimoNumero: sel.fiados ? plan.ultimoNumero : 0 };
      await aplicarImportacion(p); listo(`Importado: ${p.productos.length} productos · ${p.clientes.length} clientes · ${p.fiados.length} fiados ✓`);
    } catch (e) { setError(`Falló la importación: ${e.message}`); setOcupado(false); }
  }
  const r = plan?.resumen;
  const Ck = ({ k, t }) => <label className="cj-ck" style={{ display: 'flex', gap: 8, alignItems: 'center', letterSpacing: 0, textTransform: 'none', fontSize: 13, color: '#cbd0dc', margin: '6px 0' }}><input type="checkbox" style={{ width: 'auto' }} checked={sel[k]} onChange={(e) => setSel({ ...sel, [k]: e.target.checked })} />{t}</label>;
  return (
    <div className="pn-velo" onClick={(e) => e.target === e.currentTarget && !ocupado && cerrar()}>
      <div className="pn-modal cj-mod" style={{ width: 'min(620px,100%)' }}>
        <h3>📂 Importar desde el POS</h3>
        <p className="cj-nota">Elige el archivo <b>MeroParche_backup_….json</b>. Solo se leen inventario, clientes y fiados pendientes.</p>
        <input type="file" accept=".json,application/json" onChange={elegir} />
        {archivo && !plan && !error && <p className="cj-nota">Leyendo {archivo}…</p>}
        {error && <div className="pn-err">{error}</div>}
        {plan && <>
          <div className="cj-g2" style={{ gridTemplateColumns: 'repeat(3,1fr)', marginTop: 12 }}>
            <div className="cj-card"><small className="cj-nota">PRODUCTOS</small><b style={{ display: 'block', fontSize: 22, color: '#4ade80' }}>{r.productos}</b><span className="cj-nota">{r.productosNuevos} nuevos · {r.productosActualizan} se actualizan</span></div>
            <div className="cj-card"><small className="cj-nota">CLIENTES</small><b style={{ display: 'block', fontSize: 22, color: '#4ade80' }}>{r.clientes}</b><span className="cj-nota">{r.clientesUnidos ? `${r.clientesUnidos} repetido${r.clientesUnidos > 1 ? 's' : ''} unido${r.clientesUnidos > 1 ? 's' : ''}` : 'sin repetidos'}</span></div>
            <div className="cj-card"><small className="cj-nota">FIADOS PENDIENTES</small><b style={{ display: 'block', fontSize: 22, color: '#f5c04a' }}>{fmt(r.fiadoTotal)}</b><span className="cj-nota">{r.fiados} facturas · {r.fiadoClientes} clientes</span></div>
          </div>
          <Ck k="productos" t="Productos y categorías (los sueltos y copas quedan ligados a su envase)" />
          <Ck k="clientes" t="Clientes (nombre y apodo)" />
          <Ck k="fiados" t="Fiados pendientes con su saldo, factura original y lo ya abonado" />
          {r.sinCliente.length > 0 && <div className="cj-nota" style={{ color: '#f5c04a' }}>⚠️ {r.sinCliente.length} fiado(s) sin cliente identificable no se importan: {[...new Set(r.sinCliente)].slice(0, 4).join(', ')}</div>}
          <p className="cj-nota">Omitidos: {plan.omitidos.join(', ') || 'ninguno'}. No se importan ventas, cierres, gastos, máquinas ni datos de pago. Los fiados importados no cuentan como ventas nuevas. La próxima factura continúa en F-{String((plan.ultimoNumero || 0) + 1).padStart(4, '0')}. Si importas dos veces no se duplica.</p>
        </>}
        <div className="cj-acc"><button onClick={cerrar} disabled={ocupado}>Cancelar</button><button className="g" disabled={!plan || ocupado || (!sel.productos && !sel.clientes && !sel.fiados)} onClick={importar}>{ocupado ? 'Importando…' : 'Importar ahora'}</button></div>
      </div>
    </div>
  );
}
