using System;
using System.Collections.Generic;

namespace CarambolaSoft.Infrastructure.Persistence.Entities;

public partial class VwFiadosPendiente
{
    public Guid FacturaId { get; set; }

    public string? Deudor { get; set; }

    public Guid? ClienteId { get; set; }

    public string TipoCuenta { get; set; } = null!;

    public DateTime FechaCuenta { get; set; }

    public decimal TotalPagar { get; set; }

    public decimal TotalPendienteFiado { get; set; }

    public decimal TotalAbonado { get; set; }

    public Guid TurnoCajaId { get; set; }

    public DateTime FechaTurno { get; set; }
}
