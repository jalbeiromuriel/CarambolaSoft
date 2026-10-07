/* =====================================================================
   CarambolaSoft / El Parche de Jony  -  Triggers de stock v6.2
   PROPUESTA: NO se ha ejecutado. Probar en la BD de laboratorio, con backup.
   Requisito: ejecutar ANTES el delta v6.2 (usa GrupoCompartidoId, ControlaStock, GRUPOS_COMPARTIDOS).
   Regla de negocio (decision #3): stock se reduce SOLO al ENTREGAR y se restituye al CANCELAR.

   Cambios frente al v6 real:
   1. Productos con ControlaStock = 0 (Tinto, aromatica, garita) no tocan stock -> ya no fallan por CK_PRODUCTOS_Stock.
   2. Filas con GrupoCompartidoId se ignoran en TR_PEDIDOS: el producto compartido se descuenta UNA vez,
      cuando se crea el grupo (TR_GRUPOS_GestionarStock), no una vez por parte.
   3. Si un mismo INSERT/UPDATE trae varias filas del mismo producto, se suma la cantidad.
      (El UPDATE ... FROM con JOIN del v6 aplicaba solo UNA fila por producto: error silencioso.)
   4. Se usa SUM por producto y un unico UPDATE para todo el lote.
   ===================================================================== */
SET ANSI_NULLS ON;
GO
SET QUOTED_IDENTIFIER ON;
GO

CREATE OR ALTER TRIGGER dbo.TR_PEDIDOS_GestionarStock
ON dbo.PEDIDOS_CUENTAS AFTER INSERT, UPDATE
AS
BEGIN
    SET NOCOUNT ON;

    -- Movimiento neto de stock por producto (negativo = sale, positivo = vuelve)
    ;WITH mov AS (
        SELECT i.ProductoId,
               CASE
                   -- INSERT directo como ENTREGADO, o transicion a ENTREGADO
                   WHEN i.EstadoPedido = 'ENTREGADO' AND (d.Id IS NULL OR d.EstadoPedido <> 'ENTREGADO')
                        THEN -i.Cantidad
                   -- cancelacion de un pedido que estaba ENTREGADO
                   WHEN i.EstadoPedido = 'CANCELADO' AND d.EstadoPedido = 'ENTREGADO'
                        THEN  i.Cantidad
                   ELSE 0
               END AS Delta
        FROM inserted i
        LEFT JOIN deleted d ON d.Id = i.Id
        WHERE i.CategoriaConsumo <> 'TIEMPO'        -- el tiempo no es inventario
          AND i.GrupoCompartidoId IS NULL           -- las partes compartidas las maneja TR_GRUPOS
    )
    UPDATE p
       SET p.StockActual        = p.StockActual + m.Neto,
           p.UltimaModificacion = GETDATE(),
           p.EsSincronizado     = 0
    FROM dbo.PRODUCTOS p
    INNER JOIN (SELECT ProductoId, SUM(Delta) AS Neto FROM mov GROUP BY ProductoId HAVING SUM(Delta) <> 0) m
            ON m.ProductoId = p.Id
    WHERE p.ControlaStock = 1;                      -- stock infinito: no se toca
END;
GO

/* Producto compartido (media, tabla, etc. repartida en partes):
   - Al crear el grupo se descuenta Cantidad UNA vez.
   - Si todas las partes se cancelan (PartesVivas = 0) y no se cobro, se restituye UNA vez.
   - Si el grupo se reabre (PartesVivas vuelve a > 0 sin cobrar tras restituir) se vuelve a descontar. */
CREATE OR ALTER TRIGGER dbo.TR_GRUPOS_GestionarStock
ON dbo.GRUPOS_COMPARTIDOS AFTER INSERT, UPDATE
AS
BEGIN
    SET NOCOUNT ON;

    ;WITH mov AS (
        SELECT i.ProductoId,
               CASE
                   WHEN d.Id IS NULL                                            THEN -i.Cantidad  -- grupo nuevo
                   WHEN d.PartesVivas > 0  AND i.PartesVivas = 0 AND i.Cobrada = 0 THEN  i.Cantidad -- se anularon todas las partes
                   WHEN d.PartesVivas = 0  AND i.PartesVivas > 0 AND i.Cobrada = 0 THEN -i.Cantidad -- se reabre
                   ELSE 0
               END AS Delta
        FROM inserted i
        LEFT JOIN deleted d ON d.Id = i.Id
    )
    UPDATE p
       SET p.StockActual        = p.StockActual + m.Neto,
           p.UltimaModificacion = GETDATE(),
           p.EsSincronizado     = 0
    FROM dbo.PRODUCTOS p
    INNER JOIN (SELECT ProductoId, SUM(Delta) AS Neto FROM mov GROUP BY ProductoId HAVING SUM(Delta) <> 0) m
            ON m.ProductoId = p.Id
    WHERE p.ControlaStock = 1;
END;
GO

/* ---- Decisiones a confirmar (marcadas en BACKLOG) ----
   [D-D] El grupo descuenta al CREARSE, aunque las partes aun no se hayan entregado. Es lo habitual en el bar
         (se pide la media y se reparte). Si prefieres descontar al entregar la primera parte, se cambia aqui.
   [D-E] Restitucion solo si PartesVivas = 0 y Cobrada = 0.
   [RIESGO] Con ControlaStock = 1 y stock insuficiente, CK_PRODUCTOS_Stock hace FALLAR la venta y el pedido
         no se guarda. En modo offline-first la tablet puede vender sobre stock que la nube ya agoto:
         al sincronizar, la fila rechazada debe quedar visible para la Dueña (no perderse en silencio).
   [MEJORA] Pruebas sugeridas: (a) 2 filas del mismo producto en un INSERT; (b) producto ControlaStock=0 con
         StockActual=0; (c) grupo de 3 partes: stock baja 1 vez; (d) cancelar las 3 partes: sube 1 vez. */
