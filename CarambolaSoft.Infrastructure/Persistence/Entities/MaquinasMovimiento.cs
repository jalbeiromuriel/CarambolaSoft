using System;
using System.Collections.Generic;

namespace CarambolaSoft.Infrastructure.Persistence.Entities;

public partial class MaquinasMovimiento
{
    public Guid Id { get; set; }

    public Guid MaquinaId { get; set; }

    public string Tipo { get; set; } = null!;

    public decimal Monto { get; set; }

    public Guid? TurnoCajaId { get; set; }

    public string? Nota { get; set; }

    public DateTime FechaHora { get; set; }

    public bool EsSincronizado { get; set; }

    public DateTime UltimaModificacion { get; set; }

    public virtual Maquina Maquina { get; set; } = null!;

    public virtual TurnosCaja? TurnoCaja { get; set; }
}
