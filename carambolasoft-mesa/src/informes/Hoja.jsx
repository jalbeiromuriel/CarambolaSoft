// src/informes/Hoja.jsx — Hojas imprimibles (carta vertical, sin fondo). Imprimir → Guardar PDF; botón de WhatsApp con texto.
import { createPortal } from 'react-dom';
import { METODOS_CAJA } from '../cuenta/caja.js';
import { fmt, nombreMetodo, enlaceWhatsApp } from './datos.js';
import { useEffect } from 'react';
import { formatearNumero } from '../cuenta/cuentasPago.js';
import './informes.css';

const fechaLarga = (d = new Date()) => d.toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' });
const horaCorta = (iso) => (iso ? new Date(iso).toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' }) : '');

export function Hoja({ cerrar, texto, telefono, ticket, children }) {
  // Tiquete: mientras esté abierto, la página de impresión es angosta (80 mm); al cerrar vuelve a carta.
  useEffect(() => {
    if (!ticket) return undefined;
    const st = document.createElement('style');
    st.textContent = '@media print{@page{size:80mm 280mm;margin:4mm}}';
    document.head.appendChild(st);
    return () => st.remove();
  }, [ticket]);
  return createPortal(
    <div className={`pn-velo inf-velo${ticket ? ' inf-velo-tk' : ''}`} onClick={(e) => e.target === e.currentTarget && cerrar()}>
      <div className={`inf-hoja${ticket ? ' inf-ticket' : ''}`}>
        <div className="inf-acc">
          <button onClick={() => window.print()}>🖨 Imprimir / Guardar PDF</button>
          {texto && <button onClick={() => window.open(enlaceWhatsApp(texto, telefono), '_blank', 'noopener')}>📲 WhatsApp</button>}
          <button onClick={cerrar}>Cerrar</button>
        </div>
        {children}
        <div className="inf-pie">Generado por CarambolaSoft · Mero Parche</div>
      </div>
    </div>, document.body
  );
}

/** Cierre de caja (sellado) o resumen del turno (abierto). */
export function HojaCierre({ d, usuarioNombre, cerrar, texto }) {
  const r = d.resumen, c = d.cierre, ahora = c?.FechaCierre ? new Date(c.FechaCierre) : new Date();
  return (
    <Hoja cerrar={cerrar} texto={texto}>
      <div className="inf-cab">
        <div><h1>MERO PARCHE</h1><div className="sub">Licores &amp; Billar · Santa Cruz, Medellín</div></div>
        <div className="der"><b>{d.sellado ? `CIERRE DE CAJA${c.Numero ? ' #' + String(c.Numero).padStart(4, '0') : ''}` : 'RESUMEN DEL TURNO (sin cerrar)'}</b>
          <div className="sub">{fechaLarga(ahora)} · {horaCorta(ahora.toISOString())}</div>
          <div className="sub">{d.sellado ? `Cerró: ${c.UsuarioNombre || '—'}` : `Generó: ${usuarioNombre || '—'}`}</div></div>
      </div>
      <div className="inf-caja"><small>Total general del día</small><b>{fmt(r.totalVendido)}</b><span className="sub">{r.nVentas} transacciones{r.fiado ? ` · ${fmt(r.fiado)} quedaron fiadas` : ''}</span></div>
      <h2>RESUMEN POR MÉTODO DE PAGO</h2>
      <div className="inf-met">
        {[...METODOS_CAJA, 'FIADO'].filter((m) => r.porMetodo[m]).map((m) => <div key={m}><span>{nombreMetodo(m)}</span><b>{fmt(r.porMetodo[m])}</b></div>)}
        {r.totalCobros > 0 && <div><span>Cobros de fiado recibidos</span><b>+{fmt(r.totalCobros)}</b></div>}
      </div>
      <h2>{d.sellado ? 'ARQUEO DE EFECTIVO' : 'EFECTIVO ESPERADO'}</h2>
      <div className="inf-met">
        <div><span>Efectivo vendido</span><b>{fmt(r.porMetodo.EFECTIVO)}</b></div>
        <div><span>+ Cobros de fiado</span><b>{fmt(r.cobrosFiado.EFECTIVO)}</b></div>
        <div><span>− Gastos en efectivo</span><b>{fmt(r.gastosPorMetodo.EFECTIVO)}</b></div>
        {r.totalPrestamos > 0 && <div><span>− Préstamo a máquinas</span><b>{fmt(r.totalPrestamos)}</b></div>}
        {r.totalDevoluciones > 0 && <div><span>+ Devolución de máquinas</span><b>{fmt(r.totalDevoluciones)}</b></div>}
        {r.totalPrestPers > 0 && <div><span>− Préstamos al personal</span><b>{fmt(r.totalPrestPers)}</b></div>}
        {r.totalDevPers > 0 && <div><span>+ Abonos del personal</span><b>{fmt(r.totalDevPers)}</b></div>}
        <div><span>= Esperado en cajón</span><b>{fmt(r.efectivoEsperado)}</b></div>
        {d.arqueo && <><div><span>Contado</span><b>{fmt(d.arqueo.contado)}</b></div>
          <div><span>Diferencia</span><b>{d.arqueo.estado === 'CUADRA' ? '$0 · Cuadra' : `${d.arqueo.diferencia > 0 ? '+' : '−'}${fmt(Math.abs(d.arqueo.diferencia))} · ${d.arqueo.estado === 'SOBRANTE' ? 'Sobrante' : 'Faltante'}`}</b></div></>}
      </div>
      {d.sellado && c.Nota && <div className="sub" style={{ marginTop: 6 }}>Nota del cierre: {c.Nota}</div>}
      {d.notas?.length > 0 && <>
        <h2>ACLARACIONES</h2>
        {d.notas.map((n) => <div className="inf-nota" key={n.Id}><b>{new Date(n.FechaHora).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })} · {horaCorta(n.FechaHora)} · {n.UsuarioNombre}</b><br />{n.Texto}</div>)}
      </>}
      {d.gastos.length > 0 && <>
        <h2>GASTOS ({d.gastos.length})</h2>
        <table><tbody>{d.gastos.map((g) => <tr key={g.Id}><td>{g.Concepto}</td><td>{g.Categoria}</td><td>{nombreMetodo(g.MetodoPago)}</td><td className="r">−{fmt(g.Monto)}</td></tr>)}</tbody></table>
      </>}
      <h2>DETALLE POR MESA / VENTA</h2>
      {d.detalle.length === 0 && <div className="sub">Sin ventas en este turno.</div>}
      {d.detalle.map((v) => (
        <div className="inf-bloque" key={v.id}>
          <div className="h"><div>{v.titulo}<small>{v.numero}{v.numero ? ' · ' : ''}{horaCorta(v.fecha)}</small></div><div className="der">{v.metodos.map(nombreMetodo).join(' + ')} · {fmt(v.total)}</div></div>
          <table><thead><tr><th>Producto</th><th className="r">Cant.</th><th className="r">Precio unit.</th><th className="r">Subtotal</th></tr></thead>
            <tbody>{v.items.map((it, i) => <tr key={i}><td>{it.nombre}</td><td className="r">{it.cant}</td><td className="r">{fmt(it.unit)}</td><td className="r">{fmt(it.subtotal)}</td></tr>)}</tbody></table>
        </div>
      ))}
      {d.sellado && <div className="sub" style={{ textAlign: 'center' }}>Este cierre quedó sellado y no se puede modificar.</div>}
    </Hoja>
  );
}

