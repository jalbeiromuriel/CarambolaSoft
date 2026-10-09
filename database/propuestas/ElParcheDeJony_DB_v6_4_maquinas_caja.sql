/* =====================================================================
   CarambolaSoft / Mero Parche  -  Maquinas con fondo propio + campos de caja (v6.4)
   PROPUESTA: NO probada aun en LAB ni ejecutada contra la BD real. Con backup.
   Va DESPUES de v6.2 (delta) y v6.3 (usuarios). Idempotente.

   Que cubre (todo lo que la app React ya guarda en local y la BD aun no tiene):
     1. MAQUINAS_MOVIMIENTOS: fondo propio de las maquinas.
          Tipos: PREMIO (baja el fondo) · REPOSICION (lo manda el dueño, sube el fondo)
                 PRESTAMO (la caja le presta al fondo: sale del cajon, queda deuda)
                 DEVOLUCION (el fondo le devuelve a la caja: vuelve al cajon)
                 CUADRE = dato viejo, vale como REPOSICION.
          MaquinaId pasa a NULL (PRESTAMO/REPOSICION/DEVOLUCION no son de una maquina).
          Se agregan UsuarioId, UsuarioNombre, AutorizoId (quien registro / quien puso el PIN).
     2. CONFIGURACION_NEGOCIO.BaseFondoMaquinas (base del fondo, hoy 200.000).
     3. CIERRE_DIA: Numero, FechaCierre, UsuarioId, UsuarioNombre, EfectivoEsperado, Nota, NVentas.
          TotalPremiosMaq pasa a significar PRESTAMOS - DEVOLUCIONES del turno (lo que movio el cajon).
     4. CIERRE_NOTAS (aclaraciones a un cierre sellado: el cierre no se edita, la nota queda aparte).
     5. GASTOS_CAJA / ABONOS_FIADO: quien registro y quien autorizo.
     6. Vista VW_FONDO_MAQUINAS (reemplaza a VW_MAQUINAS_PENDIENTES, que ya no aplica).

   [RIESGO] No se toca CIERRE_DIA.Confirmado ni su trigger antifraude (decision 6).
   [RIESGO] Offline: en la tablet los registros del turno abierto tienen TurnoCajaId NULL; GASTOS_CAJA.TurnoCajaId
            es NOT NULL en la BD. El sync debe enviarlos al sellar el turno (o hacer la columna NULL). Ver pie.
   [RIESGO] FACTURAS.Consecutivo lo debe asignar el servidor al sincronizar (la tablet muestra un numero local).
   Fuera de alcance (siguen LOCALES por ahora): cuentas para pagos (META cuentasPago), WhatsApp de la patrona.
   ===================================================================== */
SET ANSI_NULLS ON;
GO
SET QUOTED_IDENTIFIER ON;
GO

/* ---------- 1. MAQUINAS_MOVIMIENTOS ---------- */
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.MAQUINAS_MOVIMIENTOS') AND name = 'MaquinaId' AND is_nullable = 0)
    ALTER TABLE dbo.MAQUINAS_MOVIMIENTOS ALTER COLUMN MaquinaId UNIQUEIDENTIFIER NULL;
GO
IF COL_LENGTH('dbo.MAQUINAS_MOVIMIENTOS', 'UsuarioId') IS NULL
    ALTER TABLE dbo.MAQUINAS_MOVIMIENTOS ADD UsuarioId UNIQUEIDENTIFIER NULL;
GO
IF COL_LENGTH('dbo.MAQUINAS_MOVIMIENTOS', 'UsuarioNombre') IS NULL
    ALTER TABLE dbo.MAQUINAS_MOVIMIENTOS ADD UsuarioNombre VARCHAR(80) COLLATE Modern_Spanish_CI_AI NULL;
GO
IF COL_LENGTH('dbo.MAQUINAS_MOVIMIENTOS', 'AutorizoId') IS NULL
    ALTER TABLE dbo.MAQUINAS_MOVIMIENTOS ADD AutorizoId UNIQUEIDENTIFIER NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_MAQ_MOV_Usuario')
    ALTER TABLE dbo.MAQUINAS_MOVIMIENTOS ADD CONSTRAINT FK_MAQ_MOV_Usuario FOREIGN KEY (UsuarioId) REFERENCES dbo.USUARIOS(Id);
