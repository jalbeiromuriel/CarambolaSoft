namespace CarambolaSoft.API.Dtos;

// ============================================================
//  DTOs planos del motor de sync (A4).
//  Espejo 1:1 del snapshot que vive en IndexedDB — sin
//  navegaciones, para que OpenAPI y el serializador no
//  se metan al ciclo Cuenta ↔ PedidosCuenta.
// ============================================================

public record CuentaSyncDto(
     Guid Id,
    Guid TurnoCajaId,
    string TipoCuenta,
    Guid? MesaId,
    Guid? ClienteId,
    string? NombreLibre,
    DateTime HoraApertura,
    DateTime? HoraCierre,
    decimal? TarifaPorHora,
    string Estado,
    DateTime UltimaModificacion
);

public record PedidoSyncDto(
    Guid Id,
    Guid CuentaId,
    Guid ProductoId,
    int Cantidad,
    decimal PrecioUnitarioHist,
    decimal CostoCompraHist,
    string CategoriaConsumo,
    string EstadoPedido,
    DateTime FechaHora,
    DateTime UltimaModificacion
);

/// Producto tal como lo edita el equipo (inventario/precios). StockActual NO se aplica en updates:
/// el stock del servidor lo mueven las ventas (trigger) y las compras (COMPRAS_INVENTARIO).
public record ProductoSyncDto(
    Guid Id,
    Guid CategoriaId,
    string Nombre,
    decimal PrecioVenta,
    decimal CostoCompra,
    decimal? CostoUltimaCompra,
    int StockActual,
    int StockMinimo,
    bool Activo,
    string? Codigo,
    bool ControlaStock,
    bool Favorito,
    string? PresentacionCompra,
    int? UnidadesPorPresentacion,
    Guid? FraccionOrigenId,
    int? FraccionRinde,
    DateTime UltimaModificacion
);

public record CambioPrecioSyncDto(
    Guid Id,
    Guid ProductoId,
    decimal PrecioAntes,
    decimal PrecioDespues,
    DateTime FechaHora,
    Guid? UsuarioId,
    string? UsuarioNombre,
    string? Motivo,
    bool Avisado,
    DateTime UltimaModificacion
);

