using CarambolaSoft.Application.UseCases.Mesas;
using CarambolaSoft.Shared.DTOs.Mesas;
using Microsoft.AspNetCore.Mvc;

namespace CarambolaSoft.API.Controllers;

[ApiController]
[Route("api/mesas")]
[Produces("application/json")]
public class MesasController(
    ObtenerMesasUseCase obtenerMesas,
    ObtenerMesaPorIdUseCase obtenerPorId,
    CambiarEstadoMesaUseCase cambiarEstado) : ControllerBase
{
    // ─────────────────────────────────────────────────────────────
    // GET /api/mesas
    // Lista todas las mesas ordenadas por número.
    // Usado por la pantalla de InicioMesa para pintar el grid.
    // ─────────────────────────────────────────────────────────────
    [HttpGet]
    [ProducesResponseType(typeof(IEnumerable<MesaDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetAll(CancellationToken ct)
    {
        var mesas = await obtenerMesas.EjecutarAsync(ct);
        return Ok(mesas);
    }

    // ─────────────────────────────────────────────────────────────
    // GET /api/mesas/{id}
    // Detalle de una mesa específica.
    // ─────────────────────────────────────────────────────────────
    [HttpGet("{id:guid}")]
    [ProducesResponseType(typeof(MesaDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetById(Guid id, CancellationToken ct)
    {
        var mesa = await obtenerPorId.EjecutarAsync(id, ct);
        return mesa is null ? NotFound() : Ok(mesa);
    }

    // ─────────────────────────────────────────────────────────────
    // PUT /api/mesas/{id}/estado
    // Cambia el estado de una mesa: DISPONIBLE | OCUPADA | MANTENIMIENTO
    // Lo llama InicioMesa al abrir/cerrar partida y el admin para mantenimiento.
    // ─────────────────────────────────────────────────────────────
    [HttpPut("{id:guid}/estado")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> CambiarEstado(
        Guid id,
        [FromBody] CambiarEstadoMesaRequest request,
        CancellationToken ct)
    {
        try
        {
            var encontrada = await cambiarEstado.EjecutarAsync(id, request.Estado, ct);
            return encontrada ? NoContent() : NotFound();
        }
        catch (InvalidOperationException ex)
        {
            // Transición de estado inválida (ej: OCUPADA → MANTENIMIENTO)
            return Conflict(new { error = ex.Message });
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }
}
