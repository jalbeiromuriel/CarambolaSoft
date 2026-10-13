/* =====================================================================
   SOLO PARA EL LAB — vacía PRODUCTOS y CATEGORIAS (y lo que cuelga de ellos) para volver a llenarlos
   desde la app con el botón «Subir inventario al servidor». NO toca clientes, fiados, cajas, usuarios.
   SEGURIDAD: se niega a correr si la base no es ElParcheDeJony_LAB, y NO borra nada hasta que cambies
   @CONFIRMAR a 1 (con 0 solo muestra cuántas filas se borrarían).
   ===================================================================== */
USE ElParcheDeJony_LAB;
GO
IF DB_NAME() <> 'ElParcheDeJony_LAB' THROW 50000, 'Este script solo corre en ElParcheDeJony_LAB.', 1;
GO
DECLARE @CONFIRMAR BIT = 0;      -- <- 0 = solo contar · 1 = borrar de verdad

SELECT 'CAMBIOS_PRECIO' AS Tabla, COUNT(*) AS Filas FROM dbo.CAMBIOS_PRECIO
UNION ALL SELECT 'COMPRAS_INVENTARIO', COUNT(*) FROM dbo.COMPRAS_INVENTARIO
UNION ALL SELECT 'PROMOCIONES', COUNT(*) FROM dbo.PROMOCIONES
UNION ALL SELECT 'PEDIDOS_CUENTAS (con producto)', COUNT(*) FROM dbo.PEDIDOS_CUENTAS WHERE ProductoId IS NOT NULL
UNION ALL SELECT 'PRODUCTOS', COUNT(*) FROM dbo.PRODUCTOS
UNION ALL SELECT 'CATEGORIAS', COUNT(*) FROM dbo.CATEGORIAS;

IF @CONFIRMAR = 1
BEGIN TRY
    BEGIN TRAN;
    DELETE FROM dbo.CAMBIOS_PRECIO;
    DELETE FROM dbo.COMPRAS_INVENTARIO;
    DELETE FROM dbo.PROMOCIONES;
    DELETE FROM dbo.PEDIDOS_CUENTAS WHERE ProductoId IS NOT NULL;     -- datos de prueba del LAB
    UPDATE dbo.PRODUCTOS SET FraccionOrigenId = NULL, FraccionRinde = NULL WHERE FraccionOrigenId IS NOT NULL;
    DELETE FROM dbo.PRODUCTOS;
    DELETE FROM dbo.CATEGORIAS;
    COMMIT;
    SELECT 'LISTO: productos y categorías vaciados' AS Resultado;
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK;
    THROW;     -- no se borró nada; manda este mensaje de error
END CATCH
