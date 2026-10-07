// src/screens/DetalleCuenta.jsx
// Mesa y cuenta — réplica mejorada del POS v6.28: cuentas de la mesa, catálogo por categoría (emoji + color),
// comanda con hora y −/+, resumen por categoría, taxímetro por chico en billar. El cobro (modal) se rediseña en su fase.
import { useState, useEffect, useCallback, useRef } from 'react';
import { put, get, getAll, porIndice } from '../db/repository.js';
import LogoBola9 from '../components/LogoBola9.jsx';
import SelectorCliente, { etiquetaDe, sumarVisita } from '../components/SelectorCliente.jsx';
import { categoriaDe, categoriasVisibles, filtrar, masVendidos, loDeSiempre, resumenPorCategoria, colorTiempo } from '../cuenta/catalogo.js';
import { cobroTiempo, msJugados, msChicoActual, estaCorriendo, iniciarChico, terminarChico, hms } from '../cuenta/tiempo.js';
import './Panel.css';
import './Mesa.css';

const METODOS = ['EFECTIVO', 'NEQUI', 'DAVIPLATA', 'TARJETA', 'TRANSFERENCIA', 'FIADO'];
const fmt = (n) => '$' + Math.round(n).toLocaleString('es-CO');
const horaDe = (iso) => (iso ? new Date(iso).toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' }) : '');
const grupoDe = (c) => c.MesaId ?? c.GrupoMesaId ?? c.Id;

export default function DetalleCuenta({ cuentaId, volver }) {
  const [activaId, setActivaId] = useState(cuentaId);
  const [grupo, setGrupo] = useState([]);
  const [todasCuentas, setTodasCuentas] = useState([]);
  const [pedidos, setPedidos] = useState([]);
  const [productos, setProductos] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [cliente, setCliente] = useState(null);
  const [deuda, setDeuda] = useState(0);
  const [filtro, setFiltro] = useState('todos');
  const [q, setQ] = useState('');
  const [cobro, setCobro] = useState(null);
  const [nueva, setNueva] = useState(null);   // { sel, creando, error }
  const [aviso, setAviso] = useState('');
  const [ahora, setAhora] = useState(Date.now());
  const avisoT = useRef(null);

  const decir = (t) => { setAviso(t); clearTimeout(avisoT.current); avisoT.current = setTimeout(() => setAviso(''), 2800); };

  const cargar = useCallback(async () => {
    const base = await get('CUENTAS', cuentaId);
    const abiertas = await porIndice('CUENTAS', 'porEstado', 'ABIERTA');
    const todas = await getAll('CUENTAS');
    setTodasCuentas(todas);
    setGrupo(base ? abiertas.filter((c) => grupoDe(c) === grupoDe(base)) : []);
    setPedidos(await getAll('PEDIDOS_CUENTAS'));
    setProductos((await getAll('PRODUCTOS')).filter((p) => p.Activo !== false));
    setCategorias(await getAll('CATEGORIAS'));
  }, [cuentaId]);

  useEffect(() => { cargar(); }, [cargar]);
  useEffect(() => { const t = setInterval(() => setAhora(Date.now()), 1000); return () => clearInterval(t); }, []);

  const cuenta = grupo.find((c) => c.Id === activaId) ?? grupo[0];

  // Cliente de la cuenta activa (apodo, ⭐) y lo que debe en fiado
  useEffect(() => {
    let vivo = true;
    (async () => {
      if (!cuenta?.ClienteId) { setCliente(null); setDeuda(0); return; }
      const cli = await get('CLIENTES', cuenta.ClienteId);
      const suyas = new Set(todasCuentas.filter((c) => c.ClienteId === cuenta.ClienteId).map((c) => c.Id));
      const d = (await getAll('FACTURAS')).filter((f) => suyas.has(f.CuentaId)).reduce((t, f) => t + (f.TotalPendienteFiado ?? 0), 0);
      if (vivo) { setCliente(cli ?? null); setDeuda(d); }
    })();
    return () => { vivo = false; };
  }, [cuenta?.Id, cuenta?.ClienteId, todasCuentas]);

  if (!cuenta) return null;

  const entregadosDe = (c) => pedidos.filter((p) => p.CuentaId === c.Id && p.EstadoPedido === 'ENTREGADO');
  const consumoDe = (c) => entregadosDe(c).reduce((t, p) => t + p.PrecioUnitarioHist * p.Cantidad, 0);
  const totalDe = (c) => consumoDe(c) + cobroTiempo(c, ahora);

  const entregados = entregadosDe(cuenta);
  const subTiempo = cobroTiempo(cuenta, ahora);
  const total = subTiempo + consumoDe(cuenta);
  const totalMesa = grupo.reduce((t, c) => t + totalDe(c), 0);
  const esBillar = cuenta.TipoCuenta === 'BILLAR';
  const resumen = resumenPorCategoria(entregados, productos, categorias);

  // ── Catálogo
  const cantidadEn = (id) => entregados.filter((p) => p.ProductoId === id).reduce((t, p) => t + p.Cantidad, 0);
  const idsVendidos = masVendidos(pedidos);
  const idsSiempre = loDeSiempre(pedidos, todasCuentas, cuenta.ClienteId, cuenta.Id);
  const claves = categoriasVisibles(productos, categorias); // las del POS siempre, aunque aún no tengan productos

  let lista = productos;
  if (filtro === 'vendidos') lista = idsVendidos.map((id) => productos.find((p) => p.Id === id)).filter(Boolean);
  else if (filtro === 'siempre') lista = idsSiempre.map((id) => productos.find((p) => p.Id === id)).filter(Boolean);
  else if (filtro === 'fav') lista = productos.filter((p) => p.Favorito);
  else if (filtro !== 'todos') lista = productos.filter((p) => categoriaDe(p, categorias).clave === filtro);
  lista = filtrar(lista, q);

  // ── Pedidos (espejo local del trigger: el stock baja al entregar)
  async function agregar(prod) {
    if ((prod.StockActual ?? 0) <= 0) { decir(`Sin stock: ${prod.Nombre}`); return; }
    const existente = entregados.find((p) => p.ProductoId === prod.Id);
    if (existente) {
      await put('PEDIDOS_CUENTAS', { ...existente, Cantidad: existente.Cantidad + 1 });
    } else {
      await put('PEDIDOS_CUENTAS', {
        CuentaId: cuenta.Id, ProductoId: prod.Id, Cantidad: 1,
        PrecioUnitarioHist: prod.PrecioVenta,        // precio congelado al pedir
        CostoCompraHist: prod.CostoCompra ?? 0,      // P&L histórico real
        CategoriaConsumo: prod.CategoriaConsumo ?? 'OTROS',
        EstadoPedido: 'ENTREGADO', FechaHora: new Date().toISOString(),
      });
    }
    await put('PRODUCTOS', { ...prod, StockActual: prod.StockActual - 1 });
    await cargar();
  }

  // Quitar una unidad: a 0 queda CANCELADO (nunca borrado) y el stock vuelve
  async function quitar(pedido) {
    const prod = productos.find((p) => p.Id === pedido.ProductoId);
    await put('PEDIDOS_CUENTAS', pedido.Cantidad > 1
      ? { ...pedido, Cantidad: pedido.Cantidad - 1 }
      : { ...pedido, EstadoPedido: 'CANCELADO' });
    if (prod) await put('PRODUCTOS', { ...prod, StockActual: prod.StockActual + 1 });
    await cargar();
  }

  async function favorito(prod) {
    await put('PRODUCTOS', { ...prod, Favorito: !prod.Favorito });
    decir(prod.Favorito ? `Quitado de favoritos: ${prod.Nombre}` : `En favoritos: ${prod.Nombre}`);
    await cargar();
  }

  // ── Taxímetro por chico
  async function cambiarChico() {
    await put('CUENTAS', estaCorriendo(cuenta) ? terminarChico(cuenta) : iniciarChico(cuenta));
    await cargar();
  }

  // ── Cuentas de la mesa
  async function crearCuenta() {
    const { sel } = nueva;
    const etiqueta = etiquetaDe(sel);
    if (!etiqueta) { setNueva({ ...nueva, error: 'Elige un cliente o escribe un nombre.' }); return; }
    const c = await put('CUENTAS', {
      TipoCuenta: cuenta.TipoCuenta, MesaId: cuenta.MesaId ?? null, GrupoMesaId: cuenta.MesaId ? null : grupoDe(cuenta), // las cuentas viejas sin grupo usan su propio Id
      ClienteId: sel.cliente?.Id ?? null, NombreLibre: etiqueta,
      HoraApertura: new Date().toISOString(), HoraCierre: null, TarifaPorHora: null, Estado: 'ABIERTA',
    });
    await sumarVisita(sel.cliente);
    setNueva(null); setActivaId(c.Id); await cargar();
  }

  async function cerrarMesa() {
    const conConsumo = grupo.filter((c) => totalDe(c) > 0);
    if (conConsumo.length) { decir(`Falta cobrar: ${conConsumo.map((c) => c.NombreLibre).join(', ')}`); return; }
    for (const c of grupo) await put('CUENTAS', { ...c, Estado: 'CANCELADA', HoraCierre: new Date().toISOString() });
    if (cuenta.MesaId) {
      const mesa = await get('MESAS_BILLAR', cuenta.MesaId);
      if (mesa) await put('MESAS_BILLAR', { ...mesa, Estado: 'DISPONIBLE' });
    }
    volver();
  }

  // ── Cobro (espejo de confirmCobro del POS; el modal se rediseña en la fase "Cobrar")
  async function confirmarCobro() {
    const { metodo, metodo2, mixto, monto1, pago } = cobro;
    if (mixto && (!monto1 || monto1 <= 0)) { decir('Ingresa el monto del método 1'); return; }
    if (mixto && monto1 > total) { decir('El monto 1 supera el total'); return; }
    const met1 = mixto ? cobro.metodo1 : metodo;
    const met2 = mixto ? metodo2 : null;
    const m1 = mixto ? monto1 : total;
    const m2 = mixto ? total - monto1 : 0;
    if (pago > 0 && pago < total && met1 !== 'FIADO' && !mixto) { decir(`Pago insuficiente: faltan ${fmt(total - pago)}`); return; }
    if ((met1 === 'FIADO' || met2 === 'FIADO') && !cuenta.ClienteId) { decir('El fiado necesita cliente registrado'); return; }

    const pendienteFiado = met1 === 'FIADO' ? m1 : met2 === 'FIADO' ? m2 : 0;
    const suma = (f) => entregados.filter(f).reduce((t, p) => t + p.PrecioUnitarioHist * p.Cantidad, 0);
    await put('FACTURAS', {
      CuentaId: cuenta.Id, TurnoCajaId: cuenta.TurnoCajaId ?? null, SubtotalTiempo: subTiempo,
      SubtotalLicor: suma((p) => p.CategoriaConsumo === 'BEBIDAS_ALCOHOLICAS'),
      SubtotalSnacks: suma((p) => p.CategoriaConsumo === 'SNACKS'),
      SubtotalOtros: suma((p) => !['BEBIDAS_ALCOHOLICAS', 'SNACKS', 'TIEMPO'].includes(p.CategoriaConsumo)),
      TotalPagar: total, TotalPendienteFiado: pendienteFiado,
      MetodoPago: met1, MetodoPagoSecundario: met2,
      MontoPrimario: mixto ? m1 : null, MontoSecundario: mixto ? m2 : null,
      EstadoPago: pendienteFiado > 0 ? 'FIADO' : 'PAGADO',
    });
    // Al cobrar, un chico en curso se termina
    await put('CUENTAS', { ...terminarChico(cuenta), Estado: 'LIQUIDADA', HoraCierre: new Date().toISOString() });
    if (cuenta.MesaId) {
      const mesa = await get('MESAS_BILLAR', cuenta.MesaId);
      if (mesa) await put('MESAS_BILLAR', { ...mesa, Estado: 'DISPONIBLE' });
    }
    setCobro(null);
    const quedan = grupo.filter((c) => c.Id !== cuenta.Id);
    if (quedan.length === 0) { volver(); return; }
    setActivaId(quedan[0].Id); decir('Cobrado ✓'); await cargar();
  }

  const devuelta = cobro && cobro.pago >= total ? cobro.pago - total : null;
  const ordenados = [...entregados].sort((a, b) => (b.FechaHora ?? '').localeCompare(a.FechaHora ?? ''));
  const dueno = grupo[0]?.NombreLibre ?? cuenta.NombreLibre; // la mesa lleva el nombre de su primera cuenta
  const titulo = esBillar ? `Billar · ${dueno}` : `${dueno} · Licores`;

  return (
    <div className="pn ms">
      <header className="pn-top">
        <LogoBola9 size={46} />
        <div>
          <div className="pn-t1">Mero Parche</div>
          <div className="pn-t2">Licores &amp; Billar · Sistema de Ventas</div>
        </div>
      </header>

      <div className="ms-sub">
        <button className="ms-volver" onClick={volver}>← Volver</button>
        <h2>{titulo}</h2><span>· {grupo.length} {grupo.length === 1 ? 'cuenta' : 'cuentas'}</span>
      </div>

      <div className="ms-grid">
        <section className="ms-card">
          <div className="ms-lab">Cuentas</div>
          <div className="ms-tabs">
            {grupo.map((c) => {
              const n = entregadosDe(c).reduce((t, p) => t + p.Cantidad, 0);
              return (
                <button key={c.Id} className={`ms-tab ${c.Id === cuenta.Id ? 'on' : ''}`} onClick={() => setActivaId(c.Id)}>
                  <b>👤 {c.NombreLibre}</b><small>{n} prod.</small><em>{fmt(totalDe(c))}</em>
                </button>
              );
            })}
            <button className="ms-tab nueva" onClick={() => setNueva({ sel: { cliente: null, nombre: '' }, creando: false, error: '' })}>＋ Nueva cuenta</button>
          </div>

          {esBillar && cuenta.TarifaPorHora > 0 && (
            <div className={`ms-bil ${estaCorriendo(cuenta) ? 'run' : ''}`}>
              <div>
                <div className="ms-lab verde">🎱 Taxímetro · {fmt(cuenta.TarifaPorHora)}/h</div>
                <div className="ms-cr">{hms(msChicoActual(cuenta, ahora))}</div>
                <small>{estaCorriendo(cuenta) ? 'chico en juego' : 'chico detenido'}</small>
              </div>
              <div className="ms-acum">
                <small>Tiempo acumulado · {hms(msJugados(cuenta, ahora))}</small>
                <strong>{fmt(subTiempo)}</strong>
              </div>
              <button className={estaCorriendo(cuenta) ? 'fin' : 'ini'} onClick={cambiarChico}>
                {estaCorriendo(cuenta) ? '■ Terminar chico' : '▶ Iniciar'}
              </button>
            </div>
          )}

          <div className="ms-busca">
            <input value={q} onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && lista[0]) { agregar(lista[0]); setQ(''); } }}
              placeholder="🔍 Buscar o escribir + Enter para agregar…" />
            {q && <span onClick={() => setQ('')}>✕</span>}
          </div>

          <div className="ms-chips">
            <button className={filtro === 'todos' ? 'on' : ''} onClick={() => setFiltro('todos')}>Todos</button>
            <button className={`sp ${filtro === 'vendidos' ? 'on' : ''}`} onClick={() => setFiltro('vendidos')}>⭐ Más vendidos</button>
            <button className={filtro === 'fav' ? 'on' : ''} onClick={() => setFiltro('fav')}>❤️ Favoritos</button>
            <button className={`ls ${filtro === 'siempre' ? 'on' : ''}`} onClick={() => setFiltro('siempre')}>🔄 Lo de siempre</button>
            {claves.map((c) => (
              <button key={c.clave} className={filtro === c.clave ? 'on' : ''} onClick={() => setFiltro(c.clave)}>{c.nombre}</button>
            ))}
          </div>

          <div className="ms-prods">
            {lista.length === 0 && <div className="ms-vacio">
              {filtro === 'fav' ? 'Toca el ♥ de un producto para dejarlo aquí.' : filtro === 'siempre' ? (cuenta.ClienteId ? 'Este cliente aún no tiene historial.' : 'Esta cuenta no tiene cliente registrado.') : 'Sin productos.'}
            </div>}
            {lista.map((p) => {
              const cat = categoriaDe(p, categorias);
              const stock = p.StockActual ?? 0;
              const cant = cantidadEn(p.Id);
              return (
                <div key={p.Id} className={`ms-p ${stock <= 0 ? 'out' : ''}`} style={{ '--c': cat.color }}
                  onClick={() => agregar(p)} role="button">
                  <span className="e">{cat.emoji}</span>
                  <div className="t"><b>{p.Nombre}</b>
                    <i>{fmt(p.PrecioVenta)}</i>
                    <span className={`st ${stock <= 3 ? 'lo' : ''}`}>{stock <= 0 ? 'Agotado' : stock <= 3 ? `⚠ ${stock}` : stock}</span>
                  </div>
                  <span className={`h ${p.Favorito ? 'on' : ''}`} onClick={(e) => { e.stopPropagation(); favorito(p); }}>♥</span>
                  {cant > 0 && <span className="q">{cant}</span>}
                </div>
              );
            })}
          </div>
        </section>

        <aside className="ms-card">
          <div className="ms-tm">
            <div><small>TOTAL MESA</small><div className="v">{fmt(totalMesa)}</div></div>
            <button className="ms-oro" onClick={cerrarMesa}>Cerrar mesa</button>
          </div>
          <div className="ms-nom">{cuenta.NombreLibre}</div>
          <div className="ms-ap">
            {cliente?.Apodo && cliente.Apodo !== cuenta.NombreLibre && <>“{cliente.Apodo}” · </>}
            {cliente ? <>⭐ {cliente.Visitas ?? 0} visitas</> : <span className="rojo">Sin cliente registrado</span>}
            {deuda > 0 && <> · <span className="rojo">Fía {fmt(deuda)}</span></>}
          </div>

          <div className="ms-res">
            <div className="ms-lab chico">Resumen por categoría</div>
            {esBillar && cuenta.TarifaPorHora > 0 && <div><span style={{ color: colorTiempo }}>🎱 Tiempo de mesa</span><b style={{ color: colorTiempo }}>{fmt(subTiempo)}</b></div>}
            {resumen.map((r) => <div key={r.clave}><span>{r.emoji} {r.nombre}</span><b>{fmt(r.total)}</b></div>)}
            <div className="t"><b>TOTAL</b><span>{fmt(total)}</span></div>
          </div>

          <div className="ms-lab gris">Pedidos · reciente → antiguo</div>
          {ordenados.length === 0 && <div className="ms-vacio">Sin consumos todavía.</div>}
          {ordenados.map((p) => {
            const prod = productos.find((x) => x.Id === p.ProductoId);
            return (
              <div key={p.Id} className="ms-ped">
                <time>{horaDe(p.FechaHora)}</time>
                <b>{prod?.Nombre ?? '¿?'}</b>
                <div className="s">
                  <button onClick={() => quitar(p)}>−</button>{p.Cantidad}
                  <button onClick={() => prod && agregar(prod)}>+</button>
                </div>
                <span className="m">{fmt(p.PrecioUnitarioHist * p.Cantidad)}</span>
              </div>
            );
          })}

          <div className="ms-acc">
            <button className="ms-cobrar" disabled={total <= 0}
              onClick={() => setCobro({ metodo: 'EFECTIVO', metodo1: 'EFECTIVO', metodo2: 'NEQUI', mixto: false, monto1: 0, pago: 0 })}>
              💳 Cobrar {fmt(total)}
            </button>
            <button className="ic" disabled title="Compartir producto — próxima fase">🤝</button>
            <button className="ic" disabled title="Recibo — próxima fase">🧾</button>
          </div>
        </aside>
      </div>

      {nueva && (
        <div className="pn-velo" onClick={(e) => e.target === e.currentTarget && setNueva(null)}>
          <div className="pn-modal">
            <h3>Nueva cuenta</h3>
            <SelectorCliente valor={nueva.sel} onChange={(sel) => setNueva((n) => ({ ...n, sel }))}
              onModoNuevo={(creando) => setNueva((n) => ({ ...n, creando }))}
              error={nueva.error} setError={(error) => setNueva((n) => ({ ...n, error }))} />
            {!nueva.creando && nueva.error && <div className="pn-err">{nueva.error}</div>}
            {!nueva.creando && <div className="pn-acc">
              <button className="no" onClick={() => setNueva(null)}>CANCELAR</button>
              <button className="si" onClick={crearCuenta}>AGREGAR</button>
            </div>}
          </div>
        </div>
      )}

      {cobro && (
        <div className="velo" onClick={(e) => e.target === e.currentTarget && setCobro(null)}>
          <div className="modal">
            <h3>COBRAR · {cuenta.NombreLibre}</h3>
            <div className="total-modal">{fmt(total)}<small>TOTAL A COBRAR</small></div>
            {!cobro.mixto && (
              <>
                <label>MÉTODO DE PAGO</label>
                <select value={cobro.metodo} onChange={(e) => setCobro({ ...cobro, metodo: e.target.value })}>
                  {METODOS.map((m) => <option key={m}>{m}</option>)}
                </select>
                <label>💵 PAGO DEL CLIENTE</label>
                <input type="number" placeholder="Ej: 100000" value={cobro.pago || ''}
                  onChange={(e) => setCobro({ ...cobro, pago: Number(e.target.value) || 0 })} />
                <div className="devuelta">
                  DEVOLVER: <strong style={{ color: devuelta !== null ? 'var(--verde)' : 'var(--amarillo)' }}>
                    {devuelta !== null ? fmt(devuelta) : cobro.pago > 0 ? 'Pago insuficiente' : '—'}
                  </strong>
                </div>
              </>
            )}
            <label className="check-mixto">
              <input type="checkbox" checked={cobro.mixto} onChange={(e) => setCobro({ ...cobro, mixto: e.target.checked })} />
              💳 Pagar con dos métodos
            </label>
            {cobro.mixto && (
              <div className="mixto">
                <div><label>MONTO MÉTODO 1</label>
                  <input type="number" value={cobro.monto1 || ''} onChange={(e) => setCobro({ ...cobro, monto1: Number(e.target.value) || 0 })} /></div>
                <div><label>MÉTODO 1</label>
                  <select value={cobro.metodo1} onChange={(e) => setCobro({ ...cobro, metodo1: e.target.value })}>
                    {METODOS.map((m) => <option key={m}>{m}</option>)}</select></div>
                <div><label>RESTO (AUTOMÁTICO)</label>
                  <input readOnly value={cobro.monto1 ? fmt(Math.max(0, total - cobro.monto1)) : ''} /></div>
                <div><label>MÉTODO 2</label>
                  <select value={cobro.metodo2} onChange={(e) => setCobro({ ...cobro, metodo2: e.target.value })}>
                    {METODOS.map((m) => <option key={m}>{m}</option>)}</select></div>
              </div>
            )}
            <div className="acciones">
              <button className="cancelar" onClick={() => setCobro(null)}>CANCELAR</button>
              <button className="abrir" style={{ background: 'var(--verde)' }} onClick={confirmarCobro}>✓ CONFIRMAR COBRO</button>
            </div>
          </div>
        </div>
      )}

      {aviso && <div className="ms-aviso">{aviso}</div>}
    </div>
  );
}