/** Informe del día: productos vendidos con ganancia y sugerido de pedido. */
export function HojaInformeDia({ i, sugerido, usuarioNombre, cerrar, texto }) {
  const ahora = new Date();
  return (
    <Hoja cerrar={cerrar} texto={texto}>
      <h1>MERO PARCHE — INFORME DEL DÍA</h1>
      <div className="sub">Período: turno actual (sin cerrar) · Generado: {fechaLarga(ahora)} · {horaCorta(ahora.toISOString())} · {usuarioNombre}</div>
      <h2>Productos vendidos y ganancia</h2>
      <table>
        <thead><tr><th>Producto</th><th className="r">Cant.</th><th className="r">Ingresos</th><th className="r">Costo</th><th className="r">Ganancia</th></tr></thead>
        <tbody>
          {i.filas.map((f) => <tr key={f.nombre}><td>{f.nombre}</td><td className="r">{f.cant || ''}</td><td className="r">{fmt(f.ingresos)}</td><td className="r">{fmt(f.costo)}</td><td className="r">{fmt(f.ganancia)}</td></tr>)}
          {i.filas.length === 0 && <tr><td colSpan="5" className="c">Sin ventas en este turno.</td></tr>}
          <tr className="tot"><td>TOTAL</td><td /><td className="r">{fmt(i.ingresos)}</td><td className="r">{fmt(i.costo)}</td><td className="r">{fmt(i.ganancia)}</td></tr>
        </tbody>
      </table>
      <div className="sub" style={{ marginTop: 6 }}>Ganancia = ingresos − costo de compra del momento de la venta.</div>
      <h2>Sugerido de pedido (agotados o bajo mínimo, por más vendidos)</h2>
      {sugerido.length === 0 ? <div className="sub">✓ Todo el inventario está por encima del mínimo.</div> : (
        <table>
          <thead><tr><th>Producto</th><th className="r">Stock</th><th className="r">Mínimo</th><th className="r">Vendido</th><th className="r">Sugerido</th></tr></thead>
          <tbody>{sugerido.map((s) => <tr key={s.nombre}><td>{s.nombre}</td><td className="r">{s.stock <= 0 ? 'Sin stock' : s.stock}</td><td className="r">{s.minimo}</td><td className="r">{s.vendido}</td><td className="r"><b>{s.sugerido}</b></td></tr>)}</tbody>
        </table>
      )}
    </Hoja>
  );
}

