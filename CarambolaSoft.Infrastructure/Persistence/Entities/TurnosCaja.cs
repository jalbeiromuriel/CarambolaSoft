using System;
using System.Collections.Generic;

namespace CarambolaSoft.Infrastructure.Persistence.Entities;

public partial class TurnosCaja
{
    public Guid Id { get; set; }

    public Guid UsuarioId { get; set; }

    public DateTime FechaApertura { get; set; }

    public DateTime? FechaCierre { get; set; }

    public decimal BaseEfectivo { get; set; }

    public decimal? EfectivoRealEntregado { get; set; }

    public bool EsSincronizado { get; set; }

    public DateTime UltimaModificacion { get; set; }

    public virtual ICollection<AbonosFiado> AbonosFiados { get; set; } = new List<AbonosFiado>();

    public virtual CierreDium? CierreDium { get; set; }

    public virtual ICollection<Cuenta> Cuenta { get; set; } = new List<Cuenta>();

    public virtual ICollection<Factura> Facturas { get; set; } = new List<Factura>();

    public virtual ICollection<GastosCaja> GastosCajas { get; set; } = new List<GastosCaja>();

    public virtual ICollection<MaquinasMovimiento> MaquinasMovimientos { get; set; } = new List<MaquinasMovimiento>();
}
