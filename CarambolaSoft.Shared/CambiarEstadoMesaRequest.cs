using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Text;

namespace CarambolaSoft.Shared.DTOs.Mesas;

/// <summary>
/// Payload del PUT /api/mesas/{id}/estado
/// </summary>
public class CambiarEstadoMesaRequest
{
    [Required(ErrorMessage = "El estado es obligatorio.")]
    [RegularExpression("^(DISPONIBLE|OCUPADA|MANTENIMIENTO)$",
        ErrorMessage = "Estado inválido. Valores permitidos: DISPONIBLE, OCUPADA, MANTENIMIENTO.")]
    public string Estado { get; set; } = string.Empty;
}
