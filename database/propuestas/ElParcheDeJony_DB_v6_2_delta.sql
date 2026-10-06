/* =====================================================================
   CarambolaSoft · BD ElParcheDeJony · DELTA v6.2  (REESCRITO 2026-10-04)
   Base: esquema REAL de 19 tablas segun el scaffold EF (repo @16e93ea).
   Origen de los cambios: Informe POS v6.16 -> v6.28 + BACKLOG B (v6.1).

   ESTADO: PROPUESTA validada contra ElParcheDeJony_DB_v6.sql (scripting real de
   SSMS, 2026-10-05). NO se ha ejecutado contra SQL Server.
   ANTES DE CORRER:
     1. BACKUP de ElParcheDeJony.
     2. Probar primero en la BD del laboratorio (PC de Albeiro), nunca en el
        PC del negocio.
     3. En sqlcmd usar -I (QUOTED_IDENTIFIER ON): hay indices filtrados y una
        columna calculada persistida. SSMS ya lo trae activado.
   Convenciones del esquema real que este delta respeta: texto en VARCHAR con
   COLLATE Modern_Spanish_CI_AI, UltimaModificacion DATETIME, defaults con
   NEWSEQUENTIALID() / GETDATE().
   Idempotente: cada bloque verifica si el objeto ya existe.
   Cambios respecto al delta anterior (ya NO se agregan, porque la BD v6 ya los tiene):
     - FACTURAS.TotalOriginal / Saldo  -> usar TotalPagar / TotalPendienteFiado
     - ABONOS_FIADO.MetodoPago / EsAbono -> MetodoPago ya existe; EsAbono es derivable
     - FACTURAS.GaritaRelojId / SesionMesaId nulo -> el vinculo va en CUENTAS
   ===================================================================== */
USE ElParcheDeJony;
GO

/* ---------- 0. Diagnostico: RESUELTO con el script real ----------
   - CHECK reales: CK_CUENTAS_Tipo (sin GARITA) -> ver bloque 2b.1. Metodos de pago: sin cambios (2b.2).
   - TR_ABONOS_ActualizarFactura solo baja TotalPendienteFiado y cambia EstadoPago; TotalPagar
     (total original) NO se toca. No hace falta TotalOriginal ni Saldo.
   - Fechas: UltimaModificacion DATETIME; PEDIDOS_CUENTAS.FechaHora DATETIME2.
   - TURNOS_CAJA.UsuarioId es solo una columna: sin FK ni tabla USUARIOS.
   - No hay ninguna columna NVARCHAR en toda la BD (ver 2b.3: causa de los emojis '??').
   ----------------------------------------------------------------- */
GO

/* ---------- 1. Tablas nuevas ---------- */

-- 1.1 Garita por reloj (CU-09). Cada cobro crea una CUENTA TipoCuenta='GARITA' + su FACTURA.
IF OBJECT_ID('dbo.GARITAS_RELOJ') IS NULL
CREATE TABLE dbo.GARITAS_RELOJ (
    Id                  UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_GARITAS_RELOJ PRIMARY KEY
                        CONSTRAINT DF_GR_Id DEFAULT NEWSEQUENTIALID(),
    Nombre              VARCHAR(80) COLLATE Modern_Spanish_CI_AI     NOT NULL,
    Valor               DECIMAL(18,2)    NOT NULL,
    InicioUtc           DATETIME2        NOT NULL,   -- la asigna el servidor (decision 12)
    ProximoCobroUtc     DATETIME2        NOT NULL,
    Cobros              INT              NOT NULL CONSTRAINT DF_GR_Cobros DEFAULT 0,
    Activa              BIT              NOT NULL CONSTRAINT DF_GR_Activa DEFAULT 1,
    EsSincronizado      BIT              NOT NULL CONSTRAINT DF_GR_Sync DEFAULT 0,
    UltimaModificacion  DATETIME         NOT NULL CONSTRAINT DF_GR_UM DEFAULT GETDATE(),
    CONSTRAINT CK_GR_Valor CHECK (Valor >= 0 AND Cobros >= 0)
);
GO

