using System;
using System.Collections.Generic;

namespace CarambolaSoft.Infrastructure.Persistence.Entities;

public partial class TurnosCaja
{
    public Guid Id { get; set; }

    public Guid UsuarioId { get; set; }

    public DateTime FechaApertura { get; set; }

    public DateTime? FechaCierre { get; set; }

    public decimal BaseEfectivo { get; set; }

    public decimal? EfectivoRealEntregado { get; set; }

    public bool EsSincronizado { get; set; }

    public DateTime UltimaModificacion { get; set; }

    public virtual CierreDium? CierreDium { get; set; }

    public virtual ICollection<Factura> Facturas { get; set; } = new List<Factura>();

    public virtual ICollection<SesionesMesa> SesionesMesas { get; set; } = new List<SesionesMesa>();
}
