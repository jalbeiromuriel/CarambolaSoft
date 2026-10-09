// src/cuenta/cajaDb.js — Lecturas y escrituras de la caja (IndexedDB). La lógica pura vive en caja.js.
import { getAll, put } from '../db/repository.js';
import { resumenTurno, arqueo, inventarioVendido } from './caja.js';

const abierto = (r) => r.TurnoCajaId == null;   // turno abierto = aún sin sellar

/** Todo lo del turno abierto + lo necesario para nombrar cada movimiento. */
export async function cargarTurno() {
  const [facturas, abonos, gastos, cuentas, mesas, clientes, pedidos, productos, cierres, usuarios] = await Promise.all([
    getAll('FACTURAS'), getAll('ABONOS_FIADO'), getAll('GASTOS_CAJA'), getAll('CUENTAS'), getAll('MESAS_BILLAR'),
    getAll('CLIENTES'), getAll('PEDIDOS_CUENTAS'), getAll('PRODUCTOS'), getAll('CIERRE_DIA'), getAll('USUARIOS'),
  ]);
  const t = { facturas: facturas.filter(abierto), abonos: abonos.filter(abierto), gastos: gastos.filter(abierto) };
  const abiertas = cuentas.filter((c) => c.Estado === 'ABIERTA');
  return {
    ...t, cuentas, mesas, clientes, productos, usuarios, abiertas, abonosTodos: abonos, facturasTodas: facturas,
    resumen: resumenTurno(t),
    vendido: inventarioVendido({ ...t, pedidos, productos }),
    cierres: cierres.filter((c) => c.Confirmado).sort((a, b) => (b.FechaCierre ?? '').localeCompare(a.FechaCierre ?? '')),
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
  if (t.abiertas.length) throw new Error('Hay cuentas abiertas: ciérralas antes de cerrar caja.');
  const r = t.resumen, ahora = new Date().toISOString();
  const ar = arqueo(r.efectivoEsperado, contado);
  const primera = [...t.facturas.map((f) => f.FechaHora), ...t.gastos.map((g) => g.FechaHora)].filter(Boolean).sort()[0];
  const turno = await put('TURNOS_CAJA', { UsuarioId: usuario?.Id ?? null, FechaApertura: primera ?? ahora, FechaCierre: ahora, BaseEfectivo: 0, EfectivoRealEntregado: contado });
  for (const f of t.facturas) await put('FACTURAS', { ...f, TurnoCajaId: turno.Id });
  for (const a of t.abonos) await put('ABONOS_FIADO', { ...a, TurnoCajaId: turno.Id });
  for (const g of t.gastos) await put('GASTOS_CAJA', { ...g, TurnoCajaId: turno.Id });
  const suma = (k) => t.facturas.reduce((s, f) => s + (f[k] ?? 0), 0);
  return put('CIERRE_DIA', {
    TurnoCajaId: turno.Id, Fecha: ahora.slice(0, 10), FechaCierre: ahora, UsuarioId: usuario?.Id ?? null, UsuarioNombre: usuario?.Nombre ?? '',
    TotalTiempo: suma('SubtotalTiempo'), TotalLicor: suma('SubtotalLicor'), TotalOtros: suma('SubtotalSnacks') + suma('SubtotalOtros'),
    TotalGeneral: r.totalVendido, TotalFiado: r.fiado, TotalGastos: r.totalGastos, TotalPremiosMaq: 0, TotalCobrosFiado: r.totalCobros,
    EfectivoEsperado: r.efectivoEsperado, EfectivoReportado: contado, Descuadre: ar.diferencia, Nota: nota?.trim() || '',
    PorMetodo: r.porMetodo, NVentas: r.nVentas, Confirmado: true,
  });
}
