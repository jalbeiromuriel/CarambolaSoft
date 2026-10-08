// src/screens/Inventario.jsx — Inventario (solo Admin): productos, reabastecer, márgenes, simulador de precio y promociones.
import { useState, useEffect, useCallback, useMemo } from 'react';
import Encabezado from '../components/Encabezado.jsx';
import { categoriaDe, norm } from '../cuenta/catalogo.js';
import * as inv from '../cuenta/inventario.js';
import { getAll, put, leerMeta, escribirMeta } from '../db/repository.js';
import './Panel.css';
import './Inventario.css';

const fmt = (n) => '$' + Math.round(n).toLocaleString('es-CO');
const num = (v) => Number(String(v).replace(/\D/g, '')) || 0;
const hoyIso = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const ENUMS = [['BEBIDAS_ALCOHOLICAS', 'Licores'], ['SNACKS', 'Snacks'], ['BEBIDAS_NO_ALCOHOLICAS', 'Bebidas'], ['OTROS', 'Otros']];
const esVendible = (p) => p.ControlaStock !== false && p.Activo !== false;

export default function Inventario() {
  const [productos, setProductos] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [objetivo, setObjetivo] = useState(inv.MARGEN_OBJETIVO);
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('todos');
  const [modal, setModal] = useState(null);   // { tipo, prod? }
  const [aviso, setAviso] = useState('');

  const cargar = useCallback(async () => {
    setProductos((await getAll('PRODUCTOS')).filter(esVendible));
    setCategorias(await getAll('CATEGORIAS'));
    setObjetivo((await leerMeta('negocio.margenObjetivo')) ?? inv.MARGEN_OBJETIVO);
  }, []);
  useEffect(() => { cargar(); }, [cargar]);
  const decir = (m) => { setAviso(m); setTimeout(() => setAviso(''), 2400); };

  const lista = useMemo(() => {
    const t = norm(q);
    return productos
      .filter((p) => (cat === 'todos' || categoriaDe(p, categorias).nombre === cat) && (!t || norm(p.Nombre).includes(t)))
      .sort((a, b) => a.Nombre.localeCompare(b.Nombre, 'es'));
  }, [productos, categorias, q, cat]);
  const nombresCat = useMemo(() => [...new Set(productos.map((p) => categoriaDe(p, categorias).nombre))], [productos, categorias]);
  const bajos = useMemo(() => inv.productosBajoMargen(productos, objetivo), [productos, objetivo]);

  async function guardar(p, cambios, msg) { await put('PRODUCTOS', { ...p, ...cambios }); await cargar(); setModal(null); if (msg) decir(msg); }

  return (
    <>
      <Encabezado activo="inventario" />
      <div className="iv">
        <div className="iv-bar">
          <input className="iv-q" placeholder="🔍 Buscar producto…" value={q} onChange={(e) => setQ(e.target.value)} />
          <button className="iv-b g" onClick={() => setModal({ tipo: 'editar', prod: null })}>+ Nuevo</button>
          <button className="iv-b ve" onClick={() => setModal({ tipo: 'reab' })}>📦 Reabastecer</button>
          <button className="iv-b ro" onClick={() => setModal({ tipo: 'margenes' })}>📉 Márgenes ({bajos.length} bajo {objetivo}%)</button>
        </div>
        <div className="iv-cats">
          {['todos', ...nombresCat].map((c) => <button key={c} className={cat === c ? 'on' : ''} onClick={() => setCat(c)}>{c === 'todos' ? 'Todos' : c}</button>)}
        </div>
        <table className="iv-t">
          <thead><tr><th>Producto</th><th>Categoría</th><th className="n">Precio</th><th className="n">Costo</th><th className="n">Stock</th><th /></tr></thead>
          <tbody>
            {lista.map((p) => {
              const m = inv.margenPct(p.PrecioVenta, p.CostoCompra ?? 0), niv = inv.nivelMargen(m, objetivo), ps = inv.promoEstado(p.Promo);
              const st = p.StockActual ?? 0, bajoMin = p.StockMinimo > 0 && st <= p.StockMinimo;
              return (
                <tr key={p.Id}>
                  <td><b>{p.Nombre}</b>{p.Promo && <span className={'iv-pr ' + (ps === 'ACTIVA' ? 'on' : '')}>{ps === 'ACTIVA' ? '🟢' : '🏷️'} PROMO{p.Promo.HoraIni ? ` ${p.Promo.HoraIni}-${p.Promo.HoraFin}` : ''}</span>}</td>
                  <td><span className="iv-cat">{categoriaDe(p, categorias).nombre}</span></td>
                  <td className="n"><b>{fmt(p.PrecioVenta)}</b></td>
                  <td className="n mut">{fmt(p.CostoCompra ?? 0)}<span className={'iv-m ' + niv}>{p.CostoCompra > 0 ? Math.round(m) + '%' : ''}</span></td>
                  <td className={'n ' + (st <= 0 ? 'sin' : bajoMin ? 'bajo' : 'ok')}>{st <= 0 ? 'Sin stock' : st + ' u'}{bajoMin && st > 0 ? ' ⚠' : ''}</td>
                  <td><div className="iv-acc">
                    <button onClick={() => setModal({ tipo: 'editar', prod: p })}>Editar</button>
                    <button className="bl" title="Simulador de precio" onClick={() => setModal({ tipo: 'sim', prod: p })}>🧮</button>
                    <button className="na" onClick={() => setModal({ tipo: 'promo', prod: p })}>Promo</button>
                  </div></td>
                </tr>
              );
            })}
            {lista.length === 0 && <tr><td colSpan="6" className="vacio">Sin productos.</td></tr>}
          </tbody>
        </table>
        <p className="iv-nota">Margen = (precio − costo) ÷ precio · <i className="ok">≥ {objetivo}%</i> <i className="medio">{objetivo - 10}–{objetivo - 1}%</i> <i className="bajo">&lt; {objetivo - 10}%</i></p>
      </div>

      {modal?.tipo === 'sim' && <Simulador p={modal.prod} cerrar={() => setModal(null)} aplicar={(precio) => guardar(modal.prod, { PrecioVenta: precio }, `${modal.prod.Nombre}: nuevo precio ${fmt(precio)} ✓`)} />}
      {modal?.tipo === 'promo' && <Promo p={modal.prod} objetivo={objetivo} cerrar={() => setModal(null)} guardar={(promo) => guardar(modal.prod, { Promo: promo }, promo ? 'Promoción aplicada ✓' : 'Promoción eliminada')} />}
      {modal?.tipo === 'reab' && <Reabastecer productos={productos} objetivo={objetivo} cerrar={() => setModal(null)} listo={async (msg) => { await cargar(); setModal(null); decir(msg); }} />}
      {modal?.tipo === 'margenes' && <Margenes productos={productos} objetivo={objetivo} cerrar={() => setModal(null)}
        cambiarObjetivo={async (v) => { await escribirMeta('negocio.margenObjetivo', v); setObjetivo(v); }}
        aplicar={async (p, precio) => { await put('PRODUCTOS', { ...p, PrecioVenta: precio }); await cargar(); decir(`${p.Nombre}: nuevo precio ${fmt(precio)} ✓`); }} />}
      {modal?.tipo === 'editar' && <Editar p={modal.prod} objetivo={objetivo} cerrar={() => setModal(null)}
        guardar={async (datos) => { await put('PRODUCTOS', { ...(modal.prod ?? { Activo: true }), ...datos }); await cargar(); setModal(null); decir('Guardado ✓'); }} />}
      {aviso && <div className="iv-toast">{aviso}</div>}
    </>
  );
}

