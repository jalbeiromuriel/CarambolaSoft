using System;
using System.Collections.Generic;

namespace CarambolaSoft.Infrastructure.Persistence.Entities;

public partial class SesionesMesa
{
    public Guid Id { get; set; }

    public Guid CuentaId { get; set; }

    public Guid MesaId { get; set; }

    public DateTime HoraInicio { get; set; }

    public DateTime? HoraFin { get; set; }

    public bool EsSincronizado { get; set; }

    public DateTime UltimaModificacion { get; set; }

    public virtual Cuenta Cuenta { get; set; } = null!;

    public virtual MesasBillar Mesa { get; set; } = null!;

    public virtual ICollection<Participante> Participantes { get; set; } = new List<Participante>();
}
