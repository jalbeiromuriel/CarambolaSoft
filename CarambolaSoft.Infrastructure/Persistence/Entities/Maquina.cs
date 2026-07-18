using System;
using System.Collections.Generic;

namespace CarambolaSoft.Infrastructure.Persistence.Entities;

public partial class Maquina
{
    public Guid Id { get; set; }

    public string Nombre { get; set; } = null!;

    public bool Activa { get; set; }

    public bool EsSincronizado { get; set; }

    public DateTime UltimaModificacion { get; set; }

    public virtual ICollection<MaquinasMovimiento> MaquinasMovimientos { get; set; } = new List<MaquinasMovimiento>();
}
