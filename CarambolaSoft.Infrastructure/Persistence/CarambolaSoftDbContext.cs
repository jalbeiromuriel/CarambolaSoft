using System;
using System.Collections.Generic;
using CarambolaSoft.Infrastructure.Persistence.Entities;
using Microsoft.EntityFrameworkCore;

namespace CarambolaSoft.Infrastructure.Persistence;

public partial class CarambolaSoftDbContext : DbContext
{
    public CarambolaSoftDbContext()
    {
    }

    public CarambolaSoftDbContext(DbContextOptions<CarambolaSoftDbContext> options)
        : base(options)
    {
    }

    public virtual DbSet<Categoria> Categorias { get; set; }

    public virtual DbSet<CierreDium> CierreDia { get; set; }

    public virtual DbSet<Factura> Facturas { get; set; }

    public virtual DbSet<Jugadore> Jugadores { get; set; }

    public virtual DbSet<MesasBillar> MesasBillars { get; set; }

    public virtual DbSet<Participante> Participantes { get; set; }

    public virtual DbSet<ParticipanteMarcasTiempo> ParticipanteMarcasTiempos { get; set; }

    public virtual DbSet<PedidosCuenta> PedidosCuentas { get; set; }

    public virtual DbSet<Producto> Productos { get; set; }

    public virtual DbSet<Rivalidade> Rivalidades { get; set; }

    public virtual DbSet<SesionesMesa> SesionesMesas { get; set; }

    public virtual DbSet<TurnosCaja> TurnosCajas { get; set; }

    public virtual DbSet<VwCierreNocturno> VwCierreNocturnos { get; set; }

    public virtual DbSet<VwColaSincronizacion> VwColaSincronizacions { get; set; }

    public virtual DbSet<VwFiadosPendiente> VwFiadosPendientes { get; set; }

    public virtual DbSet<VwRivalidadesJugador> VwRivalidadesJugadors { get; set; }

    protected override void OnConfiguring(DbContextOptionsBuilder optionsBuilder)
    {
        // Vacío de forma intencional: la configuración se inyecta desde Program.cs
    }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.UseCollation("Modern_Spanish_CI_AI");

        modelBuilder.Entity<Categoria>(entity =>
        {
            entity.ToTable("CATEGORIAS");

            entity.HasIndex(e => e.Nombre, "UQ_CATEGORIAS_Nombre").IsUnique();

            entity.Property(e => e.Id).HasDefaultValueSql("(newsequentialid())");
            entity.Property(e => e.Nombre)
                .HasMaxLength(50)
                .IsUnicode(false);
            entity.Property(e => e.UltimaModificacion)
                .HasDefaultValueSql("(getdate())")
                .HasColumnType("datetime");
        });

