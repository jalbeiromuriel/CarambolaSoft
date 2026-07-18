using CarambolaSoft.Infrastructure.Persistence;
using CarambolaSoft.Infrastructure.Persistence.Entities;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace CarambolaSoft.API.Controllers;

[ApiController]
[Route("api/cuentas")]
public class CuentasController : ControllerBase
{
    private readonly CarambolaSoftDbContext _db;

    public CuentasController(CarambolaSoftDbContext db) => _db = db;

    // ============================================================
    // GET /api/cuentas?estado=ABIERTA
    // Las tarjetas del POS: cuentas del turno activo
    // ============================================================
    [HttpGet]
    public async Task<IActionResult> Listar([FromQuery] string estado = "ABIERTA")
    {
        var cuentas = await _db.Cuentas
            .Where(c => c.Estado == estado)
            .Select(c => new
            {
                c.Id,
                c.TipoCuenta,
                MesaNumero = c.Mesa != null ? (int?)c.Mesa.Numero : null,
                Titular = c.Cliente != null
                    ? (c.Cliente.Apodo ?? c.Cliente.Nombre)
                    : (c.NombreLibre ?? "Venta rápida"),
                c.HoraApertura,
                c.TarifaPorHora,
                c.Estado,
                TotalConsumos = c.PedidosCuenta
                    .Where(p => p.EstadoPedido == "ENTREGADO")
                    .Sum(p => (decimal?)(p.PrecioUnitarioHist * p.Cantidad)) ?? 0
            })
            .OrderBy(c => c.HoraApertura)
            .ToListAsync();

        return Ok(cuentas);
    }

    // ============================================================
    // GET /api/cuentas/{id}
    // ============================================================
    [HttpGet("{id:guid}")]
    public async Task<IActionResult> Detalle(Guid id)
    {
        var cuenta = await _db.Cuentas
            .Include(c => c.Cliente)
            .Include(c => c.Mesa)
            .Include(c => c.PedidosCuenta)
                .ThenInclude(p => p.Producto)
            .FirstOrDefaultAsync(c => c.Id == id);

        if (cuenta is null) return NotFound();

        return Ok(new
        {
            cuenta.Id,
            cuenta.TipoCuenta,
            MesaNumero = cuenta.Mesa?.Numero,
            Titular = cuenta.Cliente != null
                ? (cuenta.Cliente.Apodo ?? cuenta.Cliente.Nombre)
                : (cuenta.NombreLibre ?? "Venta rápida"),
            cuenta.ClienteId,
            cuenta.HoraApertura,
            cuenta.HoraCierre,
            cuenta.TarifaPorHora,
            cuenta.Estado,
            Pedidos = cuenta.PedidosCuenta
                .OrderBy(p => p.UltimaModificacion)
                .Select(p => new
                {
                    p.Id,
                    Producto = p.Producto.Nombre,
                    p.Cantidad,
                    p.PrecioUnitarioHist,
                    Subtotal = p.PrecioUnitarioHist * p.Cantidad,
                    p.CategoriaConsumo,
                    p.EstadoPedido
                })
        });
    }

    // ============================================================
    // POST /api/cuentas — abrir cuenta
    // ============================================================
    [HttpPost]
    public async Task<IActionResult> Abrir([FromBody] AbrirCuentaRequest req)
    {
        // Turno activo obligatorio
        var turno = await _db.TurnosCajas
            .FirstOrDefaultAsync(t => t.FechaCierre == null);
        if (turno is null)
            return Conflict(new { error = "No hay turno de caja abierto. Abrí el turno primero." });

        // Regla anti-fantasma
        if (req.TipoCuenta != "VENTA_RAPIDA"
            && req.ClienteId is null
            && string.IsNullOrWhiteSpace(req.NombreLibre))
            return BadRequest(new { error = "Toda cuenta necesita cliente registrado o nombre libre." });

        MesasBillar? mesa = null;
        if (req.MesaId is not null)
        {
            mesa = await _db.MesasBillars.FindAsync(req.MesaId);
            if (mesa is null)
                return NotFound(new { error = "La mesa no existe." });
            if (mesa.Estado != "DISPONIBLE")
                return Conflict(new { error = $"La mesa {mesa.Numero} está {mesa.Estado}." });
        }

        var cuenta = new Cuenta
        {
            Id = req.Id ?? Guid.NewGuid(),          // GUID del cliente si viene (offline-first)
            TurnoCajaId = turno.Id,
            TipoCuenta = req.TipoCuenta,
            MesaId = req.MesaId,
            ClienteId = req.ClienteId,
            NombreLibre = req.NombreLibre,
            HoraApertura = DateTime.Now,
            TarifaPorHora = req.TarifaPorHora,
            Estado = "ABIERTA",
            EsSincronizado = false,
            UltimaModificacion = DateTime.Now
        };
        _db.Cuentas.Add(cuenta);

        if (mesa is not null)
        {
            mesa.Estado = "OCUPADA";
            mesa.EsSincronizado = false;
            mesa.UltimaModificacion = DateTime.Now;
        }

        await _db.SaveChangesAsync();
        return CreatedAtAction(nameof(Detalle), new { id = cuenta.Id }, new { cuenta.Id });
    }

