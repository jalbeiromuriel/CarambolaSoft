using CarambolaSoft.Application.Interfaces;
using CarambolaSoft.Shared.DTOs.Mesas;

namespace CarambolaSoft.Application.UseCases.Mesas;

public class ObtenerMesaPorIdUseCase(IMesaRepository repo)
{
    /// <returns>El DTO de la mesa, o null si no existe.</returns>
    public Task<MesaDto?> EjecutarAsync(Guid id, CancellationToken ct = default)
        => repo.ObtenerPorIdAsync(id, ct);
}
