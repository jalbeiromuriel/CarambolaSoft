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
  if (cat) return deCategoria(cat);
  const clave = POR_ENUM[prod.CategoriaConsumo] ?? 'otros';
  return { clave, nombre: NOMBRES[clave], ...GRUPOS[clave] };
}
/** Una fila de CATEGORIAS → { clave, nombre, emoji, color }. Emoji/Color propios mandan; si no, los del grupo por nombre. */
export function deCategoria(cat) {
  const grupo = PALABRAS.find(([p]) => norm(cat.Nombre).includes(p))?.[1];
  const base = GRUPOS[grupo ?? 'otros'];
  return { clave: grupo ?? cat.Id, nombre: cat.Nombre, emoji: cat.Emoji ?? base.emoji, color: cat.Color ?? base.color };
}
const NOMBRES = {
  licores: 'Licores', snacks: 'Snacks', frias: 'Bebidas frías', calientes: 'Bebidas calientes',
  cigarrillos: 'Cigarrillos', juegos: 'Juegos', granizados: 'Granizados', tiempo: 'Tiempo', otros: 'Otros',
};
const DEL_POS = ['licores', 'snacks', 'frias', 'calientes', 'cigarrillos', 'juegos', 'granizados'];

/** Chips de categoría: las 7 del POS siempre + cualquier otra que traigan los productos. */
export function categoriasVisibles(productos, categorias = []) {
  const activas = categorias.filter((c) => c.Activo !== false);
  if (activas.length) return activas.map(deCategoria).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  const lista = DEL_POS.map((clave) => ({ clave, nombre: NOMBRES[clave], ...GRUPOS[clave] }));
  for (const p of productos) {
    const c = categoriaDe(p, categorias);
    if (!lista.some((x) => x.clave === c.clave) && c.clave !== 'tiempo') lista.push(c);
  }
  return lista;
}
/** Categorías base que se crean la primera vez: nombre, emoji, color y a qué categoría de factura (enum) pertenecen. */
export const CATEGORIAS_BASE = DEL_POS.map((clave) => ({ Nombre: NOMBRES[clave], Emoji: GRUPOS[clave].emoji, Color: GRUPOS[clave].color,
  Consumo: { licores: 'BEBIDAS_ALCOHOLICAS', snacks: 'SNACKS', frias: 'BEBIDAS_NO_ALCOHOLICAS', calientes: 'BEBIDAS_NO_ALCOHOLICAS', granizados: 'BEBIDAS_NO_ALCOHOLICAS' }[clave] ?? 'OTROS', _clave: clave }));
export const CONSUMOS = [['BEBIDAS_ALCOHOLICAS', 'Licor'], ['SNACKS', 'Snacks'], ['BEBIDAS_NO_ALCOHOLICAS', 'Bebida sin alcohol'], ['OTROS', 'Otros']];
export const EMOJIS_CAT = ['🍺', '🥤', '🍿', '🚬', '🎲', '🧊', '☕', '🍔', '🌭', '🍦', '🍫', '🍬', '🥃', '🍷', '🧃', '🥜', '🔥', '⚡', '📦', '🎯', '🎱', '🃏'];
export const COLORES_CAT = ['#e879f9', '#fbbf24', '#38bdf8', '#fb923c', '#9ca3af', '#fb7185', '#67e8f9', '#4ade80', '#a78bfa', '#f87171'];
/** ¿Ya existe una categoría con ese nombre (sin tildes ni mayúsculas)? */
export const nombreRepetido = (categorias, nombre, idActual = null) => categorias.find((c) => c.Activo !== false && c.Id !== idActual && norm(c.Nombre) === norm(nombre));
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
