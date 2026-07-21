// src/screens/DetalleCuenta.jsx
// Pantalla 2 — Detalle de Cuenta. Porta la lógica de openCobrar/calcCambio/
// calcMixto/confirmCobro del POS v6.10, sobre el modelo BD v6.
import { useState, useEffect, useCallback } from 'react';
import { put, get, getAll, porIndice } from '../db/repository.js';
import Cronometro from '../components/Cronometro.jsx';

const METODOS = ['EFECTIVO', 'NEQUI', 'DAVIPLATA', 'TARJETA', 'TRANSFERENCIA', 'FIADO'];
const fmt = (n) => '$' + Math.round(n).toLocaleString('es-CO');

export default function DetalleCuenta({ cuentaId, volver }) {
  const [cuenta, setCuenta] = useState(null);
  const [pedidos, setPedidos] = useState([]);
  const [productos, setProductos] = useState([]);
  const [cobro, setCobro] = useState(null); // estado del modal de cobro
  const [, setTick] = useState(0);

  const cargar = useCallback(async () => {
    setCuenta(await get('CUENTAS', cuentaId));
    setPedidos(await porIndice('PEDIDOS_CUENTAS', 'porCuenta', cuentaId));
    setProductos((await getAll('PRODUCTOS')).filter((p) => p.Activo !== false));
  }, [cuentaId]);

  useEffect(() => {
    cargar();
    const t = setInterval(() => setTick((n) => n + 1), 1000); // total de tiempo en vivo
    return () => clearInterval(t);
  }, [cargar]);

  if (!cuenta) return null;

  const entregados = pedidos.filter((p) => p.EstadoPedido === 'ENTREGADO');

  // Tiempo por taxímetro (igual que liquidar del API)
  const subTiempo = cuenta.TarifaPorHora
    ? Math.round((Math.ceil((Date.now() - new Date(cuenta.HoraApertura)) / 60000) * cuenta.TarifaPorHora) / 60)
    : 0;
  const subConsumos = entregados.reduce((t, p) => t + p.PrecioUnitarioHist * p.Cantidad, 0);
  const total = subTiempo + subConsumos;

  // ── Agregar producto (espejo de addCart: stock y sistema en el mismo segundo)
  async function agregar(prod) {
    if ((prod.StockActual ?? 0) <= 0) { alert('Sin stock ✗'); return; }

    const existente = entregados.find((p) => p.ProductoId === prod.Id);
    if (existente) {
      await put('PEDIDOS_CUENTAS', { ...existente, Cantidad: existente.Cantidad + 1 });
    } else {
      await put('PEDIDOS_CUENTAS', {
        CuentaId: cuentaId,
        ProductoId: prod.Id,
        Cantidad: 1,
        PrecioUnitarioHist: prod.PrecioVenta,   // precio congelado al pedir
        CostoCompraHist: prod.CostoCompra ?? 0, // P&L histórico real
        CategoriaConsumo: prod.CategoriaConsumo ?? 'OTROS',
        EstadoPedido: 'ENTREGADO',
      });
    }
    // Espejo local del trigger: baja stock al entregar
    await put('PRODUCTOS', { ...prod, StockActual: prod.StockActual - 1 });
    await cargar();
  }

  // ── Quitar unidad (a 0 => CANCELADO, nunca borrado físico; stock vuelve)
  async function quitar(pedido) {
    const prod = productos.find((p) => p.Id === pedido.ProductoId);
    if (pedido.Cantidad > 1) {
      await put('PEDIDOS_CUENTAS', { ...pedido, Cantidad: pedido.Cantidad - 1 });
    } else {
      await put('PEDIDOS_CUENTAS', { ...pedido, EstadoPedido: 'CANCELADO' });
    }
    if (prod) await put('PRODUCTOS', { ...prod, StockActual: prod.StockActual + 1 });
    await cargar();
  }

  // ── Eliminar cuenta en cero: sin confirmación (regla del POS)
  async function eliminarSiVacia() {
    if (total > 0 || entregados.length > 0) return;
    await put('CUENTAS', { ...cuenta, Estado: 'CANCELADA', HoraCierre: new Date().toISOString() });
    if (cuenta.MesaId) {
      const mesa = await get('MESAS_BILLAR', cuenta.MesaId);
      if (mesa) await put('MESAS_BILLAR', { ...mesa, Estado: 'DISPONIBLE' });
    }
    volver();
  }

  // ── Confirmar cobro (espejo de confirmCobro del POS)
  async function confirmarCobro() {
    const { metodo, metodo2, mixto, monto1, pago } = cobro;

    if (mixto && (!monto1 || monto1 <= 0)) { alert('Ingresa el monto del método 1'); return; }
    if (mixto && monto1 > total) { alert('El monto 1 supera el total'); return; }

    const met1 = mixto ? cobro.metodo1 : metodo;
    const met2 = mixto ? metodo2 : null;
    const m1 = mixto ? monto1 : total;
    const m2 = mixto ? total - monto1 : 0;

    if (pago > 0 && pago < total && met1 !== 'FIADO' && !mixto) {
      alert(`⚠️ Pago insuficiente — faltan ${fmt(total - pago)}`); return;
    }
    if ((met1 === 'FIADO' || met2 === 'FIADO') && !cuenta.ClienteId) {
      alert('🚫 El fiado necesita cliente registrado'); return;
    }

    const pendienteFiado = met1 === 'FIADO' ? m1 : met2 === 'FIADO' ? m2 : 0;
    const ahora = new Date().toISOString();

    await put('FACTURAS', {
      CuentaId: cuenta.Id,
      TurnoCajaId: cuenta.TurnoCajaId ?? null,
      SubtotalTiempo: subTiempo,
      SubtotalLicor: entregados.filter((p) => p.CategoriaConsumo === 'BEBIDAS_ALCOHOLICAS')
        .reduce((t, p) => t + p.PrecioUnitarioHist * p.Cantidad, 0),
      SubtotalSnacks: entregados.filter((p) => p.CategoriaConsumo === 'SNACKS')
        .reduce((t, p) => t + p.PrecioUnitarioHist * p.Cantidad, 0),
      SubtotalOtros: entregados.filter((p) => !['BEBIDAS_ALCOHOLICAS', 'SNACKS', 'TIEMPO'].includes(p.CategoriaConsumo))
        .reduce((t, p) => t + p.PrecioUnitarioHist * p.Cantidad, 0),
      TotalPagar: total,
      TotalPendienteFiado: pendienteFiado,
      MetodoPago: met1,
      MetodoPagoSecundario: met2,
      MontoPrimario: mixto ? m1 : null,
      MontoSecundario: mixto ? m2 : null,
      EstadoPago: pendienteFiado > 0 ? 'FIADO' : 'PAGADO',
    });

    await put('CUENTAS', { ...cuenta, Estado: 'LIQUIDADA', HoraCierre: ahora });

    if (cuenta.MesaId) {
      const mesa = await get('MESAS_BILLAR', cuenta.MesaId);
      if (mesa) await put('MESAS_BILLAR', { ...mesa, Estado: 'DISPONIBLE' });
    }

    volver();
  }

  const devuelta = cobro && cobro.pago >= total ? cobro.pago - total : null;

  return (
    <>
      <header className="cabecera detalle">
        <button className="volver" onClick={volver}>‹ MESAS</button>
        <div>
          <div className="marca chica">{cuenta.NombreLibre}</div>
          <div className="subtitulo">
            {cuenta.TipoCuenta === 'BILLAR' ? 'MESA DE BILLAR' : 'LICORES'}
          </div>
        </div>
        <Cronometro desdeIso={cuenta.HoraApertura} />
        <div className="total-vivo">{fmt(total)}</div>
      </header>

      {cuenta.TarifaPorHora > 0 && (
        <div className="linea-tiempo">
          ⏱ TIEMPO: <strong>{fmt(subTiempo)}</strong> · tarifa {fmt(cuenta.TarifaPorHora)}/hora
        </div>
      )}

      <section className="seccion">
        <h2>PRODUCTOS</h2>
        <div className="rejilla productos">
          {productos.map((p) => (
            <button key={p.Id} className="prod" disabled={(p.StockActual ?? 0) <= 0} onClick={() => agregar(p)}>
              <span className="prod-nombre">{p.Nombre}</span>
              <span className="prod-precio">{fmt(p.PrecioVenta)}</span>
              <span className="prod-stock">{p.StockActual} disp.</span>
            </button>
          ))}
        </div>
      </section>

      <section className="seccion">
        <h2>CUENTA</h2>
        {entregados.length === 0 && subTiempo === 0 && (
          <p className="vacio">Sin consumos todavía.
            <button className="link-rojo" onClick={eliminarSiVacia}> Eliminar cuenta</button>
          </p>
        )}
        {entregados.map((p) => {
          const prod = productos.find((x) => x.Id === p.ProductoId);
          return (
            <div key={p.Id} className="fila-pedido">
              <span className="fp-nombre">{prod?.Nombre ?? '¿?'}</span>
              <span className="fp-cant">×{p.Cantidad}</span>
              <span className="fp-sub">{fmt(p.PrecioUnitarioHist * p.Cantidad)}</span>
              <button className="fp-quitar" onClick={() => quitar(p)}>−</button>
            </div>
          );
        })}
      </section>

      {total > 0 && (
        <button className="boton-cobrar"
          onClick={() => setCobro({ metodo: 'EFECTIVO', metodo1: 'EFECTIVO', metodo2: 'NEQUI', mixto: false, monto1: 0, pago: 0 })}>
          💵 COBRAR {fmt(total)}
        </button>
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
              <input type="checkbox" checked={cobro.mixto}
                onChange={(e) => setCobro({ ...cobro, mixto: e.target.checked })} />
              💳 Pagar con dos métodos
            </label>

            {cobro.mixto && (
              <div className="mixto">
                <div>
                  <label>MONTO MÉTODO 1</label>
                  <input type="number" value={cobro.monto1 || ''}
                    onChange={(e) => setCobro({ ...cobro, monto1: Number(e.target.value) || 0 })} />
                </div>
                <div>
                  <label>MÉTODO 1</label>
                  <select value={cobro.metodo1} onChange={(e) => setCobro({ ...cobro, metodo1: e.target.value })}>
                    {METODOS.map((m) => <option key={m}>{m}</option>)}
                  </select>
                </div>
                <div>
                  <label>RESTO (AUTOMÁTICO)</label>
                  <input readOnly value={cobro.monto1 ? fmt(Math.max(0, total - cobro.monto1)) : ''} />
                </div>
                <div>
                  <label>MÉTODO 2</label>
                  <select value={cobro.metodo2} onChange={(e) => setCobro({ ...cobro, metodo2: e.target.value })}>
                    {METODOS.map((m) => <option key={m}>{m}</option>)}
                  </select>
                </div>
              </div>
            )}

            <div className="acciones">
              <button className="cancelar" onClick={() => setCobro(null)}>CANCELAR</button>
              <button className="abrir" style={{ background: 'var(--verde)' }} onClick={confirmarCobro}>
                ✓ CONFIRMAR COBRO
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
