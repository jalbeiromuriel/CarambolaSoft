using System;
using System.Collections.Generic;

namespace CarambolaSoft.Infrastructure.Persistence.Entities;

public partial class VwCierreNocturno
{
    public int MesaNumero { get; set; }

    public DateTime HoraInicio { get; set; }

    public DateTime? HoraFin { get; set; }

    public decimal SubtotalTiempo { get; set; }

    public decimal SubtotalLicor { get; set; }

    public decimal SubtotalSnacks { get; set; }

    public decimal SubtotalOtros { get; set; }

    public decimal TotalPagar { get; set; }

    public decimal TotalPendienteFiado { get; set; }

    public string? MetodoPago { get; set; }

    public string EstadoPago { get; set; } = null!;

    public Guid TurnoCajaId { get; set; }

    public bool FacturaSincronizada { get; set; }

    public decimal? MargenBruto { get; set; }
}
