// src/cuenta/importarPosDb.js — Aplica el plan de importarPos.js en IndexedDB. Nunca descuenta stock ni crea ventas nuevas.
import { getAll, put, leerMeta, escribirMeta } from '../db/repository.js';
import { norm } from './catalogo.js';
import { asegurarCategorias } from './categoriasDb.js';

export async function datosExistentes() {
  const [productos, clientes, facturas, ignorados] = await Promise.all([getAll('PRODUCTOS'), getAll('CLIENTES'), getAll('FACTURAS'), leerMeta('importar.ignorados')]);
  return { productos, clientes, facturas, ignorados: ignorados ?? [] };
}

export async function aplicarImportacion(plan) {
  const cats = await asegurarCategorias();
  const catPorNombre = new Map(cats.map((c) => [norm(c.Nombre).trim(), c]));
  const todos = await getAll('PRODUCTOS');
  const codigosUsados = new Set(todos.map((p) => p.Codigo).filter(Boolean));
  const posAId = new Map();   // id del POS → Id local (para ligar copas/sueltos a su envase)

  // 1) productos (sin Fraccion todavía)
  for (const it of plan.productos) {
    const cat = catPorNombre.get(norm(it.catNombre ?? '').trim());
    const previo = it.existenteId ? todos.find((p) => p.Id === it.existenteId) : null;
    const { Fraccion, Codigo, ...base } = it.datos;
    const cod = previo?.Codigo ?? (codigosUsados.has(Codigo) ? null : Codigo);
    if (cod) codigosUsados.add(cod);
    const fila = await put('PRODUCTOS', { ...(previo ?? {}), ...base, ...(cod ? { Codigo: cod } : {}), CategoriaId: cat?.Id ?? previo?.CategoriaId ?? null, CategoriaConsumo: cat?.Consumo ?? previo?.CategoriaConsumo ?? 'OTROS' });
    posAId.set(it.pos, fila.Id); it._fila = fila;
  }
  // 2) fraccionados: ya existen todos los envases
  for (const it of plan.productos) {
    if (!it.fracOrigenPos || !posAId.has(it.fracOrigenPos)) continue;
    await put('PRODUCTOS', { ...it._fila, Fraccion: { OrigenId: posAId.get(it.fracOrigenPos), Rinde: it.datos.Fraccion.Rinde } });
  }
  // 3) clientes
  const cliPosAId = new Map();
  for (const c of plan.clientes) {
    const previo = c.existenteId ? (await getAll('CLIENTES')).find((x) => x.Id === c.existenteId) : null;
    const fila = await put('CLIENTES', previo ? { ...previo, Apodo: previo.Apodo || c.datos.Apodo, Visitas: Math.max(previo.Visitas ?? 0, c.datos.Visitas) } : { ...c.datos, Activo: true });
    cliPosAId.set(c.pos, fila.Id); c.alias.forEach((a) => cliPosAId.set(a, fila.Id));
  }
  // 4) fiados: turno de migración (sellado, para que no cuenten en el turno abierto), cuenta liquidada + factura + abonos previos + productos
  let turnoId = null; const prodPorNombre = new Map((await getAll('PRODUCTOS')).map((p) => [norm(p.Nombre).trim(), p]));
  const ahora = new Date().toISOString();
  for (const f of plan.fiados) {
    turnoId ??= (await put('TURNOS_CAJA', { UsuarioId: null, FechaApertura: ahora, FechaCierre: ahora, BaseEfectivo: 0, EfectivoRealEntregado: 0, Migracion: true, Nota: 'Migración desde el POS' })).Id;
    const cuenta = await put('CUENTAS', { TipoCuenta: 'LICORES', MesaId: null, ClienteId: cliPosAId.get(f.clientePos) ?? null, NombreLibre: f.nombreCuenta, Estado: 'LIQUIDADA', HoraApertura: f.fechaHora, HoraCierre: f.fechaHora, OrigenPosId: f.posId });
    const fac = await put('FACTURAS', { CuentaId: cuenta.Id, TurnoCajaId: turnoId, Numero: f.numero, FechaHora: f.fechaHora, TotalPagar: f.orig, SubtotalLicor: f.orig, TotalPendienteFiado: f.saldo, MetodoPago: 'FIADO', MetodoPagoSecundario: null, EstadoPago: 'FIADO', Migrado: true, OrigenPosId: f.posId });
    if (f.abon > 0) await put('ABONOS_FIADO', { FacturaId: fac.Id, TurnoCajaId: turnoId, Monto: f.abon, MetodoPago: 'EFECTIVO', FechaHora: f.fechaHora, Nota: 'Abonos previos (POS)', Migrado: true });
    for (const it of f.items) {
      const p = prodPorNombre.get(norm(it.nombre).trim());
      await put('PEDIDOS_CUENTAS', { CuentaId: cuenta.Id, ProductoId: p?.Id ?? null, Detalle: p ? undefined : it.nombre, Cantidad: it.cant, EstadoPedido: 'ENTREGADO', CategoriaConsumo: p?.CategoriaConsumo ?? 'OTROS', PrecioUnitarioHist: it.precio, CostoCompraHist: 0, FechaHora: f.fechaHora, Migrado: true });
    }
  }
  if (plan.ultimoNumero > 0) await escribirMeta('facturas.ultimoNumero', Math.max(plan.ultimoNumero, Number(await leerMeta('facturas.ultimoNumero')) || 0));
}
