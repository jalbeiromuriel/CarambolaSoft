using System;
using System.Collections.Generic;

namespace CarambolaSoft.Infrastructure.Persistence.Entities;

public partial class SesionesMesa
{
    public Guid Id { get; set; }

    public Guid MesaId { get; set; }

    public Guid TurnoCajaId { get; set; }

    public DateTime HoraInicio { get; set; }

    public DateTime? HoraFin { get; set; }

    public decimal TarifaPorHora { get; set; }

    public bool EsSincronizado { get; set; }

    public DateTime UltimaModificacion { get; set; }

    public virtual Factura? Factura { get; set; }

    public virtual MesasBillar Mesa { get; set; } = null!;

    public virtual ICollection<Participante> Participantes { get; set; } = new List<Participante>();

    public virtual ICollection<PedidosCuenta> PedidosCuenta { get; set; } = new List<PedidosCuenta>();

    public virtual TurnosCaja TurnoCaja { get; set; } = null!;
}