-- 1.2 Producto compartido (CU-07/08, D-D/D-E)
IF OBJECT_ID('dbo.GRUPOS_COMPARTIDOS') IS NULL
CREATE TABLE dbo.GRUPOS_COMPARTIDOS (
    Id                  UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_GRUPOS_COMPARTIDOS PRIMARY KEY
                        CONSTRAINT DF_GC_Id DEFAULT NEWSEQUENTIALID(),
    ProductoId          UNIQUEIDENTIFIER NOT NULL,
    Cantidad            INT              NOT NULL,
    ValorTotal          DECIMAL(18,2)    NOT NULL,
    PartesVivas         INT              NOT NULL CONSTRAINT DF_GC_Partes DEFAULT 0,
    Cobrada             BIT              NOT NULL CONSTRAINT DF_GC_Cobrada DEFAULT 0,
    EsSincronizado      BIT              NOT NULL CONSTRAINT DF_GC_Sync DEFAULT 0,
    UltimaModificacion  DATETIME         NOT NULL CONSTRAINT DF_GC_UM DEFAULT GETDATE(),
    CONSTRAINT FK_GC_Producto FOREIGN KEY (ProductoId) REFERENCES dbo.PRODUCTOS(Id),
    CONSTRAINT CK_GC_Valores CHECK (Cantidad > 0 AND ValorTotal >= 0 AND PartesVivas >= 0)
);
GO

-- 1.3 Compras de inventario (BACKLOG B) + historial de costos del POS (HISTORIAL_COSTOS se absorbe aqui)
IF OBJECT_ID('dbo.COMPRAS_INVENTARIO') IS NULL
CREATE TABLE dbo.COMPRAS_INVENTARIO (
    Id                  UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_COMPRAS_INVENTARIO PRIMARY KEY
                        CONSTRAINT DF_CI_Id DEFAULT NEWSEQUENTIALID(),
    ProductoId          UNIQUEIDENTIFIER NOT NULL,
    Origen              VARCHAR(10) COLLATE Modern_Spanish_CI_AI     NOT NULL CONSTRAINT DF_CI_Origen DEFAULT 'COMPRA',
    Cantidad            INT              NULL,        -- NULL cuando Origen = EDICION
    CostoUnitario       DECIMAL(18,2)    NOT NULL,
    FechaHora           DATETIME2        NOT NULL CONSTRAINT DF_CI_Fecha DEFAULT GETDATE(),
    Proveedor           VARCHAR(80) COLLATE Modern_Spanish_CI_AI     NULL,
    TurnoCajaId         UNIQUEIDENTIFIER NULL,
    EsSincronizado      BIT              NOT NULL CONSTRAINT DF_CI_Sync DEFAULT 0,
    UltimaModificacion  DATETIME         NOT NULL CONSTRAINT DF_CI_UM DEFAULT GETDATE(),
    CONSTRAINT FK_CI_Producto FOREIGN KEY (ProductoId)  REFERENCES dbo.PRODUCTOS(Id),
    CONSTRAINT FK_CI_Turno    FOREIGN KEY (TurnoCajaId) REFERENCES dbo.TURNOS_CAJA(Id),
    CONSTRAINT CK_CI_Origen   CHECK (Origen IN ('COMPRA', 'EDICION')),
    CONSTRAINT CK_CI_Cantidad CHECK ((Origen = 'COMPRA' AND Cantidad > 0) OR Origen = 'EDICION'),
    CONSTRAINT CK_CI_Costo    CHECK (CostoUnitario >= 0)
);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_CI_Producto_Fecha')
CREATE INDEX IX_CI_Producto_Fecha ON dbo.COMPRAS_INVENTARIO (ProductoId, FechaHora DESC);
GO

