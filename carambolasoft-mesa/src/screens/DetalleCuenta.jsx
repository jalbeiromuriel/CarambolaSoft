// src/screens/DetalleCuenta.jsx
// Mesa y cuenta — réplica mejorada del POS v6.28: cuentas de la mesa, catálogo por categoría (emoji + color),
// comanda con hora y −/+, resumen por categoría, taxímetro por chico en billar. El cobro (modal) se rediseña en su fase.
import { useState, useEffect, useCallback, useRef } from 'react';
import { put, get, getAll, porIndice } from '../db/repository.js';
import Encabezado from '../components/Encabezado.jsx';
import SelectorCliente, { etiquetaDe, sumarVisita } from '../components/SelectorCliente.jsx';
import { categoriaDe, categoriasVisibles, filtrar, masVendidos, loDeSiempre, resumenPorCategoria, colorTiempo } from '../cuenta/catalogo.js';
import { cobroTiempo, msJugados, msChicoActual, estaCorriendo, iniciarChico, terminarChico, hms } from '../cuenta/tiempo.js';
import { METODOS, planCobro } from '../cuenta/cobro.js';
import { grupoDe } from '../cuenta/grupos.js';
import { estadoReloj, marcadaPorDefecto, mmss } from '../cuenta/garita.js';
import { agregarPersona, cobrarAviso, cerrarReloj } from '../cuenta/garitaDb.js';
import { datosFactura } from '../cuenta/fiadosDb.js';
import { useSesion } from '../components/Sesion.jsx';
import { PinAdmin } from './Auth.jsx';
import { esAdmin } from '../cuenta/auth.js';
import './Panel.css';
import './Mesa.css';