GO
IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_MAQ_MOV_Autorizo')
    ALTER TABLE dbo.MAQUINAS_MOVIMIENTOS ADD CONSTRAINT FK_MAQ_MOV_Autorizo FOREIGN KEY (AutorizoId) REFERENCES dbo.USUARIOS(Id);
GO
-- Tipos validos y regla: solo PREMIO (y CUADRE viejo) pertenecen a una maquina; los demas son del fondo.
IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_MAQ_MOV_Tipo')
    ALTER TABLE dbo.MAQUINAS_MOVIMIENTOS WITH CHECK ADD CONSTRAINT CK_MAQ_MOV_Tipo CHECK (
        Tipo IN ('PREMIO','REPOSICION','PRESTAMO','DEVOLUCION','CUADRE')
        AND Monto > 0
        AND (Tipo NOT IN ('PREMIO','CUADRE') OR MaquinaId IS NOT NULL));
GO

/* ---------- 2. Base del fondo ---------- */
IF COL_LENGTH('dbo.CONFIGURACION_NEGOCIO', 'BaseFondoMaquinas') IS NULL
    ALTER TABLE dbo.CONFIGURACION_NEGOCIO ADD BaseFondoMaquinas DECIMAL(18,2) NOT NULL
        CONSTRAINT DF_CN_BaseFondoMaq DEFAULT 200000;
GO

/* ---------- 3. CIERRE_DIA ---------- */
IF COL_LENGTH('dbo.CIERRE_DIA', 'Numero') IS NULL            ALTER TABLE dbo.CIERRE_DIA ADD Numero INT NULL;
GO
IF COL_LENGTH('dbo.CIERRE_DIA', 'FechaCierre') IS NULL       ALTER TABLE dbo.CIERRE_DIA ADD FechaCierre DATETIME NULL;
GO
IF COL_LENGTH('dbo.CIERRE_DIA', 'UsuarioId') IS NULL         ALTER TABLE dbo.CIERRE_DIA ADD UsuarioId UNIQUEIDENTIFIER NULL;
GO
IF COL_LENGTH('dbo.CIERRE_DIA', 'UsuarioNombre') IS NULL     ALTER TABLE dbo.CIERRE_DIA ADD UsuarioNombre VARCHAR(80) COLLATE Modern_Spanish_CI_AI NULL;
GO
IF COL_LENGTH('dbo.CIERRE_DIA', 'EfectivoEsperado') IS NULL  ALTER TABLE dbo.CIERRE_DIA ADD EfectivoEsperado DECIMAL(18,2) NULL;
GO
IF COL_LENGTH('dbo.CIERRE_DIA', 'Nota') IS NULL              ALTER TABLE dbo.CIERRE_DIA ADD Nota VARCHAR(300) COLLATE Modern_Spanish_CI_AI NULL;
GO
IF COL_LENGTH('dbo.CIERRE_DIA', 'NVentas') IS NULL           ALTER TABLE dbo.CIERRE_DIA ADD NVentas INT NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_CIERRE_DIA_Usuario')
    ALTER TABLE dbo.CIERRE_DIA ADD CONSTRAINT FK_CIERRE_DIA_Usuario FOREIGN KEY (UsuarioId) REFERENCES dbo.USUARIOS(Id);
GO
EXEC sys.sp_addextendedproperty @name = N'MS_Description',
     @value = N'v6.4: PRESTAMOS - DEVOLUCIONES del turno entre la caja y el fondo de maquinas (lo que movio el cajon). Los premios salen del fondo.',
     @level0type = N'SCHEMA', @level0name = N'dbo', @level1type = N'TABLE', @level1name = N'CIERRE_DIA', @level2type = N'COLUMN', @level2name = N'TotalPremiosMaq';
GO

