using System;
using System.Collections.Generic;

namespace CarambolaSoft.Infrastructure.Persistence.Entities;

public partial class Rivalidade
{
    public Guid Id { get; set; }

    public Guid JugadorAid { get; set; }

    public Guid JugadorBid { get; set; }

    public int PartidasJugadas { get; set; }

    public int VictoriasA { get; set; }

    public int VictoriasB { get; set; }

    public DateTime? UltimaPartida { get; set; }

    public bool EsSincronizado { get; set; }

    public DateTime UltimaModificacion { get; set; }

    public virtual Jugadore JugadorA { get; set; } = null!;

    public virtual Jugadore JugadorB { get; set; } = null!;
}
