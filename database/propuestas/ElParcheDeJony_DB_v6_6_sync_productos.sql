/* =====================================================================
   CarambolaSoft · BD ElParcheDeJony · DELTA v6.6 — Soporte de sincronización de productos
   ESTADO: PROPUESTA. Probar primero en ElParcheDeJony_LAB, con backup. Idempotente.
   Requisitos: delta v6.2 (ya en el LAB) y v6.5 (presentación de compra).

   1) PRODUCTOS.FraccionOrigenId / FraccionRinde: producto que sale de abrir otro (copa <- botella,
      unidad <- caja). En la app es Producto.Fraccion = { OrigenId, Rinde }.
   2) CAMBIOS_PRECIO: quién cambió un precio de venta, cuándo y de cuánto a cuánto (aviso a ADM).
   Nota: el historial de costos del POS ya vive en COMPRAS_INVENTARIO (v6.2) y la promo del producto
   en PROMOCIONES; no se duplican aquí.
   ===================================================================== */
USE ElParcheDeJony_LAB;
GO

IF COL_LENGTH('dbo.PRODUCTOS', 'FraccionOrigenId') IS NULL
    ALTER TABLE dbo.PRODUCTOS ADD FraccionOrigenId UNIQUEIDENTIFIER NULL;
IF COL_LENGTH('dbo.PRODUCTOS', 'FraccionRinde') IS NULL
    ALTER TABLE dbo.PRODUCTOS ADD FraccionRinde INT NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_PRODUCTOS_FraccionOrigen')
    ALTER TABLE dbo.PRODUCTOS ADD CONSTRAINT FK_PRODUCTOS_FraccionOrigen FOREIGN KEY (FraccionOrigenId) REFERENCES dbo.PRODUCTOS(Id);
IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_PRODUCTOS_Fraccion')
    ALTER TABLE dbo.PRODUCTOS ADD CONSTRAINT CK_PRODUCTOS_Fraccion CHECK (
        (FraccionOrigenId IS NULL AND FraccionRinde IS NULL)
        OR (FraccionOrigenId IS NOT NULL AND FraccionRinde >= 1));
GO

IF OBJECT_ID('dbo.CAMBIOS_PRECIO') IS NULL
CREATE TABLE dbo.CAMBIOS_PRECIO (
    Id                  UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_CAMBIOS_PRECIO PRIMARY KEY,   -- GUID generado en el cliente
    ProductoId          UNIQUEIDENTIFIER NOT NULL,
    PrecioAntes         DECIMAL(18,2)    NOT NULL,
    PrecioDespues       DECIMAL(18,2)    NOT NULL,
    FechaHora           DATETIME2        NOT NULL,
    UsuarioId           UNIQUEIDENTIFIER NULL,        -- sin tabla de usuarios todavía (ver pendientes)
    UsuarioNombre       VARCHAR(60) COLLATE Modern_Spanish_CI_AI NULL,
    Motivo              VARCHAR(30) COLLATE Modern_Spanish_CI_AI NULL,   -- Simulador | Márgenes | Editar | Reabastecer | Recibir pedido
    Avisado             BIT              NOT NULL CONSTRAINT DF_CP_Avisado DEFAULT 0,
    EsSincronizado      BIT              NOT NULL CONSTRAINT DF_CP_Sync DEFAULT 0,
    UltimaModificacion  DATETIME         NOT NULL CONSTRAINT DF_CP_UM DEFAULT GETDATE(),
    CONSTRAINT FK_CP_Producto FOREIGN KEY (ProductoId) REFERENCES dbo.PRODUCTOS(Id),
    CONSTRAINT CK_CP_Cambio   CHECK (PrecioAntes <> PrecioDespues AND PrecioAntes >= 0 AND PrecioDespues >= 0)
);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_CP_Fecha')
    CREATE INDEX IX_CP_Fecha ON dbo.CAMBIOS_PRECIO (FechaHora DESC) INCLUDE (ProductoId);
GO

SELECT (SELECT COUNT(*) FROM sys.columns WHERE object_id = OBJECT_ID('dbo.PRODUCTOS')
        AND name IN ('FraccionOrigenId','FraccionRinde')) AS ColumnasFraccion,
       OBJECT_ID('dbo.CAMBIOS_PRECIO') AS TablaCambiosPrecio;   -- 2 y un número (no NULL)
