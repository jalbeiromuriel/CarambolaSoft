using System;
using System.Collections.Generic;

namespace CarambolaSoft.Infrastructure.Persistence.Entities;

public partial class PedidosCuenta
{
    public Guid Id { get; set; }

    public Guid SesionMesaId { get; set; }

    public Guid ProductoId { get; set; }

    public int Cantidad { get; set; }

    public decimal PrecioUnitarioHist { get; set; }

    public decimal CostoCompraHist { get; set; }

    public string CategoriaConsumo { get; set; } = null!;

    public string EstadoPedido { get; set; } = null!;

    public virtual Producto Producto { get; set; } = null!;

    public virtual SesionesMesa SesionMesa { get; set; } = null!;
}