/* ---------- 4. CIERRE_NOTAS ---------- */
IF OBJECT_ID('dbo.CIERRE_NOTAS') IS NULL
CREATE TABLE dbo.CIERRE_NOTAS (
    Id                  UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_CIERRE_NOTAS PRIMARY KEY
                        CONSTRAINT DF_CNOT_Id DEFAULT NEWSEQUENTIALID(),
    CierreId            UNIQUEIDENTIFIER NOT NULL CONSTRAINT FK_CNOT_Cierre REFERENCES dbo.CIERRE_DIA(Id),
    Texto               VARCHAR(500) COLLATE Modern_Spanish_CI_AI NOT NULL,
    FechaHora           DATETIME         NOT NULL,
    UsuarioId           UNIQUEIDENTIFIER NULL CONSTRAINT FK_CNOT_Usuario REFERENCES dbo.USUARIOS(Id),
    UsuarioNombre       VARCHAR(80) COLLATE Modern_Spanish_CI_AI NULL,
    AutorizoId          UNIQUEIDENTIFIER NULL CONSTRAINT FK_CNOT_Autorizo REFERENCES dbo.USUARIOS(Id),
    EsSincronizado      BIT              NOT NULL CONSTRAINT DF_CNOT_Sync DEFAULT 0,
    UltimaModificacion  DATETIME         NOT NULL CONSTRAINT DF_CNOT_UM DEFAULT GETDATE(),
    CONSTRAINT CK_CNOT_Texto CHECK (LEN(LTRIM(RTRIM(Texto))) > 0)
);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_CIERRE_NOTAS_Cierre')
    CREATE INDEX IX_CIERRE_NOTAS_Cierre ON dbo.CIERRE_NOTAS (CierreId);
GO

/* ---------- 5. Quien registro / quien autorizo ---------- */
IF COL_LENGTH('dbo.GASTOS_CAJA', 'UsuarioId') IS NULL    ALTER TABLE dbo.GASTOS_CAJA ADD UsuarioId UNIQUEIDENTIFIER NULL;
GO
IF COL_LENGTH('dbo.GASTOS_CAJA', 'AutorizoId') IS NULL   ALTER TABLE dbo.GASTOS_CAJA ADD AutorizoId UNIQUEIDENTIFIER NULL;
GO
IF COL_LENGTH('dbo.ABONOS_FIADO', 'UsuarioId') IS NULL   ALTER TABLE dbo.ABONOS_FIADO ADD UsuarioId UNIQUEIDENTIFIER NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_GASTOS_Usuario')
    ALTER TABLE dbo.GASTOS_CAJA ADD CONSTRAINT FK_GASTOS_Usuario FOREIGN KEY (UsuarioId) REFERENCES dbo.USUARIOS(Id);
GO
IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_GASTOS_Autorizo')
    ALTER TABLE dbo.GASTOS_CAJA ADD CONSTRAINT FK_GASTOS_Autorizo FOREIGN KEY (AutorizoId) REFERENCES dbo.USUARIOS(Id);
GO
IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_ABONOS_Usuario')
    ALTER TABLE dbo.ABONOS_FIADO ADD CONSTRAINT FK_ABONOS_Usuario FOREIGN KEY (UsuarioId) REFERENCES dbo.USUARIOS(Id);
GO

/* ---------- 6. Vista del fondo de maquinas ---------- */
IF OBJECT_ID('dbo.VW_MAQUINAS_PENDIENTES') IS NOT NULL DROP VIEW dbo.VW_MAQUINAS_PENDIENTES;   -- ya no aplica (modelo de cuadre quincenal)
GO
CREATE OR ALTER VIEW dbo.VW_FONDO_MAQUINAS AS
SELECT
    ISNULL((SELECT TOP (1) BaseFondoMaquinas FROM dbo.CONFIGURACION_NEGOCIO), 200000)
      + ISNULL(SUM(CASE WHEN Tipo IN ('REPOSICION','CUADRE','PRESTAMO') THEN Monto
                        WHEN Tipo IN ('PREMIO','DEVOLUCION')           THEN -Monto END), 0)  AS SaldoFondo,
    ISNULL(SUM(CASE WHEN Tipo = 'PRESTAMO'   THEN Monto
                    WHEN Tipo = 'DEVOLUCION' THEN -Monto END), 0)                              AS DeudaConCaja,
    ISNULL(SUM(CASE WHEN Tipo = 'PREMIO' THEN Monto END), 0)                                   AS PremiosPagados
FROM dbo.MAQUINAS_MOVIMIENTOS;
GO

/* ---------- Verificacion rapida ---------- */
-- SELECT * FROM dbo.VW_FONDO_MAQUINAS;
-- SELECT Tipo, COUNT(*) n, SUM(Monto) total FROM dbo.MAQUINAS_MOVIMIENTOS GROUP BY Tipo;
