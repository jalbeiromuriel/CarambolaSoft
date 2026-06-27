using CarambolaSoft.Application.Interfaces;
using CarambolaSoft.Infrastructure.Persistence;
using CarambolaSoft.Shared.DTOs.Mesas;
using Microsoft.EntityFrameworkCore;

namespace CarambolaSoft.Infrastructure.Repositories;

public class MesaRepository(CarambolaSoftDbContext db) : IMesaRepository
{
    public async Task<IEnumerable<MesaDto>> ObtenerTodasAsync(CancellationToken ct = default)
        => await db.MesasBillars
            .AsNoTracking()
            .OrderBy(m => m.Numero)
            .Select(m => new MesaDto
            {
                Id = m.Id,
                Numero = m.Numero,
                Tipo = m.Tipo,
                Estado = m.Estado
            })
            .ToListAsync(ct);

    public async Task<MesaDto?> ObtenerPorIdAsync(Guid id, CancellationToken ct = default)
        => await db.MesasBillars
            .AsNoTracking()
            .Where(m => m.Id == id)
            .Select(m => new MesaDto
            {
                Id = m.Id,
                Numero = m.Numero,
                Tipo = m.Tipo,
                Estado = m.Estado
            })
            .FirstOrDefaultAsync(ct);

    public async Task<bool> CambiarEstadoAsync(
        Guid id, string nuevoEstado, CancellationToken ct = default)
    {
        var mesa = await db.MesasBillars.FindAsync([id], ct);
        if (mesa is null) return false;

        mesa.Estado = nuevoEstado;
        mesa.UltimaModificacion = DateTime.UtcNow;
        mesa.EsSincronizado = false;   // marca pendiente de sync

        await db.SaveChangesAsync(ct);
        return true;
    }
}