function Modal({ titulo, cerrar, children, ancho = 520, rojo }) {
  return (
    <div className="pn-velo" onClick={(e) => e.target === e.currentTarget && cerrar()}>
      <div className="pn-modal iv-mod" style={{ maxWidth: ancho, borderColor: rojo ? '#fb718599' : undefined }}>
        <h3 style={rojo ? { color: 'var(--rojo)' } : undefined}>{titulo}</h3>{children}
      </div>
    </div>
  );
}

function Simulador({ p, cerrar, aplicar }) {
  const costo = p.CostoCompra ?? 0, actual = p.PrecioVenta;
  const [pct, setPct] = useState(inv.INCREMENTO_INICIAL);
  const [precio, setPrecio] = useState(inv.precioConIncremento(actual, inv.INCREMENTO_INICIAL));
  const [uni, setUni] = useState(0);
  const [mg, setMg] = useState(String(Math.round(inv.margenPct(inv.precioConIncremento(actual, inv.INCREMENTO_INICIAL), costo))));
  const s = inv.simular({ costo, precio, unidades: uni });
  const fijar = (nuevo, origen) => { setPrecio(nuevo); setPct(Math.min(inv.INCREMENTO_MAX, Math.max(0, inv.incrementoDe(actual, nuevo)))); if (origen !== 'mg') setMg(String(Math.round(inv.margenPct(nuevo, costo)))); };
  return (
    <Modal titulo={`🧮 Simulador · ${p.Nombre}`} cerrar={cerrar} ancho={580}>
      <div className="iv-tri">
        <div><label>Costo unitario</label><div className="iv-ro">{costo}</div></div>
        <div><label>Precio actual</label><div className="iv-ro">{actual}</div></div>
        <div><label>Unidades/mes</label><input className="iv-hi" inputMode="numeric" value={uni || ''} placeholder="0" onChange={(e) => setUni(num(e.target.value))} /></div>
      </div>
      <div className="iv-rngf">
        <span>Nuevo precio</span>
        <div><input type="range" min="0" max={inv.INCREMENTO_MAX} value={pct} onChange={(e) => fijar(inv.precioConIncremento(actual, Number(e.target.value)))} />
          <div className="iv-tk"><span>+0%</span><span>+100%</span><span>+250%</span><span>+500%</span></div></div>
        <b>{fmt(precio)}</b>
      </div>
      <div className="iv-chips">{inv.ATAJOS_INCREMENTO.map((a) => <button key={a} className={pct === a ? 'on' : ''} onClick={() => fijar(inv.precioConIncremento(actual, a))}>+{a}%</button>)}</div>
      <div className="iv-kp">
        <div className="hi"><small>Margen · escríbelo</small>
          <input inputMode="numeric" value={mg} onChange={(e) => { const v = e.target.value.replace(/\D/g, ''); setMg(v); const nuevo = inv.precioParaMargen(costo, Number(v)); if (nuevo) fijar(nuevo, 'mg'); }} /><b> %</b></div>
        <div><small>Ganas por unidad</small><b>{fmt(s.gana)}</b></div>
        <div><small>Ganancia al mes</small><b className="v">{fmt(s.mes)}</b></div>
      </div>
      <p className="iv-hint">{precio === actual ? 'Este es tu precio actual. Mueve la barra o escribe un margen.' : `De ${fmt(actual)} a ${fmt(precio)} (${pct >= 0 ? '+' : ''}${inv.incrementoDe(actual, precio)}%). El simulador solo calcula: el precio cambia cuando pulses Aplicar.`}</p>
      <div className="pn-acc"><button className="no" onClick={cerrar}>Cerrar</button><button className="si" disabled={precio === actual || !(precio > 0)} onClick={() => aplicar(precio)}>✓ Aplicar este precio</button></div>
    </Modal>
  );
}

