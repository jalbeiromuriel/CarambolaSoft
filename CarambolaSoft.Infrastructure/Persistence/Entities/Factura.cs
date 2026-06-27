using System;
using System.Collections.Generic;

namespace CarambolaSoft.Infrastructure.Persistence.Entities;

public partial class Factura
{
    public Guid Id { get; set; }

    public Guid SesionMesaId { get; set; }

    public Guid TurnoCajaId { get; set; }

    public decimal SubtotalTiempo { get; set; }

    public decimal SubtotalLicor { get; set; }

    public decimal SubtotalSnacks { get; set; }

    public decimal SubtotalOtros { get; set; }

    public decimal TotalPagar { get; set; }

    public decimal TotalPendienteFiado { get; set; }

    public string? MetodoPago { get; set; }

    public string EstadoPago { get; set; } = null!;

    public bool EsSincronizado { get; set; }

    public DateTime UltimaModificacion { get; set; }

    public virtual SesionesMesa SesionMesa { get; set; } = null!;

    public virtual TurnosCaja TurnoCaja { get; set; } = null!;
}
