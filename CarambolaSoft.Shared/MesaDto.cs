using System;
using System.Collections.Generic;
using System.Text;

namespace CarambolaSoft.Shared.DTOs.Mesas;

/// <summary>
/// Proyección de lectura de una mesa de billar.
/// Se usa en GET /api/mesas y GET /api/mesas/{id}.
/// </summary>
public class MesaDto
{
    public Guid Id { get; set; }
    public int Numero { get; set; }

    /// <summary>POOL | CARAMBOLA | SNOOKER</summary>
    public string Tipo { get; set; } = string.Empty;

    /// <summary>DISPONIBLE | OCUPADA | MANTENIMIENTO</summary>
    public string Estado { get; set; } = string.Empty;
}

