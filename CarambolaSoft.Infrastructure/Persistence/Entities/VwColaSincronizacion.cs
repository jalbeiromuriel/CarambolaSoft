using System;
using System.Collections.Generic;

namespace CarambolaSoft.Infrastructure.Persistence.Entities;

public partial class VwColaSincronizacion
{
    public string Tabla { get; set; } = null!;

    public Guid Id { get; set; }

    public DateTime UltimaModificacion { get; set; }
}
