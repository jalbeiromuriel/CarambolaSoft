using System;
using System.Collections.Generic;

namespace CarambolaSoft.Infrastructure.Persistence.Entities;

public partial class Participante
{
    public Guid Id { get; set; }

    public Guid SesionMesaId { get; set; }

    public Guid JugadorId { get; set; }

    public int Puntaje { get; set; }

    public int? Posicion { get; set; }

    public bool EsGanador { get; set; }

    public virtual Jugadore Jugador { get; set; } = null!;

    public virtual ICollection<ParticipanteMarcasTiempo> ParticipanteMarcasTiempos { get; set; } = new List<ParticipanteMarcasTiempo>();

    public virtual SesionesMesa SesionMesa { get; set; } = null!;
}