function Promo({ p, objetivo, cerrar, guardar }) {
  const pr = p.Promo;
  const [precio, setPrecio] = useState(pr?.Precio ?? 0);
  const [ini, setIni] = useState(pr?.Ini ?? hoyIso());
  const [fin, setFin] = useState(pr?.Fin ?? hoyIso());
  const [horario, setHorario] = useState(!!pr?.HoraIni);
  const [hi, setHi] = useState(pr?.HoraIni ?? '14:00');
  const [hf, setHf] = useState(pr?.HoraFin ?? '17:00');
  const [err, setErr] = useState('');
  const m = precio > 0 ? inv.margenPct(precio, p.CostoCompra ?? 0) : null;
  const armar = () => ({ Precio: precio, Ini: ini, Fin: fin, ...(horario ? { HoraIni: hi, HoraFin: hf } : {}) });
  return (
    <Modal titulo={`🏷️ Promoción · ${p.Nombre}`} cerrar={cerrar}>
      <p className="iv-hint">Precio normal: <b className="oro">{fmt(p.PrecioVenta)}</b></p>
      <label>Precio promocional</label>
      <input className="iv-hi" inputMode="numeric" placeholder="Ej: 3000" value={precio ? '$' + precio.toLocaleString('es-CO') : ''} onChange={(e) => setPrecio(num(e.target.value))} />
      {m !== null && p.CostoCompra > 0 && <div className={'iv-al ' + (m < objetivo ? 'r' : 'v')}>Con la promo: descuento {inv.descuentoPct(p.PrecioVenta, precio)}% · margen <b>{Math.round(m)}%</b>{m < objetivo ? ` — bajo el objetivo de ${objetivo}%` : ''}</div>}
      <div className="iv-dos"><div><label>Fecha inicio</label><input type="date" value={ini} onChange={(e) => setIni(e.target.value)} /></div><div><label>Fecha fin</label><input type="date" value={fin} onChange={(e) => setFin(e.target.value)} /></div></div>
      <label className="iv-chk"><input type="checkbox" checked={horario} onChange={(e) => setHorario(e.target.checked)} /> ⏰ Limitar a franja horaria (ej: happy hour)</label>
      {horario ? <div className="iv-dos"><div><label>Hora inicio</label><input type="time" value={hi} onChange={(e) => setHi(e.target.value)} /></div><div><label>Hora fin</label><input type="time" value={hf} onChange={(e) => setHf(e.target.value)} /></div></div>
        : <p className="iv-hint">Sin marcar: la promo aplica todo el día dentro del rango de fechas.</p>}
      {err && <div className="iv-al r">{err}</div>}
      {pr && <button className="iv-quitar" onClick={() => guardar(null)}>Quitar promoción</button>}
      <div className="pn-acc"><button className="no" onClick={cerrar}>Cancelar</button><button className="si" onClick={() => { const e = inv.validarPromo(armar()); if (e) setErr(e); else guardar(armar()); }}>✓ Aplicar promo</button></div>
    </Modal>
  );
}

