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

    public bool Activo { get; set; }

    public bool EsSincronizado { get; set; }

    public DateTime UltimaModificacion { get; set; }

    public decimal? CostoUltimaCompra { get; set; }

    public string? Codigo { get; set; }

    public bool ControlaStock { get; set; } = true;

    public bool Favorito { get; set; }

    /// <summary>Caja | Canasta | Paca | Bulto (null = se compra por unidad). Va junto con UnidadesPorPresentacion.</summary>
    public string? PresentacionCompra { get; set; }

    public int? UnidadesPorPresentacion { get; set; }

    /// <summary>Si este producto sale de abrir otro (copa ← botella): id del origen y cuántas unidades rinde.</summary>
    public Guid? FraccionOrigenId { get; set; }

    public int? FraccionRinde { get; set; }

    public virtual Categoria Categoria { get; set; } = null!;

    public virtual ICollection<PedidosCuenta> PedidosCuenta { get; set; } = new List<PedidosCuenta>();

    public virtual ICollection<Promocione> Promociones { get; set; } = new List<Promocione>();
}
