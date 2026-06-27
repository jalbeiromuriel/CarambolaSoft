using System;
using System.Collections.Generic;

namespace CarambolaSoft.Infrastructure.Persistence.Entities;

public partial class VwFiadosPendiente
{
    public Guid FacturaId { get; set; }

    public int MesaNumero { get; set; }

    public DateTime FechaPartida { get; set; }

    public decimal TotalPagar { get; set; }

    public decimal TotalPendienteFiado { get; set; }

    public Guid TurnoCajaId { get; set; }

    public DateTime FechaTurno { get; set; }

    public string? Jugadores { get; set; }
}