        modelBuilder.Entity<CierreDium>(entity =>
        {
            entity.ToTable("CIERRE_DIA", tb => tb.HasTrigger("TR_CIERRE_DIA_NoEditarConfirmado"));

            entity.HasIndex(e => new { e.EsSincronizado, e.UltimaModificacion }, "IX_CIERRE_Sync");

            entity.HasIndex(e => e.TurnoCajaId, "UQ_CIERRE_DIA_Turno").IsUnique();

            entity.Property(e => e.Id).HasDefaultValueSql("(newsequentialid())");
            entity.Property(e => e.Descuadre).HasColumnType("decimal(18, 2)");
            entity.Property(e => e.EfectivoReportado).HasColumnType("decimal(18, 2)");
            entity.Property(e => e.Fecha).HasDefaultValueSql("(CONVERT([date],getdate()))");
            entity.Property(e => e.TotalFiado).HasColumnType("decimal(18, 2)");
            entity.Property(e => e.TotalGeneral).HasColumnType("decimal(18, 2)");
            entity.Property(e => e.TotalLicor).HasColumnType("decimal(18, 2)");
            entity.Property(e => e.TotalOtros).HasColumnType("decimal(18, 2)");
            entity.Property(e => e.TotalTiempo).HasColumnType("decimal(18, 2)");
            entity.Property(e => e.UltimaModificacion)
                .HasDefaultValueSql("(getdate())")
                .HasColumnType("datetime");

            entity.HasOne(d => d.TurnoCaja).WithOne(p => p.CierreDium)
                .HasForeignKey<CierreDium>(d => d.TurnoCajaId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_CIERRE_DIA_TURNO");
        });

        modelBuilder.Entity<Factura>(entity =>
        {
            entity.ToTable("FACTURAS");

            entity.HasIndex(e => e.EstadoPago, "IX_FACTURAS_Fiado").HasFilter("([EstadoPago]='FIADO')");

            entity.HasIndex(e => new { e.EsSincronizado, e.UltimaModificacion }, "IX_FACTURAS_Sync");

            entity.HasIndex(e => new { e.TurnoCajaId, e.EstadoPago }, "IX_FACTURAS_TurnoCajaId");

            entity.HasIndex(e => e.SesionMesaId, "UQ_FACTURAS_Sesion").IsUnique();

            entity.Property(e => e.Id).HasDefaultValueSql("(newsequentialid())");
            entity.Property(e => e.EstadoPago)
                .HasMaxLength(20)
                .IsUnicode(false)
                .HasDefaultValue("PENDIENTE");
            entity.Property(e => e.MetodoPago)
                .HasMaxLength(20)
                .IsUnicode(false);
            entity.Property(e => e.SubtotalLicor).HasColumnType("decimal(18, 2)");
            entity.Property(e => e.SubtotalOtros).HasColumnType("decimal(18, 2)");
            entity.Property(e => e.SubtotalSnacks).HasColumnType("decimal(18, 2)");
            entity.Property(e => e.SubtotalTiempo).HasColumnType("decimal(18, 2)");
            entity.Property(e => e.TotalPagar).HasColumnType("decimal(18, 2)");
            entity.Property(e => e.TotalPendienteFiado).HasColumnType("decimal(18, 2)");
            entity.Property(e => e.UltimaModificacion)
                .HasDefaultValueSql("(getdate())")
                .HasColumnType("datetime");

            entity.HasOne(d => d.SesionMesa).WithOne(p => p.Factura)
                .HasForeignKey<Factura>(d => d.SesionMesaId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_FACTURAS_SESION");

            entity.HasOne(d => d.TurnoCaja).WithMany(p => p.Facturas)
                .HasForeignKey(d => d.TurnoCajaId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_FACTURAS_TURNO");
        });

        modelBuilder.Entity<Jugadore>(entity =>
        {
            entity.ToTable("JUGADORES");

            entity.HasIndex(e => e.RecordCarambolas, "IX_JUGADORES_Record").IsDescending();

            entity.HasIndex(e => new { e.EsSincronizado, e.UltimaModificacion }, "IX_JUGADORES_Sync");

            entity.HasIndex(e => e.Username, "UQ_JUGADORES_Username").IsUnique();

            entity.Property(e => e.Id).HasDefaultValueSql("(newsequentialid())");
            entity.Property(e => e.AvatarUrl)
                .HasMaxLength(500)
                .IsUnicode(false);
            entity.Property(e => e.FechaRegistro)
                .HasDefaultValueSql("(getdate())")
                .HasColumnType("datetime");
            entity.Property(e => e.PasswordHash)
                .HasMaxLength(256)
                .IsUnicode(false);
            entity.Property(e => e.UltimaModificacion)
                .HasDefaultValueSql("(getdate())")
                .HasColumnType("datetime");
            entity.Property(e => e.Username)
                .HasMaxLength(50)
                .IsUnicode(false);
        });

        modelBuilder.Entity<MesasBillar>(entity =>
        {
            entity.ToTable("MESAS_BILLAR");

            entity.HasIndex(e => new { e.EsSincronizado, e.UltimaModificacion }, "IX_MESAS_Sync");

            entity.HasIndex(e => e.Numero, "UQ_MESAS_Numero").IsUnique();

            entity.Property(e => e.Id).HasDefaultValueSql("(newsequentialid())");
            entity.Property(e => e.Estado)
                .HasMaxLength(20)
                .IsUnicode(false)
                .HasDefaultValue("DISPONIBLE");
            entity.Property(e => e.Tipo)
                .HasMaxLength(20)
                .IsUnicode(false);
            entity.Property(e => e.UltimaModificacion)
                .HasDefaultValueSql("(getdate())")
                .HasColumnType("datetime");
        });

        modelBuilder.Entity<Participante>(entity =>
        {
            entity.ToTable("PARTICIPANTES", tb => tb.HasTrigger("TR_PARTICIPANTES_ActualizarRivalidades"));

            entity.HasIndex(e => new { e.SesionMesaId, e.JugadorId }, "UQ_PARTICIPANTES_Sesion_Jug").IsUnique();

            entity.Property(e => e.Id).HasDefaultValueSql("(newsequentialid())");

            entity.HasOne(d => d.Jugador).WithMany(p => p.Participantes)
                .HasForeignKey(d => d.JugadorId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_PARTICIPANTES_JUGADOR");

            entity.HasOne(d => d.SesionMesa).WithMany(p => p.Participantes)
                .HasForeignKey(d => d.SesionMesaId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_PARTICIPANTES_SESION");
        });

        modelBuilder.Entity<ParticipanteMarcasTiempo>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PK_MARCAS_TIEMPO");

            entity.ToTable("PARTICIPANTE_MARCAS_TIEMPO");

            entity.HasIndex(e => new { e.ParticipanteId, e.MarcaTiempo }, "IX_MARCAS_Participante");

            entity.Property(e => e.Id).HasDefaultValueSql("(newsequentialid())");
            entity.Property(e => e.CarambolasEnMarca).HasDefaultValue(1);
            entity.Property(e => e.MarcaTiempo)
                .HasDefaultValueSql("(getdate())")
                .HasColumnType("datetime");

            entity.HasOne(d => d.Participante).WithMany(p => p.ParticipanteMarcasTiempos)
                .HasForeignKey(d => d.ParticipanteId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_MARCAS_PARTICIPANTE");
        });

        modelBuilder.Entity<PedidosCuenta>(entity =>
        {
            entity.ToTable("PEDIDOS_CUENTAS", tb => tb.HasTrigger("TR_PEDIDOS_GestionarStock"));

            entity.HasIndex(e => new { e.SesionMesaId, e.EstadoPedido }, "IX_PEDIDOS_Sesion_Estado");

            entity.Property(e => e.Id).HasDefaultValueSql("(newsequentialid())");
            entity.Property(e => e.CategoriaConsumo)
                .HasMaxLength(30)
                .IsUnicode(false);
            entity.Property(e => e.CostoCompraHist).HasColumnType("decimal(18, 2)");
            entity.Property(e => e.EstadoPedido)
                .HasMaxLength(20)
                .IsUnicode(false)
                .HasDefaultValue("PENDIENTE");
            entity.Property(e => e.PrecioUnitarioHist).HasColumnType("decimal(18, 2)");

            entity.HasOne(d => d.Producto).WithMany(p => p.PedidosCuenta)
                .HasForeignKey(d => d.ProductoId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_PEDIDOS_PRODUCTO");

            entity.HasOne(d => d.SesionMesa).WithMany(p => p.PedidosCuenta)
                .HasForeignKey(d => d.SesionMesaId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_PEDIDOS_SESION");
        });

        modelBuilder.Entity<Producto>(entity =>
        {
            entity.ToTable("PRODUCTOS");

            entity.HasIndex(e => new { e.EsSincronizado, e.UltimaModificacion }, "IX_PRODUCTOS_Sync");

            entity.Property(e => e.Id).HasDefaultValueSql("(newsequentialid())");
            entity.Property(e => e.CostoCompra).HasColumnType("decimal(18, 2)");
            entity.Property(e => e.Nombre)
                .HasMaxLength(100)
                .IsUnicode(false);
            entity.Property(e => e.PrecioVenta).HasColumnType("decimal(18, 2)");
            entity.Property(e => e.UltimaModificacion)
                .HasDefaultValueSql("(getdate())")
                .HasColumnType("datetime");

            entity.HasOne(d => d.Categoria).WithMany(p => p.Productos)
                .HasForeignKey(d => d.CategoriaId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_PRODUCTOS_CATEGORIAS");
        });

        modelBuilder.Entity<Rivalidade>(entity =>
        {
            entity.ToTable("RIVALIDADES");

            entity.HasIndex(e => e.JugadorAid, "IX_RIVALIDADES_JugA");

            entity.HasIndex(e => e.JugadorBid, "IX_RIVALIDADES_JugB");

            entity.HasIndex(e => new { e.EsSincronizado, e.UltimaModificacion }, "IX_RIVALIDADES_Sync");

            entity.HasIndex(e => new { e.JugadorAid, e.JugadorBid }, "UQ_RIVALIDADES_Par").IsUnique();

            entity.Property(e => e.Id).HasDefaultValueSql("(newsequentialid())");
            entity.Property(e => e.JugadorAid).HasColumnName("JugadorAId");
            entity.Property(e => e.JugadorBid).HasColumnName("JugadorBId");
            entity.Property(e => e.UltimaModificacion)
                .HasDefaultValueSql("(getdate())")
                .HasColumnType("datetime");
            entity.Property(e => e.UltimaPartida).HasColumnType("datetime");

            entity.HasOne(d => d.JugadorA).WithMany(p => p.RivalidadeJugadorAs)
                .HasForeignKey(d => d.JugadorAid)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_RIVALIDADES_JUGADOR_A");

            entity.HasOne(d => d.JugadorB).WithMany(p => p.RivalidadeJugadorBs)
                .HasForeignKey(d => d.JugadorBid)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_RIVALIDADES_JUGADOR_B");
        });

        modelBuilder.Entity<SesionesMesa>(entity =>
        {
            entity.ToTable("SESIONES_MESAS");

            entity.HasIndex(e => new { e.MesaId, e.HoraFin }, "IX_SESIONES_MesaId");

            entity.HasIndex(e => new { e.EsSincronizado, e.UltimaModificacion }, "IX_SESIONES_Sync");

            entity.Property(e => e.Id).HasDefaultValueSql("(newsequentialid())");
            entity.Property(e => e.HoraFin).HasColumnType("datetime");
            entity.Property(e => e.HoraInicio)
                .HasDefaultValueSql("(getdate())")
                .HasColumnType("datetime");
            entity.Property(e => e.TarifaPorHora).HasColumnType("decimal(18, 2)");
            entity.Property(e => e.UltimaModificacion)
                .HasDefaultValueSql("(getdate())")
                .HasColumnType("datetime");

            entity.HasOne(d => d.Mesa).WithMany(p => p.SesionesMesas)
                .HasForeignKey(d => d.MesaId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_SESIONES_MESA");

            entity.HasOne(d => d.TurnoCaja).WithMany(p => p.SesionesMesas)
                .HasForeignKey(d => d.TurnoCajaId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_SESIONES_TURNO");
        });

        modelBuilder.Entity<TurnosCaja>(entity =>
        {
            entity.ToTable("TURNOS_CAJA");

            entity.HasIndex(e => new { e.EsSincronizado, e.UltimaModificacion }, "IX_TURNOS_Sync");

            entity.Property(e => e.Id).HasDefaultValueSql("(newsequentialid())");
            entity.Property(e => e.BaseEfectivo).HasColumnType("decimal(18, 2)");
            entity.Property(e => e.EfectivoRealEntregado).HasColumnType("decimal(18, 2)");
            entity.Property(e => e.FechaApertura)
                .HasDefaultValueSql("(getdate())")
                .HasColumnType("datetime");
            entity.Property(e => e.FechaCierre).HasColumnType("datetime");
            entity.Property(e => e.UltimaModificacion)
                .HasDefaultValueSql("(getdate())")
                .HasColumnType("datetime");
        });

        modelBuilder.Entity<VwCierreNocturno>(entity =>
        {
            entity
                .HasNoKey()
                .ToView("VW_CIERRE_NOCTURNO");

            entity.Property(e => e.EstadoPago)
                .HasMaxLength(20)
                .IsUnicode(false);
            entity.Property(e => e.HoraFin).HasColumnType("datetime");
            entity.Property(e => e.HoraInicio).HasColumnType("datetime");
            entity.Property(e => e.MargenBruto).HasColumnType("decimal(38, 2)");
            entity.Property(e => e.MetodoPago)
                .HasMaxLength(20)
                .IsUnicode(false);
            entity.Property(e => e.SubtotalLicor).HasColumnType("decimal(18, 2)");
            entity.Property(e => e.SubtotalOtros).HasColumnType("decimal(18, 2)");
            entity.Property(e => e.SubtotalSnacks).HasColumnType("decimal(18, 2)");
            entity.Property(e => e.SubtotalTiempo).HasColumnType("decimal(18, 2)");
            entity.Property(e => e.TotalPagar).HasColumnType("decimal(18, 2)");
            entity.Property(e => e.TotalPendienteFiado).HasColumnType("decimal(18, 2)");
        });

        modelBuilder.Entity<VwColaSincronizacion>(entity =>
        {
            entity
                .HasNoKey()
                .ToView("VW_COLA_SINCRONIZACION");

            entity.Property(e => e.Tabla)
                .HasMaxLength(14)
                .IsUnicode(false);
            entity.Property(e => e.UltimaModificacion).HasColumnType("datetime");
        });

        modelBuilder.Entity<VwFiadosPendiente>(entity =>
        {
            entity
                .HasNoKey()
                .ToView("VW_FIADOS_PENDIENTES");

            entity.Property(e => e.FechaPartida).HasColumnType("datetime");
            entity.Property(e => e.FechaTurno).HasColumnType("datetime");
            entity.Property(e => e.Jugadores)
                .HasMaxLength(8000)
                .IsUnicode(false);
            entity.Property(e => e.TotalPagar).HasColumnType("decimal(18, 2)");
            entity.Property(e => e.TotalPendienteFiado).HasColumnType("decimal(18, 2)");
        });

        modelBuilder.Entity<VwRivalidadesJugador>(entity =>
        {
            entity
                .HasNoKey()
                .ToView("VW_RIVALIDADES_JUGADOR");

            entity.Property(e => e.Contrincante)
                .HasMaxLength(50)
                .IsUnicode(false);
            entity.Property(e => e.Jugador)
                .HasMaxLength(50)
                .IsUnicode(false);
            entity.Property(e => e.PorcentajeVictorias).HasColumnType("decimal(5, 1)");
            entity.Property(e => e.UltimaPartida).HasColumnType("datetime");
        });

        OnModelCreatingPartial(modelBuilder);
    }

    partial void OnModelCreatingPartial(ModelBuilder modelBuilder);
}
