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

/** Cambio de precio de la app → CambioPrecioSyncDto. */
export const cambioPrecioADto = (c) => ({
  Id: c.Id, ProductoId: c.ProductoId, PrecioAntes: Number(c.Antes) || 0, PrecioDespues: Number(c.Despues) || 0,
  FechaHora: c.Fecha, UsuarioId: c.UsuarioId ?? null, UsuarioNombre: c.Usuario || null, Motivo: c.Motivo || null,
  Avisado: !!c.Avisado, UltimaModificacion: c.UltimaModificacion ?? c.Fecha,
});

/** ¿Este producto es inventario subible? (con categoría válida y no de tiempo de mesa) */
export const esProductoSubible = (p, idsCategorias) => !!p.CategoriaId && idsCategorias.has(p.CategoriaId) && p.CategoriaConsumo !== 'TIEMPO';

// ── Bajada: lo que trae el servidor se mezcla con lo local SIN pisar lo que este equipo aún no ha subido.
/** Producto del servidor (PascalCase plano) → campos de catálogo de la app. NO incluye StockActual: el stock manda en el equipo hasta que suban las ventas. */
export function camposProductoServidor(s) {
  return {
    CategoriaId: s.CategoriaId, Nombre: s.Nombre, PrecioVenta: Number(s.PrecioVenta), CostoCompra: Number(s.CostoCompra),
    CostoUltimaCompra: s.CostoUltimaCompra ?? undefined, StockMinimo: s.StockMinimo, Activo: s.Activo !== false, Codigo: s.Codigo ?? undefined,
    ControlaStock: s.ControlaStock !== false, Favorito: !!s.Favorito,
    Presentacion: s.PresentacionCompra && s.UnidadesPorPresentacion ? { Nombre: s.PresentacionCompra, Unidades: s.UnidadesPorPresentacion } : undefined,
    Fraccion: s.FraccionOrigenId && s.FraccionRinde ? { OrigenId: s.FraccionOrigenId, Rinde: s.FraccionRinde } : undefined,
  };
}
/** Qué guardar en local al llegar un producto del servidor: null = no tocar (el local tiene cambios sin subir). */
export function mezclarProducto(local, servidor) {
  const campos = camposProductoServidor(servidor);
  if (!local) return { Id: servidor.Id, ...campos, StockActual: servidor.StockActual ?? 0, EsSincronizado: true };
  if (local.EsSincronizado === false) return null;
  const mezcla = { ...local, ...campos, EsSincronizado: true };
  if (campos.Presentacion === undefined) delete mezcla.Presentacion;
  if (campos.Fraccion === undefined) delete mezcla.Fraccion;
  return mezcla;
}
/** Categoría del servidor → categoría de la app. */
export function mezclarCategoria(local, s) {
  const campos = { Nombre: s.Nombre, Emoji: s.Icono ?? local?.Emoji, Color: s.ColorHex ?? local?.Color, Consumo: s.CategoriaConsumo ?? local?.Consumo, Activo: s.Activo !== false };
  if (!local) return { Id: s.Id, ...campos, EsSincronizado: true };
  if (local.EsSincronizado === false) return null;
  return { ...local, ...campos, EsSincronizado: true };
}

