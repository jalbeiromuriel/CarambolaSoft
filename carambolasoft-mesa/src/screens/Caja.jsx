// src/screens/Caja.jsx — Caja (solo Admin): resumen del turno, gastos con PIN, cierre con arqueo e Inventario vendido.
import { useState, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import Encabezado from '../components/Encabezado.jsx';
import { useSesion } from '../components/Sesion.jsx';
import { PinAdmin } from './Auth.jsx';
import { METODOS } from '../cuenta/cobro.js';
import { CATEGORIAS_GASTO, METODOS_CAJA, arqueo, movimientos } from '../cuenta/caja.js';
import { cargarTurno, registrarGasto, cerrarCaja, agregarAclaracion } from '../cuenta/cajaDb.js';
import { HojaCierre, HojaInformeDia } from '../informes/Hoja.jsx';
import { datosCierre, informeDia, sugeridoPedido, textoCierre, textoInformeDia } from '../informes/datos.js';
import FacturasBuscar from './FacturasBuscar.jsx';
import './Panel.css';
import './Caja.css';

const fmt = (n) => '$' + Math.round(n).toLocaleString('es-CO');
const num = (v) => Number(String(v).replace(/\D/g, '')) || 0;
const hora = (iso) => (iso ? new Date(iso).toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' }) : '');
const dia = (iso) => (iso ? new Date(iso).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' }) : '');
const nombreMetodo = (v) => (v === 'TARJETA' ? 'Bancolombia' : METODOS.find((m) => m.v === v)?.t.replace(/^\S+\s/, '') ?? v);

export default function Caja() {
  const { usuario } = useSesion();
  const [t, setT] = useState(null);
  const [vista, setVista] = useState('hoy');
  const [modal, setModal] = useState(null);   // 'gasto' | 'cierre' | 'vendido' | { vendidoDe: cierre }
  const [aviso, setAviso] = useState('');
  const cargar = useCallback(async () => setT(await cargarTurno()), []);
  useEffect(() => { cargar(); }, [cargar]);
  const decir = (m) => { setAviso(m); setTimeout(() => setAviso(''), 2600); };

  const etiqueta = useMemo(() => {
    if (!t) return () => '';
    const cuenta = (id) => t.cuentas.find((c) => c.Id === id);
    const num = (mid) => t.mesas.find((m) => m.Id === mid)?.Numero;
    const nombreDe = (c) => c?.NombreLibre || t.clientes.find((x) => x.Id === c?.ClienteId)?.Nombre || '';
    return (f) => {
      if (f.abono) {
        const fa = t.facturasTodas.find((x) => x.Id === f.abono.facturaIds[0]);
        const c = cuenta(fa?.CuentaId); const cli = t.clientes.find((x) => x.Id === c?.ClienteId);
        return `Abono · ${cli?.Apodo || cli?.Nombre || nombreDe(c) || 'cliente'}`;
      }
      const c = cuenta(f.CuentaId);
      if (!c) return 'Venta';
      if (c.TipoCuenta === 'VENTA_RAPIDA') return `⚡ Rápida · ${nombreDe(c)}`;
      if (c.TipoCuenta === 'GARITA') return `🃏 Garita · ${nombreDe(c)}`;
      const n = num(c.MesaId);
      return `${c.TipoCuenta === 'BILLAR' ? '🎱 Billar' : '🥃 Mesa'}${n ? ' ' + n : ''} · ${nombreDe(c)}`;
    };
  }, [t]);

  if (!t) return <><Encabezado activo="caja" /><div className="cj" /></>;
  const r = t.resumen;
  const movs = movimientos({ facturas: t.facturas, abonos: t.abonos, gastos: t.gastos, premios: t.premios, nombreMaquina: (id) => t.maquinas.find((m) => m.Id === id)?.Nombre ?? 'Máquina', etiquetaDe: etiqueta });
  const aperturas = t.abiertas.map((c) => etiqueta({ CuentaId: c.Id }).replace(/^\S+\s/, '')).filter(Boolean);
  const hayAbiertas = t.abiertas.length > 0;
  // datos de un cierre ya sellado (por TurnoCajaId) o del turno abierto
  const datosDe = (c) => {
    const por = (l) => (c ? l.filter((x) => x.TurnoCajaId === c.TurnoCajaId) : l.filter((x) => x.TurnoCajaId == null));
    return datosCierre({ facturas: por(t.facturasTodas), abonos: por(t.abonosTodos), gastos: por(t.gastosTodos), premios: por(t.maqMovs.filter((x) => x.Tipo === 'PREMIO')), pedidos: t.pedidos, productos: t.productos, etiquetaDe: etiqueta, cierre: c, notas: c ? t.notas.filter((n) => n.CierreId === c.Id) : [] });
  };

  return (
    <>
      <Encabezado activo="caja" />
      <div className="cj">
        {t.vacio && <div className="cj-aviso">ℹ️ No hay movimientos en este turno: no hay nada que cerrar. Cuando haya ventas, abonos o gastos podrás cerrar la caja.</div>}
        {hayAbiertas && <div className="cj-alerta">⚠️ Cuentas abiertas ({t.abiertas.length}): {aperturas.join(', ')} — ciérralas antes de cerrar caja</div>}
        <div className="cj-cols">
          <div>
            <div className="cj-sec">Resumen del turno</div>
            <div className="cj-card">
              {METODOS_CAJA.map((m) => <div className="cj-mr" key={m}><span>{nombreMetodo(m)}</span><span className={r.porMetodo[m] ? 'y' : 'z'}>{fmt(r.porMetodo[m])}</span></div>)}
              <div className="cj-mr"><span>Fiado <small>(queda por cobrar)</small></span><span className={r.fiado ? 'y na' : 'z'}>{fmt(r.fiado)}</span></div>
              {r.totalCobros > 0 && <>
                <div className="cj-mr lin"><span className="ver">✓ Cobros de fiado recibidos ({r.nCobros})</span><span className="y ver">+{fmt(r.totalCobros)}</span></div>
                <div className="cj-mr sub"><span>· {METODOS_CAJA.filter((m) => r.cobrosFiado[m]).map((m) => `${nombreMetodo(m)} ${fmt(r.cobrosFiado[m])}`).join(' · ')}</span></div>
              </>}
              {r.totalPremios > 0 && <div className="cj-mr lin"><span className="rojo">🎰 Premios de máquinas ({r.nPremios})</span><span className="y rojo">−{fmt(r.totalPremios)}</span></div>}
              {r.totalGastos > 0 && <div className="cj-mr lin"><span className="rojo">💸 Gastos del turno ({r.nGastos})</span><span className="y rojo">−{fmt(r.totalGastos)}</span></div>}
              <div className="cj-mr esp"><span>💵 Efectivo esperado en cajón</span><span className="y">{fmt(r.efectivoEsperado)}</span></div>
            </div>
            <div className="cj-card cj-big"><small>Vendido en el turno</small><b>{fmt(r.totalVendido)}</b><i>{r.fiado > 0 ? `de los cuales ${fmt(r.fiado)} quedaron fiados` : `${r.nVentas} ventas`}</i></div>
            <div className="cj-btns">
              <button className="cj-cierre" disabled={hayAbiertas || t.vacio} onClick={() => setModal('cierre')} title={t.vacio ? 'No hay movimientos en este turno' : hayAbiertas ? 'Hay cuentas abiertas' : ''}>🔒 Cerrar caja</button>
              <button className="cj-b" onClick={() => setModal('gasto')}>💸 Gasto</button>
              <button className="cj-b" onClick={() => setModal({ informe: null })} title="Cierre del turno: resumen, arqueo y detalle por mesa">📄 Informe</button>
              <button className="cj-b ve" onClick={() => setModal('dia')} title="Productos vendidos, ganancia y sugerido de pedido">📊 Del día</button>
              <button className="cj-b" onClick={() => setModal('vendido')} title="Unidades vendidas del turno, para cuadrar la nevera">📋 Vendido</button>
            </div>
          </div>
          <div>
            <div className="cj-tabs"><button className={vista === 'hoy' ? 'on' : ''} onClick={() => setVista('hoy')}>Hoy</button><button className={vista === 'hist' ? 'on' : ''} onClick={() => setVista('hist')}>Historial de cierres</button><button className={vista === 'fac' ? 'on' : ''} onClick={() => setVista('fac')}>🔎 Facturas</button></div>
            {vista === 'fac' ? <FacturasBuscar /> : vista === 'hoy' ? (
              <div className="cj-card"><div className="cj-sec">Movimientos de hoy</div>
                {movs.length === 0 && <div className="cj-vacio">Sin movimientos en este turno.</div>}
                <div className="cj-lista">{movs.map((m) => (
                  <div className="cj-mv" key={m.id}>
                    <div><span className={m.tipo === 'ABONO' ? 'ver' : m.tipo === 'GASTO' || m.tipo === 'PREMIO' ? 'rojo' : ''}>{m.tipo === 'GASTO' ? `Gasto · ${m.titulo}` : m.tipo === 'PREMIO' ? `Premio · ${m.titulo}` : m.titulo}</span>
                      <small>{m.tipo === 'GASTO' || m.tipo === 'PREMIO' ? `${nombreMetodo(m.detalle[0])} · ${m.detalle[1]}` : m.detalle.map(nombreMetodo).join(' + ')} · {hora(m.fecha)}</small></div>
                    <b className={m.tipo === 'GASTO' || m.tipo === 'PREMIO' ? 'rojo' : ''}>{m.tipo === 'GASTO' || m.tipo === 'PREMIO' ? '−' : m.tipo === 'ABONO' ? '+' : ''}{fmt(m.monto)}</b>
                  </div>
                ))}</div>
              </div>
            ) : (
              <div className="cj-card"><div className="cj-sec">Cierres anteriores</div>
                {t.cierres.length === 0 && <div className="cj-vacio">Aún no hay cierres.</div>}
                <div className="cj-lista">{t.cierres.map((c) => (
                  <div className="cj-mv" key={c.Id}>
                    <div>{dia(c.FechaCierre)} · {hora(c.FechaCierre)}<small>{c.UsuarioNombre || '—'} · {c.NVentas} ventas · {c.Descuadre === 0 ? 'Cuadró ✓' : `${c.Descuadre > 0 ? 'Sobrante' : 'Faltante'} ${fmt(Math.abs(c.Descuadre))}`}{c.Nota ? ` · ${c.Nota}` : ''}</small>
                      {t.notas.filter((n) => n.CierreId === c.Id).map((n) => <small className="cj-acl" key={n.Id}>📝 {n.Texto} — {n.UsuarioNombre}, {dia(n.FechaHora)}</small>)}</div>
                    <span className="cj-der"><b>{fmt(c.TotalGeneral)}</b><button className="cj-mini" title="Ver informe del cierre" onClick={() => setModal({ informe: c })}>Ver ⟶</button><button className="cj-mini" title="Anotar una aclaración (el cierre no se edita)" onClick={() => setModal({ aclarar: c })}>📝 Aclarar</button></span>
                  </div>
                ))}</div>
              </div>
            )}
          </div>
        </div>
      </div>

      {modal === 'gasto' && <Gasto cerrar={() => setModal(null)} guardar={async (g, autorizo) => { await registrarGasto({ ...g, usuarioId: usuario?.Id, autorizoId: autorizo.Id }); setModal(null); await cargar(); decir('Gasto registrado ✓'); }} />}
      {modal === 'cierre' && <Cierre t={t} cerrar={() => setModal(null)} confirmar={async (contado, nota) => {
        try { await cerrarCaja({ usuario, contado, nota }); } catch (e) { decir(e.message); setModal(null); return; }
        const previo = t.vendido; await cargar(); setModal({ vendido: previo, cierre: true }); decir('Caja cerrada ✓');
      }} />}
      {modal?.informe !== undefined && (() => {
        const c = modal.informe;
        const d = datosDe(c);
        return <HojaCierre d={d} usuarioNombre={usuario?.Nombre} cerrar={() => setModal(null)} texto={textoCierre(d, new Date(c?.FechaCierre ?? Date.now()).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' }))} />;
      })()}
      {modal?.aclarar && <Aclarar cierre={modal.aclarar} cerrar={() => setModal(null)} guardar={async (texto, autorizo) => { await agregarAclaracion({ cierreId: modal.aclarar.Id, texto, usuario, autorizoId: autorizo.Id }); setModal(null); await cargar(); decir('Aclaración guardada ✓'); }} />}
      {modal === 'dia' && (() => {
        const i = informeDia({ facturas: t.facturas, pedidos: t.pedidos, productos: t.productos });
        const sug = sugeridoPedido({ productos: t.productos, vendidos: i.filas });
        return <HojaInformeDia i={i} sugerido={sug} usuarioNombre={usuario?.Nombre} cerrar={() => setModal(null)} texto={textoInformeDia(i, new Date().toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' }))} />;
      })()}
      {modal === 'vendido' && <Vendido v={t.vendido} cerrar={() => setModal(null)} />}
      {modal?.vendido && <Vendido v={modal.vendido} cierre cerrar={() => setModal(null)} />}
      {aviso && <div className="iv-toast">{aviso}</div>}
    </>
  );
}

export function Gasto({ cerrar, guardar }) {
  const [d, setD] = useState({ concepto: '', monto: '', categoria: CATEGORIAS_GASTO[0], metodo: 'EFECTIVO' });
  const [pide, setPide] = useState(false); const [error, setError] = useState('');
  const set = (k, v) => setD((x) => ({ ...x, [k]: v }));
  function seguir() {
    if (!d.concepto.trim()) { setError('Escribe el concepto del gasto.'); return; }
    if (!(num(d.monto) > 0)) { setError('Escribe el monto.'); return; }
    setError(''); setPide(true);
  }
  return (
    <div className="pn-velo" onClick={(e) => e.target === e.currentTarget && cerrar()}>
      <div className="pn-modal cj-mod">
        <h3>💸 Registrar gasto de caja</h3>
        <label>Concepto</label><input autoFocus value={d.concepto} placeholder="Vasos, taxi mesero, candela…" onChange={(e) => set('concepto', e.target.value)} />
        <div className="cj-g2">
          <div><label>Monto</label><input inputMode="numeric" value={d.monto ? fmt(num(d.monto)) : ''} placeholder="$20.000" onChange={(e) => set('monto', e.target.value)} /></div>
          <div><label>Categoría</label><select value={d.categoria} onChange={(e) => set('categoria', e.target.value)}>{CATEGORIAS_GASTO.map((c) => <option key={c}>{c}</option>)}</select></div>
        </div>
        <label>Salió de</label>
        <select value={d.metodo} onChange={(e) => set('metodo', e.target.value)}>{METODOS_CAJA.map((m) => <option key={m} value={m}>{nombreMetodo(m)}</option>)}</select>
        <p className="cj-nota">Lo autoriza un Admin con su PIN. Se descuenta del efectivo esperado y queda en el cierre.</p>
        {error && <div className="pn-err">{error}</div>}
        <div className="cj-acc"><button onClick={cerrar}>Cancelar</button><button className="g" onClick={seguir}>Guardar gasto</button></div>
      </div>
      {pide && <PinAdmin motivo="Un Admin digita su PIN para autorizar este gasto." cancelar={() => setPide(false)} ok={(a) => guardar({ concepto: d.concepto, monto: num(d.monto), categoria: d.categoria, metodo: d.metodo }, a)} />}
    </div>
  );
}

function Cierre({ t, cerrar, confirmar }) {
  const r = t.resumen;
  const [contado, setContado] = useState(''); const [nota, setNota] = useState(''); const [error, setError] = useState('');
  const ar = contado === '' ? null : arqueo(r.efectivoEsperado, num(contado));
  function ok() {
    if (contado === '') { setError('Cuenta el efectivo y escríbelo.'); return; }
    if (ar.diferencia !== 0 && !nota.trim()) { setError('No cuadra: escribe en la nota por qué.'); return; }
    confirmar(num(contado), nota);
  }
  return (
    <div className="pn-velo" onClick={(e) => e.target === e.currentTarget && cerrar()}>
      <div className="pn-modal cj-mod" style={{ maxWidth: 560 }}>
        <h3>🔒 Cerrar caja del día</h3>
        <div className="cj-card chico">
          <div className="cj-mr"><span>Ventas del turno ({r.nVentas})</span><span className="y ver">{fmt(r.totalVendido)}</span></div>
          {METODOS_CAJA.filter((m) => r.porMetodo[m]).map((m) => <div className="cj-mr sub" key={m}><span>· {nombreMetodo(m)}</span><span>{fmt(r.porMetodo[m])}</span></div>)}
          {r.fiado > 0 && <div className="cj-mr sub"><span>· Fiado (por cobrar)</span><span className="na">{fmt(r.fiado)}</span></div>}
          {r.totalCobros > 0 && <div className="cj-mr"><span>Cobros de fiado</span><span className="y ver">+{fmt(r.totalCobros)}</span></div>}
          {r.totalGastos > 0 && <div className="cj-mr"><span>Gastos ({r.nGastos})</span><span className="y rojo">−{fmt(r.totalGastos)}</span></div>}
          <div className="cj-mr esp"><span>💵 Efectivo esperado en cajón</span><span className="y">{fmt(r.efectivoEsperado)}</span></div>
        </div>
        <label>💵 Efectivo contado (billetes y monedas)</label>
        <input className="cj-hi" autoFocus inputMode="numeric" placeholder="$0" value={contado === '' ? '' : fmt(num(contado))} onChange={(e) => { setContado(e.target.value.replace(/\D/g, '')); setError(''); }} />
        {ar && <div className={`cj-dif ${ar.estado.toLowerCase()}`}><span>Diferencia (contado − esperado)</span><b>{ar.estado === 'CUADRA' ? '$0 · Cuadra ✓' : `${ar.diferencia > 0 ? '+' : '−'}${fmt(Math.abs(ar.diferencia))} · ${ar.estado === 'SOBRANTE' ? 'Sobrante' : 'Faltante'}`}</b></div>}
        <label>Nota del cierre {ar && ar.diferencia !== 0 ? '(obligatoria)' : '(opcional)'}</label>
        <input value={nota} placeholder="Si hay faltante o sobrante, escribe por qué…" onChange={(e) => { setNota(e.target.value); setError(''); }} />
        <p className="cj-nota">Al confirmar, el turno se sella: ventas, gastos y diferencia ya no se pueden modificar. La diferencia queda registrada con tu nombre.</p>
        {error && <div className="pn-err">{error}</div>}
        <div className="cj-acc"><button onClick={cerrar}>Cancelar</button><button className="g" onClick={ok}>🔒 Confirmar cierre</button></div>
      </div>
    </div>
  );
}

/** Hoja "Inventario vendido" (tipo recibo, sin fondo). Imprimir → PDF. */
function Vendido({ v, cierre, cerrar }) {
  const ahora = new Date();
  return createPortal(
    <div className="pn-velo cj-velo" onClick={(e) => e.target === e.currentTarget && cerrar()}>
      <div className="cj-hoja">
        <div className="cj-hoja-acc"><button onClick={() => window.print()}>🖨 Imprimir / Guardar PDF</button><button onClick={cerrar}>Cerrar</button></div>
        <h1>MERO PARCHE</h1>
        <div className="sub">INVENTARIO VENDIDO · para cuadre<br />{ahora.toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' })} · {cierre ? 'cierre' : 'corte'} {ahora.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}</div>
        <hr />
        <table>
          <thead><tr><th>Producto</th><th>Cant.</th></tr></thead>
          <tbody>
            {v.filas.map((f) => <tr key={f.nombre}><td>{f.nombre}</td><td className="c">{f.cant}</td></tr>)}
            {v.filas.length === 0 && <tr><td colSpan="2" className="vacio">No hay productos vendidos en este turno.</td></tr>}
            <tr className="tot"><td>TOTAL UNIDADES</td><td>{v.total}</td></tr>
          </tbody>
        </table>
        <div className="pie">Compara estas cantidades con el conteo físico de nevera y bodega.<br />Generado por CarambolaSoft · Mero Parche</div>
      </div>
    </div>, document.body
  );
}

/** Aclaración a un cierre sellado. Las cifras no cambian: la nota queda aparte con fecha y autor. */
function Aclarar({ cierre, cerrar, guardar }) {
  const [texto, setTexto] = useState(''); const [pide, setPide] = useState(false); const [error, setError] = useState('');
  return (
    <div className="pn-velo" onClick={(e) => e.target === e.currentTarget && cerrar()}>
      <div className="pn-modal cj-mod">
        <h3>📝 Aclaración al cierre</h3>
        <p className="cj-nota" style={{ marginTop: 0 }}>Cierre del {dia(cierre.FechaCierre)} · {hora(cierre.FechaCierre)} · {fmt(cierre.TotalGeneral)}. Las cifras de un cierre sellado no se cambian; la aclaración queda al lado, con tu nombre y la fecha, y sale en el PDF.</p>
        <label>Qué quieres aclarar</label>
        <textarea autoFocus rows={4} value={texto} placeholder="Ej.: el faltante era un cambio mal dado, ya se repuso." onChange={(e) => { setTexto(e.target.value); setError(''); }} />
        {error && <div className="pn-err">{error}</div>}
        <div className="cj-acc"><button onClick={cerrar}>Cancelar</button><button className="g" onClick={() => (texto.trim().length < 5 ? setError('Escribe la aclaración (mínimo unas palabras).') : setPide(true))}>Guardar aclaración</button></div>
      </div>
      {pide && <PinAdmin motivo="Un Admin digita su PIN para autorizar esta aclaración." cancelar={() => setPide(false)} ok={(a) => guardar(texto, a)} />}
    </div>
  );
}
