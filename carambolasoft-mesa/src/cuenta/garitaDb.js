// src/cuenta/garitaDb.js — Escrituras de la garita (IndexedDB). La lógica pura vive en garita.js.
import { put, get, getAll } from '../db/repository.js';
import { PRODUCTO_GARITA_ID, nuevoReloj, avanzarReloj } from './garita.js';

/** Suma `horas` al pedido "Garita" de la cuenta (lo crea si no existe). Es un servicio: no mueve stock. */
export async function cobrarHoraA(cuenta, horas = 1) {
  const prod = await get('PRODUCTOS', PRODUCTO_GARITA_ID);
  if (!prod) throw new Error('Falta el producto Garita');
  const previo = (await getAll('PEDIDOS_CUENTAS')).find(
    (p) => p.CuentaId === cuenta.Id && p.ProductoId === prod.Id && p.EstadoPedido === 'ENTREGADO');
  if (previo) return put('PEDIDOS_CUENTAS', { ...previo, Cantidad: previo.Cantidad + horas });
  return put('PEDIDOS_CUENTAS', {
    CuentaId: cuenta.Id, ProductoId: prod.Id, Cantidad: horas,
    PrecioUnitarioHist: prod.PrecioVenta, CostoCompraHist: 0, CategoriaConsumo: 'OTROS',
    EstadoPedido: 'ENTREGADO', FechaHora: new Date().toISOString(), Detalle: 'Garita',
  });
}

/** Persona nueva en la garita: cuenta propia + primera hora cobrada al entrar. */
export async function agregarPersona(relojId, { cliente, etiqueta }) {
  const c = await put('CUENTAS', {
    TipoCuenta: 'GARITA', MesaId: null, GaritaRelojId: relojId, GrupoMesaId: null,
    ClienteId: cliente?.Id ?? null, NombreLibre: etiqueta,
    HoraApertura: new Date().toISOString(), HoraCierre: null, TarifaPorHora: null, Estado: 'ABIERTA',
  });
  await cobrarHoraA(c, 1);
  return c;
}

/** Abre la garita: reloj nuevo + primera persona. */
export async function abrirGarita(persona) {
  const reloj = await put('GARITAS_RELOJ', nuevoReloj());
  return agregarPersona(reloj.Id, persona);
}

/** Aviso confirmado: otra hora a los marcados y el reloj avanza (aunque no marquen a nadie). */
export async function cobrarAviso(reloj, cuentas) {
  for (const c of cuentas) await cobrarHoraA(c, 1);
  await put('GARITAS_RELOJ', avanzarReloj(reloj));
}

export async function cerrarReloj(relojId) {
  const r = await get('GARITAS_RELOJ', relojId);
  if (r && r.Activa) await put('GARITAS_RELOJ', { ...r, Activa: false });
}
