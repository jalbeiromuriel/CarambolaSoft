using System;
using System.Collections.Generic;

namespace CarambolaSoft.Infrastructure.Persistence.Entities;

public partial class Cliente
{
    public Guid Id { get; set; }

    public string Nombre { get; set; } = null!;

    public string? Apodo { get; set; }

    public bool Activo { get; set; }

    public int Visitas { get; set; }

    public decimal GastoAcumulado { get; set; }

    public DateTime FechaRegistro { get; set; }

    public bool EsSincronizado { get; set; }

    public DateTime UltimaModificacion { get; set; }

    public virtual ICollection<Cuenta> Cuenta { get; set; } = new List<Cuenta>();

    public virtual ICollection<Jugadore> Jugadores { get; set; } = new List<Jugadore>();
}
