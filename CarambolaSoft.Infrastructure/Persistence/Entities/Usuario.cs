using System;

namespace CarambolaSoft.Infrastructure.Persistence.Entities;

/// <summary>Usuario del sistema (login del API). El PIN solo existe como PinSal + PinHash.</summary>
public partial class Usuario
{
    public Guid Id { get; set; }
    public string Nombre { get; set; } = null!;
    public string Rol { get; set; } = null!;      // ADMIN | PATRONA | EMPLEADO
    public string? PinHash { get; set; }
    public string? PinSal { get; set; }
    public bool Activo { get; set; } = true;
    public int IntentosFallidos { get; set; }
    public DateTime? BloqueadoHastaUtc { get; set; }
    public DateTime? UltimoAccesoUtc { get; set; }
    public bool EsSincronizado { get; set; }
    public DateTime UltimaModificacion { get; set; }
}
