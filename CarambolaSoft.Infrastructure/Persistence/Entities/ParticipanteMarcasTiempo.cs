using System;
using System.Collections.Generic;

namespace CarambolaSoft.Infrastructure.Persistence.Entities;

public partial class ParticipanteMarcasTiempo
{
    public Guid Id { get; set; }

    public Guid ParticipanteId { get; set; }

    public DateTime MarcaTiempo { get; set; }

    public int CarambolasEnMarca { get; set; }

    public virtual Participante Participante { get; set; } = null!;
}
