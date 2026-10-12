using System;

namespace CarambolaSoft.Infrastructure.Persistence.Entities;

/// <summary>Cambio de precio de venta de un producto (quién, cuándo, de cuánto a cuánto). Sirve para avisar a los administradores.</summary>
public partial class CambioPrecio
{
    public Guid Id { get; set; }

    public Guid ProductoId { get; set; }

    public decimal PrecioAntes { get; set; }

    public decimal PrecioDespues { get; set; }

    public DateTime FechaHora { get; set; }

    public Guid? UsuarioId { get; set; }

    public string? UsuarioNombre { get; set; }

    public string? Motivo { get; set; }

    public bool Avisado { get; set; }

    public bool EsSincronizado { get; set; }

    public DateTime UltimaModificacion { get; set; }
}
