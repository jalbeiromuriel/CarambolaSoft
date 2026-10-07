// src/cuenta/catalogo.js — Catálogo de la cuenta: categoría, emoji, color, búsqueda, más vendidos, lo de siempre.
export const norm = (t) => (t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const GRUPOS = {
  licores:     { emoji: '🍺', color: '#e879f9' },
  snacks:      { emoji: '🍿', color: '#fbbf24' },
  frias:       { emoji: '🥤', color: '#38bdf8' },
  calientes:   { emoji: '☕', color: '#fb923c' },
  cigarrillos: { emoji: '🚬', color: '#9ca3af' },
  juegos:      { emoji: '🎲', color: '#fb7185' },
  granizados:  { emoji: '🧊', color: '#67e8f9' },
  tiempo:      { emoji: '🎱', color: '#22d3ee' },
  otros:       { emoji: '🛒', color: '#94a3b8' },
};

const POR_ENUM = {
  BEBIDAS_ALCOHOLICAS: 'licores', SNACKS: 'snacks', BEBIDAS_NO_ALCOHOLICAS: 'frias', TIEMPO: 'tiempo', OTROS: 'otros',
};
const PALABRAS = [
  ['granizado', 'granizados'], ['cigarr', 'cigarrillos'], ['juego', 'juegos'], ['garita', 'juegos'],
  ['caliente', 'calientes'], ['licor', 'licores'], ['alcohol', 'licores'], ['snack', 'snacks'], ['fria', 'frias'],
];

/** { clave, nombre, emoji, color } de un producto; el nombre de CATEGORIAS manda, si no el enum. */
export function categoriaDe(prod, categorias = []) {
  const cat = categorias.find((c) => c.Id === prod.CategoriaId);
  const nombre = cat?.Nombre ?? null;
  let clave = nombre ? PALABRAS.find(([p]) => norm(nombre).includes(p))?.[1] : null;
  clave = clave ?? POR_ENUM[prod.CategoriaConsumo] ?? 'otros';
  return { clave, nombre: nombre ?? NOMBRES[clave], ...GRUPOS[clave] };
}
const NOMBRES = {
  licores: 'Licores', snacks: 'Snacks', frias: 'Bebidas frías', calientes: 'Bebidas calientes',
  cigarrillos: 'Cigarrillos', juegos: 'Juegos', granizados: 'Granizados', tiempo: 'Tiempo', otros: 'Otros',
};
const DEL_POS = ['licores', 'snacks', 'frias', 'calientes', 'cigarrillos', 'juegos', 'granizados'];

/** Chips de categoría: las 7 del POS siempre + cualquier otra que traigan los productos. */
export function categoriasVisibles(productos, categorias = []) {
  const lista = DEL_POS.map((clave) => ({ clave, nombre: NOMBRES[clave], ...GRUPOS[clave] }));
  for (const p of productos) {
    const c = categoriaDe(p, categorias);
    if (!lista.some((x) => x.clave === c.clave) && c.clave !== 'tiempo') lista.push(c);
  }
  return lista;
}
export const colorTiempo = GRUPOS.tiempo.color;

export function filtrar(productos, q) {
  const t = norm(q).trim();
  return t ? productos.filter((p) => norm(p.Nombre).includes(t)) : productos;
}

/** Ids de producto por unidades vendidas (pedidos entregados de todas las cuentas). */
export function masVendidos(pedidos, tope = 6) {
  const v = {};
  for (const p of pedidos) if (p.EstadoPedido === 'ENTREGADO') v[p.ProductoId] = (v[p.ProductoId] ?? 0) + p.Cantidad;
  return Object.entries(v).sort((a, b) => b[1] - a[1]).slice(0, tope).map(([id]) => id);
}

/** Ids de producto que ESTE cliente suele pedir, por en cuántas cuentas distintas lo pidió. */
export function loDeSiempre(pedidos, cuentas, clienteId, cuentaActualId) {
  if (!clienteId) return [];
  const suyas = new Set(cuentas.filter((c) => c.ClienteId === clienteId && c.Id !== cuentaActualId).map((c) => c.Id));
  const visitas = {};
  for (const p of pedidos) {
    if (p.EstadoPedido !== 'ENTREGADO' || !suyas.has(p.CuentaId)) continue;
    (visitas[p.ProductoId] ??= new Set()).add(p.CuentaId);
  }
  return Object.entries(visitas).sort((a, b) => b[1].size - a[1].size).map(([id]) => id);
}

/** Resumen por categoría (para la tarjeta de la cuenta): [{clave,nombre,emoji,color,total}]. */
export function resumenPorCategoria(entregados, productos, categorias) {
  const acc = {};
  for (const p of entregados) {
    const prod = productos.find((x) => x.Id === p.ProductoId);
    const cat = categoriaDe(prod ?? { CategoriaConsumo: p.CategoriaConsumo }, categorias);
    (acc[cat.clave] ??= { ...cat, total: 0 }).total += p.PrecioUnitarioHist * p.Cantidad;
  }
  return Object.values(acc);
}
