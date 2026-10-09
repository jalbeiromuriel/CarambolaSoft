// src/informes/Hoja.jsx — Hojas imprimibles (carta vertical, sin fondo). Imprimir → Guardar PDF; botón de WhatsApp con texto.
import { createPortal } from 'react-dom';
import { METODOS_CAJA } from '../cuenta/caja.js';
import { fmt, nombreMetodo, enlaceWhatsApp } from './datos.js';
import './informes.css';

const fechaLarga = (d = new Date()) => d.toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' });
const horaCorta = (iso) => (iso ? new Date(iso).toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' }) : '');

export function Hoja({ cerrar, texto, telefono, children }) {
  return createPortal(
    <div className="pn-velo inf-velo" onClick={(e) => e.target === e.currentTarget && cerrar()}>
      <div className="inf-hoja">
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
        <div><span>= Esperado en cajón</span><b>{fmt(r.efectivoEsperado)}</b></div>
        {d.arqueo && <><div><span>Contado</span><b>{fmt(d.arqueo.contado)}</b></div>
          <div><span>Diferencia</span><b>{d.arqueo.estado === 'CUADRA' ? '$0 · Cuadra' : `${d.arqueo.diferencia > 0 ? '+' : '−'}${fmt(Math.abs(d.arqueo.diferencia))} · ${d.arqueo.estado === 'SOBRANTE' ? 'Sobrante' : 'Faltante'}`}</b></div></>}
      </div>
      {d.sellado && c.Nota && <div className="sub" style={{ marginTop: 6 }}>Nota del cierre: {c.Nota}</div>}
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
