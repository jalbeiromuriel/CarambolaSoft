using System;
using System.Collections.Generic;

namespace CarambolaSoft.Infrastructure.Persistence.Entities;

public partial class GastosCaja
{
    public Guid Id { get; set; }

    public Guid TurnoCajaId { get; set; }

    public string Concepto { get; set; } = null!;

    public decimal Monto { get; set; }

    public string Categoria { get; set; } = null!;

    public string MetodoPago { get; set; } = null!;

    public DateTime FechaHora { get; set; }

    public bool EsSincronizado { get; set; }

    public DateTime UltimaModificacion { get; set; }

    public virtual TurnosCaja TurnoCaja { get; set; } = null!;
}
