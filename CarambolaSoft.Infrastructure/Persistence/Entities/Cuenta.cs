using System;
using System.Collections.Generic;

namespace CarambolaSoft.Infrastructure.Persistence.Entities;

public partial class Cuenta
{
    public Guid Id { get; set; }

    public Guid TurnoCajaId { get; set; }

    public string TipoCuenta { get; set; } = null!;

    public Guid? MesaId { get; set; }

    public Guid? ClienteId { get; set; }

    public string? NombreLibre { get; set; }

    public DateTime HoraApertura { get; set; }

    public DateTime? HoraCierre { get; set; }

    public decimal? TarifaPorHora { get; set; }

    public string Estado { get; set; } = null!;

    public bool EsSincronizado { get; set; }

    public DateTime UltimaModificacion { get; set; }

    public virtual Cliente? Cliente { get; set; }

    public virtual Factura? Factura { get; set; }

    public virtual MesasBillar? Mesa { get; set; }

    public virtual ICollection<PedidosCuenta> PedidosCuenta { get; set; } = new List<PedidosCuenta>();

    public virtual ICollection<SesionesMesa> SesionesMesas { get; set; } = new List<SesionesMesa>();

    public virtual TurnosCaja TurnoCaja { get; set; } = null!;
}