function Reabastecer({ productos, objetivo, cerrar, listo }) {
  const [id, setId] = useState('');
  const [cant, setCant] = useState(0);
  const [costo, setCosto] = useState(0);
  const [alerta, setAlerta] = useState(null);
  const p = productos.find((x) => x.Id === id);
  const c = p && costo > 0 ? inv.compararCompra({ precio: p.PrecioVenta, costoAntes: p.CostoCompra ?? 0, costoNuevo: costo, objetivo }) : null;
  async function registrar(nuevoPrecio) {
    const hist = [{ Fecha: new Date().toISOString(), Costo: costo }, ...(p.HistorialCostos ?? [])].slice(0, 10);
    await put('PRODUCTOS', { ...p, StockActual: (p.StockActual ?? 0) + cant, CostoCompra: costo, HistorialCostos: hist, ...(nuevoPrecio ? { PrecioVenta: nuevoPrecio } : {}) });
    listo(`Compra registrada: +${cant} ${p.Nombre}${nuevoPrecio ? ` · precio ${fmt(nuevoPrecio)}` : ''} ✓`);
  }
  if (alerta) return (
    <Modal titulo="⚠ Margen bajo" cerrar={cerrar} rojo>
      <p className="iv-hint">Con el nuevo costo, <b>{p.Nombre}</b> queda con margen de <b className="rj">{Math.round(c.despues.margen)}%</b> (objetivo {objetivo}%).</p>
      <div className="iv-cmp"><div><small>Precio actual</small><b>{fmt(p.PrecioVenta)}</b></div><div className="v"><small>Precio sugerido</small><b>{fmt(c.sugerido)}</b></div></div>
      <p className="iv-hint">El sistema nunca cambia un precio solo: tú decides.</p>
      <div className="pn-acc"><button className="no" onClick={() => registrar(null)}>Dejar el precio así</button><button className="si" onClick={() => registrar(c.sugerido)}>⬆ Subir a {fmt(c.sugerido)}</button></div>
    </Modal>
  );
  return (
    <Modal titulo="📦 Reabastecer" cerrar={cerrar}>
      <label>Producto</label>
      <select value={id} onChange={(e) => { setId(e.target.value); const x = productos.find((y) => y.Id === e.target.value); setCosto(x?.CostoCompra ?? 0); }}>
        <option value="">— Elige —</option>{[...productos].sort((a, b) => a.Nombre.localeCompare(b.Nombre, 'es')).map((x) => <option key={x.Id} value={x.Id}>{x.Nombre} · stock {x.StockActual ?? 0}</option>)}
      </select>
      <label>Cantidad que llega</label>
      <input className="iv-in" inputMode="numeric" placeholder="0" value={cant || ''} onChange={(e) => setCant(num(e.target.value))} />
      <label>Costo de compra por unidad</label>
      <input className="iv-hi" inputMode="numeric" placeholder="✎ Escribe el costo" value={costo ? '$' + costo.toLocaleString('es-CO') : ''} onChange={(e) => setCosto(num(e.target.value))} />
      {c && <>
        <div className="iv-cmp"><div><small>Antes</small><b>{fmt(c.antes.gana)}</b><span>ganancia/u · margen {Math.round(c.antes.margen)}%</span></div>
          <div className={c.bajo ? 'r' : ''}><small>Después</small><b>{fmt(c.despues.gana)}</b><span>ganancia/u · margen {Math.round(c.despues.margen)}%</span></div></div>
        {c.bajo && <div className="iv-al r">⚠ El margen queda en <b>{Math.round(c.despues.margen)}%</b>, bajo el objetivo de {objetivo}%. Precio sugerido: <b>{fmt(c.sugerido)}</b></div>}
      </>}
      <div className="pn-acc"><button className="no" onClick={cerrar}>Cancelar</button>
        <button className="si" disabled={!p || cant <= 0 || costo <= 0} onClick={() => (c.bajo ? setAlerta(true) : registrar(null))}>✓ Registrar compra</button></div>
    </Modal>
  );
}

