// src/screens/Inventario.jsx — Inventario (solo Admin): productos, reabastecer, márgenes, simulador de precio y promociones.
import ImportarPos from './ImportarPos.jsx';
import { createPortal } from 'react-dom';
import { useState, useEffect, useCallback, useMemo, Fragment } from 'react';
import Encabezado from '../components/Encabezado.jsx';
import { categoriaDe, norm, deCategoria, EMOJIS_CAT, COLORES_CAT, CONSUMOS } from '../cuenta/catalogo.js';
import { asegurarCategorias, guardarCategoria, desactivarCategoria } from '../cuenta/categoriasDb.js';
import * as inv from '../cuenta/inventario.js';
import { getAll, put, leerMeta, escribirMeta } from '../db/repository.js';
import { abrirEnvaseDb, registrarCompra } from '../cuenta/inventarioDb.js';
import { imprimirComo, nombrePdf } from '../cuenta/imprimir.js';
import { HojaPedido } from '../informes/Hoja.jsx';
import './Panel.css';
import './Inventario.css';

const fmt = (n) => '$' + Math.round(n).toLocaleString('es-CO');
const PRESENTACIONES = ['Caja', 'Canasta', 'Paca', 'Bulto'];
const num = (v) => Number(String(v).replace(/\D/g, '')) || 0;
const hoyIso = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const ENUMS = [['BEBIDAS_ALCOHOLICAS', 'Licores'], ['SNACKS', 'Snacks'], ['BEBIDAS_NO_ALCOHOLICAS', 'Bebidas'], ['OTROS', 'Otros']];
const esVendible = (p) => p.ControlaStock !== false;   // fuera: garita y venta libre (no son del inventario)

