using System;
using System.Collections.Generic;

namespace CarambolaSoft.Infrastructure.Persistence.Entities;

public partial class Categoria
{
    public Guid Id { get; set; }

    public string Nombre { get; set; } = null!;

    public string? Icono { get; set; }

    public string? ColorHex { get; set; }

    public bool EsSincronizado { get; set; }

    public DateTime UltimaModificacion { get; set; }

    /// <summary>Enum de factura: TIEMPO, BEBIDAS_ALCOHOLICAS, SNACKS, BEBIDAS_NO_ALCOHOLICAS, OTROS.</summary>
    public string? CategoriaConsumo { get; set; }

    public bool Activo { get; set; } = true;

    public virtual ICollection<Producto> Productos { get; set; } = new List<Producto>();
}