    // ============================================================
    // POST /api/cuentas/{id}/pedidos — agregar consumo
    // Precio SIEMPRE resuelto en servidor (FN_ObtenerPrecioVigente)
    // Entra como ENTREGADO: el trigger descarga stock
    // ============================================================
    [HttpPost("{id:guid}/pedidos")]
    public async Task<IActionResult> AgregarPedido(Guid id, [FromBody] AgregarPedidoRequest req)
    {
        var cuenta = await _db.Cuentas.FindAsync(id);
        if (cuenta is null) return NotFound();
        if (cuenta.Estado != "ABIERTA")
            return Conflict(new { error = "La cuenta no está abierta." });

        var producto = await _db.Productos
            .Include(p => p.Categoria)
            .FirstOrDefaultAsync(p => p.Id == req.ProductoId);
        if (producto is null) return NotFound(new { error = "Producto no existe." });
        if (!producto.Activo)
            return Conflict(new { error = "Producto desactivado." });

        var categoriaConsumo = MapCategoriaConsumo(producto.Categoria?.Nombre);

        if (categoriaConsumo != "TIEMPO" && producto.StockActual < req.Cantidad)
            return Conflict(new { error = $"Stock insuficiente: quedan {producto.StockActual}." });

        // Precio vigente server-side (promos por franja horaria)
        var precio = await _db.Database
            .SqlQuery<decimal>($"SELECT dbo.FN_ObtenerPrecioVigente({req.ProductoId}, {DateTime.Now}) AS [Value]")
            .SingleAsync();

        var pedido = new PedidosCuenta
        {
            Id = req.Id ?? Guid.NewGuid(),
            CuentaId = id,
            ProductoId = req.ProductoId,
            Cantidad = req.Cantidad,
            PrecioUnitarioHist = precio,
            CostoCompraHist = producto.CostoCompra,
            CategoriaConsumo = categoriaConsumo,
            EstadoPedido = "ENTREGADO",   // en el bar se entrega al pedir
            EsSincronizado = false,
            UltimaModificacion = DateTime.Now
        };
        _db.PedidosCuentas.Add(pedido);
        await _db.SaveChangesAsync();   // el trigger baja el stock

        return Ok(new { pedido.Id, PrecioAplicado = precio });
    }

    // ============================================================
    // DELETE /api/cuentas/{id}/pedidos/{pedidoId} — cancelar pedido
    // El trigger restituye stock (ENTREGADO -> CANCELADO)
    // ============================================================
    [HttpDelete("{id:guid}/pedidos/{pedidoId:guid}")]
    public async Task<IActionResult> CancelarPedido(Guid id, Guid pedidoId)
    {
        var cuenta = await _db.Cuentas.FindAsync(id);
        if (cuenta is null) return NotFound();
        if (cuenta.Estado != "ABIERTA")
            return Conflict(new { error = "La cuenta no está abierta." });

        var pedido = await _db.PedidosCuentas
            .FirstOrDefaultAsync(p => p.Id == pedidoId && p.CuentaId == id);
        if (pedido is null) return NotFound();
        if (pedido.EstadoPedido == "CANCELADO")
            return Conflict(new { error = "El pedido ya está cancelado." });

        pedido.EstadoPedido = "CANCELADO";
        pedido.EsSincronizado = false;
        pedido.UltimaModificacion = DateTime.Now;
        await _db.SaveChangesAsync();   // el trigger restituye stock

        return NoContent();
    }