const fmt = (n) => '$' + Math.round(n).toLocaleString('es-CO');
const horaDe = (iso) => (iso ? new Date(iso).toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' }) : '');

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
  const [cierre, setCierre] = useState(false); // "Cerrar mesa" con cuentas sin cobrar
  const [nueva, setNueva] = useState(null);   // { sel, creando, error }
  const [vincular, setVincular] = useState(null); // { sel, creando, error } — ligar un cliente a la cuenta abierta
  const [reloj, setReloj] = useState(null);
  const [avisoSel, setAvisoSel] = useState(null); // { ids:Set } — modal de cobro de la hora
  const [descartado, setDescartado] = useState(0); // Cobros del aviso que se dejó para después
  const { usuario } = useSesion();
  const [pidePin, setPidePin] = useState(null); // { luego } — un Admin autoriza (fiar siendo Empleado)
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
    setReloj(base?.GaritaRelojId ? (await get('GARITAS_RELOJ', base.GaritaRelojId)) ?? null : null);
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

  const er = reloj ? estadoReloj(reloj, ahora) : null;
  // Al llegar el aviso se abre solo el modal de cobro (marcados: todos menos los recién llegados)
  useEffect(() => {
    if (er?.enAviso && !avisoSel && descartado !== reloj.Cobros && grupo.length) {
      setAvisoSel({ ids: new Set(grupo.filter((c) => marcadaPorDefecto(c)).map((c) => c.Id)) });
    }
  }, [er?.enAviso, reloj?.Cobros, grupo.length]); // eslint-disable-line

  if (!cuenta) return null;
  const esGarita = cuenta.TipoCuenta === 'GARITA';

  const entregadosDe = (c) => pedidos.filter((p) => p.CuentaId === c.Id && p.EstadoPedido === 'ENTREGADO');
  const consumoDe = (c) => entregadosDe(c).reduce((t, p) => t + p.PrecioUnitarioHist * p.Cantidad, 0);
  const totalDe = (c) => consumoDe(c) + cobroTiempo(c, ahora);

  const entregados = entregadosDe(cuenta);
  const subTiempo = cobroTiempo(cuenta, ahora);
  const total = subTiempo + consumoDe(cuenta);
  const totalMesa = grupo.reduce((t, c) => t + totalDe(c), 0);
  // Lo que se está cobrando: la cuenta activa, o toda la mesa cuando paga una sola persona
  const cuentasCobro = cobro?.mesa ? grupo.filter((c) => totalDe(c) > 0) : [cuenta];
  const pagador = (cobro?.mesa && grupo.find((c) => c.Id === cobro.pagadorId)) || cuenta;
  const pedidosCobro = cuentasCobro.flatMap(entregadosDe);
  const subTiempoC = cuentasCobro.reduce((t, c) => t + cobroTiempo(c, ahora), 0);
  const totalC = cuentasCobro.reduce((t, c) => t + totalDe(c), 0);
  const resumenC = resumenPorCategoria(pedidosCobro, productos, categorias);
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
  lista = filtrar(lista.filter((p) => !/garita/i.test(p.Nombre)), q); // la garita se cobra con ＋ Persona y el aviso, no desde el catálogo

  // ── Pedidos (espejo local del trigger: el stock baja al entregar)
  async function agregar(prod) {
    const controla = prod.ControlaStock !== false;
    if (controla && (prod.StockActual ?? 0) <= 0) { decir(`Sin stock: ${prod.Nombre}`); return; }
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
    if (controla) await put('PRODUCTOS', { ...prod, StockActual: prod.StockActual - 1 });
    await cargar();
  }

  // Quitar una unidad: a 0 queda CANCELADO (nunca borrado) y el stock vuelve
  async function quitar(pedido) {
    const prod = productos.find((p) => p.Id === pedido.ProductoId);
    await put('PEDIDOS_CUENTAS', pedido.Cantidad > 1
      ? { ...pedido, Cantidad: pedido.Cantidad - 1 }
      : { ...pedido, EstadoPedido: 'CANCELADO' });
    if (prod && prod.ControlaStock !== false) await put('PRODUCTOS', { ...prod, StockActual: prod.StockActual + 1 });
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
    if (esGarita) {
      const c = await agregarPersona(cuenta.GaritaRelojId, { cliente: sel.cliente, etiqueta });
      await sumarVisita(sel.cliente);
      setNueva(null); setActivaId(c.Id); await cargar(); return;
    }
    const c = await put('CUENTAS', {
      TipoCuenta: cuenta.TipoCuenta, MesaId: cuenta.MesaId ?? null, GrupoMesaId: cuenta.MesaId ? null : grupoDe(cuenta), // las cuentas viejas sin grupo usan su propio Id
      ClienteId: sel.cliente?.Id ?? null, NombreLibre: etiqueta,
      HoraApertura: new Date().toISOString(), HoraCierre: null, TarifaPorHora: null, Estado: 'ABIERTA',
    });
    await sumarVisita(sel.cliente);
    setNueva(null); setActivaId(c.Id); await cargar();
  }

  async function cerrarMesa() {
    if (grupo.some((c) => totalDe(c) > 0)) { setCierre(true); return; } // quedan cuentas por cobrar: ofrece cobrar toda la mesa
    if (cuenta.GaritaRelojId) await cerrarReloj(cuenta.GaritaRelojId);
    for (const c of grupo) await put('CUENTAS', { ...c, Estado: 'CANCELADA', HoraCierre: new Date().toISOString() });
    if (cuenta.MesaId) {
      const mesa = await get('MESAS_BILLAR', cuenta.MesaId);
      if (mesa) await put('MESAS_BILLAR', { ...mesa, Estado: 'DISPONIBLE' });
    }
    volver();
  }

  // ── Vincular cliente a la cuenta abierta (habilita fiado y ⭐ visitas)
  async function vincularCliente() {
    const c = vincular.sel.cliente;
    if (!c) { setVincular({ ...vincular, error: 'Elige un cliente o crea uno nuevo.' }); return; }
    await put('CUENTAS', { ...cuenta, ClienteId: c.Id });
    await sumarVisita(c);
    setVincular(null); decir(`Cuenta vinculada a ${c.Nombre} ✓`); await cargar();
  }

  // ── Cobro: las reglas viven en cuenta/cobro.js
  const abrirCobro = () => setCobro({ metodo: 'EFECTIVO', mixto: false, metodo1: 'EFECTIVO', metodo2: 'NEQUI', monto1: 0, pago: 0 });

  async function confirmarCobro() {
    const plan = planCobro({ ...cobro, total: totalC, tieneCliente: !!pagador.ClienteId });
    if (plan.error) { decir(plan.error); return; }
    const { met1, met2, m1, m2, pendienteFiado } = plan;
    const { mixto } = cobro;
    const suma = (f) => pedidosCobro.filter(f).reduce((t, p) => t + p.PrecioUnitarioHist * p.Cantidad, 0);
    await put('FACTURAS', {
      ...(await datosFactura()), CuentaId: pagador.Id, TurnoCajaId: pagador.TurnoCajaId ?? null, SubtotalTiempo: subTiempoC,
      ...(cobro.mesa ? { CuentasIncluidas: cuentasCobro.map((c) => c.Id) } : {}),
      SubtotalLicor: suma((p) => p.CategoriaConsumo === 'BEBIDAS_ALCOHOLICAS'),
      SubtotalSnacks: suma((p) => p.CategoriaConsumo === 'SNACKS'),
      SubtotalOtros: suma((p) => !['BEBIDAS_ALCOHOLICAS', 'SNACKS', 'TIEMPO'].includes(p.CategoriaConsumo)),
      TotalPagar: totalC, TotalPendienteFiado: pendienteFiado, UsuarioId: usuario?.Id ?? null, AutorizoId: cobro.autorizoId ?? null,
      MetodoPago: met1, MetodoPagoSecundario: met2,
      MontoPrimario: mixto ? m1 : null, MontoSecundario: mixto ? m2 : null,
      EstadoPago: pendienteFiado > 0 ? 'FIADO' : 'PAGADO',
    });
    // Al cobrar, un chico en curso se termina; en "toda la mesa" se liquidan todas las cuentas cobradas
    const ahoraIso = new Date().toISOString();
    for (const c of cuentasCobro) await put('CUENTAS', { ...terminarChico(c), Estado: 'LIQUIDADA', HoraCierre: ahoraIso, ...(c.Id !== pagador.Id ? { PagadaPorCuentaId: pagador.Id } : {}) });
    if (cobro.mesa) for (const c of grupo.filter((x) => !cuentasCobro.some((y) => y.Id === x.Id))) await put('CUENTAS', { ...c, Estado: 'CANCELADA', HoraCierre: ahoraIso });
    const quedan = cobro.mesa ? [] : grupo.filter((c) => c.Id !== cuenta.Id);
    if (quedan.length === 0 && cuenta.MesaId) {
      const mesa = await get('MESAS_BILLAR', cuenta.MesaId);
      if (mesa) await put('MESAS_BILLAR', { ...mesa, Estado: 'DISPONIBLE' });
    }
    setCobro(null);
    if (quedan.length === 0) { if (cuenta.GaritaRelojId) await cerrarReloj(cuenta.GaritaRelojId); volver(); return; }
    setActivaId(quedan[0].Id); decir('Cobrado ✓'); await cargar();
  }

  const puedeFiar = esAdmin(usuario?.Rol) || cobro?.fiadoOk;
  function elegir(campo, v) {
    const aplicar = (extra = {}) => setCobro((c) => ({ ...c, [campo]: v, ...extra }));
    if (v === 'FIADO' && !puedeFiar) setPidePin({ luego: () => aplicar({ fiadoOk: true }) });
    else aplicar();
  }
  const devuelta = cobro && !cobro.mixto && cobro.metodo === 'EFECTIVO' && cobro.pago >= totalC ? cobro.pago - totalC : null;
  const soloDigitos = (v) => Number(String(v).replace(/\D/g, '')) || 0;
  const nombreDe = (v) => METODOS.find((m) => m.v === v)?.t;
  const ordenados = [...entregados].sort((a, b) => (b.FechaHora ?? '').localeCompare(a.FechaHora ?? ''));
  const dueno = grupo[0]?.NombreLibre ?? cuenta.NombreLibre; // la mesa lleva el nombre de su primera cuenta
  const titulo = esGarita ? `⏱ Garita · ${dueno}` : esBillar ? `Billar · ${dueno}` : `${dueno} · Licores`;

  return (
    <div className="pn ms">
      <Encabezado activo="panel" irPanel={volver} />

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

          {esGarita && reloj && (
            <div className={`ms-bil ga ${er.enAviso ? 'al' : 'run'}`}>
              <div>
                <div className="ms-lab rosa">⏱ Garita · {fmt(reloj.Valor)}/persona/hora</div>
                <div className="ms-cr">{hms(er.transcurrido)}</div>
                <small>{er.enAviso ? '⏰ ¡Cumple la hora! cobra otra' : `aviso en ${mmss(er.faltaAviso)}`} · hora {reloj.Cobros}</small>
              </div>
              <div className="ms-acum">
                <small>👥 {grupo.length} {grupo.length === 1 ? 'persona' : 'personas'}</small>
                <strong>{fmt(grupo.length * reloj.Valor)}/h</strong>
              </div>
              {er.enAviso
                ? <button className="ini" onClick={() => setAvisoSel({ ids: new Set(grupo.filter((c) => marcadaPorDefecto(c)).map((c) => c.Id)) })}>COBRAR HORA</button>
                : <button className="ini" onClick={() => setNueva({ sel: { cliente: null, nombre: '' }, creando: false, error: '' })}>＋ Persona</button>}
            </div>
          )}

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
            <button className="ms-oro" onClick={cerrarMesa}>{esGarita ? 'Terminar garita' : 'Cerrar mesa'}</button>
          </div>
          <div className="ms-nom">{cuenta.NombreLibre}</div>
          <div className="ms-ap">
            {cliente?.Apodo && cliente.Apodo !== cuenta.NombreLibre && <>“{cliente.Apodo}” · </>}
            {cliente ? <>⭐ {cliente.Visitas ?? 0} visitas</> : <span className="rojo">Sin cliente registrado</span>}
            {!cuenta.ClienteId && <button className="ms-vinc" onClick={() => setVincular({ sel: { cliente: null, nombre: '' }, creando: false, error: '' })}>+ Vincular cliente</button>}
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
              onClick={abrirCobro}>
              💳 Cobrar {fmt(total)}
            </button>
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

      {vincular && (
        <div className="pn-velo alto" onClick={(e) => e.target === e.currentTarget && setVincular(null)}>
          <div className="pn-modal">
            <h3>Vincular cliente · {cuenta.NombreLibre}</h3>
            <SelectorCliente soloCliente valor={vincular.sel} onChange={(sel) => setVincular((v) => ({ ...v, sel }))}
              onModoNuevo={(creando) => setVincular((v) => ({ ...v, creando }))}
              error={vincular.error} setError={(error) => setVincular((v) => ({ ...v, error }))} />
            {!vincular.creando && vincular.error && <div className="pn-err">{vincular.error}</div>}
            {!vincular.creando && <div className="pn-acc">
              <button className="no" onClick={() => setVincular(null)}>CANCELAR</button>
              <button className="si" onClick={vincularCliente}>VINCULAR</button>
            </div>}
          </div>
        </div>
      )}

      {cobro && (
        <div className="pn-velo" onClick={(e) => e.target === e.currentTarget && setCobro(null)}>
          <div className="pn-modal cb">
            <h3>{cobro.mesa ? `Cobrar toda la mesa · ${dueno}` : `Cobrar · ${cuenta.NombreLibre}`}</h3>
            {cobro.mesa && (
              <>
                <div className="cb-lab">¿Quién paga? ({cuentasCobro.length} {cuentasCobro.length === 1 ? 'cuenta' : 'cuentas'} · una sola factura)</div>
                <div className="cb-quien">{grupo.map((c) => (
                  <button key={c.Id} className={pagador.Id === c.Id ? 'on' : ''} onClick={() => setCobro({ ...cobro, pagadorId: c.Id, ...(c.ClienteId ? {} : { metodo: cobro.metodo === 'FIADO' ? 'EFECTIVO' : cobro.metodo, metodo1: cobro.metodo1 === 'FIADO' ? 'EFECTIVO' : cobro.metodo1, metodo2: cobro.metodo2 === 'FIADO' ? 'NEQUI' : cobro.metodo2 }) })}>
                    {c.ClienteId ? '⭐ ' : ''}{c.NombreLibre}</button>))}</div>
              </>
            )}
            <div className="cb-tot">{fmt(totalC)}</div>
            <div className="cb-tl">TOTAL A COBRAR</div>
            <div className="cb-cats">
              {subTiempoC > 0 && <span>🎱 Tiempo {fmt(subTiempoC)}</span>}
              {resumenC.map((r) => <span key={r.clave}>{r.emoji} {r.nombre} {fmt(r.totalC)}</span>)}
            </div>

            {!cobro.mixto && (
              <>
                <div className="cb-lab">Método de pago</div>
                <div className="cb-met">
                  {METODOS.map((m) => {
                    const bloqueado = m.v === 'FIADO' && !pagador.ClienteId;
                    return (
                      <button key={m.v} className={`${m.v === 'FIADO' ? 'fi' : ''} ${cobro.metodo === m.v ? 'on' : ''}`} disabled={bloqueado}
                        title={bloqueado ? 'Vincula un cliente para fiar' : ''} onClick={() => elegir('metodo', m.v)}>
                        {m.t}{bloqueado || (m.v === 'FIADO' && !puedeFiar) ? ' 🔒' : ''}
                      </button>
                    );
                  })}
                </div>
              </>
            )}

            {!pagador.ClienteId && (
              <div className="cb-alerta">
                🚫 {pagador.NombreLibre} no es cliente registrado: el fiado no está disponible.
                <button onClick={() => setVincular({ sel: { cliente: null, nombre: '' }, creando: false, error: '' })}>Vincular cliente</button>
              </div>
            )}
            {pagador.ClienteId && cliente && (
              <div className="cb-cli">A nombre de <b>{cliente.Nombre}{cliente.Apodo ? ` · “${cliente.Apodo}”` : ''}</b>{deuda > 0 && <span>Debe <b>{fmt(deuda)}</b></span>}</div>
            )}

            {!cobro.mixto && cobro.metodo === 'EFECTIVO' && (
              <>
                <div className="cb-lab">💵 Pago del cliente</div>
                <div className="cb-fila">
                  <div className="p"><small>PAGO</small>
                    <input inputMode="numeric" placeholder="$ —" value={cobro.pago ? '$' + cobro.pago.toLocaleString('es-CO') : ''}
                      onChange={(e) => setCobro({ ...cobro, pago: soloDigitos(e.target.value) })} /></div>
                  <div className="d"><small>DEVOLVER</small>
                    <div className="n">{devuelta !== null ? fmt(devuelta) : cobro.pago > 0 ? 'Falta ' + fmt(totalC - cobro.pago) : '—'}</div></div>
                </div>
                <div className="cb-tc">Total cuenta <b>{fmt(totalC)}</b></div>
              </>
            )}

            {cobro.mixto && (
              <>
                <div className="cb-lab">Dos métodos</div>
                <div className="cb-mx">
                  <div className="c a"><div className="t">MÉTODO 1</div>
                    <input className="v" inputMode="numeric" placeholder="$ —" value={cobro.monto1 ? '$' + cobro.monto1.toLocaleString('es-CO') : ''}
                      onChange={(e) => setCobro({ ...cobro, monto1: soloDigitos(e.target.value) })} />
                    <div className="mm">{METODOS.map((m) => (
                      <button key={m.v} disabled={m.v === 'FIADO' && !pagador.ClienteId} className={cobro.metodo1 === m.v ? 'on' : ''}
                        onClick={() => elegir('metodo1', m.v)}>{m.t}</button>))}</div></div>
                  <div className="c"><div className="t">MÉTODO 2 · EL RESTO</div>
                    <div className="v ver">{cobro.monto1 > 0 && cobro.monto1 < totalC ? fmt(totalC - cobro.monto1) : '$ —'}</div>
                    <div className="mm">{METODOS.map((m) => (
                      <button key={m.v} disabled={m.v === 'FIADO' && !pagador.ClienteId} className={cobro.metodo2 === m.v ? 'on' : ''}
                        onClick={() => elegir('metodo2', m.v)}>{m.t}</button>))}</div></div>
                </div>
              </>
            )}

            <label className="cb-chk">
              <input type="checkbox" checked={cobro.mixto} onChange={(e) => setCobro({ ...cobro, mixto: e.target.checked })} />
              <span className="box">{cobro.mixto ? '✓' : ''}</span>
              💳 Pagar con dos métodos (ej: efectivo + Nequi)
            </label>

            <div className="pn-acc">
              <button className="no" onClick={() => setCobro(null)}>CANCELAR</button>
              <button className="si" onClick={confirmarCobro}>✓ CONFIRMAR COBRO</button>
            </div>
          </div>
        </div>
      )}

      {avisoSel && reloj && (
        <div className="pn-velo alto" onClick={(e) => e.target === e.currentTarget && (setDescartado(reloj.Cobros), setAvisoSel(null))}>
          <div className="pn-modal ga">
            <h3>⏰ Cobrar otra hora · garita</h3>
            <small className="ga-sub">Marca a quienes siguen. Los recién llegados salen sin marcar.</small>
            <div className="ga-lista">
              {grupo.map((c) => {
                const on = avisoSel.ids.has(c.Id);
                return (
                  <label key={c.Id} className={`cb-chk ${on ? 'on' : ''}`}>
                    <input type="checkbox" checked={on} onChange={() => setAvisoSel((a) => {
                      const ids = new Set(a.ids); on ? ids.delete(c.Id) : ids.add(c.Id); return { ids };
                    })} />
                    <span className="box">{on ? '✓' : ''}</span>
                    {c.NombreLibre}<em>{fmt(reloj.Valor)}</em>
                  </label>
                );
              })}
            </div>
            <div className="ga-tot">A cobrar <b>{fmt(avisoSel.ids.size * reloj.Valor)}</b></div>
            <div className="pn-acc">
              <button className="no" onClick={() => { setDescartado(reloj.Cobros); setAvisoSel(null); }}>DESPUÉS</button>
              <button className="si" onClick={async () => {
                await cobrarAviso(reloj, grupo.filter((c) => avisoSel.ids.has(c.Id)));
                setAvisoSel(null); decir('Hora cobrada ✓'); await cargar();
              }}>COBRAR {avisoSel.ids.size} {avisoSel.ids.size === 1 ? 'PERSONA' : 'PERSONAS'}</button>
            </div>
          </div>
        </div>
      )}

      {cierre && (
        <div className="pn-velo" onClick={(e) => e.target === e.currentTarget && setCierre(false)}>
          <div className="pn-modal">
            <h3>{esGarita ? 'Terminar garita' : 'Cerrar mesa'} · faltan cuentas por cobrar</h3>
            <div className="cb-quien lista">{grupo.filter((c) => totalDe(c) > 0).map((c) => <div key={c.Id}><span>👤 {c.NombreLibre}</span><b>{fmt(totalDe(c))}</b></div>)}</div>
            <div className="cb-tot">{fmt(totalMesa)}</div><div className="cb-tl">TOTAL DE LA MESA</div>
            <p className="au-nota">¿Paga una sola persona? Cobra <b>toda la mesa</b> de una vez. O cobra cada cuenta por separado con el botón Cobrar.</p>
            <div className="pn-acc"><button className="no" onClick={() => setCierre(false)}>VOLVER</button>
              <button className="si" onClick={() => { setCierre(false); setCobro({ metodo: 'EFECTIVO', mixto: false, metodo1: 'EFECTIVO', metodo2: 'NEQUI', monto1: 0, pago: 0, mesa: true, pagadorId: cuenta.Id }); }}>💳 COBRAR TODA LA MESA</button></div>
          </div>
        </div>
      )}

      {pidePin && <PinAdmin motivo="Un Empleado no puede fiar. Un Admin digita su PIN para autorizar este fiado."
        cancelar={() => setPidePin(null)}
        ok={(a) => { pidePin.luego(); setCobro((c) => ({ ...c, autorizoId: a.Id })); setPidePin(null); }} />}

      {aviso && <div className="ms-aviso">{aviso}</div>}
    </div>
  );
}
