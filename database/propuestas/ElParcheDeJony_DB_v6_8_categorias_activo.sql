/* =====================================================================
   CarambolaSoft · BD ElParcheDeJony · DELTA v6.8 — CATEGORIAS.Activo
   ESTADO: PROPUESTA. Probar primero en ElParcheDeJony_LAB, con backup. Idempotente.
   La app desactiva categorías en vez de borrarlas (nunca se borran); SQL necesita la columna para reflejarlo.
   ===================================================================== */
USE ElParcheDeJony_LAB;
GO
IF COL_LENGTH('dbo.CATEGORIAS', 'Activo') IS NULL
    ALTER TABLE dbo.CATEGORIAS ADD Activo BIT NOT NULL CONSTRAINT DF_CATEGORIAS_Activo DEFAULT 1;
GO
SELECT COUNT(*) AS Categorias, SUM(CAST(Activo AS INT)) AS Activas FROM dbo.CATEGORIAS;
