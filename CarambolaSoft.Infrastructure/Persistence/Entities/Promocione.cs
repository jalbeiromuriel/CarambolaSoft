using System;
using System.Collections.Generic;

namespace CarambolaSoft.Infrastructure.Persistence.Entities;

public partial class Promocione
{
    public Guid Id { get; set; }

    public Guid ProductoId { get; set; }

    public decimal PrecioPromo { get; set; }

    public TimeOnly HoraInicio { get; set; }

    public TimeOnly HoraFin { get; set; }

    public byte DiasSemana { get; set; }

    public bool Activa { get; set; }

    public bool EsSincronizado { get; set; }

    public DateTime UltimaModificacion { get; set; }

    public virtual Producto Producto { get; set; } = null!;
}