const hora12 = (iso) => (iso ? new Date(iso).toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' }) : '');
const fechaHora = (iso) => (iso ? new Date(iso).toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' }) + ' · ' + hora12(iso) : '');

function CabTicket({ sub }) {
  return <div className="tk-cab"><h1>MERO PARCHE</h1><div className="sub">Licores &amp; Billar · Santa Cruz, Medellín</div>{sub}</div>;
}
/** Recuadro "¿Dónde pagar?": los datos vienen de Ajustes (guardados solo en este equipo, nunca en el código). */
function DondePagar({ cuentas }) {
  const l = (cuentas ?? []).filter((c) => c?.numero);
  return l.length
    ? <div className="tk-pago"><b>¿DÓNDE PAGAR?</b>{l.map((c, i) => <div key={c.Id ?? i} className="tk-cta">{i > 0 && <hr />}<div>{c.banco}</div><div className="num">{formatearNumero(c.tipo, c.numero)}</div><div>{c.titular}</div></div>)}</div>
    : <div className="tk-pago vacio">Configura las cuentas en Panel → 💳 Cuenta para pagos → Administrar.</div>;
}

/** Recibo de una cuenta (tiquete angosto). */
export function HojaReciboCuenta({ d, nombre, apodo, sitio, cuentas, telefono, texto, cerrar }) {
  const ahora = new Date();
  return (
    <Hoja ticket cerrar={cerrar} texto={texto} telefono={telefono}>
      <CabTicket />
      <div className="tk-fila"><span>{sitio}</span><span>{fechaHora(ahora.toISOString())}</span></div>
      <div className="tk-quien"><b>{nombre}</b>{apodo && <div className="sub">“{apodo}”</div>}</div>
      <table><thead><tr><th>Descripción</th><th className="r">Cant.</th><th className="r">Vr. unit.</th><th className="r">Vr. total</th></tr></thead>
        <tbody>{d.items.map((i, k) => <tr key={k}><td>{i.nombre}</td><td className="r">{i.cant}</td><td className="r">{fmt(i.unit)}</td><td className="r">{fmt(i.total)}</td></tr>)}</tbody></table>
      {d.historial.length > 0 && <><div className="tk-tit">HISTORIAL DE PEDIDOS</div>
        {d.historial.map((h, k) => <div className="tk-fila" key={k}><span>{hora12(h.fecha)} {h.nombre}{h.cant > 1 ? ` ×${h.cant}` : ''}</span><span>{fmt(h.monto)}</span></div>)}</>}
      <div className="inf-caja"><small>Total a pagar</small><b>{fmt(d.total)}</b></div>
      <DondePagar cuentas={cuentas} />
      <div className="tk-gracias">¡Gracias por su visita!<br />Vuelva pronto al Mero Parche 🎱</div>
    </Hoja>
  );
}

/** Recibo de fiado: facturas pendientes con detalle, abonos y total pendiente. */
export function HojaReciboFiado({ d, cuentas, telefono, texto, cerrar }) {
  const ahora = new Date();
  return (
    <Hoja ticket cerrar={cerrar} texto={texto} telefono={telefono}>
      <CabTicket />
      <div className="tk-fila"><span>Tipo</span><span>CUENTA PENDIENTE (FIADO)</span></div>
      <div className="tk-fila"><span /> <span>{fechaHora(ahora.toISOString())}</span></div>
      <div className="tk-quien"><b>{d.cliente.Nombre}</b>{d.cliente.Apodo && <div className="sub">“{d.cliente.Apodo}”</div>}</div>
      <div className="tk-tit">FACTURAS PENDIENTES ({d.facturas.length})</div>
      {d.facturas.map((f) => (
        <div className="inf-bloque" key={f.numero}>
          <div className="h"><span>{f.numero}</span><span style={{ fontWeight: 400, fontSize: 10 }}>{fechaHora(f.fecha).split(' · ')[0]}</span></div>
          <table><tbody>
            {f.items.map((i, k) => <tr key={k}><td>{i.cant} × {i.nombre}</td><td className="r">{fmt(i.total)}</td></tr>)}
            <tr><td><b>Total factura</b></td><td className="r"><b>{fmt(f.original)}</b></td></tr>
            {f.abonado > 0 && <tr><td>Abonado</td><td className="r">− {fmt(f.abonado)}</td></tr>}
            <tr><td><b>Saldo factura</b></td><td className="r"><b>{fmt(f.saldo)}</b></td></tr>
          </tbody></table>
        </div>
      ))}
      {d.pagos.length > 0 && <><div className="tk-tit">ABONOS RECIBIDOS</div>
        {d.pagos.map((p) => <div className="tk-fila" key={p.Id}><span>{fechaHora(p.FechaHora)} · {nombreMetodo(p.MetodoPago)}</span><span>{fmt(p.Monto)}</span></div>)}</>}
      <div className="inf-bloque tk-sumas"><div className="tk-fila"><b>Total consumido</b><b>{fmt(d.consumido)}</b></div>
        <div className="tk-fila"><span>Total abonado</span><span>− {fmt(d.abonado)}</span></div></div>
      <div className="inf-caja"><small>Total pendiente por pagar</small><b>{fmt(d.pendiente)}</b></div>
      <DondePagar cuentas={cuentas} />
      <div className="tk-gracias">Recuerda cancelar tu deuda con el Mero Parche.<br />¡Te esperamos! 🎱</div>
    </Hoja>
  );
}

/** Cartera de fiados (carta vertical). */
export function HojaCartera({ c, cerrar, texto }) {
  const ahora = new Date();
  return (
    <Hoja cerrar={cerrar} texto={texto}>
      <div className="inf-cab"><div><h1>MERO PARCHE</h1><div className="sub">Reporte de fiados pendientes · Generado: {fechaLarga(ahora)}</div></div></div>
      <div className="inf-caja"><small>Cartera pendiente total</small><b>{fmt(c.total)}</b><span className="sub">{c.clientes.length} {c.clientes.length === 1 ? 'cliente' : 'clientes'} con deuda</span></div>
      {c.clientes.length === 0 && <div className="sub" style={{ textAlign: 'center' }}>Nadie debe nada. 🎉</div>}
      {c.clientes.map((x) => (
        <div className="inf-bloque" key={x.nombre}>
          <div className="h"><span>{x.nombre}</span><span>{fmt(x.deuda)}</span></div>
          <table><tbody>{x.facturas.map((f) => (
            <tr key={f.numero}><td><b>{f.numero}</b> · {fechaHora(f.fecha)}{f.vieja ? ' ⚠' : ''}</td>
              <td className="r">{f.abonado > 0 ? <>total {fmt(f.original)} − abonado {fmt(f.abonado)} = <b>{fmt(f.saldo)}</b></> : fmt(f.saldo)}</td></tr>
          ))}</tbody></table>
        </div>
      ))}
      <div className="sub" style={{ marginTop: 8 }}>Ordenado del cliente con la deuda más antigua al más reciente. ⚠ = factura con más de 15 días.</div>
    </Hoja>
  );
}

/** Copia de consulta de una factura (tiquete angosto). Sello COPIA · PAGADA / COPIA · PENDIENTE. */
export function HojaCopiaFactura({ d, telefono, texto, cerrar }) {
  return (
    <Hoja ticket cerrar={cerrar} texto={texto} telefono={telefono}>
      <CabTicket />
      <div className="tk-sello">COPIA · {d.estado}</div>
      <div className="tk-fila"><span>Factura</span><b>{d.numero}</b></div>
      <div className="tk-fila"><span>Fecha</span><span>{fechaHora(d.fecha)}</span></div>
      {d.metodos && <div className="tk-fila"><span>Pagó</span><span>{d.metodos}</span></div>}
      <div className="tk-quien"><b>{d.cliente}</b>{d.apodo && <div className="sub">“{d.apodo}”</div>}</div>
      <table><tbody>{d.items.map((i, k) => <tr key={k}><td>{i.cant} × {i.nombre}</td><td className="r">{fmt(i.total)}</td></tr>)}</tbody></table>
      <div className="tk-fila" style={{ marginTop: 8 }}><span>Total factura</span><b>{fmt(d.total)}</b></div>
      {d.pagos.length > 0 && <><div className="tk-tit">ABONOS RECIBIDOS</div>
        {d.pagos.map((p, k) => <div className="tk-fila" key={k}><span>{fechaHora(p.FechaHora)} · {nombreMetodo(p.MetodoPago)}</span><span>{fmt(p.Monto)}</span></div>)}</>}
      <div className="tk-fila"><span>Pagado</span><span>{fmt(d.pagado)}</span></div>
      <div className="inf-caja"><small>Saldo</small><b>{fmt(d.saldo)}</b></div>
      <div className="tk-gracias">Copia de consulta · no es una nueva venta<br />Impreso {fechaHora(new Date().toISOString())}</div>
    </Hoja>
  );
}
