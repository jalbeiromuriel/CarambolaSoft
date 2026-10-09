// src/cuenta/cajaDb.js — Lecturas y escrituras de la caja (IndexedDB). La lógica pura vive en caja.js.
import { getAll, put } from '../db/repository.js';
import { resumenTurno, arqueo, inventarioVendido } from './caja.js';

const abierto = (r) => r.TurnoCajaId == null;   // turno abierto = aún sin sellar

/** Todo lo del turno abierto + lo necesario para nombrar cada movimiento. */
export async function cargarTurno() {
  const [facturas, abonos, gastos, cuentas, mesas, clientes, pedidos, productos, cierres, usuarios, notas, maquinas, maqMovs] = await Promise.all([
    getAll('FACTURAS'), getAll('ABONOS_FIADO'), getAll('GASTOS_CAJA'), getAll('CUENTAS'), getAll('MESAS_BILLAR'),
    getAll('CLIENTES'), getAll('PEDIDOS_CUENTAS'), getAll('PRODUCTOS'), getAll('CIERRE_DIA'), getAll('USUARIOS'), getAll('CIERRE_NOTAS'), getAll('MAQUINAS'), getAll('MAQUINAS_MOVIMIENTOS'),
  ]);
  const t = { facturas: facturas.filter(abierto), abonos: abonos.filter(abierto), gastos: gastos.filter(abierto), maq: maqMovs.filter((x) => (x.Tipo === 'PRESTAMO' || x.Tipo === 'DEVOLUCION') && abierto(x)) };
  const sellados = cierres.filter((c) => c.Confirmado);
  const abiertas = cuentas.filter((c) => c.Estado === 'ABIERTA');
  return {
    ...t, notas: notas.sort((a, b) => (a.FechaHora ?? '').localeCompare(b.FechaHora ?? '')), vacio: !t.facturas.length && !t.abonos.length && !t.gastos.length && !t.maq.length, maquinas, maqMovs, cuentas, mesas, clientes, productos, usuarios, abiertas, abonosTodos: abonos, facturasTodas: facturas, gastosTodos: gastos, pedidos,
    resumen: resumenTurno(t),
    vendido: inventarioVendido({ ...t, pedidos, productos }),
    cierres: sellados.sort((a, b) => (b.FechaCierre ?? '').localeCompare(a.FechaCierre ?? '')),
  };
}

/** Gasto de caja: lo autoriza un Admin (PIN verificado antes de llamar aquí). */
export const registrarGasto = ({ concepto, monto, categoria, metodo, usuarioId, autorizoId }) =>
  put('GASTOS_CAJA', { TurnoCajaId: null, Concepto: concepto.trim(), Monto: monto, Categoria: categoria, MetodoPago: metodo, FechaHora: new Date().toISOString(), UsuarioId: usuarioId ?? null, AutorizoId: autorizoId ?? null });

/**
 * Cierra la caja: crea el turno, sella facturas/abonos/gastos con su Id y guarda el CIERRE_DIA confirmado (inmutable).
 * Devuelve el cierre. Lanza si hay cuentas abiertas.
 */
export async function cerrarCaja({ usuario, contado, nota }) {
  const t = await cargarTurno();
  if (t.vacio) throw new Error('No hay movimientos en este turno: no hay nada que cerrar.');
  if (t.abiertas.length) throw new Error('Hay cuentas abiertas: ciérralas antes de cerrar caja.');
  const r = t.resumen, ahora = new Date().toISOString();
  const ar = arqueo(r.efectivoEsperado, contado);
  const primera = [...t.facturas.map((f) => f.FechaHora), ...t.gastos.map((g) => g.FechaHora), ...t.maq.map((p) => p.FechaHora)].filter(Boolean).sort()[0];
  const turno = await put('TURNOS_CAJA', { UsuarioId: usuario?.Id ?? null, FechaApertura: primera ?? ahora, FechaCierre: ahora, BaseEfectivo: 0, EfectivoRealEntregado: contado });
  for (const f of t.facturas) await put('FACTURAS', { ...f, TurnoCajaId: turno.Id });
  for (const a of t.abonos) await put('ABONOS_FIADO', { ...a, TurnoCajaId: turno.Id });
  for (const g of t.gastos) await put('GASTOS_CAJA', { ...g, TurnoCajaId: turno.Id });
  // movimientos del fondo de máquinas del turno quedan sellados con él (ya no se editan)
  for (const x of t.maqMovs.filter(abierto)) await put('MAQUINAS_MOVIMIENTOS', { ...x, TurnoCajaId: turno.Id });
  const suma = (k) => t.facturas.reduce((s, f) => s + (f[k] ?? 0), 0);
  return put('CIERRE_DIA', {
    TurnoCajaId: turno.Id, Numero: t.cierres.length + 1, Fecha: ahora.slice(0, 10), FechaCierre: ahora, UsuarioId: usuario?.Id ?? null, UsuarioNombre: usuario?.Nombre ?? '',
    TotalTiempo: suma('SubtotalTiempo'), TotalLicor: suma('SubtotalLicor'), TotalOtros: suma('SubtotalSnacks') + suma('SubtotalOtros'),
    TotalGeneral: r.totalVendido, TotalFiado: r.fiado, TotalGastos: r.totalGastos, TotalPremiosMaq: r.totalPrestamos - r.totalDevoluciones, TotalCobrosFiado: r.totalCobros,
    EfectivoEsperado: r.efectivoEsperado, EfectivoReportado: contado, Descuadre: ar.diferencia, Nota: nota?.trim() || '',
    PorMetodo: r.porMetodo, NVentas: r.nVentas, Confirmado: true,
  });
}

/** Aclaración a un cierre sellado: el cierre no se edita; la nota queda aparte, con fecha y autor (lo autoriza un Admin). */
export const agregarAclaracion = ({ cierreId, texto, usuario, autorizoId }) =>
  put('CIERRE_NOTAS', { CierreId: cierreId, Texto: texto.trim(), FechaHora: new Date().toISOString(), UsuarioId: usuario?.Id ?? null, UsuarioNombre: usuario?.Nombre ?? '', AutorizoId: autorizoId ?? null });
