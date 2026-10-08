// src/cuenta/categoriasDb.js — Gestión de categorías de producto (nunca se borran: se desactivan).
import { getAll, put } from '../db/repository.js';
import { CATEGORIAS_BASE, deCategoria, nombreRepetido } from './catalogo.js';
import { norm } from './catalogo.js';

/** Primera vez: crea las 7 categorías del POS y asigna CategoriaId a los productos que aún no la tienen. Idempotente. */
let enCurso = null;   // una sola ejecución a la vez (React monta dos veces en desarrollo y duplicaba filas)
export function asegurarCategorias() {
  enCurso ??= crearBase().finally(() => { enCurso = null; });
  return enCurso;
}
async function crearBase() {
  let cats = await getAll('CATEGORIAS');
  for (const b of CATEGORIAS_BASE) {
    if (!cats.some((c) => norm(c.Nombre) === norm(b.Nombre))) {
      const { _clave, ...fila } = b;
      cats.push(await put('CATEGORIAS', { ...fila, Activo: true }));
    }
  }
  const productos = await getAll('PRODUCTOS');
  const POR_ENUM = { BEBIDAS_ALCOHOLICAS: 'licores', SNACKS: 'snacks', BEBIDAS_NO_ALCOHOLICAS: 'frias', OTROS: null };
  for (const p of productos) {
    if (p.CategoriaId || p.CategoriaConsumo === 'TIEMPO') continue;
    const clave = POR_ENUM[p.CategoriaConsumo];
    const destino = clave && cats.find((c) => deCategoria(c).clave === clave);
    if (destino) await put('PRODUCTOS', { ...p, CategoriaId: destino.Id });
  }
  return getAll('CATEGORIAS');
}

export async function guardarCategoria(categorias, datos, id = null) {
  const n = datos.Nombre.trim();
  if (!n) return { error: 'Escribe el nombre de la categoría' };
  const dup = nombreRepetido(categorias, n, id);
  if (dup) return { error: `Ya existe la categoría "${dup.Nombre}"` };
  const actual = id ? categorias.find((c) => c.Id === id) : null;
  const guardada = await put('CATEGORIAS', { ...(actual ?? { Activo: true }), ...datos, Nombre: n });
  if (actual) {   // sus productos heredan la categoría de factura nueva
    for (const p of (await getAll('PRODUCTOS')).filter((x) => x.CategoriaId === id && x.CategoriaConsumo !== datos.Consumo))
      await put('PRODUCTOS', { ...p, CategoriaConsumo: datos.Consumo });
  }
  return { ok: guardada };
}

/** Desactiva una categoría; no se puede si aún tiene productos activos. */
export async function desactivarCategoria(cat) {
  const n = (await getAll('PRODUCTOS')).filter((p) => p.CategoriaId === cat.Id && p.Activo !== false).length;
  if (n > 0) return { error: `"${cat.Nombre}" tiene ${n} producto(s). Muévelos a otra categoría primero.` };
  await put('CATEGORIAS', { ...cat, Activo: false });
  return { ok: true };
}
