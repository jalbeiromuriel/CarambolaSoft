using System;
using System.Collections.Generic;

namespace CarambolaSoft.Infrastructure.Persistence.Entities;

public partial class Jugadore
{
    public Guid Id { get; set; }

    public string Username { get; set; } = null!;

    public string PasswordHash { get; set; } = null!;

    public string? AvatarUrl { get; set; }

    public int RecordCarambolas { get; set; }

    public DateTime FechaRegistro { get; set; }

    public bool EsSincronizado { get; set; }

    public DateTime UltimaModificacion { get; set; }

    public virtual ICollection<Participante> Participantes { get; set; } = new List<Participante>();

    public virtual ICollection<Rivalidade> RivalidadeJugadorAs { get; set; } = new List<Rivalidade>();

    public virtual ICollection<Rivalidade> RivalidadeJugadorBs { get; set; } = new List<Rivalidade>();
}