    // ============================================================
    // POST /api/cuentas/{id}/liquidar — cerrar y facturar
    // ============================================================
    [HttpPost("{id:guid}/liquidar")]
    public async Task<IActionResult> Liquidar(Guid id, [FromBody] LiquidarCuentaRequest req)
    {
        var cuenta = await _db.Cuentas
            .Include(c => c.Mesa)
            .Include(c => c.PedidosCuenta)
            .FirstOrDefaultAsync(c => c.Id == id);

        if (cuenta is null) return NotFound();
        if (cuenta.Estado != "ABIERTA")
            return Conflict(new { error = "La cuenta no está abierta." });

        // FIADO exige cliente registrado (anti-fantasma)
        bool hayFiado = req.MetodoPago == "FIADO" || req.MetodoPagoSecundario == "FIADO";
        if (hayFiado && cuenta.ClienteId is null)
            return BadRequest(new { error = "El fiado exige cliente registrado, no nombre libre." });

        var ahora = DateTime.Now;
        var entregados = cuenta.PedidosCuenta.Where(p => p.EstadoPedido == "ENTREGADO").ToList();

        decimal subLicor = entregados.Where(p => p.CategoriaConsumo == "BEBIDAS_ALCOHOLICAS")
                                      .Sum(p => p.PrecioUnitarioHist * p.Cantidad);
        decimal subSnacks = entregados.Where(p => p.CategoriaConsumo == "SNACKS")
                                      .Sum(p => p.PrecioUnitarioHist * p.Cantidad);
        decimal subOtros = entregados.Where(p => p.CategoriaConsumo != "BEBIDAS_ALCOHOLICAS"
                                               && p.CategoriaConsumo != "SNACKS"
                                               && p.CategoriaConsumo != "TIEMPO")
                                      .Sum(p => p.PrecioUnitarioHist * p.Cantidad);

        // Tiempo por taxímetro (por minuto, como el POS)
        decimal subTiempo = 0;
        if (cuenta.TarifaPorHora is > 0)
        {
            var minutos = (decimal)Math.Ceiling((ahora - cuenta.HoraApertura).TotalMinutes);
            subTiempo = Math.Round(minutos * cuenta.TarifaPorHora.Value / 60m, 0);
        }
        // + tiempo cargado como pedido (si vino de productos PTIEMPO)
        subTiempo += entregados.Where(p => p.CategoriaConsumo == "TIEMPO")
                               .Sum(p => p.PrecioUnitarioHist * p.Cantidad);

        decimal total = subTiempo + subLicor + subSnacks + subOtros;

        // Validación de pago mixto
        if (req.MetodoPagoSecundario is not null)
        {
            if (req.MontoPrimario is null || req.MontoSecundario is null)
                return BadRequest(new { error = "Pago mixto exige ambos montos." });
            if (req.MontoPrimario + req.MontoSecundario != total)
                return BadRequest(new { error = $"Los montos no suman el total ({total})." });
        }

        decimal pendienteFiado = 0;
        if (req.MetodoPago == "FIADO")
            pendienteFiado = req.MontoPrimario ?? total;
        else if (req.MetodoPagoSecundario == "FIADO")
            pendienteFiado = req.MontoSecundario ?? 0;

        var factura = new Factura
        {
            Id = Guid.NewGuid(),
            CuentaId = cuenta.Id,
            TurnoCajaId = cuenta.TurnoCajaId,
            SubtotalTiempo = subTiempo,
            SubtotalLicor = subLicor,
            SubtotalSnacks = subSnacks,
            SubtotalOtros = subOtros,
            TotalPagar = total,
            TotalPendienteFiado = pendienteFiado,
            MetodoPago = req.MetodoPago,
            MetodoPagoSecundario = req.MetodoPagoSecundario,
            MontoPrimario = req.MontoPrimario,
            MontoSecundario = req.MontoSecundario,
            EstadoPago = pendienteFiado > 0 ? "FIADO" : "PAGADO",
            EsSincronizado = false,
            UltimaModificacion = ahora
        };
        _db.Facturas.Add(factura);

        cuenta.Estado = "LIQUIDADA";
        cuenta.HoraCierre = ahora;
        cuenta.EsSincronizado = false;
        cuenta.UltimaModificacion = ahora;

        if (cuenta.Mesa is not null)
        {
            cuenta.Mesa.Estado = "DISPONIBLE";
            cuenta.Mesa.EsSincronizado = false;
            cuenta.Mesa.UltimaModificacion = ahora;
        }

        await _db.SaveChangesAsync();

        return Ok(new
        {
            factura.Id,
            factura.SubtotalTiempo,
            factura.SubtotalLicor,
            factura.SubtotalSnacks,
            factura.SubtotalOtros,
            factura.TotalPagar,
            factura.TotalPendienteFiado,
            factura.EstadoPago
        });
    }

