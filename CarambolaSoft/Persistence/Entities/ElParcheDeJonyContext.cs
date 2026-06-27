using System;
using System.Collections.Generic;
using Microsoft.EntityFrameworkCore;

namespace CarambolaSoft.API.Persistence.Entities;

public partial class ElParcheDeJonyContext : DbContext
{
    public ElParcheDeJonyContext()
    {
    }

    public ElParcheDeJonyContext(DbContextOptions<ElParcheDeJonyContext> options)
        : base(options)
    {
    }

    public virtual DbSet<MesasBillar> MesasBillars { get; set; }

    protected override void OnConfiguring(DbContextOptionsBuilder optionsBuilder)
    {
        // La configuración se inyecta desde Program.cs — no hardcodear aquí
    }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.UseCollation("Modern_Spanish_CI_AI");

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
            entity.Property(e => e.TarifaPorHora).HasColumnType("decimal(18, 2)");
            entity.Property(e => e.Tipo)
                .HasMaxLength(20)
                .IsUnicode(false);
            entity.Property(e => e.UltimaModificacion)
                .HasDefaultValueSql("(getdate())")
                .HasColumnType("datetime");
        });

        OnModelCreatingPartial(modelBuilder);
    }

    partial void OnModelCreatingPartial(ModelBuilder modelBuilder);
}
