/* =====================================================================
   CarambolaSoft / El Parche de Jony  -  Costo promedio, margenes y fiados por cliente (v6.2)
   PROPUESTA: NO se ha ejecutado. Probar en la BD de laboratorio, con backup.
   Requisito: ejecutar ANTES el delta v6.2 (COMPRAS_INVENTARIO, CONFIGURACION_NEGOCIO, CostoUltimaCompra, ControlaStock).
   Regla (BACKLOG D-F / CU-11, CU-12):
     - margen = (precio - costo) / precio, medido con el ULTIMO costo de compra;
     - alerta bajo el objetivo (CONFIGURACION_NEGOCIO.MargenObjetivo, hoy 40 %);
     - el sistema SUGIERE precio, nunca lo cambia solo;
     - PRODUCTOS.CostoCompra = costo PROMEDIO PONDERADO (es el que alimenta CostoCompraHist y el P&L).
   ===================================================================== */
SET ANSI_NULLS ON;
GO
SET QUOTED_IDENTIFIER ON;
GO

/* ---------- 1. Reabastecer / editar costo ---------- */
-- COMPRA : suma Cantidad al stock, recalcula costo promedio ponderado y guarda el ultimo costo.
-- EDICION: el usuario corrige el costo a mano; fija CostoCompra y CostoUltimaCompra, NO toca stock.
-- Las compras son append-only: el trigger solo escucha INSERT. Si el API sincroniza con upsert,
-- una fila ya existente que se reenvia NO debe volver a sumar (usar INSERT ... WHERE NOT EXISTS por Id).
CREATE OR ALTER TRIGGER dbo.TR_COMPRAS_ActualizarCosto
ON dbo.COMPRAS_INVENTARIO AFTER INSERT
AS
BEGIN
    SET NOCOUNT ON;

    ;WITH ed AS (   -- ultima edicion manual del lote, por producto
        SELECT ProductoId, CostoUnitario,
               ROW_NUMBER() OVER (PARTITION BY ProductoId ORDER BY FechaHora DESC, Id DESC) AS rn
        FROM inserted WHERE Origen = 'EDICION'
    ),
    cp AS (         -- compras del lote, agregadas por producto
        SELECT ProductoId,
               SUM(Cantidad)                    AS Cant,
               SUM(Cantidad * CostoUnitario)    AS Valor
        FROM inserted WHERE Origen = 'COMPRA' GROUP BY ProductoId
    ),
    ul AS (         -- ultima compra del lote (para CostoUltimaCompra)
        SELECT ProductoId, CostoUnitario,
               ROW_NUMBER() OVER (PARTITION BY ProductoId ORDER BY FechaHora DESC, Id DESC) AS rn
        FROM inserted WHERE Origen = 'COMPRA'
    )
    UPDATE p
       SET p.CostoCompra =
               CASE
                   WHEN cp.Cant IS NOT NULL THEN
                        -- promedio ponderado; la base es la edicion del lote si la hay, si no el costo actual
                        CAST( ( p.StockActual * COALESCE(e.CostoUnitario, p.CostoCompra) + cp.Valor )
                              / NULLIF(p.StockActual + cp.Cant, 0) AS DECIMAL(18,2) )
                   WHEN e.CostoUnitario IS NOT NULL THEN e.CostoUnitario
                   ELSE p.CostoCompra
               END,
           p.CostoUltimaCompra = COALESCE(u.CostoUnitario, e.CostoUnitario, p.CostoUltimaCompra),
           p.StockActual       = p.StockActual + COALESCE(cp.Cant, 0),
           p.UltimaModificacion = GETDATE(),
           p.EsSincronizado     = 0
    FROM dbo.PRODUCTOS p
    LEFT JOIN cp            ON cp.ProductoId = p.Id
    LEFT JOIN ed e          ON e.ProductoId  = p.Id AND e.rn = 1
    LEFT JOIN ul u          ON u.ProductoId  = p.Id AND u.rn = 1
    WHERE cp.ProductoId IS NOT NULL OR e.ProductoId IS NOT NULL;
