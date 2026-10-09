// src/screens/Clientes.jsx — Clientes: lista (cards/lista), historial de consumo y fiados con abonos (solo Admin).
// Empleado: ve y agrega clientes; no ve fiados, deudas ni teléfono, ni edita/elimina.
import { useState, useEffect, useCallback, useMemo } from 'react';
import Encabezado from '../components/Encabezado.jsx';
import Avatar from '../components/Avatar.jsx';
import { useSesion } from '../components/Sesion.jsx';
import { esAdmin } from '../cuenta/auth.js';
import { norm } from '../cuenta/catalogo.js';
import { METODOS } from '../cuenta/cobro.js';
import { antiguedad } from '../cuenta/fiados.js';
import { listarClientes, guardarCliente } from '../marcador/datos.js';
import { getAll } from '../db/repository.js';
import { cargarFiados, registrarAbono, abonosDeCliente, leerDatosPago, guardarDatosPago } from '../cuenta/fiadosDb.js';
import { HojaReciboFiado, HojaCartera, HojaCopiaFactura } from '../informes/Hoja.jsx';
import { copiaFactura, textoCopiaFactura, reciboFiado, carteraFiados, textoReciboFiado, textoCartera } from '../informes/datos.js';
import './Panel.css';
import './Auth.css';
import './Clientes.css';

const fmt = (n) => '$' + Math.round(n).toLocaleString('es-CO');
const fecha = (iso) => (iso ? new Date(iso).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' }) + ' · ' + new Date(iso).toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' }) : '—');
const soloDigitos = (v) => Number(String(v).replace(/\D/g, '')) || 0;
const METODOS_ABONO = METODOS.filter((m) => m.v !== 'FIADO');

