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

    /// PUT api/sync/productos/{id}
    /// Inventario y precios editados en el equipo. Upsert idempotente por GUID.
    /// En un producto que ya existe NO se toca StockActual (lo mueven ventas y compras en el servidor).
    [HttpPut("productos/{id:guid}")]
    public async Task<IActionResult> UpsertProducto(Guid id, [FromBody] ProductoSyncDto dto)
    {
        if (id != dto.Id)
            return UnprocessableEntity(new { error = "Id de ruta y de cuerpo no coinciden." });
        if (!await _db.Categorias.AnyAsync(c => c.Id == dto.CategoriaId))
            return UnprocessableEntity(new { error = $"Categoría {dto.CategoriaId} no existe." });
        if (dto.FraccionOrigenId is not null && dto.FraccionOrigenId != id &&
            !await _db.Productos.AnyAsync(p => p.Id == dto.FraccionOrigenId))
            return UnprocessableEntity(new { error = $"Producto origen {dto.FraccionOrigenId} no existe. ¿Orden de cola roto?" });
        if (dto.PrecioVenta < 0 || dto.CostoCompra < 0)
            return UnprocessableEntity(new { error = "Precio y costo no pueden ser negativos." });
        // Las dos columnas de presentación van juntas (CK_PRODUCTOS_Presentacion) y una caja trae al menos 2 unidades.
        if ((dto.PresentacionCompra is null) != (dto.UnidadesPorPresentacion is null) || dto.UnidadesPorPresentacion < 2)
            return UnprocessableEntity(new { error = "PresentacionCompra y UnidadesPorPresentacion van juntas (mínimo 2 unidades)." });
        if ((dto.FraccionOrigenId is null) != (dto.FraccionRinde is null) || dto.FraccionRinde < 1)
            return UnprocessableEntity(new { error = "FraccionOrigenId y FraccionRinde van juntas (rinde mínimo 1)." });

        var existente = await _db.Productos.FindAsync(id);
        if (existente is null)
        {
            var nuevo = new Producto { Id = id };
            AplicarProducto(nuevo, dto, conStock: true);
            nuevo.EsSincronizado = true;
            _db.Productos.Add(nuevo);
            await _db.SaveChangesAsync();
            return Created($"/api/sync/productos/{id}", new { id });
        }

        AplicarProducto(existente, dto, conStock: false);
        existente.EsSincronizado = true;
        await _db.SaveChangesAsync();
        return Ok(new { id });
    }

    private static void AplicarProducto(Producto p, ProductoSyncDto d, bool conStock)
    {
        p.CategoriaId = d.CategoriaId;
        p.Nombre = d.Nombre;
        p.PrecioVenta = d.PrecioVenta;
        p.CostoCompra = d.CostoCompra;
        p.CostoUltimaCompra = d.CostoUltimaCompra;
        p.StockMinimo = d.StockMinimo;
        p.Activo = d.Activo;
        p.Codigo = d.Codigo;
        p.ControlaStock = d.ControlaStock;
        p.Favorito = d.Favorito;
        p.PresentacionCompra = d.PresentacionCompra;
        p.UnidadesPorPresentacion = d.UnidadesPorPresentacion;
        p.FraccionOrigenId = d.FraccionOrigenId;
        p.FraccionRinde = d.FraccionRinde;
        if (conStock) p.StockActual = d.StockActual;
        p.UltimaModificacion = DateTime.Now;   // misma hora local que GETDATE() del servidor
    }

    /// PUT api/sync/cambios-precio/{id}
    /// Registro de quién cambió un precio. Es un hecho histórico: si ya existe solo se actualiza Avisado.
    [HttpPut("cambios-precio/{id:guid}")]
    public async Task<IActionResult> UpsertCambioPrecio(Guid id, [FromBody] CambioPrecioSyncDto dto)
    {
        if (id != dto.Id)
            return UnprocessableEntity(new { error = "Id de ruta y de cuerpo no coinciden." });
        if (dto.PrecioAntes == dto.PrecioDespues || dto.PrecioAntes < 0 || dto.PrecioDespues < 0)
            return UnprocessableEntity(new { error = "El cambio de precio no es válido." });
        if (!await _db.Productos.AnyAsync(p => p.Id == dto.ProductoId))
            return UnprocessableEntity(new { error = $"Producto {dto.ProductoId} no existe. ¿Orden de cola roto?" });

        var existente = await _db.CambiosPrecio.FindAsync(id);
        if (existente is null)
        {
            _db.CambiosPrecio.Add(new CambioPrecio
            {
                Id = id, ProductoId = dto.ProductoId, PrecioAntes = dto.PrecioAntes, PrecioDespues = dto.PrecioDespues,
                FechaHora = dto.FechaHora, UsuarioId = dto.UsuarioId, UsuarioNombre = dto.UsuarioNombre,
                Motivo = dto.Motivo, Avisado = dto.Avisado, EsSincronizado = true, UltimaModificacion = DateTime.Now
            });
            await _db.SaveChangesAsync();
            return Created($"/api/sync/cambios-precio/{id}", new { id });
        }

        existente.Avisado = existente.Avisado || dto.Avisado;
        existente.EsSincronizado = true;
        existente.UltimaModificacion = DateTime.Now;
        await _db.SaveChangesAsync();
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