// src/screens/FacturasBuscar.jsx — Buscador de facturas (solo lectura) dentro de Caja. Cada resultado abre la COPIA del recibo.
import { useState, useEffect, useMemo } from 'react';
import { getAll } from '../db/repository.js';
import { buscarFacturas } from '../cuenta/caja.js';
import { HojaCopiaFactura } from '../informes/Hoja.jsx';
import { copiaFactura, textoCopiaFactura, fmt, nombreMetodo } from '../informes/datos.js';

const fechaHora = (iso) => new Date(iso).toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' }) + ' · ' + new Date(iso).toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' });

export default function FacturasBuscar() {
  const [d, setD] = useState(null);
  const [texto, setTexto] = useState(''); const [estado, setEstado] = useState('todas'); const [periodo, setPeriodo] = useState('todo');
  const [hoja, setHoja] = useState(null);
  useEffect(() => { (async () => {
    const [facturas, cuentas, clientes, abonos, pedidos, productos] = await Promise.all(['FACTURAS', 'CUENTAS', 'CLIENTES', 'ABONOS_FIADO', 'PEDIDOS_CUENTAS', 'PRODUCTOS'].map(getAll));
    setD({ facturas, cuentas, clientes, abonos, pedidos, productos });
  })(); }, []);
  const filas = useMemo(() => (d ? buscarFacturas({ ...d, texto, estado, periodo }) : []), [d, texto, estado, periodo]);
  function ver(r) {
    const c = d.cuentas.find((x) => x.Id === r.factura.CuentaId); const cl = d.clientes.find((x) => x.Id === c?.ClienteId);
    setHoja({ copia: copiaFactura({ factura: r.factura, pedidos: d.pedidos, productos: d.productos, abonos: d.abonos.filter((a) => a.FacturaId === r.factura.Id), cliente: cl, nombreCuenta: c?.NombreLibre ?? '' }), telefono: cl?.Telefono });
  }
  return (
    <div className="cj-card">
      <div className="cj-sec">Facturas</div>
      <div className="fb-barra">
        <input className="fb-in" autoFocus value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="🔎 F-0004, Chalo, 02/10…" />
        <select value={estado} onChange={(e) => setEstado(e.target.value)}><option value="todas">Todas</option><option value="pagadas">Pagadas</option><option value="pendientes">Pendientes</option></select>
        <select value={periodo} onChange={(e) => setPeriodo(e.target.value)}><option value="todo">Todo el tiempo</option><option value="hoy">Hoy</option><option value="7d">Últimos 7 días</option></select>
      </div>
      {d && filas.length === 0 && <div className="cj-vacio">No hay facturas con ese criterio.</div>}
      <div className="cj-lista">{filas.map((r) => (
        <div className="cj-mv" key={r.factura.Id}>
          <div><span><b>{r.numero}</b> · {r.cliente || 'Sin nombre'} <span className={`fb-est ${r.estado}`}>{r.estado}</span></span>
            <small>{fechaHora(r.fecha)} · {r.metodo === 'FIADO' ? 'Fiado' : nombreMetodo(r.metodo)}</small></div>
          <span className="cj-der"><b className={r.saldo > 0 ? 'amb' : ''}>{fmt(r.saldo > 0 ? r.saldo : r.total)}</b><button className="cj-mini" onClick={() => ver(r)}>🧾 Ver</button></span>
        </div>))}</div>
      {hoja && <HojaCopiaFactura d={hoja.copia} telefono={hoja.telefono} texto={textoCopiaFactura(hoja.copia)} cerrar={() => setHoja(null)} />}
    </div>
  );
}