export default function Clientes() {
  const { usuario } = useSesion();
  const admin = esAdmin(usuario?.Rol);
  const [tab, setTab] = useState('lista');
  const [vista, setVista] = useState('cards');
  const [q, setQ] = useState('');
  const [clientes, setClientes] = useState([]);
  const [fiados, setFiados] = useState({ lista: [], total: 0 });
  const [facturas, setFacturas] = useState([]); const [cuentas, setCuentas] = useState([]);
  const [pedidos, setPedidos] = useState([]); const [productos, setProductos] = useState([]);
  const [form, setForm] = useState(null);       // cliente nuevo/editar
  const [abono, setAbono] = useState(null);     // { g, metodo, monto, error }
  const [hoja, setHoja] = useState(null);         // { recibo: datos } | { cartera: datos }
  const [detalle, setDetalle] = useState(null); // { g, tipo:'facturas'|'abonos', abonos? }
  const [pago, setPago] = useState(null);       // datos de pago { editar, banco, cuenta, titular }
  const [histCli, setHistCli] = useState(null);
  const [aviso, setAviso] = useState('');
  const decir = (t) => { setAviso(t); setTimeout(() => setAviso(''), 2800); };

  const cargar = useCallback(async () => {
    setClientes((await listarClientes()).filter((c) => c.Activo !== false));
    setFacturas(await getAll('FACTURAS')); setCuentas(await getAll('CUENTAS'));
    setPedidos(await getAll('PEDIDOS_CUENTAS')); setProductos(await getAll('PRODUCTOS'));
    setFiados(await cargarFiados());
  }, []);
  useEffect(() => { cargar(); }, [cargar]);

  const visibles = useMemo(() => clientes.filter((c) => !q || norm(c.Nombre).includes(norm(q)) || norm(c.Apodo).includes(norm(q))), [clientes, q]);
  const ultima = (c) => cuentas.filter((x) => x.ClienteId === c.Id).map((x) => x.HoraApertura).sort().pop();
  const deudaDe = (c) => fiados.lista.find((g) => g.cliente.Id === c.Id)?.deuda ?? 0;

  async function guardar() {
    if (!form.Nombre?.trim()) { setForm({ ...form, error: 'Escribe el nombre.' }); return; }
    const previo = form.Id ? clientes.find((c) => c.Id === form.Id) : null;
    await guardarCliente({ ...previo, Id: form.Id, Nombre: form.Nombre, Apodo: form.Apodo, ...(admin ? { Telefono: form.Telefono } : {}) });
    setForm(null); decir('Cliente guardado ✓'); await cargar();
  }
  async function eliminar(c) {   // baja lógica: nunca se borra con historial; solo si no tiene facturas
    if (facturas.some((f) => cuentas.find((x) => x.Id === f.CuentaId)?.ClienteId === c.Id)) { decir('Tiene facturas: no se puede eliminar.'); return; }
    await guardarCliente({ ...c, Activo: false }); decir(`${c.Nombre} eliminado`); await cargar();
  }
  async function abrirAbono(g) { setAbono({ g, metodo: 'EFECTIVO', monto: 0, error: '' }); }
  async function confirmarAbono() {
    const { g, metodo, monto } = abono;
    if (!(monto > 0)) { setAbono({ ...abono, error: 'Escribe cuánto paga.' }); return; }
    if (monto > g.deuda) { setAbono({ ...abono, error: `No puede superar la deuda (${fmt(g.deuda)}).` }); return; }
    await registrarAbono({ facturas: g.facturas, monto, metodo, usuarioId: usuario.Id });
    setAbono(null); decir(monto === g.deuda ? 'Deuda saldada ✓' : `Abono de ${fmt(monto)} registrado ✓`); await cargar();
  }
  async function verDetalle(g, tipo) {
    setDetalle({ g, tipo, abonos: tipo === 'abonos' ? await abonosDeCliente(g.todasFacturaIds) : [] });
  }
  async function verRecibo(g) {
    const facIds = g.facturas.map((f) => f.Id);
    const pagos = await abonosDeCliente(facIds);
    setHoja({ recibo: reciboFiado({ g, pedidos, productos, pagos }), pago: await leerDatosPago(), telefono: g.cliente.Telefono });
  }
  async function verCopia(g, f) {
    const abonos = (await getAll('ABONOS_FIADO')).filter((a) => a.FacturaId === f.Id);
    setHoja({ copia: copiaFactura({ factura: f, pedidos, productos, abonos, cliente: g.cliente }), telefono: g.cliente.Telefono });
  }
  async function verPago() { setPago({ ...((await leerDatosPago()) ?? { banco: '', cuenta: '', titular: '' }), editar: false }); }
  async function guardarPago() { await guardarDatosPago({ banco: pago.banco, cuenta: pago.cuenta, titular: pago.titular }); setPago({ ...pago, editar: false }); }

  // Historial de un cliente: facturas + lo que más pide
  const histFacturas = histCli ? facturas.filter((f) => cuentas.find((c) => c.Id === f.CuentaId)?.ClienteId === histCli.Id).sort((a, b) => (b.FechaHora ?? '').localeCompare(a.FechaHora ?? '')) : [];
  const histTop = (() => {
    if (!histCli) return [];
    const mias = new Set(cuentas.filter((c) => c.ClienteId === histCli.Id).map((c) => c.Id)); const n = {};
    for (const p of pedidos) if (mias.has(p.CuentaId) && p.EstadoPedido === 'ENTREGADO') n[p.ProductoId] = (n[p.ProductoId] ?? 0) + p.Cantidad;
    return Object.entries(n).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([id, c]) => [productos.find((p) => p.Id === id)?.Nombre ?? '¿?', c]);
  })();

  return (
    <div className="pn cl">
      <Encabezado activo="clientes" />
      <div className="pn-wrap">
        <div className="cl-bar">
          <input className="us-q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="🔍 Buscar cliente o apodo…" />
          <button className={`us-f ${vista === 'cards' ? 'on' : ''}`} onClick={() => setVista('cards')}>⊞ Cards</button>
          <button className={`us-f ${vista === 'lista' ? 'on' : ''}`} onClick={() => setVista('lista')}>☰ Lista</button>
          <button className="us-nuevo" onClick={() => setForm({ Nombre: '', Apodo: '', Telefono: '', error: '' })}>+ NUEVO</button>
        </div>
        <div className="cl-tabs">
          <button className={tab === 'lista' ? 'on' : ''} onClick={() => setTab('lista')}>👥 Lista de clientes</button>
          <button className={tab === 'hist' ? 'on' : ''} onClick={() => setTab('hist')}>📋 Historial de consumo</button>
          {admin && <button className={tab === 'fiados' ? 'on' : ''} onClick={() => setTab('fiados')}>💸 Fiados pendientes{fiados.lista.length ? ` · ${fiados.lista.length}` : ''}</button>}
        </div>

        {tab === 'lista' && (
          <div className={vista === 'cards' ? 'cl-cards' : 'cl-filas'}>
            {visibles.length === 0 && <div className="pn-vacio">Sin clientes.</div>}
            {visibles.map((c) => (
              <div key={c.Id} className="cl-c">
                <Avatar nombre={c.Nombre} rol="EMPLEADO" grande />
                <div className="n"><b>{c.Nombre}</b><small>{c.Apodo ? `“${c.Apodo}”` : 'sin apodo'}{admin && c.Telefono ? ` · ${c.Telefono}` : ''}</small></div>
                <div className="m"><span className="star">⭐ {c.Visitas ?? 0}</span><span>{ultima(c) ? fecha(ultima(c)).split(' · ')[0] : 'nunca'}</span>{admin && deudaDe(c) > 0 && <span className="deb">Fía {fmt(deudaDe(c))}</span>}</div>
                {admin && <div className="acc"><button onClick={() => setForm({ ...c, Telefono: c.Telefono ?? '', Apodo: c.Apodo ?? '', error: '' })}>✏️</button><button className="r" onClick={() => eliminar(c)}>🗑</button></div>}
              </div>
            ))}
          </div>
        )}

        {tab === 'hist' && (
          <div className="cl-hist">
            <div className="cl-quien">{visibles.map((c) => <button key={c.Id} className={histCli?.Id === c.Id ? 'on' : ''} onClick={() => setHistCli(c)}>{c.Apodo || c.Nombre}</button>)}</div>
            {!histCli ? <div className="pn-vacio">Elige un cliente para ver su historial.</div> : (
              <>
                <div className="cl-top"><b>Lo que más pide:</b> {histTop.length ? histTop.map(([n, c]) => `${n} (${c})`).join(' · ') : 'aún nada'}</div>
                {histFacturas.length === 0 && <div className="pn-vacio">Sin facturas todavía.</div>}
                {histFacturas.map((f) => (
                  <div key={f.Id} className="cl-fila"><span className="mut">{fecha(f.FechaHora ?? f.UltimaModificacion)}</span><b>{f.Numero ?? '—'}</b><span className="mut">{(f.MetodoPago ?? '').toLowerCase()}</span>
                    <span className={`cl-est ${f.EstadoPago}`}>{f.EstadoPago}</span><b className="der">{fmt(f.TotalPagar)}</b></div>
                ))}
              </>
            )}
          </div>
        )}

        {tab === 'fiados' && admin && (
          <>
            <div className="cl-ban"><span>{fiados.lista.length} {fiados.lista.length === 1 ? 'cliente' : 'clientes'} con fiado pendiente</span><b>{fmt(fiados.total)}</b>
              <button className="v" onClick={verPago}>💳 Datos de pago</button><button className="o" onClick={() => setHoja({ cartera: carteraFiados(fiados.lista) })}>📄 PDF cartera</button></div>
            {fiados.lista.length === 0 && <div className="pn-vacio">Nadie debe nada. 🎉</div>}
            {fiados.lista.map((g) => {
              const a = antiguedad(g.masAntigua);
              return (
                <div key={g.cliente.Id} className="cl-row">
                  <div className="n"><b>{g.cliente.Nombre} <span className={`cl-age ${a.clase}`}>{a.texto}</span></b>
                    <small>{g.facturas.length} {g.facturas.length === 1 ? 'factura fiada' : 'facturas fiadas'}</small>
                    <div>{g.facturas.map((f) => <button key={f.Id} className="cl-chip cl-chip-b" title="Ver el recibo de esta factura" onClick={() => verCopia(g, f)}>{f.Numero ?? 'F-—'} · <i>{fmt(f.saldo)}</i>{f.abonado > 0 ? ` (de ${fmt(f.original)})` : ''} <span className="cl-lupa">🔍</span></button>)}</div>
                    {g.abonado > 0 && <div className="cl-abon">Ha abonado {fmt(g.abonado)} · {g.pagos} {g.pagos === 1 ? 'pago' : 'pagos'}</div>}</div>
                  <span className="cl-deb">{fmt(g.deuda)}</span>
                  <button className="b" onClick={() => verDetalle(g, 'facturas')}>Ver detalle</button>
                  {g.abonado > 0 && <button className="o" onClick={() => verDetalle(g, 'abonos')}>📜 Abonos</button>}
                  <button onClick={() => verRecibo(g)}>🧾 Recibo</button>
                  <button className="go" onClick={() => abrirAbono(g)}>💵 Pagar / Abonar</button>
                </div>
              );
            })}
          </>
        )}
      </div>

      {form && (
        <div className="pn-velo" onClick={(e) => e.target === e.currentTarget && setForm(null)}>
          <div className="pn-modal">
            <h3>{form.Id ? 'Editar cliente' : 'Nuevo cliente'}</h3>
            <label>Nombre completo</label><input autoFocus value={form.Nombre} onChange={(e) => setForm({ ...form, Nombre: e.target.value })} />
            <label>Apodo</label><input value={form.Apodo} onChange={(e) => setForm({ ...form, Apodo: e.target.value })} placeholder="El Tigre, La Reina…" />
            {admin && <><label>Teléfono (solo Admin)</label><input inputMode="tel" value={form.Telefono} onChange={(e) => setForm({ ...form, Telefono: e.target.value })} /></>}
            {form.error && <div className="pn-err">{form.error}</div>}
            <div className="pn-acc"><button className="no" onClick={() => setForm(null)}>CANCELAR</button><button className="si" onClick={guardar}>GUARDAR</button></div>
          </div>
        </div>
      )}

      {abono && (
        <div className="pn-velo" onClick={(e) => e.target === e.currentTarget && setAbono(null)}>
          <div className="pn-modal cb">
            <h3>💵 Pagar o abonar · {abono.g.cliente.Nombre}</h3>
            <div className="cl-deuda"><small>DEUDA PENDIENTE</small><b>{fmt(abono.g.deuda)}</b>{abono.g.abonado > 0 && <span>ya abonó {fmt(abono.g.abonado)} antes</span>}</div>
            <div className="cb-lab">Método de pago</div>
            <div className="cb-met">{METODOS_ABONO.map((m) => <button key={m.v} className={abono.metodo === m.v ? 'on' : ''} onClick={() => setAbono({ ...abono, metodo: m.v })}>{m.t}</button>)}</div>
            <div className="cb-lab">¿Cuánto paga el cliente? (puede ser un abono)</div>
            <input className="cl-monto" inputMode="numeric" autoFocus placeholder="$ —" value={abono.monto ? fmt(abono.monto) : ''} onChange={(e) => setAbono({ ...abono, monto: soloDigitos(e.target.value), error: '' })} />
            <div className="cl-q"><button onClick={() => setAbono({ ...abono, monto: abono.g.deuda })}>Todo {fmt(abono.g.deuda)}</button><button onClick={() => setAbono({ ...abono, monto: Math.round(abono.g.deuda / 2) })}>Mitad {fmt(Math.round(abono.g.deuda / 2))}</button></div>
            <div className="cl-res"><div><small>TOTAL FIADO</small><b className="r">{fmt(abono.g.deuda)}</b></div><div><small>QUEDA DEBIENDO</small><b className="o">{fmt(Math.max(0, abono.g.deuda - abono.monto))}</b></div></div>
            <p className="au-nota">Se aplica primero a la factura más antigua.</p>
            {abono.error && <div className="pn-err">{abono.error}</div>}
            <div className="pn-acc"><button className="no" onClick={() => setAbono(null)}>CANCELAR</button><button className="si" onClick={confirmarAbono}>✓ REGISTRAR ABONO</button></div>
          </div>
        </div>
      )}

      {hoja?.recibo && <HojaReciboFiado d={hoja.recibo} pago={hoja.pago} telefono={hoja.telefono} texto={textoReciboFiado(hoja.recibo, hoja.pago)} cerrar={() => setHoja(null)} />}
      {hoja?.cartera && <HojaCartera c={hoja.cartera} texto={textoCartera(hoja.cartera, new Date().toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' }))} cerrar={() => setHoja(null)} />}
      {hoja?.copia && <HojaCopiaFactura d={hoja.copia} telefono={hoja.telefono} texto={textoCopiaFactura(hoja.copia)} cerrar={() => setHoja(null)} />}
      {detalle && (
        <div className="pn-velo" onClick={(e) => e.target === e.currentTarget && setDetalle(null)}>
          <div className="pn-modal">
            <h3>{detalle.tipo === 'abonos' ? '📜 Abonos' : 'Detalle del fiado'} · {detalle.g.cliente.Nombre}</h3>
            {detalle.tipo === 'abonos'
              ? detalle.abonos.map((a) => <div key={a.Id} className="cl-fila"><span className="mut">{fecha(a.FechaHora)}</span><span>{METODOS.find((m) => m.v === a.MetodoPago)?.t ?? a.MetodoPago}</span><b className="der">{fmt(a.Monto)}</b></div>)
              : detalle.g.todasFacturas.map((f) => (
                <div key={f.Id} className="cl-fac"><div className="cl-fila"><b>{f.Numero ?? 'F-—'}</b><span className="mut">{fecha(f.FechaHora)}</span>{f.saldo > 0 ? <b className="der">{fmt(f.saldo)}</b> : <span className="cl-pag">PAGADA</span>}<button className="cl-ver" onClick={() => verCopia(detalle.g, f)}>🧾 Ver recibo</button></div>
                  {pedidos.filter((p) => p.CuentaId === f.CuentaId && p.EstadoPedido === 'ENTREGADO').map((p) => <div key={p.Id} className="cl-item"><span>{p.Cantidad} × {productos.find((x) => x.Id === p.ProductoId)?.Nombre ?? p.Detalle ?? '¿?'}</span><span>{fmt(p.PrecioUnitarioHist * p.Cantidad)}</span></div>)}</div>
              ))}
            <div className="pn-acc"><button className="no" onClick={() => setDetalle(null)}>CERRAR</button></div>
          </div>
        </div>
      )}

      {pago && (
        <div className="pn-velo" onClick={(e) => e.target === e.currentTarget && setPago(null)}>
          <div className="pn-modal">
            <h3>💳 Cuenta para pagos</h3>
            {pago.editar ? (
              <>
                <label>Banco y tipo</label><input value={pago.banco} onChange={(e) => setPago({ ...pago, banco: e.target.value })} placeholder="Bancolombia · Cuenta de ahorros" />
                <label>Número</label><input value={pago.cuenta} onChange={(e) => setPago({ ...pago, cuenta: e.target.value })} />
                <label>Titular</label><input value={pago.titular} onChange={(e) => setPago({ ...pago, titular: e.target.value })} />
                <div className="pn-acc"><button className="no" onClick={() => setPago({ ...pago, editar: false })}>CANCELAR</button><button className="si" onClick={guardarPago}>GUARDAR</button></div>
              </>
            ) : (
              <>
                {pago.cuenta ? <div className="cl-pago"><b>{pago.banco}</b><div className="num">{pago.cuenta}</div><b>{pago.titular}</b></div> : <div className="pn-vacio">Aún no hay datos de pago. Toca Editar.</div>}
                <p className="au-nota">Estos datos se guardan solo en este equipo; no se publican en el código.</p>
                <div className="pn-acc"><button className="no" onClick={() => setPago({ ...pago, editar: true })}>✏️ EDITAR</button>
                  {pago.cuenta && <button className="no" onClick={() => navigator.clipboard?.writeText(pago.cuenta).then(() => decir('Número copiado'))}>📋 COPIAR</button>}
                  <button className="si" onClick={() => setPago(null)}>CERRAR</button></div>
              </>
            )}
          </div>
        </div>
      )}
      {aviso && <div className="ms-aviso">{aviso}</div>}
    </div>
  );
}
