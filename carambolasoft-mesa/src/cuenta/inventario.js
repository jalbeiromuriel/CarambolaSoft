// src/cuenta/inventario.js — Lógica pura de inventario: márgenes, precio sugerido, simulador y promociones.
export const MARGEN_OBJETIVO = 40;       // % por defecto, editable en Márgenes
export const INCREMENTO_MAX = 500;       // el simulador sube hasta +500 % sobre el precio actual
export const INCREMENTO_INICIAL = 40;    // la barra arranca en +40 %
export const ATAJOS_INCREMENTO = [10, 25, 40, 50, 150, 300, 500];

const redondea50 = (n) => Math.ceil(n / 50) * 50;   // precios "de tienda": múltiplos de $50

/** Margen % = (precio − costo) ÷ precio. Sin precio → 0. */
export const margenPct = (precio, costo) => (precio > 0 ? ((precio - costo) / precio) * 100 : 0);
export const gananciaUnidad = (precio, costo) => precio - costo;

/** Precio que deja el margen pedido: costo ÷ (1 − m). Redondeado hacia arriba a $50. */
export function precioParaMargen(costo, margen) {
  const m = Number(margen);
  if (!(m >= 0 && m < 95) || !(costo > 0)) return null;
  return redondea50(costo / (1 - m / 100));
}
export const precioSugerido = (costo, objetivo = MARGEN_OBJETIVO) => precioParaMargen(costo, objetivo);

/** Color del margen: ok ≥ objetivo · medio ≥ objetivo−10 · bajo. */
export const nivelMargen = (m, objetivo = MARGEN_OBJETIVO) => (m >= objetivo ? 'ok' : m >= objetivo - 10 ? 'medio' : 'bajo');

export const precioConIncremento = (precio, pct) => Math.round(precio * (1 + Math.min(Math.max(Number(pct) || 0, 0), INCREMENTO_MAX) / 100));
export const incrementoDe = (precioActual, nuevo) => (precioActual > 0 ? Math.round(((nuevo - precioActual) / precioActual) * 100) : 0);

/** Simulación de un precio nuevo con unidades/mes estimadas. */
export function simular({ costo, precio, unidades = 0 }) {
  const gana = gananciaUnidad(precio, costo);
  return { margen: margenPct(precio, costo), gana, mes: gana * (Number(unidades) || 0) };
}

/** Reabastecer: antes vs. después con el costo nuevo (el precio no cambia solo). */
export function compararCompra({ precio, costoAntes, costoNuevo, objetivo = MARGEN_OBJETIVO }) {
  const antes = { gana: gananciaUnidad(precio, costoAntes), margen: margenPct(precio, costoAntes) };
  const despues = { gana: gananciaUnidad(precio, costoNuevo), margen: margenPct(precio, costoNuevo) };
  const bajo = costoNuevo > 0 && despues.margen < objetivo;
  return { antes, despues, bajo, sugerido: bajo ? precioSugerido(costoNuevo, objetivo) : null };
}

/** Productos por debajo del objetivo, del más flojo al mejor. Mide con el último costo de compra. */
export function productosBajoMargen(productos, objetivo = MARGEN_OBJETIVO) {
  return productos
    .filter((p) => p.Activo !== false && p.ControlaStock !== false && p.CostoCompra > 0 && p.PrecioVenta > 0)
    .map((p) => ({ p, margen: margenPct(p.PrecioVenta, p.CostoCompra), sugerido: precioSugerido(p.CostoCompra, objetivo) }))
    .filter((x) => x.margen < objetivo)
    .sort((a, b) => a.margen - b.margen);
}

// ── Promociones: precio promo entre fechas (YYYY-MM-DD) y, opcional, franja horaria (HH:MM; admite cruzar medianoche)
const aMin = (hhmm) => { const [h, m] = String(hhmm).split(':').map(Number); return h * 60 + m; };
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export function promoEstado(promo, ahora = new Date()) {
  if (!promo) return null;
  const hoy = iso(ahora);
  if (hoy > promo.Fin) return 'VENCIDA';
  if (hoy < promo.Ini) return 'FUTURA';
  if (promo.HoraIni && promo.HoraFin) {
    const t = ahora.getHours() * 60 + ahora.getMinutes(), i = aMin(promo.HoraIni), f = aMin(promo.HoraFin);
    const dentro = f > i ? t >= i && t <= f : t >= i || t <= f;
    return dentro ? 'ACTIVA' : 'FUERA_HORARIO';
  }
  return 'ACTIVA';
}
/** Precio que se cobra ahora: el de promo solo si está ACTIVA. */
export const precioVigente = (p, ahora = new Date()) => (promoEstado(p.Promo, ahora) === 'ACTIVA' ? p.Promo.Precio : p.PrecioVenta);

export function validarPromo(promo) {
  if (!(promo?.Precio > 0)) return 'Escribe el precio promocional';
  if (!promo.Ini || !promo.Fin) return 'Completa las fechas';
  if (promo.Fin < promo.Ini) return 'La fecha fin es anterior al inicio';
  if (!!promo.HoraIni !== !!promo.HoraFin) return 'Completa la franja horaria';
  return null;
}
export const descuentoPct = (normal, promo) => (normal > 0 ? Math.round((1 - promo / normal) * 100) : 0);

// ── Fraccionados: copa/cigarrillo suelto que sale de un envase (botella/paquete). StockActual = unidades sueltas.
export const esFraccionado = (p) => !!p?.Fraccion?.OrigenId && p.Fraccion.Rinde > 0;
export const envasesDe = (p, origen) => (esFraccionado(p) && origen ? origen.StockActual ?? 0 : 0);
/** Unidades que se pueden vender: sueltas + envases cerrados × rendimiento. */
export const disponible = (p, origen) => (p.StockActual ?? 0) + envasesDe(p, origen) * (p.Fraccion?.Rinde ?? 0);
/** Descarga q unidades abriendo envases cuando faltan sueltas. null si no alcanza. */
export function descargar(p, origen, q) {
  if (!esFraccionado(p)) return (p.StockActual ?? 0) >= q ? { prod: { ...p, StockActual: p.StockActual - q }, origen: null, abiertos: 0 } : null;
  if (disponible(p, origen) < q) return null;
  let sueltas = p.StockActual ?? 0, env = origen.StockActual ?? 0, abiertos = 0;
  while (sueltas < q) { env -= 1; sueltas += p.Fraccion.Rinde; abiertos += 1; }
  return { prod: { ...p, StockActual: sueltas - q }, origen: abiertos ? { ...origen, StockActual: env } : null, abiertos };
}
/** Abre un envase a mano (+Rinde sueltas, −1 envase). */
export function abrirEnvase(p, origen) {
  if (!esFraccionado(p) || !origen || (origen.StockActual ?? 0) <= 0) return null;
  return { prod: { ...p, StockActual: (p.StockActual ?? 0) + p.Fraccion.Rinde }, origen: { ...origen, StockActual: origen.StockActual - 1 } };
}
/** Texto de stock: "11 sueltas · 3 env." o "14 u". */
export const textoStock = (p, origen) => (esFraccionado(p) ? `${p.StockActual ?? 0} sueltas · ${envasesDe(p, origen)} env.` : `${p.StockActual ?? 0} u`);