    // ============================================================
    // POST /api/cuentas/{id}/cancelar — cancelar cuenta completa
    // (PIN validado en frontend; endpoint para rol admin)
    // ============================================================
    [HttpPost("{id:guid}/cancelar")]
    public async Task<IActionResult> Cancelar(Guid id)
    {
        var cuenta = await _db.Cuentas
            .Include(c => c.Mesa)
            .Include(c => c.PedidosCuenta)
            .FirstOrDefaultAsync(c => c.Id == id);

        if (cuenta is null) return NotFound();
        if (cuenta.Estado != "ABIERTA")
            return Conflict(new { error = "Solo se cancelan cuentas abiertas." });

        var ahora = DateTime.Now;

        // Cancelar pedido a pedido: el trigger restituye stock
        foreach (var p in cuenta.PedidosCuenta.Where(p => p.EstadoPedido == "ENTREGADO"))
        {
            p.EstadoPedido = "CANCELADO";
            p.EsSincronizado = false;
            p.UltimaModificacion = ahora;
        }

        cuenta.Estado = "CANCELADA";
        cuenta.HoraCierre = ahora;
        cuenta.EsSincronizado = false;
        cuenta.UltimaModificacion = ahora;

        if (cuenta.Mesa is not null)
        {
            cuenta.Mesa.Estado = "DISPONIBLE";
            cuenta.Mesa.EsSincronizado = false;
            cuenta.Mesa.UltimaModificacion = ahora;
        }

        await _db.SaveChangesAsync();
        return NoContent();
    }

    // ============================================================
    // Mapeo Categoría (nombre libre) -> CategoriaConsumo (enum BD)
    // ============================================================
    private static string MapCategoriaConsumo(string? nombreCategoria) =>
        (nombreCategoria ?? "").ToUpperInvariant() switch
        {
            "BEBIDAS ALCOHÓLICAS" or "BEBIDAS ALCOHOLICAS" => "BEBIDAS_ALCOHOLICAS",
            "BEBIDAS NO ALCOHÓLICAS" or "BEBIDAS NO ALCOHOLICAS" => "BEBIDAS_NO_ALCOHOLICAS",
            "GRANIZADOS" => "BEBIDAS_NO_ALCOHOLICAS",
            "SNACKS" => "SNACKS",
            "TIEMPO" => "TIEMPO",
            _ => "OTROS"
        };
}

// ================================================================
// DTOs
// ================================================================
public record AbrirCuentaRequest(
    Guid? Id,                 // GUID generado en cliente (offline-first); si viene null, lo genera el server
    string TipoCuenta,        // LICORES | BILLAR | CARTAS | DOMINO | VENTA_RAPIDA
    Guid? MesaId,
    Guid? ClienteId,
    string? NombreLibre,
    decimal? TarifaPorHora);

public record AgregarPedidoRequest(
    Guid? Id,
    Guid ProductoId,
    int Cantidad);

public record LiquidarCuentaRequest(
    string MetodoPago,            // EFECTIVO | TARJETA | NEQUI | DAVIPLATA | TRANSFERENCIA | FIADO
    string? MetodoPagoSecundario, // pago mixto
    decimal? MontoPrimario,
    decimal? MontoSecundario);