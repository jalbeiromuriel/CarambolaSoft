using System;
using System.Collections.Generic;

namespace CarambolaSoft.Infrastructure.Persistence.Entities;

public partial class AbonosFiado
{
    public Guid Id { get; set; }

    public Guid FacturaId { get; set; }

    public Guid TurnoCajaId { get; set; }

    public decimal Monto { get; set; }

    public string MetodoPago { get; set; } = null!;

    public DateTime FechaHora { get; set; }

    public bool EsSincronizado { get; set; }

    public DateTime UltimaModificacion { get; set; }

    public virtual Factura Factura { get; set; } = null!;

    public virtual TurnosCaja TurnoCaja { get; set; } = null!;
}
