using System;

namespace CarambolaSoft.Infrastructure.Persistence.Entities;

/// <summary>Usuario del sistema (login del API). El PIN solo existe como Salt + PinHash.</summary>
public partial class Usuario
{
    public Guid Id { get; set; }
    public string Nombre { get; set; } = null!;
    public string Rol { get; set; } = null!;      // ADMIN | PATRONA | EMPLEADO
    public string Salt { get; set; } = null!;
    public string PinHash { get; set; } = null!;
    public bool Activo { get; set; } = true;
    public int Intentos { get; set; }
    public DateTime? BloqueadoHasta { get; set; }
    public DateTime? UltimoLogin { get; set; }
    public DateTime UltimaModificacion { get; set; }
}
