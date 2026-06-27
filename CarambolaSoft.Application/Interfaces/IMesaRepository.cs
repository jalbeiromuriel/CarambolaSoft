using CarambolaSoft.Shared.DTOs.Mesas;

namespace CarambolaSoft.Application.Interfaces;

/// <summary>
/// Contrato de persistencia para MESAS_BILLAR.
/// La implementación vive en CarambolaSoft.Infrastructure.
/// </summary>
public interface IMesaRepository
{
    Task<IEnumerable<MesaDto>> ObtenerTodasAsync(CancellationToken ct = default);
    Task<MesaDto?> ObtenerPorIdAsync(Guid id, CancellationToken ct = default);
    Task<bool> CambiarEstadoAsync(Guid id, string nuevoEstado, CancellationToken ct = default);
}