export default function Inventario() {
  const [todosProd, setTodosProd] = useState([]);   // incluye desactivados
  const [verOff, setVerOff] = useState(false);
  const productos = useMemo(() => todosProd.filter((p) => p.Activo !== false), [todosProd]);   // todo el cálculo usa solo los activos
  const nOff = todosProd.length - productos.length;
  const [categorias, setCategorias] = useState([]);
  const [objetivo, setObjetivo] = useState(inv.MARGEN_OBJETIVO);
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('todos');
  const [modal, setModal] = useState(null);   // { tipo, prod? }
  const [aviso, setAviso] = useState('');

  const cargar = useCallback(async () => {
    let todos = (await getAll('PRODUCTOS')).filter(esVendible);
    const sinCodigo = todos.filter((p) => !p.Codigo);
    if (sinCodigo.length) {   // asigna P001, P002… a los productos que aún no tienen código
      let n = Math.max(0, ...todos.map((p) => Number(String(p.Codigo ?? '').slice(1)) || 0));
      for (const p of sinCodigo) await put('PRODUCTOS', { ...p, Codigo: 'P' + String(++n).padStart(3, '0') });
      todos = (await getAll('PRODUCTOS')).filter(esVendible);
    }
    setTodosProd(todos);
    setCategorias((await asegurarCategorias()).filter((c) => c.Activo !== false));
    setObjetivo((await leerMeta('negocio.margenObjetivo')) ?? inv.MARGEN_OBJETIVO);
  }, []);
  useEffect(() => { cargar(); }, [cargar]);
  const decir = (m) => { setAviso(m); setTimeout(() => setAviso(''), 2400); };

  const lista = useMemo(() => {
    const t = norm(q);
    return (verOff ? todosProd.filter((p) => p.Activo === false) : productos)
      .filter((p) => (cat === 'todos' || categoriaDe(p, categorias).nombre === cat) && (!t || norm(p.Nombre).includes(t)))
      .sort((a, b) => a.Nombre.localeCompare(b.Nombre, 'es'));
  }, [productos, todosProd, verOff, categorias, q, cat]);
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
          <button className="iv-b o" onClick={() => setModal({ tipo: 'cats' })}>⚙ Categorías</button>
          <button className="iv-b ve" onClick={() => setModal({ tipo: 'reab' })}>📦 Reabastecer</button>
          {nOff > 0 && <button className={'iv-b ' + (verOff ? 'o' : '')} onClick={() => setVerOff(!verOff)}>{verOff ? '← Ver activos' : `Ver desactivados (${nOff})`}</button>}
          <button className="iv-b o" onClick={() => setModal({ tipo: 'repo' })}>📋 Reposición</button>
          <button className="iv-b" onClick={() => setModal({ tipo: 'audpromo' })}>🏷️ Auditoría promos</button>
          <button className="iv-b" onClick={() => setModal({ tipo: 'importar' })}>📂 Importar POS</button>
          <button className="iv-b ro" title={`${bajos.length} producto(s) con margen bajo ${objetivo}%`} onClick={() => setModal({ tipo: 'margenes' })}>📉 Márgenes · {bajos.length}</button>
        </div>
        <div className="iv-cats">
          {['todos', ...nombresCat].map((c) => <button key={c} className={cat === c ? 'on' : ''} onClick={() => setCat(c)}>{c === 'todos' ? 'Todos' : c}</button>)}
        </div>
        <table className="iv-t">
          <thead><tr><th>Código</th><th>Producto</th><th>Categoría</th><th className="n">Precio</th><th className="n" title="Costo y margen sobre el precio">Costo · margen</th><th className="n">Stock</th><th /></tr></thead>
          <tbody>
            {lista.map((p) => {
              const m = inv.margenPct(p.PrecioVenta, p.CostoCompra ?? 0), niv = inv.nivelMargen(m, objetivo), ps = inv.promoEstado(p.Promo);
              const origen = productos.find((x) => x.Id === p.Fraccion?.OrigenId), frac = inv.esFraccionado(p);
              const st = frac ? inv.disponible(p, origen) : p.StockActual ?? 0, bajoMin = p.StockMinimo > 0 && st <= p.StockMinimo;
              return (
                <tr key={p.Id} className={p.Activo === false ? 'off' : ''}>
                  <td className="cod">{p.Codigo}</td>
                  <td><b>{p.Nombre}</b>{inv.esFraccionado(p) && <span className="iv-env">🔗 {p.Fraccion.Rinde}/env</span>}{inv.presentacionDe(p) && <span className="iv-env">📦 {inv.presentacionDe(p).nombre} × {inv.presentacionDe(p).unidades}</span>}{p.Promo && <PromoTag promo={p.Promo} estado={ps} />}</td>
                  <td><span className="iv-cat">{categoriaDe(p, categorias).nombre}</span></td>
                  <td className="n"><b>{fmt(p.PrecioVenta)}</b></td>
                  <td className="n mut">{fmt(p.CostoCompra ?? 0)}<span className={'iv-m ' + niv} title={p.CostoCompra > 0 ? `Margen sobre el precio. Recargo sobre el costo: +${Math.round(inv.recargoPct(p.PrecioVenta, p.CostoCompra))}%` : ''}>{p.CostoCompra > 0 ? Math.round(m) + '%' : ''}</span></td>
                  <td className={'n ' + (st <= 0 ? 'sin' : bajoMin ? 'bajo' : 'ok')}>{st <= 0 ? (frac ? inv.textoStock(p, origen) : 'Sin stock') : inv.textoStock(p, origen)}{bajoMin && st > 0 ? ' ⚠' : ''}</td>
                  <td><div className="iv-acc">
                    {p.Activo === false
                      ? <button className="re" onClick={() => guardar(p, { Activo: true }, `${p.Nombre} reactivado ✓`)}>↺ Reactivar</button>
                      : <button onClick={() => setModal({ tipo: 'editar', prod: p })}>Editar</button>}
                    {frac && <button className="ab" title={`Abrir un envase de ${origen?.Nombre ?? ''}`} onClick={async () => { const ok = await abrirEnvaseDb(p); decir(ok ? `🍾 Abierto: +${p.Fraccion.Rinde} ${p.Nombre}` : `⚠ No hay envases de ${origen?.Nombre ?? 'origen'}`); cargar(); }}>🍾 Abrir</button>}
                    <button className="bl" title="Simulador de precio" onClick={() => setModal({ tipo: 'sim', prod: p })}>🧮</button>
                    {p.Activo !== false && <button className="na" onClick={() => setModal({ tipo: 'promo', prod: p })}>Promo</button>}
                    {p.Activo !== false && <button className="x" title="Desactivar producto" onClick={() => setModal({ tipo: 'off', prod: p })}>✕</button>}
                  </div></td>
                </tr>
              );
            })}
            {lista.length === 0 && <tr><td colSpan="7" className="vacio">Sin productos.</td></tr>}
          </tbody>
        </table>
        <p className="iv-nota">Margen = (precio − costo) ÷ precio · <i className="ok">≥ {objetivo}%</i> <i className="medio">{objetivo - 10}–{objetivo - 1}%</i> <i className="bajo">&lt; {objetivo - 10}%</i></p>
      </div>

      {modal?.tipo === 'off' && <Desactivar p={modal.prod} productos={productos} cerrar={() => setModal(null)} listo={() => guardar(modal.prod, { Activo: false }, `${modal.prod.Nombre} desactivado`)} />}
      {modal?.tipo === 'importar' && <ImportarPos cerrar={() => setModal(null)} listo={async (msg) => { setModal(null); await cargar(); decir(msg); }} />}
      {modal?.tipo === 'cats' && <Categorias categorias={categorias} productos={productos} cerrar={() => setModal(null)} cambio={async (msg) => { await cargar(); if (msg) decir(msg); }} />}
      {modal?.tipo === 'sim' && <Simulador p={modal.prod} objetivo={objetivo} cerrar={() => setModal(null)} aplicar={(precio) => guardar(modal.prod, { PrecioVenta: precio }, `${modal.prod.Nombre}: nuevo precio ${fmt(precio)} ✓`)} />}
      {modal?.tipo === 'promo' && <Promo p={modal.prod} objetivo={objetivo} cerrar={() => setModal(null)} guardar={(promo) => guardar(modal.prod, { Promo: promo }, promo ? 'Promoción aplicada ✓' : 'Promoción eliminada')} />}
      {modal?.tipo === 'repo' && <ListaReposicion productos={productos} categorias={categorias} objetivo={objetivo} recargar={cargar} cerrar={() => setModal(null)} />}
      {modal?.tipo === 'audpromo' && <AuditoriaPromos productos={productos} categorias={categorias} cerrar={() => setModal(null)} />}
      {modal?.tipo === 'reab' && <Reabastecer productos={productos} objetivo={objetivo} cerrar={() => setModal(null)} listo={async (msg) => { await cargar(); setModal(null); decir(msg); }} />}
      {modal?.tipo === 'margenes' && <Margenes productos={productos} objetivo={objetivo} cerrar={() => setModal(null)}
        cambiarObjetivo={async (v) => { await escribirMeta('negocio.margenObjetivo', v); setObjetivo(v); }}
        aplicar={async (p, precio) => { await put('PRODUCTOS', { ...p, PrecioVenta: precio }); await cargar(); decir(`${p.Nombre}: nuevo precio ${fmt(precio)} ✓`); }} />}
      {modal?.tipo === 'editar' && <Editar p={modal.prod} productos={productos} categorias={categorias} objetivo={objetivo} cerrar={() => setModal(null)}
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

function Simulador({ p, objetivo, cerrar, aplicar }) {
  const costo = p.CostoCompra ?? 0, actual = p.PrecioVenta;
  // Arranca con el margen objetivo (40 %): el precio que lo da es el punto de partida
  const inicial = inv.precioParaMargen(costo, objetivo) ?? actual;
  const [pct, setPct] = useState(Math.min(inv.INCREMENTO_MAX, Math.max(0, inv.incrementoDe(actual, inicial))));
  const [precio, setPrecio] = useState(inicial);
  const [uni, setUni] = useState(0);
  const [mg, setMg] = useState(String(Math.round(inv.margenPct(inicial, costo))));
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
        <span>Subir precio actual</span>
        <div><input type="range" min="0" max={inv.INCREMENTO_MAX} value={pct} onChange={(e) => fijar(inv.precioConIncremento(actual, Number(e.target.value)))} />
          <div className="iv-tk"><span>+0%</span><span>+100%</span><span>+250%</span><span>+500%</span></div></div>
        <input className="iv-hi iv-np" inputMode="numeric" value={precio ? '$' + precio.toLocaleString('es-CO') : ''} placeholder="$ precio"
          onChange={(e) => { const v = num(e.target.value); setPrecio(v); setPct(Math.min(inv.INCREMENTO_MAX, Math.max(0, inv.incrementoDe(actual, v)))); setMg(String(Math.round(inv.margenPct(v, costo)))); }} />
      </div>
      <div className="iv-chips"><em>Margen:</em>{inv.ATAJOS_MARGEN.map((a) => <button key={a} className={Number(mg) === a ? 'on' : ''} onClick={() => { const nuevo = inv.precioParaMargen(costo, a); if (nuevo) { fijar(nuevo, 'mg'); setMg(String(a)); } }}>{a}%</button>)}</div>
      <div className={'iv-res ' + (precio === actual ? '' : precio > actual ? 'sube' : 'baja')}>
        <small>PRECIO DE VENTA RESULTANTE</small>
        <b>{fmt(precio)}</b>
        <span>{precio === actual ? 'Es tu precio actual: no cambia.' : `Hoy se vende a ${fmt(actual)} → quedaría en ${fmt(precio)} (${inv.incrementoDe(actual, precio) >= 0 ? '+' : ''}${inv.incrementoDe(actual, precio)}%).`}</span>
        <span>Costo {fmt(costo)} con margen del {Math.round(s.margen)}% ⇒ vendes a {fmt(precio)} (se redondea hacia arriba a múltiplos de {fmt(inv.pasoRedondeo(precio))}).</span>
      </div>
      <div className="iv-kp">
        <div className="hi"><small>Margen · escríbelo</small>
          <input inputMode="numeric" value={mg} onChange={(e) => { const v = e.target.value.replace(/\D/g, ''); setMg(v); const nuevo = inv.precioParaMargen(costo, Number(v)); if (nuevo) fijar(nuevo, 'mg'); }} /><b> %</b></div>
        <div><small>Ganas por unidad</small><b>{fmt(s.gana)}</b></div>
        <div><small>Ganancia al mes</small><b className="v">{fmt(s.mes)}</b></div>
      </div>
      <p className="iv-hint iv-rec">Margen <b>{Math.round(s.margen)}%</b> = de cada $100 que vendes, <b>${Math.round(s.margen)}</b> son ganancia (sobre el precio). Recargo sobre el costo: <b>+{Math.round(inv.recargoPct(precio, costo))}%</b>. Cambio vs. precio actual: <b>{inv.incrementoDe(actual, precio) >= 0 ? '+' : ''}{inv.incrementoDe(actual, precio)}%</b>.</p>
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
  const [porCaja, setPorCaja] = useState(false);   // solo si el producto tiene presentación de compra
  const p = productos.find((x) => x.Id === id);
  const pres = p ? inv.presentacionDe(p) : null;
  const modoCaja = !!pres && porCaja;
  const uds = modoCaja ? cant * pres.unidades : cant;                        // unidades que entran al stock
  const costoU = modoCaja ? Math.round(costo / pres.unidades) : costo;       // costo por unidad
  const cambiarModo = (v) => { setPorCaja(v); setCant(0); setCosto(v ? Math.round((p.CostoCompra ?? 0) * pres.unidades) : (p.CostoCompra ?? 0)); };
  const c = p && costoU > 0 ? inv.compararCompra({ precio: p.PrecioVenta, costoAntes: p.CostoCompra ?? 0, costoNuevo: costoU, objetivo }) : null;
  async function registrar(nuevoPrecio) {
    await registrarCompra(p, uds, costoU, nuevoPrecio);
    listo(`Compra registrada: +${uds} ${p.Nombre}${nuevoPrecio ? ` · precio ${fmt(nuevoPrecio)}` : ''} ✓`);
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
      <select value={id} onChange={(e) => { setId(e.target.value); setPorCaja(false); setCant(0); const x = productos.find((y) => y.Id === e.target.value); setCosto(x?.CostoCompra ?? 0); }}>
        <option value="">— Elige —</option>{[...productos].filter((x) => !inv.esFraccionado(x)).sort((a, b) => a.Nombre.localeCompare(b.Nombre, 'es')).map((x) => <option key={x.Id} value={x.Id}>{x.Nombre} · stock {x.StockActual ?? 0}</option>)}
      </select>
      {pres && <div className="iv-modo"><button className={!porCaja ? 'on' : ''} onClick={() => cambiarModo(false)}>Por unidad</button><button className={porCaja ? 'on' : ''} onClick={() => cambiarModo(true)}>Por {pres.nombre.toLowerCase()} de {pres.unidades}</button></div>}
      <label>{modoCaja ? `${pres.nombre}s que llegan` : 'Cantidad que llega'}</label>
      <input className="iv-in" inputMode="numeric" placeholder="0" value={cant || ''} onChange={(e) => setCant(num(e.target.value))} />
      <label>{modoCaja ? `Costo de compra por ${pres.nombre.toLowerCase()}` : 'Costo de compra por unidad'}</label>
      <input className="iv-hi" inputMode="numeric" placeholder="✎ Escribe el costo" value={costo ? '$' + costo.toLocaleString('es-CO') : ''} onChange={(e) => setCosto(num(e.target.value))} />
      {modoCaja && cant > 0 && costo > 0 && <div className="iv-hint">= {uds} unidades · {fmt(costoU)} c/u</div>}
      {c && <>
        <div className="iv-cmp"><div><small>Antes</small><b>{fmt(c.antes.gana)}</b><span>ganancia/u · margen {Math.round(c.antes.margen)}%</span></div>
          <div className={c.bajo ? 'r' : ''}><small>Después</small><b>{fmt(c.despues.gana)}</b><span>ganancia/u · margen {Math.round(c.despues.margen)}%</span></div></div>
        {c.bajo && <div className="iv-al r">⚠ El margen queda en <b>{Math.round(c.despues.margen)}%</b>, bajo el objetivo de {objetivo}%. Precio sugerido: <b>{fmt(c.sugerido)}</b></div>}
      </>}
      <div className="pn-acc"><button className="no" onClick={cerrar}>Cancelar</button>
        <button className="si" disabled={!p || uds <= 0 || costoU <= 0} onClick={() => (c.bajo ? setAlerta(true) : registrar(null))}>✓ Registrar compra</button></div>
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

function Editar({ p, productos, categorias, objetivo, cerrar, guardar }) {
  const [d, setD] = useState({ Nombre: p?.Nombre ?? '', CategoriaId: p?.CategoriaId ?? categorias.find((c) => c.Nombre === 'Licores')?.Id ?? categorias[0]?.Id ?? '', PrecioVenta: p?.PrecioVenta ?? 0, CostoCompra: p?.CostoCompra ?? 0, StockActual: p?.StockActual ?? 0, StockMinimo: p?.StockMinimo ?? 0, OrigenId: p?.Fraccion?.OrigenId ?? '', Rinde: p?.Fraccion?.Rinde ?? 0, PresNombre: p?.Presentacion?.Nombre ?? '', PresUnidades: p?.Presentacion?.Unidades ?? 0 });
  const set = (k, v) => setD({ ...d, [k]: v });
  const m = d.PrecioVenta > 0 && d.CostoCompra > 0 ? inv.margenPct(d.PrecioVenta, d.CostoCompra) : null;
  const ok = d.Nombre.trim() && d.PrecioVenta > 0 && (!d.OrigenId || d.Rinde > 0) && (!d.PresNombre || d.PresUnidades >= 2);
  const armar = () => { const { OrigenId, Rinde, PresNombre, PresUnidades, ...base } = d; const cat = categorias.find((c) => c.Id === d.CategoriaId); return { ...base, CategoriaConsumo: cat?.Consumo ?? p?.CategoriaConsumo ?? 'OTROS', Nombre: d.Nombre.trim(), Fraccion: OrigenId ? { OrigenId, Rinde } : null, Presentacion: !OrigenId && PresNombre && PresUnidades >= 2 ? { Nombre: PresNombre, Unidades: PresUnidades } : null }; };
  return (
    <Modal titulo={p ? 'Editar producto' : 'Nuevo producto'} cerrar={cerrar}>
      <label>Nombre</label><input className="iv-in" value={d.Nombre} onChange={(e) => set('Nombre', e.target.value)} />
      <label>Categoría</label><select value={d.CategoriaId} onChange={(e) => set('CategoriaId', e.target.value)}>{categorias.map((c) => <option key={c.Id} value={c.Id}>{deCategoria(c).emoji} {c.Nombre}</option>)}</select>
      <div className="iv-dos"><div><label>Precio de venta</label><input className="iv-in" inputMode="numeric" value={d.PrecioVenta || ''} onChange={(e) => set('PrecioVenta', num(e.target.value))} /></div>
        <div><label>Costo</label><input className="iv-in" inputMode="numeric" value={d.CostoCompra || ''} onChange={(e) => set('CostoCompra', num(e.target.value))} /></div></div>
      {m !== null && <div className={'iv-al ' + (m < objetivo ? 'r' : 'v')}>Margen {Math.round(m)}%{m < objetivo ? ` — bajo el objetivo de ${objetivo}%. Precio sugerido: ${fmt(inv.precioSugerido(d.CostoCompra, objetivo))}` : ''}</div>}
      <div className="iv-dos"><div><label>Stock actual</label><input className="iv-in" inputMode="numeric" value={d.StockActual || ''} onChange={(e) => set('StockActual', num(e.target.value))} /></div>
        <div><label>Stock mínimo (alerta)</label><input className="iv-in" inputMode="numeric" value={d.StockMinimo || ''} onChange={(e) => set('StockMinimo', num(e.target.value))} /></div></div>
      <div className="iv-fr">
        <div className="t">🔗 FRACCIONADO (opcional)</div>
        <p className="iv-hint" style={{ marginTop: 0 }}>Ej: la copa sale de una botella, el cigarrillo de un paquete. Al agotarse las sueltas, el sistema abre un envase nuevo solo.</p>
        <label>Producto origen (envase)</label>
        <select value={d.OrigenId} onChange={(e) => set('OrigenId', e.target.value)}><option value="">— No es fraccionado —</option>
          {productos.filter((x) => x.Id !== p?.Id && !inv.esFraccionado(x)).sort((a, b) => a.Nombre.localeCompare(b.Nombre, 'es')).map((x) => <option key={x.Id} value={x.Id}>{x.Nombre}</option>)}</select>
        {d.OrigenId && <><label>Rendimiento (unidades por envase)</label><input className="iv-in" inputMode="numeric" placeholder="Ej: 12 copas por botella" value={d.Rinde || ''} onChange={(e) => set('Rinde', num(e.target.value))} /></>}
      </div>
      {!d.OrigenId && <div className="iv-fr">
        <div className="t">📦 SE COMPRA POR (opcional)</div>
        <p className="iv-hint" style={{ marginTop: 0 }}>Ej: la cerveza viene en caja de 30. Se sigue vendiendo y contando por unidad; la lista de reposición y Reabastecer podrán trabajar en cajas.</p>
        <label>Presentación de compra</label>
        <select value={d.PresNombre} onChange={(e) => set('PresNombre', e.target.value)}><option value="">— Se compra por unidad —</option>{PRESENTACIONES.map((n) => <option key={n} value={n}>{n}</option>)}</select>
        {d.PresNombre && <><label>Unidades por {d.PresNombre.toLowerCase()}</label><input className="iv-in" inputMode="numeric" placeholder="Ej: 30" value={d.PresUnidades || ''} onChange={(e) => set('PresUnidades', num(e.target.value))} /></>}
      </div>}
      <div className="pn-acc"><button className="no" onClick={cerrar}>Cancelar</button><button className="si" disabled={!ok} onClick={() => guardar(armar())}>✓ Guardar</button></div>
    </Modal>
  );
}

function Categorias({ categorias, productos, cerrar, cambio }) {
  const VACIA = { Nombre: '', Emoji: '📦', Color: '#94a3b8', Consumo: 'OTROS' };
  const [edit, setEdit] = useState(null);      // null = lista · {} = nueva · {…cat} = editar
  const [d, setD] = useState(VACIA);
  const [err, setErr] = useState('');
  const abrir = (c) => { setErr(''); setD(c ? { Nombre: c.Nombre, Emoji: deCategoria(c).emoji, Color: deCategoria(c).color, Consumo: c.Consumo ?? 'OTROS' } : VACIA); setEdit(c ?? {}); };
  const nProd = (c) => productos.filter((p) => p.CategoriaId === c.Id).length;
  if (edit) return (
    <Modal titulo={edit.Id ? 'Editar categoría' : 'Nueva categoría'} cerrar={cerrar} ancho={560}>
      <div className="cg-prev" style={{ '--c': d.Color }}><span className="cg-ic">{d.Emoji}</span><div><b>{d.Nombre.trim() || 'Nombre de la categoría'}</b><small>Así se verá en la mesa</small></div></div>
      <label>Nombre</label><input className="iv-in" autoFocus placeholder="Ej: Heladería, Cafetería…" value={d.Nombre} onChange={(e) => setD({ ...d, Nombre: e.target.value })} />
      <label>Icono</label><div className="cg-emo">{EMOJIS_CAT.map((e) => <button key={e} className={d.Emoji === e ? 'on' : ''} onClick={() => setD({ ...d, Emoji: e })}>{e}</button>)}</div>
      <label>Color</label><div className="cg-col">{COLORES_CAT.map((c) => <button key={c} className={d.Color === c ? 'on' : ''} style={{ '--c': c }} onClick={() => setD({ ...d, Color: c })} aria-label={c} />)}</div>
      <label>Se factura como</label>
      <div className="cg-seg">{CONSUMOS.map(([v, t]) => <button key={v} className={d.Consumo === v ? 'on' : ''} onClick={() => setD({ ...d, Consumo: v })}>{t}</button>)}</div>
      <p className="iv-hint" style={{ marginTop: 8 }}>Decide en qué grupo sale en la factura y en el cierre del día.</p>
      {err && <div className="iv-al r">{err}</div>}
      <div className="pn-acc"><button className="no" onClick={() => { setErr(''); setEdit(null); }}>Cancelar</button>
        <button className="si" onClick={async () => { const r = await guardarCategoria(categorias, d, edit.Id ?? null); if (r.error) setErr(r.error); else { setErr(''); setEdit(null); cambio(`✓ Categoría "${d.Nombre.trim()}" guardada`); } }}>{edit.Id ? 'Guardar cambios' : 'Crear categoría'}</button></div>
    </Modal>
  );
  return (
    <Modal titulo="Categorías" cerrar={cerrar} ancho={720}>
      <p className="iv-hint" style={{ margin: '-6px 0 14px' }}>Agrupan los productos en la mesa, la venta rápida y el inventario.</p>
      <div className="cg-grid">
        {[...categorias].sort((a, b) => a.Nombre.localeCompare(b.Nombre, 'es')).map((c) => { const k = deCategoria(c), n = nProd(c); return (
          <div key={c.Id} className="cg-card" style={{ '--c': k.color }}>
            <span className="cg-ic">{k.emoji}</span>
            <div className="cg-t"><b>{c.Nombre}</b><small>{n === 0 ? 'Sin productos' : `${n} producto${n === 1 ? '' : 's'}`}</small></div>
            <div className="cg-b">
              <button title="Editar" onClick={() => abrir(c)}>✏️</button>
              <button title={n ? 'Tiene productos: no se puede borrar' : 'Borrar'} className={n ? 'off' : ''} onClick={async () => { if (n) { setErr(`"${c.Nombre}" tiene ${n} producto(s). Muévelos a otra categoría primero.`); return; } if (window.confirm(`¿Borrar la categoría ${c.Nombre}?`)) { const r = await desactivarCategoria(c); if (r.error) setErr(r.error); else { setErr(''); cambio(`Categoría "${c.Nombre}" borrada`); } } }}>🗑️</button>
            </div>
          </div>); })}
      </div>
      <button className="cg-nueva" onClick={() => abrir(null)}><span>＋</span>Nueva categoría</button>
      {err && <div className="iv-al r">{err}</div>}
      <div className="pn-acc"><button className="si" onClick={cerrar}>Listo</button></div>
    </Modal>
  );
}

const fmtFecha = (iso) => new Date(iso + 'T00:00:00').toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });
function PromoTag({ promo, estado }) {
  const hora = promo.HoraIni ? ` ${promo.HoraIni}-${promo.HoraFin}` : '';
  const [cls, txt] = estado === 'ACTIVA' ? ['on', `🟢 PROMO${hora}`]
    : estado === 'VENCIDA' ? ['vencida', 'Promo vencida']
    : estado === 'FUTURA' ? ['futura', `Promo desde ${fmtFecha(promo.Ini)}`]
    : ['fuera', `🏷️ PROMO${hora}`];   // vigente por fechas pero hoy fuera de su franja horaria
  return <span className={'iv-pr ' + cls}>{txt}</span>;
}

function Desactivar({ p, productos, cerrar, listo }) {
  const hijos = productos.filter((x) => x.Fraccion?.OrigenId === p.Id);
  return (
    <Modal titulo="Desactivar producto" cerrar={cerrar} rojo>
      <p className="iv-hint" style={{ marginTop: 0 }}>¿Desactivar <b>{p.Nombre}</b>?</p>
      <ul className="iv-lis">
        <li>Deja de salir en la mesa, la venta rápida, el Inventario y los Márgenes.</li>
        <li>Las ventas y facturas anteriores no cambian.</li>
        <li>Lo puedes reactivar cuando quieras en <b>Ver desactivados</b>.</li>
      </ul>
      {hijos.length > 0 && <div className="iv-al r">⚠ Es el envase de: <b>{hijos.map((h) => h.Nombre).join(', ')}</b>. Esos productos no podrán abrir envase mientras esté desactivado.</div>}
      {p.StockActual > 0 && <div className="iv-al r">Aún tiene {p.StockActual} en stock.</div>}
      <div className="pn-acc"><button className="no" onClick={cerrar}>Cancelar</button><button className="si" onClick={listo}>Desactivar</button></div>
    </Modal>
  );
}

const ESTADO_TXT = { ACTIVA: 'Activa', FUERA_HORARIO: 'Fuera de horario', VENCIDA: 'Vencida', FUTURA: 'Por iniciar' };
/** Informe imprimible tipo factura (sin colores de relleno). Imprimir → Guardar como PDF. */
function AuditoriaPromos({ productos, categorias, cerrar }) {
  const ahora = new Date();
  const filas = productos.filter((p) => p.Promo).map((p) => ({ p, est: inv.promoEstado(p.Promo, ahora) }))
    .sort((a, b) => a.p.Nombre.localeCompare(b.p.Nombre, 'es'));
  const activas = filas.filter((f) => f.est === 'ACTIVA' || f.est === 'FUERA_HORARIO').length;
  const vencidas = filas.filter((f) => f.est === 'VENCIDA').length;
  return createPortal(
    <div className="pn-velo iv-aud-velo" onClick={(e) => e.target === e.currentTarget && cerrar()}>
      <div className="iv-aud">
        <div className="iv-aud-acc"><button onClick={() => window.print()}>🖨 Imprimir / PDF</button><button onClick={cerrar}>Cerrar</button></div>
        <header><h2>MERO PARCHE</h2><div>Licores &amp; Billar · Medellín</div></header>
        <h3>AUDITORÍA DE PROMOCIONES</h3>
        <div className="iv-aud-meta">Fecha: {ahora.toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' })} · {ahora.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}</div>
        <table>
          <thead><tr><th>Producto</th><th>Categoría</th><th className="r">Precio normal</th><th className="r">Precio promo</th><th className="r">Desc.</th><th>Período</th><th>Horario</th><th>Estado</th></tr></thead>
          <tbody>
            {filas.map(({ p, est }) => (
              <tr key={p.Id}>
                <td>{p.Nombre}</td><td>{categoriaDe(p, categorias).nombre}</td>
                <td className="r">{fmt(p.PrecioVenta)}</td><td className="r">{fmt(p.Promo.Precio)}</td>
                <td className="r">{inv.descuentoPct(p.PrecioVenta, p.Promo.Precio)}%</td>
                <td>{fmtFecha(p.Promo.Ini)} – {fmtFecha(p.Promo.Fin)}</td>
                <td>{p.Promo.HoraIni ? `${p.Promo.HoraIni}–${p.Promo.HoraFin}` : 'Todo el día'}</td>
                <td>{ESTADO_TXT[est]}</td>
              </tr>
            ))}
            {filas.length === 0 && <tr><td colSpan="8" className="c">No hay productos con promoción.</td></tr>}
          </tbody>
        </table>
        <footer>Total con promoción: {filas.length} · Vigentes: {activas} · Vencidas: {vencidas}</footer>
      </div>
    </div>, document.body
  );
}

const isoLocal = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const haceDias = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return isoLocal(d); };
const RANGOS = [['Hoy', 0], ['Últimos 7 días', 7], ['Últimos 15 días', 15], ['Últimos 30 días', 30]];
/** Qué pedir al proveedor según lo vendido. Marcas lo que realmente se repone; el costo editable solo estima el pedido. Hoja blanca; Imprimir → PDF; Tirilla (80 mm) y WhatsApp. */
function ListaReposicion({ productos, categorias, objetivo, recargar, cerrar }) {
  const [pedidos, setPedidos] = useState([]);
  const [desde, setDesde] = useState(haceDias(15));
  const [hasta, setHasta] = useState(haceDias(0));
  const [cambios, setCambios] = useState({});   // Id → cantidad a pedir editada a mano
  const [costos, setCostos] = useState({});     // Id → costo unitario escrito a mano (solo para este pedido)
  const [quitados, setQuitados] = useState({}); // Id → true: desmarcado, no se pide hoy
  const [tirilla, setTirilla] = useState(false);
  const [recibir, setRecibir] = useState(false);
  const [presDe, setPresDe] = useState(null);   // producto al que se le está poniendo la presentación de compra
  useEffect(() => { getAll('PEDIDOS_CUENTAS').then(setPedidos); }, []);
  const filas = useMemo(() => inv.reposicion(productos, pedidos, desde, hasta, categorias).map((f) => {
    const pedir = cambios[f.p.Id] ?? f.pedir;
    const costo = costos[f.p.Id] ?? f.costo;
    return { ...f, pedir, pedirBase: f.pedir, costo, costoBase: f.costo, marcada: pedir > 0 && !quitados[f.p.Id], total: pedir * costo };
  }), [productos, categorias, pedidos, desde, hasta, cambios, costos, quitados]);
  const { lineas, total: inversion } = useMemo(() => inv.armarPedido(filas, quitados), [filas, quitados]);
  const conPedir = filas.filter((f) => f.pedir > 0);
  const gruposConMarcas = new Set(filas.filter((f) => f.marcada).map((f) => f.grupo));
  const todas = conPedir.length > 0 && conPedir.every((f) => f.marcada);
  const marcarTodas = (v) => setQuitados(v ? {} : Object.fromEntries(conPedir.map((f) => [f.p.Id, true])));
  const ahora = new Date();
  const fechaCorta = (i) => fmtFecha(i);
  const fechaLarga = ahora.toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' });
  return createPortal(
    <div className={`pn-velo iv-aud-velo${tirilla ? ' iv-rp-bajo' : ''}`} onClick={(e) => e.target === e.currentTarget && cerrar()}>
      <div className="iv-aud">
        <div className="iv-aud-acc"><button onClick={() => imprimirComo(nombrePdf('Reposición', hoyIso()))}>🖨 Imprimir / PDF</button><button onClick={cerrar}>Cerrar</button></div>
        <div className="iv-rp-filtro">
          <span>Ventas de</span>
          {RANGOS.map(([t, n]) => <button key={n} className={desde === haceDias(n) && hasta === haceDias(0) ? 'on' : ''} onClick={() => { setDesde(haceDias(n)); setHasta(haceDias(0)); }}>{t}</button>)}
          <span>Desde</span><input type="date" value={desde} max={hasta} onChange={(e) => e.target.value && setDesde(e.target.value)} />
          <span>Hasta</span><input type="date" value={hasta} min={desde} onChange={(e) => e.target.value && setHasta(e.target.value)} />
        </div>
        <div className="iv-rp-barra">
          <div>A pedir: <b>{lineas.length}</b> de {conPedir.length} productos · Inversión estimada: <b className="tot">{fmt(inversion)}</b></div>
          <div className="iv-rp-bts"><button disabled={lineas.length === 0} onClick={() => setTirilla(true)}>🧾 Tirilla / WhatsApp</button><button className="rec" disabled={lineas.length === 0} onClick={() => setRecibir(true)}>✓ Recibir pedido</button></div>
        </div>
        <header><h2>MERO PARCHE</h2><div>Licores &amp; Billar · Medellín</div></header>
        <h3>LISTA DE REPOSICIÓN</h3>
        <div className="iv-aud-meta">Ventas del {fechaCorta(desde)} al {fechaCorta(hasta)} · Generada: {fechaLarga} · {ahora.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}</div>
        <table>
          <thead><tr><th className="iv-rp-ck"><input type="checkbox" title="Marcar / desmarcar todo" checked={todas} onChange={(e) => marcarTodas(e.target.checked)} /></th><th>Producto</th><th className="r">Vendido</th><th className="r">Stock</th><th className="r">Mínimo</th><th className="r">Pedir</th><th className="r">Costo unid.</th><th className="r">Costo pedido</th></tr></thead>
          <tbody>
            {filas.map((f, i) => (
              <Fragment key={f.p.Id}>
              {(i === 0 || (f.pedirBase > 0 ? f.grupo !== filas[i - 1].grupo || filas[i - 1].pedirBase === 0 : filas[i - 1].pedirBase > 0)) && (
                <tr className={`iv-rp-grupo${f.pedirBase > 0 && gruposConMarcas.has(f.grupo) ? '' : ' cero'}`}><td colSpan="8">{f.pedirBase > 0 ? f.grupo : 'Sin pedido por ahora'}</td></tr>)}
              <tr className={f.marcada ? '' : 'cero'}>
                <td className="iv-rp-ck">{f.pedir > 0 && <input type="checkbox" checked={f.marcada} onChange={(e) => setQuitados({ ...quitados, [f.p.Id]: !e.target.checked })} />}</td>
                <td>{f.p.Nombre}<button className="iv-rp-pres" title={f.pres ? `Se compra por ${f.pres.nombre.toLowerCase()} de ${f.pres.unidades} (cambiar)` : 'Poner presentación de compra (caja, canasta…)'} onClick={() => setPresDe(f.p)}>📦</button></td><td className="r">{f.vendido}</td>
                <td className="r">{f.stock <= 0 ? 'Sin stock' : f.stock}</td><td className="r">{f.minimo}</td>
                <td className="r">{f.pres
                  ? <><input className="iv-rp-n" inputMode="numeric" value={f.pedir / f.pres.unidades} onChange={(e) => setCambios({ ...cambios, [f.p.Id]: (Number(e.target.value.replace(/\D/g, '')) || 0) * f.pres.unidades })} /><div className="iv-rp-sub">{inv.nombrePresentacion(f.pres, f.pedir / f.pres.unidades)} · {f.pedir} u</div></>
                  : <input className="iv-rp-n" inputMode="numeric" value={f.pedir} onChange={(e) => setCambios({ ...cambios, [f.p.Id]: Number(e.target.value.replace(/\D/g, '')) || 0 })} />}</td>
                <td className="r"><input className={`iv-rp-n iv-rp-c${f.costo !== f.costoBase ? ' ed' : ''}`} inputMode="numeric" title={f.costo !== f.costoBase ? `Costo editado solo para este pedido (en el producto: ${fmt(f.costoBase)})` : 'Costo unitario'} value={Math.round(f.costo)} onChange={(e) => { const v = Number(e.target.value.replace(/\D/g, '')) || 0; setCostos({ ...costos, [f.p.Id]: v }); }} />
                  {f.pres && <div className="iv-rp-sub">{f.pres.nombre.toLowerCase()}: <input className="iv-rp-n iv-rp-c" inputMode="numeric" title={`Costo por ${f.pres.nombre.toLowerCase()} de ${f.pres.unidades}`} value={Math.round(f.costo * f.pres.unidades)} onChange={(e) => { const v = Number(e.target.value.replace(/\D/g, '')) || 0; setCostos({ ...costos, [f.p.Id]: v / f.pres.unidades }); }} /></div>}</td>
                <td className="r">{fmt(f.total)}</td>
              </tr>
              </Fragment>
            ))}
            {filas.length === 0 && <tr><td colSpan="8" className="c">No hay productos.</td></tr>}
          </tbody>
        </table>
        <footer>Productos por pedir: {lineas.length} · Inversión estimada: <b>{fmt(inversion)}</b></footer>
        <p className="iv-rp-nota">Pedir = vendido en el período + stock mínimo − stock actual. Las copas se cuentan en su botella. Los productos que se compran por caja se piden en cajas completas. Marca solo lo que vas a pedir hoy y cambia la cantidad o el costo si hace falta: el costo escrito aquí solo estima este pedido, no cambia el del producto (ese se registra al recibir la mercancía, en Reabastecer).</p>
      </div>
      {presDe && <PresentacionRapida p={presDe} cerrar={() => setPresDe(null)} listo={async () => { setPresDe(null); await recargar(); }} />}
      {recibir && <RecibirPedido lineas={lineas} productos={productos} objetivo={objetivo} cerrar={() => setRecibir(false)} terminado={async () => { setRecibir(false); setCambios({}); setCostos({}); setQuitados({}); await recargar(); }} />}
      {tirilla && <HojaPedido lineas={lineas} total={inversion} texto={inv.textoPedido(lineas, inversion, fechaLarga)} cerrar={() => setTirilla(false)} />}
    </div>, document.body
  );
}

/** Poner o quitar la presentación de compra de un producto sin salir de la lista de reposición. */
function PresentacionRapida({ p, cerrar, listo }) {
  const [nombre, setNombre] = useState(p.Presentacion?.Nombre ?? 'Caja');
  const [unidades, setUnidades] = useState(p.Presentacion?.Unidades ?? 0);
  const guardar = async (pres) => { await put('PRODUCTOS', { ...p, Presentacion: pres }); listo(); };
  return (
    <Modal titulo={`📦 ${p.Nombre}`} cerrar={cerrar}>
      <p className="iv-hint" style={{ marginTop: 0 }}>Se sigue vendiendo y contando por unidad. Esto solo dice cuántas unidades trae lo que le compras al proveedor.</p>
      <label>Se compra por</label>
      <select value={nombre} onChange={(e) => setNombre(e.target.value)}>{PRESENTACIONES.map((n) => <option key={n} value={n}>{n}</option>)}</select>
      <label>Unidades por {nombre.toLowerCase()}</label>
      <input className="iv-in" inputMode="numeric" placeholder="Ej: 30" value={unidades || ''} onChange={(e) => setUnidades(num(e.target.value))} autoFocus />
      <div className="pn-acc"><button className="no" onClick={cerrar}>Cancelar</button>
        {p.Presentacion && <button className="no" onClick={() => guardar(null)}>Quitar</button>}
        <button className="si" disabled={unidades < 2} onClick={() => guardar({ Nombre: nombre, Unidades: unidades })}>✓ Guardar</button></div>
    </Modal>
  );
}

/**
 * Recibir pedido: de lo marcado en la lista, registra lo que de verdad llegó (cantidad y costo) en un solo paso.
 * Suma el stock y deja el costo de cada producto; después muestra los que quedaron con margen bajo para que TÚ decidas el precio.
 */
function RecibirPedido({ lineas, productos, objetivo, cerrar, terminado }) {
  const [paso, setPaso] = useState('revisar');   // revisar → precios (si hay margen bajo) → fin
  const [ent, setEnt] = useState(() => Object.fromEntries(lineas.map((l) => [l.p.Id, { llego: l.cajas ?? l.cant, costo: Math.round(l.pres ? l.costo * l.pres.unidades : l.costo) }])));
  const [ocupado, setOcupado] = useState(false);
  const [extras, setExtras] = useState([]);       // productos que llegaron y no estaban en el pedido
  const [bajos, setBajos] = useState([]);       // { p (ya con el costo nuevo), sugerido, margen }
  const [hechos, setHechos] = useState({});     // Id → 'subido' | 'dejado'
  const [resumen, setResumen] = useState({ n: 0, total: 0 });
  const todas = [...lineas, ...extras];
  const filas = todas.map((l) => { const e = ent[l.p.Id]; return { l, ...e, ...inv.evaluarRecepcion({ p: l.p, llego: e.quitada ? 0 : e.llego, costo: e.costo, objetivo }) }; });
  const aRegistrar = filas.filter((f) => f.valida);
  const falta = filas.some((f) => f.llego > 0 && !f.quitada && f.costo <= 0);
  const total = aRegistrar.reduce((a, f) => a + f.total, 0);
  const poner = (id, k, v) => setEnt({ ...ent, [id]: { ...ent[id], [k]: num(v) } });
  const alternarQuitada = (id) => setEnt({ ...ent, [id]: { ...ent[id], quitada: !ent[id].quitada } });   // "no llegó": no se registra, y se puede deshacer
  const disponibles = productos.filter((x) => x.Activo !== false && x.ControlaStock !== false && !inv.esFraccionado(x) && !todas.some((l) => l.p.Id === x.Id)).sort((a, b) => a.Nombre.localeCompare(b.Nombre, 'es'));
  const agregar = (id) => {
    const x = productos.find((y) => y.Id === id); if (!x) return;
    const pres = inv.presentacionDe(x), costo = x.CostoCompra ?? 0;
    setEnt({ ...ent, [id]: { llego: 0, costo: Math.round(pres ? costo * pres.unidades : costo) } });
    setExtras([...extras, { p: x, pres, cant: 0, cajas: pres ? 0 : null, costo, extra: true }]);
  };

  async function registrar() {
    setOcupado(true);
    const quedaron = [];
    for (const f of aRegistrar) {
      const guardado = await registrarCompra(f.l.p, f.uds, f.costoU);
      if (f.bajo) quedaron.push({ p: guardado, sugerido: f.c.sugerido, margen: f.c.despues.margen });
    }
    setResumen({ n: aRegistrar.length, total });
    setBajos(quedaron); setOcupado(false);
    setPaso(quedaron.length ? 'precios' : 'fin');
  }
  async function subir(b) { await put('PRODUCTOS', { ...b.p, PrecioVenta: b.sugerido }); setHechos((h) => ({ ...h, [b.p.Id]: 'subido' })); }
  const pendientes = bajos.filter((b) => !hechos[b.p.Id]);

  if (paso === 'precios') return (
    <Modal titulo="⚠ Margen bajo con el costo nuevo" cerrar={() => {}} ancho={720} rojo>
      <p className="iv-hint" style={{ marginTop: 0 }}>Compra registrada. Estos productos quedaron por debajo del <b>{objetivo}%</b>. El sistema nunca cambia un precio solo: tú decides.</p>
      <div className="iv-scroll"><table className="iv-t">
        <thead><tr><th>Producto</th><th className="n">Precio</th><th className="n">Margen</th><th className="n">Sugerido</th><th /></tr></thead>
        <tbody>{bajos.map((b) => (
          <tr key={b.p.Id}><td>{b.p.Nombre}</td><td className="n">{fmt(hechos[b.p.Id] === 'subido' ? b.sugerido : b.p.PrecioVenta)}</td>
            <td className="n"><span className="iv-m bajo">{Math.round(inv.margenPct(hechos[b.p.Id] === 'subido' ? b.sugerido : b.p.PrecioVenta, b.p.CostoCompra))}%</span></td>
            <td className="n">{fmt(b.sugerido)}</td>
            <td>{hechos[b.p.Id] ? <span className="mut">{hechos[b.p.Id] === 'subido' ? '✓ subido' : 'se deja'}</span>
              : <div className="iv-acc"><button onClick={() => subir(b)}>⬆ Subir</button><button onClick={() => setHechos((h) => ({ ...h, [b.p.Id]: 'dejado' }))}>Dejar</button></div>}</td></tr>))}
        </tbody></table></div>
      <div className="pn-acc">
        {pendientes.length > 0 && <button className="no" onClick={async () => { for (const b of pendientes) await subir(b); }}>⬆ Subir todos al sugerido</button>}
        <button className="si" onClick={() => setPaso('fin')}>{pendientes.length ? 'Seguir sin cambiar' : 'Listo'}</button></div>
    </Modal>
  );
  if (paso === 'fin') return (
    <Modal titulo="✓ Pedido recibido" cerrar={terminado}>
      <p className="iv-hint" style={{ marginTop: 0 }}>Se registró la compra de <b>{resumen.n}</b> producto{resumen.n === 1 ? '' : 's'} por <b className="oro">{fmt(resumen.total)}</b>. El stock y el costo ya quedaron al día.</p>
      <div className="pn-acc"><button className="si" onClick={terminado}>Cerrar</button></div>
    </Modal>
  );
  return (
    <Modal titulo="✓ Recibir pedido" cerrar={cerrar} ancho={760}>
      <p className="iv-hint" style={{ marginTop: 0 }}>Escribe lo que <b>de verdad llegó</b> y lo que costó. Si algo <b>no llegó</b>, pulsa ✕ (o déjalo en 0): no se registra y sigue en la lista para el próximo pedido. Al confirmar, el stock y el costo de cada producto se actualizan.</p>
      <div className="iv-scroll"><table className="iv-t">
        <thead><tr><th>Producto</th><th className="n">Pedido</th><th className="n">Llegó</th><th className="n">Costo</th><th className="n">Margen</th><th /></tr></thead>
        <tbody>{filas.map((f) => (
          <tr key={f.l.p.Id} className={f.quitada ? 'no' : ''}><td>{f.l.p.Nombre}{f.l.extra && <span className="iv-env">no pedido</span>}</td>
            <td className="n">{f.l.extra ? '—' : f.pres ? `${f.l.cajas} ${inv.nombrePresentacion(f.pres, f.l.cajas)}` : f.l.cant}</td>
            <td className="n"><input className="iv-rc-in" inputMode="numeric" value={f.llego || ''} placeholder="0" onChange={(e) => poner(f.l.p.Id, 'llego', e.target.value)} />{f.pres && <small className="mut"> {f.uds} u</small>}</td>
            <td className="n"><input className="iv-rc-in" inputMode="numeric" value={f.costo || ''} placeholder="0" title={f.pres ? `Costo por ${f.pres.nombre.toLowerCase()}` : 'Costo por unidad'} onChange={(e) => poner(f.l.p.Id, 'costo', e.target.value)} />{f.pres && <small className="mut"> {fmt(f.costoU)} c/u</small>}</td>
            <td className="n">{f.c && !f.quitada ? <span className={`iv-m ${f.bajo ? 'bajo' : 'ok'}`}>{Math.round(f.c.despues.margen)}%</span> : '—'}</td>
            <td><button className="iv-rc-x" title={f.quitada ? 'Volver a incluirlo' : 'No llegó: no se registra'} onClick={() => alternarQuitada(f.l.p.Id)}>{f.quitada ? '↺' : '✕'}</button></td></tr>))}
        </tbody></table></div>
      <select value="" onChange={(e) => agregar(e.target.value)} style={{ marginTop: 10 }}><option value="">+ Agregar un producto que llegó y no estaba en el pedido</option>{disponibles.map((x) => <option key={x.Id} value={x.Id}>{x.Nombre}</option>)}</select>
      {falta && <div className="iv-al r">⚠ Falta el costo de algún producto que llegó.</div>}
      <div className="pn-acc"><span className="iv-rc-tot">Total: <b className="oro">{fmt(total)}</b></span>
        <button className="no" onClick={cerrar}>Cancelar</button>
        <button className="si" disabled={ocupado || aRegistrar.length === 0 || falta} onClick={registrar}>{ocupado ? 'Registrando…' : `✓ Registrar ${aRegistrar.length} producto${aRegistrar.length === 1 ? '' : 's'}`}</button></div>
    </Modal>
  );
}
