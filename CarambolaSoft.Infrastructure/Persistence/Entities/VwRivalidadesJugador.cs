using System;
using System.Collections.Generic;

namespace CarambolaSoft.Infrastructure.Persistence.Entities;

public partial class VwRivalidadesJugador
{
    public string Jugador { get; set; } = null!;

    public string Contrincante { get; set; } = null!;

    public int PartidasJugadas { get; set; }

    public int Victorias { get; set; }

    public int Derrotas { get; set; }

    public decimal? PorcentajeVictorias { get; set; }

    public DateTime? UltimaPartida { get; set; }
}