-- 1.4 Configuracion del negocio (una sola fila). Datos de pago = dato personal: acceso restringido.
IF OBJECT_ID('dbo.CONFIGURACION_NEGOCIO') IS NULL
CREATE TABLE dbo.CONFIGURACION_NEGOCIO (
    Id                  UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_CONFIGURACION_NEGOCIO PRIMARY KEY
                        CONSTRAINT DF_CN_Id DEFAULT NEWSEQUENTIALID(),
    Unica               BIT              NOT NULL CONSTRAINT DF_CN_Unica DEFAULT 1,
    MargenObjetivo      DECIMAL(5,2)     NOT NULL CONSTRAINT DF_CN_Margen DEFAULT 40,
    PrecioGarita        DECIMAL(18,2)    NULL,
    DatosPagoBanco      VARCHAR(60) COLLATE Modern_Spanish_CI_AI     NULL,
    DatosPagoTipo       VARCHAR(30) COLLATE Modern_Spanish_CI_AI     NULL,
    DatosPagoNumero     VARCHAR(40) COLLATE Modern_Spanish_CI_AI     NULL,
    DatosPagoTitular    VARCHAR(100) COLLATE Modern_Spanish_CI_AI    NULL,
    DatosPagoQrUrl      VARCHAR(400) COLLATE Modern_Spanish_CI_AI    NULL,   -- ruta/URL del archivo, no el binario
    EsSincronizado      BIT              NOT NULL CONSTRAINT DF_CN_Sync DEFAULT 0,
    UltimaModificacion  DATETIME         NOT NULL CONSTRAINT DF_CN_UM DEFAULT GETDATE(),
    CONSTRAINT CK_CN_Unica  CHECK (Unica = 1),
    CONSTRAINT UQ_CN_Unica  UNIQUE (Unica),
    CONSTRAINT CK_CN_Margen CHECK (MargenObjetivo >= 0 AND MargenObjetivo < 100)
);
GO

/* ---------- 2. Columnas nuevas en tablas existentes ---------- */

-- CUENTAS: origen garita
IF COL_LENGTH('dbo.CUENTAS', 'GaritaRelojId') IS NULL
    ALTER TABLE dbo.CUENTAS ADD GaritaRelojId UNIQUEIDENTIFIER NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_CUENTAS_Garita')
ALTER TABLE dbo.CUENTAS ADD CONSTRAINT FK_CUENTAS_Garita
    FOREIGN KEY (GaritaRelojId) REFERENCES dbo.GARITAS_RELOJ(Id);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_CUENTAS_Garita')
CREATE INDEX IX_CUENTAS_Garita ON dbo.CUENTAS (GaritaRelojId) WHERE GaritaRelojId IS NOT NULL;
GO
-- TipoCuenta GARITA: ver bloque 2b.1. CK_CUENTAS_Identidad exige NombreLibre: la cuenta
-- de garita debe copiar GARITAS_RELOJ.Nombre en NombreLibre.

-- FACTURAS: consecutivo F-#### (CU-01). TotalPagar = total original; TotalPendienteFiado = saldo.
IF COL_LENGTH('dbo.FACTURAS', 'Consecutivo') IS NULL
    ALTER TABLE dbo.FACTURAS ADD Consecutivo INT NULL;
GO
IF COL_LENGTH('dbo.FACTURAS', 'NumeroFactura') IS NULL
    ALTER TABLE dbo.FACTURAS ADD NumeroFactura AS
        ('F-' + RIGHT('0000' + CAST(Consecutivo AS VARCHAR(10)), 4)) PERSISTED;
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_FACTURAS_Consecutivo')
CREATE UNIQUE INDEX UX_FACTURAS_Consecutivo ON dbo.FACTURAS (Consecutivo) WHERE Consecutivo IS NOT NULL;
GO
-- Backfill (revisar antes de aplicar): consecutivo por orden de creacion.
-- ;WITH x AS (SELECT Id, ROW_NUMBER() OVER (ORDER BY UltimaModificacion, Id) AS n FROM dbo.FACTURAS WHERE Consecutivo IS NULL)
-- UPDATE f SET Consecutivo = x.n + ISNULL((SELECT MAX(Consecutivo) FROM dbo.FACTURAS), 0) FROM dbo.FACTURAS f JOIN x ON x.Id = f.Id;
-- [RIESGO] Con varias tablets offline el servidor debe asignar Consecutivo al sincronizar.

-- ABONOS_FIADO: foto de la deuda para el recibo (CU-04)
IF COL_LENGTH('dbo.ABONOS_FIADO', 'DeudaAntes') IS NULL
    ALTER TABLE dbo.ABONOS_FIADO ADD DeudaAntes DECIMAL(18,2) NULL;
IF COL_LENGTH('dbo.ABONOS_FIADO', 'DeudaDespues') IS NULL
    ALTER TABLE dbo.ABONOS_FIADO ADD DeudaDespues DECIMAL(18,2) NULL;
