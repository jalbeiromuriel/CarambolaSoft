using Microsoft.EntityFrameworkCore;
using CarambolaSoft.Infrastructure.Persistence.Entities;

namespace CarambolaSoft.Infrastructure.Persistence;

public partial class CarambolaSoftDbContext
{
    partial void OnModelCreatingPartial(ModelBuilder modelBuilder)
    {
        // SQL Server no permite OUTPUT en tablas con trigger (EF Core 7+)
        modelBuilder.Entity<PedidosCuenta>(e =>
            e.ToTable(tb => tb.HasTrigger("TR_PEDIDOS_GestionarStock")));

        modelBuilder.Entity<CierreDium>(e =>
            e.ToTable(tb => tb.HasTrigger("TR_CIERRE_DIA_NoEditarConfirmado")));

        modelBuilder.Entity<AbonosFiado>(e =>
            e.ToTable(tb => tb.HasTrigger("TR_ABONOS_ActualizarFactura")));

        modelBuilder.Entity<Participante>(e =>
            e.ToTable(tb => tb.HasTrigger("TR_PARTICIPANTES_ActualizarRivalidades")));
    }
}