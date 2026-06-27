using System;
using System.Collections.Generic;

namespace CarambolaSoft.Infrastructure.Persistence.Entities;

public partial class Producto
{
    public Guid Id { get; set; }

    public Guid CategoriaId { get; set; }

    public string Nombre { get; set; } = null!;

    public decimal PrecioVenta { get; set; }

    public decimal CostoCompra { get; set; }

    public int StockActual { get; set; }

    public int StockMinimo { get; set; }

    public bool EsSincronizado { get; set; }

    public DateTime UltimaModificacion { get; set; }

    public virtual Categoria Categoria { get; set; } = null!;

    public virtual ICollection<PedidosCuenta> PedidosCuenta { get; set; } = new List<PedidosCuenta>();
}