GO

-- PEDIDOS_CUENTAS: parte de un producto compartido
IF COL_LENGTH('dbo.PEDIDOS_CUENTAS', 'GrupoCompartidoId') IS NULL
    ALTER TABLE dbo.PEDIDOS_CUENTAS ADD GrupoCompartidoId UNIQUEIDENTIFIER NULL;
IF COL_LENGTH('dbo.PEDIDOS_CUENTAS', 'ValorParte') IS NULL
    ALTER TABLE dbo.PEDIDOS_CUENTAS ADD ValorParte DECIMAL(18,2) NULL;
IF COL_LENGTH('dbo.PEDIDOS_CUENTAS', 'CostoParteHist') IS NULL
    ALTER TABLE dbo.PEDIDOS_CUENTAS ADD CostoParteHist DECIMAL(18,2) NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_PC_GrupoCompartido')
ALTER TABLE dbo.PEDIDOS_CUENTAS ADD CONSTRAINT FK_PC_GrupoCompartido
    FOREIGN KEY (GrupoCompartidoId) REFERENCES dbo.GRUPOS_COMPARTIDOS(Id);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_PC_GrupoCompartido')
CREATE INDEX IX_PC_GrupoCompartido ON dbo.PEDIDOS_CUENTAS (GrupoCompartidoId) WHERE GrupoCompartidoId IS NOT NULL;
GO
-- [RIESGO] CuentasController.Liquidar suma PrecioUnitarioHist * Cantidad. Para partes compartidas
-- debe sumar ValorParte (y CostoParteHist para el costo). Ajustar antes de usar esta columna.

-- PRODUCTOS: base del margen y datos que el POS ya muestra
IF COL_LENGTH('dbo.PRODUCTOS', 'CostoUltimaCompra') IS NULL
    ALTER TABLE dbo.PRODUCTOS ADD CostoUltimaCompra DECIMAL(18,2) NULL;
IF COL_LENGTH('dbo.PRODUCTOS', 'Codigo') IS NULL
    ALTER TABLE dbo.PRODUCTOS ADD Codigo VARCHAR(10) COLLATE Modern_Spanish_CI_AI NULL;
IF COL_LENGTH('dbo.PRODUCTOS', 'ControlaStock') IS NULL
    ALTER TABLE dbo.PRODUCTOS ADD ControlaStock BIT NOT NULL CONSTRAINT DF_PRODUCTOS_ControlaStock DEFAULT 1;
IF COL_LENGTH('dbo.PRODUCTOS', 'Favorito') IS NULL
    ALTER TABLE dbo.PRODUCTOS ADD Favorito BIT NOT NULL CONSTRAINT DF_PRODUCTOS_Favorito DEFAULT 0;
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_PRODUCTOS_Codigo')
CREATE UNIQUE INDEX UX_PRODUCTOS_Codigo ON dbo.PRODUCTOS (Codigo) WHERE Codigo IS NOT NULL;
GO
-- UPDATE dbo.PRODUCTOS SET CostoUltimaCompra = CostoCompra WHERE CostoUltimaCompra IS NULL;
-- [RIESGO] ControlaStock = 0 (stock infinito, p.ej. Tinto, garita): TR_PEDIDOS_GestionarStock debe
-- respetarlo. Hoy el POS marca "infinito" y el trigger de la BD no lo sabe.

-- CATEGORIAS: mapeo de la categoria dinamica del POS al enum fijo de facturacion
IF COL_LENGTH('dbo.CATEGORIAS', 'CategoriaConsumo') IS NULL
    ALTER TABLE dbo.CATEGORIAS ADD CategoriaConsumo VARCHAR(30) COLLATE Modern_Spanish_CI_AI NULL;
GO
-- Valores: TIEMPO | BEBIDAS_ALCOHOLICAS | SNACKS | BEBIDAS_NO_ALCOHOLICAS | OTROS
-- Nota: FACTURAS solo guarda 4 subtotales (Tiempo, Licor, Snacks, Otros); las no alcoholicas caen en Otros.

