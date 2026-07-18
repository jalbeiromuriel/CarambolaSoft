using System;
using System.Collections.Generic;

namespace CarambolaSoft.Infrastructure.Persistence.Entities;

public partial class VwMaquinasPendiente
{
    public Guid MaquinaId { get; set; }

    public string Nombre { get; set; } = null!;

    public bool Activa { get; set; }

    public DateTime? UltimoCuadre { get; set; }

    public decimal PremiosPorReponer { get; set; }

    public int? NumPremiosPendientes { get; set; }
}