function Margenes({ productos, objetivo, cerrar, cambiarObjetivo, aplicar }) {
  const [o, setO] = useState(String(objetivo));
  const l = inv.productosBajoMargen(productos, objetivo);
  return (
    <Modal titulo="📉 Análisis de márgenes" cerrar={cerrar} ancho={680}>
      <div className="iv-obj"><label>Margen objetivo</label>
        <input className="iv-in" style={{ width: 90 }} inputMode="numeric" value={o} onChange={(e) => setO(e.target.value.replace(/\D/g, ''))} onBlur={() => { const v = Number(o); if (v > 0 && v < 95) cambiarObjetivo(v); else setO(String(objetivo)); }} /> %
        <span>se mide con el último costo de compra</span></div>
      <div className="iv-scroll"><table className="iv-t">
        <thead><tr><th>Producto</th><th className="n">Margen</th><th className="n">Gana/u</th><th className="n">Costo</th><th className="n">Sugerido</th><th /></tr></thead>
        <tbody>{l.map(({ p, margen, sugerido }) => (
          <tr key={p.Id}><td>{p.Nombre}</td><td className="n"><span className={'iv-m ' + inv.nivelMargen(margen, objetivo)}>{Math.round(margen)}%</span></td><td className="n">{fmt(p.PrecioVenta - p.CostoCompra)}</td>
            <td className="n">{fmt(p.CostoCompra)}{p.HistorialCostos?.[1] && p.CostoCompra > p.HistorialCostos[1].Costo ? <span className="rj"> ↑</span> : null}</td><td className="n">{fmt(sugerido)}</td>
            <td><div className="iv-acc"><button onClick={() => aplicar(p, sugerido)}>Aplicar</button></div></td></tr>))}
        </tbody></table>
        {l.length === 0 && <div className="vacio ok">✓ Todos los productos cumplen el margen objetivo</div>}</div>
      <div className="pn-acc"><button className="si" onClick={cerrar}>Cerrar</button></div>
    </Modal>
  );
}

function Editar({ p, objetivo, cerrar, guardar }) {
  const [d, setD] = useState({ Nombre: p?.Nombre ?? '', CategoriaConsumo: p?.CategoriaConsumo ?? 'BEBIDAS_ALCOHOLICAS', PrecioVenta: p?.PrecioVenta ?? 0, CostoCompra: p?.CostoCompra ?? 0, StockActual: p?.StockActual ?? 0, StockMinimo: p?.StockMinimo ?? 0 });
  const set = (k, v) => setD({ ...d, [k]: v });
  const m = d.PrecioVenta > 0 && d.CostoCompra > 0 ? inv.margenPct(d.PrecioVenta, d.CostoCompra) : null;
  const ok = d.Nombre.trim() && d.PrecioVenta > 0;
  return (
    <Modal titulo={p ? 'Editar producto' : 'Nuevo producto'} cerrar={cerrar}>
      <label>Nombre</label><input className="iv-in" value={d.Nombre} onChange={(e) => set('Nombre', e.target.value)} />
      <label>Categoría</label><select value={d.CategoriaConsumo} onChange={(e) => set('CategoriaConsumo', e.target.value)}>{ENUMS.map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select>
      <div className="iv-dos"><div><label>Precio de venta</label><input className="iv-in" inputMode="numeric" value={d.PrecioVenta || ''} onChange={(e) => set('PrecioVenta', num(e.target.value))} /></div>
        <div><label>Costo</label><input className="iv-in" inputMode="numeric" value={d.CostoCompra || ''} onChange={(e) => set('CostoCompra', num(e.target.value))} /></div></div>
      {m !== null && <div className={'iv-al ' + (m < objetivo ? 'r' : 'v')}>Margen {Math.round(m)}%{m < objetivo ? ` — bajo el objetivo de ${objetivo}%. Precio sugerido: ${fmt(inv.precioSugerido(d.CostoCompra, objetivo))}` : ''}</div>}
      <div className="iv-dos"><div><label>Stock actual</label><input className="iv-in" inputMode="numeric" value={d.StockActual || ''} onChange={(e) => set('StockActual', num(e.target.value))} /></div>
        <div><label>Stock mínimo (alerta)</label><input className="iv-in" inputMode="numeric" value={d.StockMinimo || ''} onChange={(e) => set('StockMinimo', num(e.target.value))} /></div></div>
      <div className="pn-acc"><button className="no" onClick={cerrar}>Cancelar</button><button className="si" disabled={!ok} onClick={() => guardar({ ...d, Nombre: d.Nombre.trim() })}>✓ Guardar</button></div>
    </Modal>
  );
}
