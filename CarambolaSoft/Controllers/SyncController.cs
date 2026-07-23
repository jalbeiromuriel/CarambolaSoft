using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using CarambolaSoft.Infrastructure.Persistence;
using CarambolaSoft.Infrastructure.Persistence.Entities;
using CarambolaSoft.API.Dtos;

namespace CarambolaSoft.API.Controllers;

/// <summary>
/// Endpoints de sincronización Offline-First (A4).
/// Upserts idempotentes por GUID. Validan integridad de DATOS,
/// NO reglas de flujo en vivo (esas ya corrieron en la tablet).
/// Reciben DTOs planos (espejo del snapshot IndexedDB) — nunca
/// entidades EF, para evitar ciclos de navegación en OpenAPI.
/// </summary>
[ApiController]
[Route("api/sync")]
public class SyncController : ControllerBase
{
    private readonly CarambolaSoftDbContext _db;
    private readonly ILogger<SyncController> _log;

    public SyncController(CarambolaSoftDbContext db, ILogger<SyncController> log)
    {
        _db = db;
        _log = log;
    }

    // ========================================================
    //  SUBIDA — Fase 1
    // ========================================================

    /// PUT api/sync/cuentas/{id}
    [HttpPut("cuentas/{id:guid}")]
    public async Task<IActionResult> UpsertCuenta(Guid id, [FromBody] CuentaSyncDto dto)
    {
        if (id != dto.Id)
            return UnprocessableEntity(new { error = "Id de ruta y de cuerpo no coinciden." });

        // Integridad de datos: la mesa debe existir (VENTA_RAPIDA puede venir sin mesa)
        if (dto.MesaId is not null &&
            !await _db.MesasBillars.AnyAsync(m => m.Id == dto.MesaId))
            return UnprocessableEntity(new { error = $"Mesa {dto.MesaId} no existe." });

        // OJO: aquí NO validamos mesa ocupada ni anti-fantasma de flujo —
        // el constraint de BD (ClienteId o NombreLibre) sí dispara 422 solo.

        var existente = await _db.Cuentas.FindAsync(id);

        if (existente is null)
        {
            var nueva = new Cuenta();
            _db.Entry(nueva).CurrentValues.SetValues(dto); // matchea por nombre de propiedad
            nueva.EsSincronizado = true;
            _db.Cuentas.Add(nueva);
            await _db.SaveChangesAsync();
            return Created($"/api/sync/cuentas/{id}", new { id });
        }

        _db.Entry(existente).CurrentValues.SetValues(dto);
        existente.EsSincronizado = true;
        await _db.SaveChangesAsync();
        return Ok(new { id });
    }

    /// PUT api/sync/pedidos/{id}
    [HttpPut("pedidos/{id:guid}")]
    public async Task<IActionResult> UpsertPedido(Guid id, [FromBody] PedidoSyncDto dto)
    {
        if (id != dto.Id)
            return UnprocessableEntity(new { error = "Id de ruta y de cuerpo no coinciden." });

        // La cuenta padre debió subir antes (orden seq de la SYNC_QUEUE lo garantiza)
        if (!await _db.Cuentas.AnyAsync(c => c.Id == dto.CuentaId))
            return UnprocessableEntity(new { error = $"Cuenta {dto.CuentaId} no existe. ¿Orden de cola roto?" });

        // ===== Decisión Riesgo 1: precio a FECHA DEL PEDIDO =====
        var precioServer = await _db.Database
            .SqlQuery<decimal>($"SELECT dbo.FN_ObtenerPrecioVigente({dto.ProductoId}, {dto.FechaHora}) AS [Value]")
            .SingleAsync();

        var precioFinal = dto.PrecioUnitarioHist;
        if (precioServer != dto.PrecioUnitarioHist)
        {
            _log.LogWarning(
                "Sync: discrepancia de precio en pedido {PedidoId}. Cliente: {PrecioCliente}, Server: {PrecioServer}. Gana el server.",
                id, dto.PrecioUnitarioHist, precioServer);
            precioFinal = precioServer;
        }

        var existente = await _db.PedidosCuentas.FindAsync(id);

        if (existente is null)
        {
            var nuevo = new PedidosCuenta();
            _db.Entry(nuevo).CurrentValues.SetValues(dto);
            nuevo.PrecioUnitarioHist = precioFinal;
            nuevo.EsSincronizado = true;
            _db.PedidosCuentas.Add(nuevo);
            await _db.SaveChangesAsync(); // trigger de stock corre normal (ENTREGADO descuenta)
            return Created($"/api/sync/pedidos/{id}", new { id });
        }

        _db.Entry(existente).CurrentValues.SetValues(dto);
        existente.PrecioUnitarioHist = precioFinal;
        existente.EsSincronizado = true;
        await _db.SaveChangesAsync(); // cambio de estado a CANCELADO → trigger restituye
        return Ok(new { id });
    }

    // ========================================================
    //  BAJADA — catálogos por UltimaModificacion
    // ========================================================

    /// GET api/sync/cambios?desde=2026-07-21T00:00:00Z
    /// Sin cursor (primera sync de una tablet) → baja todo el catálogo.
    [HttpGet("cambios")]
    public async Task<IActionResult> Cambios([FromQuery] DateTime? desde = null)
    {
        // Piso seguro: sin cursor o cursor corrupto = bajar todo.
        // SQL 'datetime' no acepta fechas antes de 1753 → clamp.
        var corte = (desde is null || desde < new DateTime(1753, 1, 1))
            ? new DateTime(2020, 1, 1)   // antes de que existiera el negocio: equivale a "todo"
            : desde.Value;

        // Cursor con reloj de SQL Server, no de la tablet ni del app server:
        // misma fuente que estampa UltimaModificacion → cero ventanas perdidas
        var servidorAhora = await _db.Database
            .SqlQuery<DateTime>($"SELECT SYSDATETIME() AS [Value]")
            .SingleAsync();

        var productos = await _db.Productos.AsNoTracking()
                              .Where(p => p.UltimaModificacion > corte).ToListAsync();
        var categorias = await _db.Categorias.AsNoTracking().ToListAsync(); // catálogo chico: baja completo
        var promociones = await _db.Promociones.AsNoTracking()
                              .Where(p => p.UltimaModificacion > corte).ToListAsync();
        var mesas = await _db.MesasBillars.AsNoTracking()
                              .Where(m => m.UltimaModificacion > corte).ToListAsync();

        return Ok(new { servidorAhora, productos, categorias, promociones, mesas });
    }
}