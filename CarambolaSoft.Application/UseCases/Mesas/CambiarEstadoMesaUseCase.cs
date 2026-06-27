using CarambolaSoft.Application.Interfaces;

namespace CarambolaSoft.Application.UseCases.Mesas;

public class CambiarEstadoMesaUseCase(IMesaRepository repo)
{
    private static readonly HashSet<string> EstadosValidos =
        ["DISPONIBLE", "OCUPADA", "MANTENIMIENTO"];

    /// <summary>
    /// Cambia el estado de una mesa aplicando las reglas de negocio.
    /// </summary>
    /// <returns>
    ///   true  → cambio aplicado,
    ///   false → mesa no encontrada,
    ///   lanza InvalidOperationException si la transición no está permitida.
    /// </returns>
    public async Task<bool> EjecutarAsync(
        Guid id, string nuevoEstado, CancellationToken ct = default)
    {
        nuevoEstado = nuevoEstado.ToUpperInvariant();

        if (!EstadosValidos.Contains(nuevoEstado))
            throw new ArgumentException(
                $"Estado '{nuevoEstado}' no es válido.", nameof(nuevoEstado));

        // Regla de negocio: MANTENIMIENTO solo se puede aplicar desde DISPONIBLE
        // para evitar que se ponga en mantenimiento una mesa activa con jugadores.
        // [RIESGO] Si se pone MANTENIMIENTO sobre OCUPADA se pierde la sesión activa.
        var mesa = await repo.ObtenerPorIdAsync(id, ct);
        if (mesa is null) return false;

        if (nuevoEstado == "MANTENIMIENTO" && mesa.Estado == "OCUPADA")
            throw new InvalidOperationException(
                $"No se puede poner en MANTENIMIENTO la mesa #{mesa.Numero} mientras está OCUPADA. " +
                "Cierra la partida primero.");

        return await repo.CambiarEstadoAsync(id, nuevoEstado, ct);
    }
}
