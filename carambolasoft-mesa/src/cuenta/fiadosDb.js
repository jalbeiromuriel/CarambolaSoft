// src/cuenta/fiadosDb.js — Fiados y abonos en IndexedDB (FACTURAS + ABONOS_FIADO). Reglas puras en fiados.js.
import { put, getAll, leerMeta, escribirMeta, borrarLocal } from '../db/repository.js';
import { normalizarCuentas } from './cuentasPago.js';
import { repartirAbono, siguienteNumero, etiquetaFactura, esDePrueba, castigarFactura, reabrirFactura } from './fiados.js';

/** Datos para facturar: número consecutivo y fecha. */
export async function datosFactura() {
  const base = Number(await leerMeta('facturas.ultimoNumero')) || 0;   // última factura del POS importado: la numeración continúa desde ahí
  return { Numero: etiquetaFactura(Math.max(siguienteNumero(await getAll('FACTURAS')), base + 1)), FechaHora: new Date().toISOString() };
}

/** Números consecutivos para `n` facturas de una misma división de cuenta. */
export async function datosFacturas(n) {
  const base = Number(await leerMeta('facturas.ultimoNumero')) || 0;
  const primero = Math.max(siguienteNumero(await getAll('FACTURAS')), base + 1);
  return { Numeros: Array.from({ length: n }, (_, i) => etiquetaFactura(primero + i)), FechaHora: new Date().toISOString() };
}

/** Fiados agrupados por cliente: una sola deuda por persona, con sus facturas (saldo, abonado, antigüedad). */
export async function cargarFiados() {
  const [facturas, cuentas, clientes, abonos] = await Promise.all([getAll('FACTURAS'), getAll('CUENTAS'), getAll('CLIENTES'), getAll('ABONOS_FIADO')]);
  const cuentaPorId = new Map(cuentas.map((c) => [c.Id, c]));
  const abonadoPor = new Map();
  for (const a of abonos) abonadoPor.set(a.FacturaId, (abonadoPor.get(a.FacturaId) ?? 0) + a.Monto);
  const por = new Map();
  for (const f of facturas) {
    if (f.EstadoPago !== 'FIADO' || !((f.TotalPendienteFiado ?? 0) > 0)) continue;
    const c = cuentaPorId.get(f.CuentaId); const cli = clientes.find((x) => x.Id === c?.ClienteId);
    if (!cli) continue;
    const abonado = abonadoPor.get(f.Id) ?? 0;
    const fila = { ...f, FechaHora: f.FechaHora ?? c.HoraCierre ?? f.UltimaModificacion, saldo: f.TotalPendienteFiado, abonado, original: f.TotalPendienteFiado + abonado };
    if (!por.has(cli.Id)) por.set(cli.Id, { cliente: cli, facturas: [], deuda: 0, abonado: 0, pagos: 0 });
    const g = por.get(cli.Id); g.facturas.push(fila); g.deuda += fila.saldo; g.abonado += abonado;
  }
  for (const g of por.values()) {
    g.facturas.sort((a, b) => new Date(a.FechaHora) - new Date(b.FechaHora));
    // Abonos de TODAS las facturas del cliente (incluye las que ya quedaron saldadas)
    const mias = new Set(cuentas.filter((c) => c.ClienteId === g.cliente.Id).map((c) => c.Id));
    const suyas = facturas.filter((f) => mias.has(f.CuentaId));
    g.todasFacturaIds = suyas.map((f) => f.Id);
    // Todas las facturas del cliente (pendientes y pagadas), recientes primero — para consultar recibos
    g.todasFacturas = suyas.map((f) => ({ ...f, saldo: f.TotalPendienteFiado ?? 0, FechaHora: f.FechaHora ?? f.UltimaModificacion })).sort((a, b) => new Date(b.FechaHora) - new Date(a.FechaHora));
    const suyos = abonos.filter((a) => g.todasFacturaIds.includes(a.FacturaId));
    g.abonado = suyos.reduce((t, a) => t + a.Monto, 0);
    g.pagos = new Set(suyos.map((a) => a.FechaHora)).size; // un pago puede tocar varias facturas
    g.masAntigua = g.facturas[0]?.FechaHora;
  }
  const lista = [...por.values()].sort((a, b) => new Date(a.masAntigua) - new Date(b.masAntigua));
  return { lista, total: lista.reduce((t, g) => t + g.deuda, 0) };
}

