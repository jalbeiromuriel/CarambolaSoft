using CarambolaSoft.Application.Interfaces;
using CarambolaSoft.Shared.DTOs.Mesas;

namespace CarambolaSoft.Application.UseCases.Mesas;

public class ObtenerMesasUseCase(IMesaRepository repo)
{
    public Task<IEnumerable<MesaDto>> EjecutarAsync(CancellationToken ct = default)
        => repo.ObtenerTodasAsync(ct);
}
