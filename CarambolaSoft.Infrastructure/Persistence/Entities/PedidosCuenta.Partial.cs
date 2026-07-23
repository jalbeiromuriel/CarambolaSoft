using System;

namespace CarambolaSoft.Infrastructure.Persistence.Entities;

// ============================================================
//  BD v6.1 — FechaHora agregada por ALTER (2026-07-21).
//  EF la mapea por convención (mismo nombre de columna).
//
//  ⚠ DEUDA: al próximo re-scaffold, la clase generada YA
//  incluirá FechaHora → BORRAR este archivo o no compila
//  (propiedad duplicada).
// ============================================================
public partial class PedidosCuenta
{
    public DateTime FechaHora { get; set; }
}