/** Registra un abono: se aplica a la factura más antigua primero. Una fila de ABONOS_FIADO por factura tocada. */
export async function registrarAbono({ facturas, monto, metodo, usuarioId }) {
  const { aplicaciones, sobrante } = repartirAbono(facturas.map((f) => ({ Id: f.Id, FechaHora: f.FechaHora, saldo: f.saldo })), monto);
  if (!aplicaciones.length || sobrante > 0) throw new Error('El abono no puede superar la deuda.');
  const ahora = new Date().toISOString();
  for (const ap of aplicaciones) {
    const f = facturas.find((x) => x.Id === ap.facturaId);
    await put('ABONOS_FIADO', { FacturaId: ap.facturaId, TurnoCajaId: null, Monto: ap.aplicado, MetodoPago: metodo, FechaHora: ahora, UsuarioId: usuarioId ?? null });
    const { saldo, abonado, original, FechaHora, ...factura } = f; // quita los campos calculados
    await put('FACTURAS', { ...factura, ...(f.FechaHora ? { FechaHora: f.FechaHora } : {}), TotalPendienteFiado: ap.saldo, EstadoPago: ap.saldo > 0 ? 'FIADO' : 'PAGADO' });
  }
  return aplicaciones;
}

/** Pagos del cliente (un pago que tocó varias facturas se muestra como uno solo), recientes primero. */
export async function abonosDeCliente(facturaIds) {
  const set = new Set(facturaIds); const por = new Map();
  for (const a of await getAll('ABONOS_FIADO')) {
    if (!set.has(a.FacturaId)) continue;
    const k = `${a.FechaHora}|${a.MetodoPago}`;
    por.set(k, { ...(por.get(k) ?? { Id: k, FechaHora: a.FechaHora, MetodoPago: a.MetodoPago, Monto: 0 }), Monto: (por.get(k)?.Monto ?? 0) + a.Monto });
  }
  return [...por.values()].sort((a, b) => b.FechaHora.localeCompare(a.FechaHora));
}

// Datos de pago (cuenta para recibir transferencias): SOLO locales, nunca en el repo.
// Varias cuentas (lista). Si solo existe el dato antiguo de una cuenta, se migra como principal.
export async function leerCuentasPago() {
  const nuevas = await leerMeta('negocio.cuentasPago');
  return normalizarCuentas(nuevas ?? (await leerMeta('negocio.datosPago')));
}
export const guardarCuentasPago = (lista) => escribirMeta('negocio.cuentasPago', lista);

// WhatsApp de la patrona (para enviar comprobantes). Solo local.
export const leerWhatsappPatrona = async () => (await leerMeta('negocio.whatsappPatrona')) ?? '';
export const guardarWhatsappPatrona = (n) => escribirMeta('negocio.whatsappPatrona', String(n ?? '').replace(/\D/g, ''));

/** Castiga facturas fiadas (un Admin ya digitó su PIN). Cada una pasa a saldo 0 y queda marcada con el motivo. */
export async function castigarFiados({ facturas, motivo, usuario, autorizoId }) {
  const nuevas = facturas.map((f) => castigarFactura(f, { motivo, usuarioId: usuario?.Id, autorizoId }));   // valida todas antes de escribir
  for (const n of nuevas) await put('FACTURAS', n);
  return nuevas.length;
}
/** Facturas castigadas (para reabrirlas), recientes primero, con el nombre del cliente. */
export async function cargarCastigados() {
  const [facturas, cuentas, clientes] = await Promise.all([getAll('FACTURAS'), getAll('CUENTAS'), getAll('CLIENTES')]);
  return facturas.filter((f) => f.Castigado).map((f) => ({ ...f, cliente: clientes.find((c) => c.Id === cuentas.find((x) => x.Id === f.CuentaId)?.ClienteId)?.Nombre ?? '—' }))
    .sort((a, b) => (b.FechaCastigo ?? '').localeCompare(a.FechaCastigo ?? ''));
}
export const reabrirFiado = (f) => put('FACTURAS', reabrirFactura(f));

/** Elimina fiados importados del POS (de prueba) y recuerda su id del POS para que un reimport no los traiga de vuelta. */
export async function eliminarFiadosPrueba(facturas) {
  const validas = facturas.filter(esDePrueba); if (validas.length !== facturas.length) throw new Error('Solo se pueden eliminar fiados importados del POS.');
  const [pedidos, abonos] = await Promise.all([getAll('PEDIDOS_CUENTAS'), getAll('ABONOS_FIADO')]);
  for (const f of validas) {
    await borrarLocal('PEDIDOS_CUENTAS', pedidos.filter((p) => p.CuentaId === f.CuentaId).map((p) => p.Id));
    await borrarLocal('ABONOS_FIADO', abonos.filter((a) => a.FacturaId === f.Id).map((a) => a.Id));
    await borrarLocal('FACTURAS', [f.Id]);
    await borrarLocal('CUENTAS', [f.CuentaId]);
  }
  // el turno de migración (compartido por todos los fiados importados) se borra solo cuando ya no lo usa ninguna factura
  const quedan = await getAll('FACTURAS');
  for (const t of new Set(validas.map((f) => f.TurnoCajaId).filter(Boolean))) if (!quedan.some((x) => x.TurnoCajaId === t)) await borrarLocal('TURNOS_CAJA', [t]);
  const ya = (await leerMeta('importar.ignorados')) ?? [];
  await escribirMeta('importar.ignorados', [...new Set([...ya, ...validas.map((f) => f.OrigenPosId)])]);
  return validas.length;
}