-- PARTICIPANTES: dobles (2 vs 2). Decidido en el chat "Cambios del POST" (jul-2026).
IF COL_LENGTH('dbo.PARTICIPANTES', 'Equipo') IS NULL
    ALTER TABLE dbo.PARTICIPANTES ADD Equipo TINYINT NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_PARTICIPANTES_Equipo')
ALTER TABLE dbo.PARTICIPANTES ADD CONSTRAINT CK_PARTICIPANTES_Equipo CHECK (Equipo IS NULL OR Equipo IN (1, 2));
GO

/* ---------- 2b. Ajustes a restricciones y tipos existentes ---------- */

-- 2b.1 CUENTAS.TipoCuenta: agregar GARITA (CU-09)
IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_CUENTAS_Tipo' AND definition NOT LIKE '%GARITA%')
BEGIN
    ALTER TABLE dbo.CUENTAS DROP CONSTRAINT CK_CUENTAS_Tipo;
    ALTER TABLE dbo.CUENTAS WITH CHECK ADD CONSTRAINT CK_CUENTAS_Tipo
        CHECK (TipoCuenta IN ('LICORES','BILLAR','CARTAS','DOMINO','VENTA_RAPIDA','GARITA'));
END
GO

-- 2b.2 (decidido 2026-10-05) Bancolombia NO es un metodo de pago propio: se registra como
--      TRANSFERENCIA. Los CHECK de metodo de pago no cambian. En la migracion, la linea
--      "Bancolombia" de Caja del POS se mapea a TRANSFERENCIA.

-- 2b.3 CATEGORIAS.Icono: era VARCHAR(10); un emoji no cabe en VARCHAR y se guarda como '??'.
--      Re-sembrar con N'...' NO lo arregla: hay que cambiar el tipo (y despues volver a cargar los iconos).
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.CATEGORIAS') AND name = 'Icono' AND system_type_id = 167)
    ALTER TABLE dbo.CATEGORIAS ALTER COLUMN Icono NVARCHAR(16) COLLATE Modern_Spanish_CI_AI NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_CATEGORIAS_Consumo')
ALTER TABLE dbo.CATEGORIAS ADD CONSTRAINT CK_CATEGORIAS_Consumo
    CHECK (CategoriaConsumo IS NULL OR CategoriaConsumo IN ('TIEMPO','BEBIDAS_ALCOHOLICAS','SNACKS','BEBIDAS_NO_ALCOHOLICAS','OTROS'));
GO

/* ---------- 3. Pendiente (siguiente paso, tras aprobar este delta) ---------- */
-- TRIGGERS (hallazgos del esquema real; hoy NO cubren lo siguiente):
--  a) TR_PEDIDOS_GestionarStock resta Cantidad por CADA fila ENTREGADO. Con producto compartido,
--     cada parte es una fila: tres partes de una media restarian tres medias. Debe ignorar filas con
--     GrupoCompartidoId y descontar una sola vez al crear GRUPOS_COMPARTIDOS (decision D-D);
--     restituir solo si PartesVivas = 0 y Cobrada = 0 (D-E).
--  b) CK_PRODUCTOS_Stock exige StockActual >= 0. Un producto sin limite (Tinto, Aromatica, garita)
--     con StockActual = 0 haria FALLAR la venta. Con ControlaStock = 0 el trigger debe saltarlo.
--  c) COMPRAS_INVENTARIO: costo promedio ponderado y CostoUltimaCompra al insertar Origen = 'COMPRA'.
--  d) TR_ABONOS_ActualizarFactura valida con un scan de toda FACTURAS (WHERE TotalPendienteFiado < 0);
--     CK_FACTURAS_Fiado ya lo impide fila a fila: el scan se puede quitar.
-- VISTAS: VW_FIADOS_PENDIENTES agrupada por cliente (hoy es por factura); VW_MARGENES.
-- API:    CuentasController.Liquidar debe sumar ValorParte en partes compartidas.
-- DECIDIR: zona horaria GETDATE() (local) vs UTC al subir a la nube; TURNOS_CAJA.UsuarioId sin tabla.
-- RESUELTO: la pregunta abierta "SESIONES_MESAS.CuentaId singular": CuentaId vive en SESIONES_MESAS
--     (no en CUENTAS) y no es unico, asi que una cuenta puede tener varias sesiones de mesa.
