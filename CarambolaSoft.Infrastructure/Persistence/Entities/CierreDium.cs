using System;
using System.Collections.Generic;

namespace CarambolaSoft.Infrastructure.Persistence.Entities;

public partial class CierreDium
{
    public Guid Id { get; set; }

    public Guid TurnoCajaId { get; set; }

    public DateOnly Fecha { get; set; }

    public decimal TotalTiempo { get; set; }

    public decimal TotalLicor { get; set; }

    public decimal TotalOtros { get; set; }

    public decimal TotalGeneral { get; set; }

    public decimal TotalFiado { get; set; }

    public decimal TotalGastos { get; set; }

    public decimal TotalPremiosMaq { get; set; }

    public decimal TotalCobrosFiado { get; set; }

    public decimal? EfectivoReportado { get; set; }

    public decimal? Descuadre { get; set; }

    public bool Confirmado { get; set; }

    public bool EsSincronizado { get; set; }

    public DateTime UltimaModificacion { get; set; }

    public virtual TurnosCaja TurnoCaja { get; set; } = null!;
}
