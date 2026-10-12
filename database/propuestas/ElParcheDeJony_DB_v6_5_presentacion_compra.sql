/* =====================================================================
   CarambolaSoft · BD ElParcheDeJony · DELTA v6.5 — Presentación de compra
   ESTADO: PROPUESTA. NO se ha ejecutado contra SQL Server.
   ANTES DE CORRER: backup; probar primero en ElParcheDeJony_LAB, nunca en el PC del negocio.
   Idempotente: cada bloque verifica si el objeto ya existe.

   Qué resuelve: hay productos que se compran por caja/canasta/paca (cerveza, gaseosas) pero se
   venden y se cuentan por unidad. El stock sigue en unidades; esto solo dice cuántas unidades
   trae cada presentación, para pedir y recibir por cajas (lista de reposición y Reabastecer).
   En la app (IndexedDB) es Producto.Presentacion = { Nombre, Unidades }.
   ===================================================================== */
USE ElParcheDeJony_LAB;   -- cambiar a ElParcheDeJony solo cuando las pruebas pasen, con backup fresco
GO

IF COL_LENGTH('dbo.PRODUCTOS', 'PresentacionCompra') IS NULL
    ALTER TABLE dbo.PRODUCTOS ADD PresentacionCompra VARCHAR(20) COLLATE Modern_Spanish_CI_AI NULL;   -- Caja | Canasta | Paca | Bulto
IF COL_LENGTH('dbo.PRODUCTOS', 'UnidadesPorPresentacion') IS NULL
    ALTER TABLE dbo.PRODUCTOS ADD UnidadesPorPresentacion INT NULL;
GO

-- Las dos columnas van juntas o ninguna, y una caja trae al menos 2 unidades.
IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_PRODUCTOS_Presentacion')
ALTER TABLE dbo.PRODUCTOS ADD CONSTRAINT CK_PRODUCTOS_Presentacion CHECK (
    (PresentacionCompra IS NULL AND UnidadesPorPresentacion IS NULL)
    OR (PresentacionCompra IS NOT NULL AND UnidadesPorPresentacion >= 2));
GO

-- Verificación
SELECT COUNT(*) AS ConPresentacion FROM dbo.PRODUCTOS WHERE PresentacionCompra IS NOT NULL;
-- [PENDIENTE] Tras aplicarlo: re-scaffold de la entidad Producto y mapear con la sincronización (A4).
