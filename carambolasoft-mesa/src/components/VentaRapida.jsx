// src/components/VentaRapida.jsx — Venta rápida: pide y paga en un solo paso, sin abrir mesa ni cuenta abierta.
// El carrito vive en memoria; al cobrar se escribe cuenta VENTA_RAPIDA (liquidada) + pedidos + factura + stock.
import { precioVigente, disponible } from '../cuenta/inventario.js';
import { descontarStock } from '../cuenta/inventarioDb.js';
import { useState, useEffect, useMemo } from 'react';
import { put, getAll } from '../db/repository.js';
import SelectorCliente, { sumarVisita } from './SelectorCliente.jsx';
import { categoriaDe, categoriasVisibles, filtrar, masVendidos, loDeSiempre } from '../cuenta/catalogo.js';
import { METODOS, planCobro } from '../cuenta/cobro.js';
import { datosFactura } from '../cuenta/fiadosDb.js';
import { useSesion } from './Sesion.jsx';
import { PRODUCTO_LIBRE_ID } from '../cuenta/garita.js';

const fmt = (n) => '$' + Math.round(n).toLocaleString('es-CO');
const soloDigitos = (v) => Number(String(v).replace(/\D/g, '')) || 0;
const SIN_FIADO = METODOS.filter((m) => m.v !== 'FIADO');
const OCULTOS = /garita|venta libre/i;

