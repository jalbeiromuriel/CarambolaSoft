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