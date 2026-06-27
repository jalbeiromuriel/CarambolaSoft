using System;
using System.Collections.Generic;

namespace CarambolaSoft.Infrastructure.Persistence.Entities;

public partial class MesasBillar
{
    public Guid Id { get; set; }

    public int Numero { get; set; }

    public string Tipo { get; set; } = null!;

    public string Estado { get; set; } = null!;

    public bool EsSincronizado { get; set; }

    public DateTime UltimaModificacion { get; set; }

    public virtual ICollection<SesionesMesa> SesionesMesas { get; set; } = new List<SesionesMesa>();
}