export default function VentaRapida({ cerrar, alCobrar }) {
  const [productos, setProductos] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [pedidos, setPedidos] = useState([]);
  const [filtro, setFiltro] = useState('todos');
  const [q, setQ] = useState('');
  const [carro, setCarro] = useState([]);       // { key, prod|null, nombre, precio, cant }
  const [metodo, setMetodo] = useState('EFECTIVO');
  const [pago, setPago] = useState(0);
  const [libre, setLibre] = useState(null);     // { nombre, precio } — formulario "+ Libre"
  const [cliente, setCliente] = useState(null);   // opcional: da historial (Lo de siempre) y ⭐ visitas
  const [elegir, setElegir] = useState(null);     // { sel, creando, error }
  const [cuentas, setCuentas] = useState([]);
  const { usuario } = useSesion();
  const [aviso, setAviso] = useState('');

  useEffect(() => { (async () => {
    setProductos((await getAll('PRODUCTOS')).filter((p) => p.Activo !== false));
    setCategorias(await getAll('CATEGORIAS'));
    setPedidos(await getAll('PEDIDOS_CUENTAS'));
    setCuentas(await getAll('CUENTAS'));
  })(); }, []);

  const total = carro.reduce((t, l) => t + l.precio * l.cant, 0);
  const items = carro.reduce((t, l) => t + l.cant, 0);
  const claves = categoriasVisibles(productos, categorias);
  const visibles = productos.filter((p) => !OCULTOS.test(p.Nombre));

  let lista = visibles;
  if (filtro === 'vendidos') lista = masVendidos(pedidos).map((id) => visibles.find((p) => p.Id === id)).filter(Boolean);
  else if (filtro === 'siempre') lista = loDeSiempre(pedidos, cuentas, cliente?.Id, null).map((id) => visibles.find((p) => p.Id === id)).filter(Boolean);
  else if (filtro === 'fav') lista = visibles.filter((p) => p.Favorito);
  else if (filtro !== 'todos') lista = visibles.filter((p) => categoriaDe(p, categorias).clave === filtro);
  lista = filtrar(lista, q);

  const disponibleDe = (p) => disponible(p, productos.find((x) => x.Id === p.Fraccion?.OrigenId));
  const enCarro = (p) => carro.find((l) => l.prod?.Id === p.Id)?.cant ?? 0;
  const decir = (t) => { setAviso(t); setTimeout(() => setAviso(''), 2500); };

  function agregar(p) {
    if (p.ControlaStock !== false && enCarro(p) >= disponibleDe(p)) { decir(`Sin stock: ${p.Nombre}`); return; }
    setCarro((c) => c.some((l) => l.prod?.Id === p.Id)
      ? c.map((l) => (l.prod?.Id === p.Id ? { ...l, cant: l.cant + 1 } : l))
      : [...c, { key: p.Id, prod: p, nombre: p.Nombre, precio: precioVigente(p), cant: 1 }]);
  }
  const cambiar = (key, d) => setCarro((c) => c.flatMap((l) => {
    if (l.key !== key) return [l];
    if (d > 0 && l.prod && l.prod.ControlaStock !== false && l.cant >= disponibleDe(l.prod)) return [l];
    return l.cant + d <= 0 ? [] : [{ ...l, cant: l.cant + d }];
  }));
  function agregarLibre() {
    const precio = soloDigitos(libre.precio);
    if (!libre.nombre.trim() || !(precio > 0)) { decir('Escribe nombre y precio.'); return; }
    setCarro((c) => [...c, { key: crypto.randomUUID(), prod: null, nombre: libre.nombre.trim(), precio, cant: 1 }]);
    setLibre(null);
  }

  const plan = useMemo(() => planCobro({ total, mixto: false, metodo, pago, tieneCliente: false }), [total, metodo, pago]);
  const devolver = metodo === 'EFECTIVO' && pago >= total && total > 0 ? pago - total : null;

  async function cobrar() {
    if (!carro.length) { decir('El pedido está vacío.'); return; }
    if (plan.error) { decir(plan.error); return; }
    const ahora = new Date().toISOString();
    const cuenta = await put('CUENTAS', {
      TipoCuenta: 'VENTA_RAPIDA', MesaId: null, GrupoMesaId: null, ClienteId: cliente?.Id ?? null, NombreLibre: cliente ? (cliente.Apodo || cliente.Nombre) : 'Venta rápida',
      HoraApertura: ahora, HoraCierre: ahora, TarifaPorHora: null, Estado: 'LIQUIDADA',
    });
    const suma = (f) => carro.filter(f).reduce((t, l) => t + l.precio * l.cant, 0);
    const cat = (l) => l.prod?.CategoriaConsumo ?? 'OTROS';
    for (const l of carro) {
      await put('PEDIDOS_CUENTAS', {
        CuentaId: cuenta.Id, ProductoId: l.prod?.Id ?? PRODUCTO_LIBRE_ID, Cantidad: l.cant,
        PrecioUnitarioHist: l.precio, CostoCompraHist: l.prod?.CostoCompra ?? 0, CategoriaConsumo: cat(l),
        EstadoPedido: 'ENTREGADO', FechaHora: ahora, ...(l.prod ? {} : { Detalle: l.nombre }),
      });
      if (l.prod && l.prod.ControlaStock !== false) await descontarStock(l.prod, l.cant);
    }
    await put('FACTURAS', {
      ...(await datosFactura()), CuentaId: cuenta.Id, TurnoCajaId: null, SubtotalTiempo: 0,
      SubtotalLicor: suma((l) => cat(l) === 'BEBIDAS_ALCOHOLICAS'), SubtotalSnacks: suma((l) => cat(l) === 'SNACKS'),
      SubtotalOtros: suma((l) => !['BEBIDAS_ALCOHOLICAS', 'SNACKS'].includes(cat(l))),
      TotalPagar: total, TotalPendienteFiado: 0, UsuarioId: usuario?.Id ?? null, MetodoPago: plan.met1, MetodoPagoSecundario: null,
      MontoPrimario: null, MontoSecundario: null, EstadoPago: 'PAGADO',
    });
    await sumarVisita(cliente);
    alCobrar?.(total);
  }

  return (
    <div className="pn-velo" onClick={(e) => e.target === e.currentTarget && cerrar()}>
      <div className="pn-modal vr">
        <h3>⚡ Venta rápida
          <span className="vr-cli">
            {cliente ? <>👤 {cliente.Apodo || cliente.Nombre} · ⭐ {cliente.Visitas ?? 0} <button onClick={() => { setCliente(null); if (filtro === 'siempre') setFiltro('todos'); }}>✕</button></>
              : <button onClick={() => setElegir({ sel: { cliente: null, nombre: '' }, creando: false, error: '' })}>+ Cliente</button>}
          </span>
        </h3>
        <div className="vr-grid">
          <div>
            <div className="vr-busca">
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="🔍 Buscar o escribir + Enter…"
                onKeyDown={(e) => { if (e.key === 'Enter' && lista[0]) { agregar(lista[0]); setQ(''); } }} />
              <button onClick={() => setLibre({ nombre: '', precio: '' })}>➕ Libre</button>
            </div>
            <div className="ms-chips">
              <button className={filtro === 'todos' ? 'on' : ''} onClick={() => setFiltro('todos')}>Todos</button>
              <button className={`sp ${filtro === 'vendidos' ? 'on' : ''}`} onClick={() => setFiltro('vendidos')}>⭐ Más vendidos</button>
              <button className={filtro === 'fav' ? 'on' : ''} onClick={() => setFiltro('fav')}>❤️ Favoritos</button>
              <button className={`ls ${filtro === 'siempre' ? 'on' : ''}`} onClick={() => setFiltro('siempre')}>🔄 Lo de siempre</button>
              {claves.map((c) => <button key={c.clave} className={filtro === c.clave ? 'on' : ''} onClick={() => setFiltro(c.clave)}>{c.nombre}</button>)}
            </div>
            <div className="ms-prods vr-prods">
              {lista.length === 0 && <div className="ms-vacio">{filtro === 'siempre' ? (cliente ? 'Este cliente aún no tiene historial.' : 'Elige un cliente (+ Cliente) para ver lo de siempre.') : 'Sin productos.'}</div>}
              {lista.map((p) => {
                const cat = categoriaDe(p, categorias); const n = enCarro(p); const out = p.ControlaStock !== false && disponibleDe(p) <= 0;
                return (
                  <div key={p.Id} className={`ms-p ${out ? 'out' : ''}`} style={{ '--c': cat.color }} role="button" onClick={() => !out && agregar(p)}>
                    <span className="e">{cat.emoji}</span>
                    <div className="t"><b>{p.Nombre}</b><i>{fmt(precioVigente(p))}</i>{out && <span className="st lo">Agotado</span>}</div>
                    {n > 0 && <span className="q vrq">{n}</span>}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="vr-der">
            <div className="ms-lab vrl">🛒 Pedido · {items} {items === 1 ? 'ítem' : 'ítems'}</div>
            {carro.length === 0 && <div className="ms-vacio">Toca productos para armar el pedido.</div>}
            {carro.map((l) => (
              <div key={l.key} className="ms-ped vrp">
                <b>{l.nombre}</b>
                <div className="s"><button onClick={() => cambiar(l.key, -1)}>−</button>{l.cant}<button onClick={() => cambiar(l.key, 1)}>+</button></div>
                <span className="m">{fmt(l.precio * l.cant)}</span>
              </div>
            ))}
            <div className="cb-lab">Método de pago</div>
            <div className="cb-met">
              {SIN_FIADO.map((m) => <button key={m.v} className={metodo === m.v ? 'on' : ''} onClick={() => setMetodo(m.v)}>{m.t}</button>)}
            </div>
            {metodo === 'EFECTIVO' && (
              <div className="cb-fila" style={{ marginTop: 10 }}>
                <div className="p"><small>PAGO</small>
                  <input inputMode="numeric" placeholder="$ —" value={pago ? fmt(pago) : ''} onChange={(e) => setPago(soloDigitos(e.target.value))} /></div>
                <div className="d"><small>DEVOLVER</small>
                  <div className="n">{devolver !== null ? fmt(devolver) : pago > 0 ? 'Falta ' + fmt(total - pago) : '—'}</div></div>
              </div>
            )}
            <div className="vr-tot"><small>TOTAL</small><b>{fmt(total)}</b></div>
            <div className="vr-nota">Para fiar, abre una mesa con cliente registrado.</div>
            <div className="pn-acc">
              <button className="no" onClick={cerrar}>CANCELAR</button>
              <button className="si" disabled={!carro.length} onClick={cobrar}>✓ COBRAR Y REGISTRAR</button>
            </div>
          </div>
        </div>
      </div>

      {elegir && (
        <div className="pn-velo alto" onClick={(e) => e.target === e.currentTarget && setElegir(null)}>
          <div className="pn-modal">
            <h3>Cliente de la venta</h3>
            <SelectorCliente soloCliente valor={elegir.sel} onChange={(sel) => setElegir((v) => ({ ...v, sel }))}
              onModoNuevo={(creando) => setElegir((v) => ({ ...v, creando }))}
              error={elegir.error} setError={(error) => setElegir((v) => ({ ...v, error }))} />
            {!elegir.creando && elegir.error && <div className="pn-err">{elegir.error}</div>}
            {!elegir.creando && <div className="pn-acc">
              <button className="no" onClick={() => setElegir(null)}>CANCELAR</button>
              <button className="si" onClick={() => elegir.sel.cliente ? (setCliente(elegir.sel.cliente), setElegir(null)) : setElegir({ ...elegir, error: 'Elige un cliente o crea uno nuevo.' })}>ELEGIR</button>
            </div>}
          </div>
        </div>
      )}

      {libre && (
        <div className="pn-velo alto" onClick={(e) => e.target === e.currentTarget && setLibre(null)}>
          <div className="pn-modal vr-libre">
            <h3>➕ Ítem libre</h3>
            <label>Descripción</label>
            <input autoFocus value={libre.nombre} onChange={(e) => setLibre({ ...libre, nombre: e.target.value })} placeholder="Ej: Hielo, vaso…" />
            <label>Precio</label>
            <input inputMode="numeric" value={libre.precio ? fmt(soloDigitos(libre.precio)) : ''} onChange={(e) => setLibre({ ...libre, precio: e.target.value })} placeholder="$ —" />
            <div className="pn-acc"><button className="no" onClick={() => setLibre(null)}>CANCELAR</button><button className="si" onClick={agregarLibre}>AGREGAR</button></div>
          </div>
        </div>
      )}
      {aviso && <div className="ms-aviso">{aviso}</div>}
    </div>
  );
}
