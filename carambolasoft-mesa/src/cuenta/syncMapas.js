// src/cuenta/syncMapas.js — Convierte los registros de la app (IndexedDB) al formato plano del API. Lógica pura.

/** Categoría de la app → CategoriaSyncDto. */
export const categoriaADto = (c) => ({
  Id: c.Id, Nombre: String(c.Nombre ?? '').trim(), Icono: c.Emoji ?? null, ColorHex: c.Color ?? null,
  CategoriaConsumo: c.Consumo ?? null, Activo: c.Activo !== false, UltimaModificacion: c.UltimaModificacion ?? new Date().toISOString(),
});

/** Producto de la app → ProductoSyncDto. Presentacion/Fraccion (objetos) se aplanan; si vienen incompletas se mandan en null. */
export function productoADto(p) {
  const pr = p.Presentacion, fr = p.Fraccion;
  const presOk = pr?.Nombre && Number(pr.Unidades) >= 2;
  const fracOk = fr?.OrigenId && Number(fr.Rinde) >= 1;
  return {
    Id: p.Id, CategoriaId: p.CategoriaId, Nombre: String(p.Nombre ?? '').trim(),
    PrecioVenta: Number(p.PrecioVenta) || 0, CostoCompra: Number(p.CostoCompra) || 0,
    CostoUltimaCompra: p.CostoUltimaCompra ?? p.CostoCompra ?? null,
    StockActual: Math.max(0, Math.round(Number(p.StockActual) || 0)), StockMinimo: Math.max(0, Math.round(Number(p.StockMinimo) || 0)),
    Activo: p.Activo !== false, Codigo: p.Codigo ?? null, ControlaStock: p.ControlaStock !== false, Favorito: !!p.Favorito,
    PresentacionCompra: presOk ? String(pr.Nombre).slice(0, 20) : null, UnidadesPorPresentacion: presOk ? Math.round(Number(pr.Unidades)) : null,
    FraccionOrigenId: fracOk ? fr.OrigenId : null, FraccionRinde: fracOk ? Math.round(Number(fr.Rinde)) : null,
    UltimaModificacion: p.UltimaModificacion ?? new Date().toISOString(),
  };
}

/** Qué se puede subir: sin categoría o de tiempo (mesa) no es inventario; el resto va, con los que salen de otro producto al final. */
export function planSubida(categorias, productos) {
  const cats = categorias.filter((c) => c.Nombre?.trim());
  const ids = new Set(cats.map((c) => c.Id));
  const omitidos = [], validos = [];
  for (const p of productos) (p.CategoriaId && ids.has(p.CategoriaId) && p.CategoriaConsumo !== 'TIEMPO' ? validos : omitidos).push(p);
  const orden = [...validos.filter((p) => !p.Fraccion?.OrigenId), ...validos.filter((p) => p.Fraccion?.OrigenId)];
  return { categorias: cats, productos: orden, omitidos };
}