END;
GO

/* ---------- 2. Margenes ---------- */
CREATE OR ALTER VIEW dbo.VW_MARGENES AS
SELECT
    p.Id                                   AS ProductoId,
    p.Nombre,
    cat.Nombre                             AS Categoria,
    p.PrecioVenta,
    p.CostoCompra                          AS CostoPromedio,
    COALESCE(p.CostoUltimaCompra, p.CostoCompra) AS CostoReferencia,
    CASE WHEN p.PrecioVenta > 0
         THEN CAST((p.PrecioVenta - COALESCE(p.CostoUltimaCompra, p.CostoCompra)) * 100.0 / p.PrecioVenta AS DECIMAL(6,2))
    END                                    AS MargenPct,
    cfg.MargenObjetivo,
    CASE WHEN p.PrecioVenta > 0
          AND (p.PrecioVenta - COALESCE(p.CostoUltimaCompra, p.CostoCompra)) * 100.0 / p.PrecioVenta < cfg.MargenObjetivo
         THEN 1 ELSE 0 END                 AS BajoObjetivo,
    -- sugerencia (no se aplica sola); redondeada hacia arriba a multiplos de 100 COP
    CAST(CEILING(COALESCE(p.CostoUltimaCompra, p.CostoCompra) / (1 - cfg.MargenObjetivo / 100.0) / 100.0) * 100 AS DECIMAL(18,2)) AS PrecioSugerido
FROM dbo.PRODUCTOS p
INNER JOIN dbo.CATEGORIAS cat ON cat.Id = p.CategoriaId
CROSS JOIN (SELECT TOP 1 MargenObjetivo FROM dbo.CONFIGURACION_NEGOCIO) cfg
WHERE p.Activo = 1;
GO

/* ---------- 3. Fiados por cliente (cobranza) ----------
   VW_FIADOS_PENDIENTES (v6) se queda: es el detalle por factura.
   Esta vista suma por cliente para la pantalla de Fiados y el abono global (D-C: una cartera por cliente). */
CREATE OR ALTER VIEW dbo.VW_FIADOS_POR_CLIENTE AS
SELECT
    ClienteId,
    MAX(Deudor)                          AS Deudor,
    COUNT(*)                             AS FacturasAbiertas,
    SUM(TotalPagar)                      AS TotalOriginal,
    SUM(TotalAbonado)                    AS TotalAbonado,
    SUM(TotalPendienteFiado)             AS SaldoPendiente,
    MIN(FechaCuenta)                     AS FiadoMasAntiguo,
    DATEDIFF(DAY, MIN(FechaCuenta), GETDATE()) AS DiasMora
FROM dbo.VW_FIADOS_PENDIENTES
WHERE TotalPendienteFiado > 0
GROUP BY ClienteId;       -- cuentas sin cliente (ClienteId NULL) quedan juntas: el POS debe exigir cliente para fiar
GO

/* ---- Notas ----
   [RIESGO] Si CONFIGURACION_NEGOCIO esta vacia, VW_MARGENES no devuelve filas (CROSS JOIN). Insertar la fila unica con el delta.
   [RIESGO] StockActual + Cantidad = 0 solo ocurre en EDICION sin compra; en COMPRA Cantidad > 0 (CK_CI_Cantidad).
   [MEJORA] Pruebas: (a) stock 10 a $2.000 + compra 10 a $3.000 -> costo 2.500, ultimo 3.000, stock 20;
            (b) EDICION a $2.800 -> costo y ultimo 2.800, stock igual; (c) dos compras del mismo producto en un INSERT.
   [DECIDIR] Fiado sin cliente: hoy ClienteId puede ser NULL y el GROUP BY los junta; conviene CHECK/regla en API. */
