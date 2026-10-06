/****** Object:  UserDefinedFunction [dbo].[FN_ObtenerPrecioVigente]    Script Date: 5/10/2026 10:22:50 p. m. ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

-- ============================================================
--  BLOQUE 7 — Función de precio vigente
-- ============================================================
CREATE   FUNCTION [dbo].[FN_ObtenerPrecioVigente](@ProductoId UNIQUEIDENTIFIER, @Momento DATETIME)
RETURNS DECIMAL(18,2)
AS
BEGIN
    DECLARE @Precio DECIMAL(18,2);
    DECLARE @Hora TIME = CAST(@Momento AS TIME);
    -- DATEPART WEEKDAY con @@DATEFIRST fijo: independiente del idioma del servidor
    DECLARE @DiaBit TINYINT = POWER(2, (DATEPART(WEEKDAY, @Momento) + @@DATEFIRST - 2) % 7);

    SELECT TOP 1 @Precio = p.PrecioPromo
    FROM dbo.PROMOCIONES p
    WHERE p.ProductoId = @ProductoId
      AND p.Activa = 1
      AND (p.DiasSemana & @DiaBit) > 0
      AND (
            (p.HoraInicio <= p.HoraFin AND @Hora BETWEEN p.HoraInicio AND p.HoraFin)
         OR (p.HoraInicio >  p.HoraFin AND (@Hora >= p.HoraInicio OR @Hora <= p.HoraFin)) -- franja que cruza medianoche
      )
    ORDER BY p.PrecioPromo ASC;

    IF @Precio IS NULL
        SELECT @Precio = PrecioVenta FROM dbo.PRODUCTOS WHERE Id = @ProductoId;

    RETURN @Precio;
END;
GO
/****** Object:  Table [dbo].[MESAS_BILLAR]    Script Date: 5/10/2026 10:22:50 p. m. ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[MESAS_BILLAR](
	[Id] [uniqueidentifier] NOT NULL,
	[Numero] [int] NOT NULL,
	[Tipo] [varchar](20) COLLATE Modern_Spanish_CI_AI NOT NULL,
	[Estado] [varchar](20) COLLATE Modern_Spanish_CI_AI NOT NULL,
	[EsSincronizado] [bit] NOT NULL,
	[UltimaModificacion] [datetime] NOT NULL,
 CONSTRAINT [PK_MESAS_BILLAR] PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY],
 CONSTRAINT [UQ_MESAS_Numero] UNIQUE NONCLUSTERED 
(
	[Numero] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[CUENTAS]    Script Date: 5/10/2026 10:22:50 p. m. ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[CUENTAS](
	[Id] [uniqueidentifier] NOT NULL,
	[TurnoCajaId] [uniqueidentifier] NOT NULL,
	[TipoCuenta] [varchar](15) COLLATE Modern_Spanish_CI_AI NOT NULL,
	[MesaId] [uniqueidentifier] NULL,
	[ClienteId] [uniqueidentifier] NULL,
	[NombreLibre] [varchar](80) COLLATE Modern_Spanish_CI_AI NULL,
	[HoraApertura] [datetime] NOT NULL,
	[HoraCierre] [datetime] NULL,
	[TarifaPorHora] [decimal](18, 2) NULL,
	[Estado] [varchar](15) COLLATE Modern_Spanish_CI_AI NOT NULL,
	[EsSincronizado] [bit] NOT NULL,
	[UltimaModificacion] [datetime] NOT NULL,
 CONSTRAINT [PK_CUENTAS] PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[CLIENTES]    Script Date: 5/10/2026 10:22:50 p. m. ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[CLIENTES](
	[Id] [uniqueidentifier] NOT NULL,
	[Nombre] [varchar](100) COLLATE Modern_Spanish_CI_AI NOT NULL,
	[Apodo] [varchar](60) COLLATE Modern_Spanish_CI_AI NULL,
	[Activo] [bit] NOT NULL,
	[Visitas] [int] NOT NULL,
	[GastoAcumulado] [decimal](18, 2) NOT NULL,
	[FechaRegistro] [datetime] NOT NULL,
	[EsSincronizado] [bit] NOT NULL,
	[UltimaModificacion] [datetime] NOT NULL,
 CONSTRAINT [PK_CLIENTES] PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[PEDIDOS_CUENTAS]    Script Date: 5/10/2026 10:22:50 p. m. ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[PEDIDOS_CUENTAS](
	[Id] [uniqueidentifier] NOT NULL,
	[CuentaId] [uniqueidentifier] NOT NULL,
	[ProductoId] [uniqueidentifier] NOT NULL,
	[Cantidad] [int] NOT NULL,
	[PrecioUnitarioHist] [decimal](18, 2) NOT NULL,
	[CostoCompraHist] [decimal](18, 2) NOT NULL,
	[CategoriaConsumo] [varchar](30) COLLATE Modern_Spanish_CI_AI NOT NULL,
	[EstadoPedido] [varchar](20) COLLATE Modern_Spanish_CI_AI NOT NULL,
	[EsSincronizado] [bit] NOT NULL,
	[UltimaModificacion] [datetime] NOT NULL,
	[FechaHora] [datetime2](7) NOT NULL,
 CONSTRAINT [PK_PEDIDOS_CUENTAS] PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[FACTURAS]    Script Date: 5/10/2026 10:22:50 p. m. ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[FACTURAS](
	[Id] [uniqueidentifier] NOT NULL,
	[CuentaId] [uniqueidentifier] NOT NULL,
	[TurnoCajaId] [uniqueidentifier] NOT NULL,
	[SubtotalTiempo] [decimal](18, 2) NOT NULL,
	[SubtotalLicor] [decimal](18, 2) NOT NULL,
	[SubtotalSnacks] [decimal](18, 2) NOT NULL,
	[SubtotalOtros] [decimal](18, 2) NOT NULL,
	[TotalPagar] [decimal](18, 2) NOT NULL,
	[TotalPendienteFiado] [decimal](18, 2) NOT NULL,
	[MetodoPago] [varchar](20) COLLATE Modern_Spanish_CI_AI NULL,
	[MetodoPagoSecundario] [varchar](20) COLLATE Modern_Spanish_CI_AI NULL,
	[MontoPrimario] [decimal](18, 2) NULL,
	[MontoSecundario] [decimal](18, 2) NULL,
	[EstadoPago] [varchar](20) COLLATE Modern_Spanish_CI_AI NOT NULL,
	[EsSincronizado] [bit] NOT NULL,
	[UltimaModificacion] [datetime] NOT NULL,
 CONSTRAINT [PK_FACTURAS] PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY],
 CONSTRAINT [UQ_FACTURAS_Cuenta] UNIQUE NONCLUSTERED 
(
	[CuentaId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  View [dbo].[VW_CIERRE_NOCTURNO]    Script Date: 5/10/2026 10:22:50 p. m. ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

-- ============================================================
--  BLOQUE 9 — Vistas
-- ============================================================

CREATE   VIEW [dbo].[VW_CIERRE_NOCTURNO] AS
SELECT
    c.TipoCuenta,
    mb.Numero                               AS MesaNumero,
    COALESCE(cl.Apodo, cl.Nombre, c.NombreLibre) AS Titular,
    c.HoraApertura, c.HoraCierre,
    f.SubtotalTiempo, f.SubtotalLicor,
    f.SubtotalSnacks, f.SubtotalOtros,
    f.TotalPagar, f.TotalPendienteFiado,
    f.MetodoPago, f.EstadoPago,
    f.TurnoCajaId, f.EsSincronizado         AS FacturaSincronizada,
    f.TotalPagar - ISNULL((
        SELECT SUM(pc.CostoCompraHist * pc.Cantidad)
        FROM   dbo.PEDIDOS_CUENTAS pc
        WHERE  pc.CuentaId = c.Id AND pc.EstadoPedido = 'ENTREGADO'
    ), 0)                                   AS MargenBruto
FROM       dbo.FACTURAS     f
INNER JOIN dbo.CUENTAS      c  ON c.Id  = f.CuentaId
LEFT  JOIN dbo.MESAS_BILLAR mb ON mb.Id = c.MesaId
LEFT  JOIN dbo.CLIENTES     cl ON cl.Id = c.ClienteId;
GO
/****** Object:  Table [dbo].[JUGADORES]    Script Date: 5/10/2026 10:22:50 p. m. ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[JUGADORES](
	[Id] [uniqueidentifier] NOT NULL,
	[ClienteId] [uniqueidentifier] NULL,
	[Username] [varchar](50) COLLATE Modern_Spanish_CI_AI NOT NULL,
	[PasswordHash] [varchar](256) COLLATE Modern_Spanish_CI_AI NOT NULL,
	[AvatarUrl] [varchar](500) COLLATE Modern_Spanish_CI_AI NULL,
	[RecordCarambolas] [int] NOT NULL,
	[FechaRegistro] [datetime] NOT NULL,
	[EsSincronizado] [bit] NOT NULL,
	[UltimaModificacion] [datetime] NOT NULL,
 CONSTRAINT [PK_JUGADORES] PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY],
 CONSTRAINT [UQ_JUGADORES_Username] UNIQUE NONCLUSTERED 
(
	[Username] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[RIVALIDADES]    Script Date: 5/10/2026 10:22:50 p. m. ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[RIVALIDADES](
	[Id] [uniqueidentifier] NOT NULL,
	[JugadorAId] [uniqueidentifier] NOT NULL,
	[JugadorBId] [uniqueidentifier] NOT NULL,
	[PartidasJugadas] [int] NOT NULL,
	[VictoriasA] [int] NOT NULL,
	[VictoriasB] [int] NOT NULL,
	[UltimaPartida] [datetime] NULL,
	[EsSincronizado] [bit] NOT NULL,
	[UltimaModificacion] [datetime] NOT NULL,
 CONSTRAINT [PK_RIVALIDADES] PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY],
 CONSTRAINT [UQ_RIVALIDADES_Par] UNIQUE NONCLUSTERED 
(
	[JugadorAId] ASC,
	[JugadorBId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  View [dbo].[VW_RIVALIDADES_JUGADOR]    Script Date: 5/10/2026 10:22:51 p. m. ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE   VIEW [dbo].[VW_RIVALIDADES_JUGADOR] AS
SELECT
    j1.Username                             AS Jugador,
    j2.Username                             AS Contrincante,
    r.PartidasJugadas,
    CASE WHEN r.JugadorAId = j1.Id THEN r.VictoriasA ELSE r.VictoriasB END AS Victorias,
    CASE WHEN r.JugadorAId = j1.Id THEN r.VictoriasB ELSE r.VictoriasA END AS Derrotas,
    CAST(
        CASE WHEN r.PartidasJugadas > 0
             THEN (CASE WHEN r.JugadorAId = j1.Id THEN r.VictoriasA ELSE r.VictoriasB END) * 100.0 / r.PartidasJugadas
             ELSE 0 END
    AS DECIMAL(5,1))                        AS PorcentajeVictorias,
    r.UltimaPartida
FROM       dbo.RIVALIDADES r
INNER JOIN dbo.JUGADORES   j1 ON (j1.Id = r.JugadorAId OR j1.Id = r.JugadorBId)
INNER JOIN dbo.JUGADORES   j2 ON (j2.Id = r.JugadorAId OR j2.Id = r.JugadorBId)
                              AND j1.Id <> j2.Id;
GO
/****** Object:  Table [dbo].[TURNOS_CAJA]    Script Date: 5/10/2026 10:22:51 p. m. ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[TURNOS_CAJA](
	[Id] [uniqueidentifier] NOT NULL,
	[UsuarioId] [uniqueidentifier] NOT NULL,
	[FechaApertura] [datetime] NOT NULL,
	[FechaCierre] [datetime] NULL,
	[BaseEfectivo] [decimal](18, 2) NOT NULL,
	[EfectivoRealEntregado] [decimal](18, 2) NULL,
	[EsSincronizado] [bit] NOT NULL,
	[UltimaModificacion] [datetime] NOT NULL,
 CONSTRAINT [PK_TURNOS_CAJA] PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[ABONOS_FIADO]    Script Date: 5/10/2026 10:22:51 p. m. ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[ABONOS_FIADO](
	[Id] [uniqueidentifier] NOT NULL,
	[FacturaId] [uniqueidentifier] NOT NULL,
	[TurnoCajaId] [uniqueidentifier] NOT NULL,
	[Monto] [decimal](18, 2) NOT NULL,
	[MetodoPago] [varchar](20) COLLATE Modern_Spanish_CI_AI NOT NULL,
	[FechaHora] [datetime] NOT NULL,
	[EsSincronizado] [bit] NOT NULL,
	[UltimaModificacion] [datetime] NOT NULL,
 CONSTRAINT [PK_ABONOS] PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  View [dbo].[VW_FIADOS_PENDIENTES]    Script Date: 5/10/2026 10:22:51 p. m. ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

-- ★ v6: fiados por CLIENTE (identidad comercial), con abonos descontados
CREATE   VIEW [dbo].[VW_FIADOS_PENDIENTES] AS
SELECT
    f.Id                                    AS FacturaId,
    COALESCE(cl.Apodo, cl.Nombre, c.NombreLibre) AS Deudor,
    cl.Id                                   AS ClienteId,
    c.TipoCuenta,
    c.HoraApertura                          AS FechaCuenta,
    f.TotalPagar,
    f.TotalPendienteFiado,
    ISNULL((SELECT SUM(a.Monto) FROM dbo.ABONOS_FIADO a WHERE a.FacturaId = f.Id), 0) AS TotalAbonado,
    f.TurnoCajaId,
    tc.FechaApertura                        AS FechaTurno
FROM       dbo.FACTURAS    f
INNER JOIN dbo.CUENTAS     c  ON c.Id  = f.CuentaId
LEFT  JOIN dbo.CLIENTES    cl ON cl.Id = c.ClienteId
INNER JOIN dbo.TURNOS_CAJA tc ON tc.Id = f.TurnoCajaId
WHERE f.EstadoPago = 'FIADO';
GO
/****** Object:  Table [dbo].[MAQUINAS]    Script Date: 5/10/2026 10:22:51 p. m. ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[MAQUINAS](
	[Id] [uniqueidentifier] NOT NULL,
	[Nombre] [varchar](60) COLLATE Modern_Spanish_CI_AI NOT NULL,
	[Activa] [bit] NOT NULL,
	[EsSincronizado] [bit] NOT NULL,
	[UltimaModificacion] [datetime] NOT NULL,
 CONSTRAINT [PK_MAQUINAS] PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY],
 CONSTRAINT [UQ_MAQUINAS_Nom] UNIQUE NONCLUSTERED 
(
	[Nombre] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[MAQUINAS_MOVIMIENTOS]    Script Date: 5/10/2026 10:22:51 p. m. ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[MAQUINAS_MOVIMIENTOS](
	[Id] [uniqueidentifier] NOT NULL,
	[MaquinaId] [uniqueidentifier] NOT NULL,
	[Tipo] [varchar](10) COLLATE Modern_Spanish_CI_AI NOT NULL,
	[Monto] [decimal](18, 2) NOT NULL,
	[TurnoCajaId] [uniqueidentifier] NULL,
	[Nota] [varchar](200) COLLATE Modern_Spanish_CI_AI NULL,
	[FechaHora] [datetime] NOT NULL,
	[EsSincronizado] [bit] NOT NULL,
	[UltimaModificacion] [datetime] NOT NULL,
 CONSTRAINT [PK_MAQ_MOV] PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  View [dbo].[VW_MAQUINAS_PENDIENTES]    Script Date: 5/10/2026 10:22:51 p. m. ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

-- ★ NUEVO v6: el papelito para el dueño de las máquinas
--   Premios acumulados desde el último cuadre, por máquina
CREATE   VIEW [dbo].[VW_MAQUINAS_PENDIENTES] AS
SELECT
    m.Id            AS MaquinaId,
    m.Nombre,
    m.Activa,
    ult.UltimoCuadre,
    ISNULL(SUM(CASE WHEN mv.Tipo = 'PREMIO'
                     AND mv.FechaHora > ISNULL(ult.UltimoCuadre,'1900-01-01')
                    THEN mv.Monto END), 0)  AS PremiosPorReponer,
    COUNT(CASE WHEN mv.Tipo = 'PREMIO'
                AND mv.FechaHora > ISNULL(ult.UltimoCuadre,'1900-01-01')
               THEN 1 END)                  AS NumPremiosPendientes
FROM dbo.MAQUINAS m
OUTER APPLY (
    SELECT MAX(x.FechaHora) AS UltimoCuadre
    FROM dbo.MAQUINAS_MOVIMIENTOS x
    WHERE x.MaquinaId = m.Id AND x.Tipo = 'CUADRE'
) ult
LEFT JOIN dbo.MAQUINAS_MOVIMIENTOS mv ON mv.MaquinaId = m.Id
GROUP BY m.Id, m.Nombre, m.Activa, ult.UltimoCuadre;
GO
/****** Object:  Table [dbo].[PROMOCIONES]    Script Date: 5/10/2026 10:22:51 p. m. ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[PROMOCIONES](
	[Id] [uniqueidentifier] NOT NULL,
	[ProductoId] [uniqueidentifier] NOT NULL,
	[PrecioPromo] [decimal](18, 2) NOT NULL,
	[HoraInicio] [time](7) NOT NULL,
	[HoraFin] [time](7) NOT NULL,
	[DiasSemana] [tinyint] NOT NULL,
	[Activa] [bit] NOT NULL,
	[EsSincronizado] [bit] NOT NULL,
	[UltimaModificacion] [datetime] NOT NULL,
 CONSTRAINT [PK_PROMOCIONES] PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[CIERRE_DIA]    Script Date: 5/10/2026 10:22:51 p. m. ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[CIERRE_DIA](
	[Id] [uniqueidentifier] NOT NULL,
	[TurnoCajaId] [uniqueidentifier] NOT NULL,
	[Fecha] [date] NOT NULL,
	[TotalTiempo] [decimal](18, 2) NOT NULL,
	[TotalLicor] [decimal](18, 2) NOT NULL,
	[TotalOtros] [decimal](18, 2) NOT NULL,
	[TotalGeneral] [decimal](18, 2) NOT NULL,
	[TotalFiado] [decimal](18, 2) NOT NULL,
	[TotalGastos] [decimal](18, 2) NOT NULL,
	[TotalPremiosMaq] [decimal](18, 2) NOT NULL,
	[TotalCobrosFiado] [decimal](18, 2) NOT NULL,
	[EfectivoReportado] [decimal](18, 2) NULL,
	[Descuadre] [decimal](18, 2) NULL,
	[Confirmado] [bit] NOT NULL,
	[EsSincronizado] [bit] NOT NULL,
	[UltimaModificacion] [datetime] NOT NULL,
 CONSTRAINT [PK_CIERRE_DIA] PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY],
 CONSTRAINT [UQ_CIERRE_DIA_Turno] UNIQUE NONCLUSTERED 
(
	[TurnoCajaId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[GASTOS_CAJA]    Script Date: 5/10/2026 10:22:51 p. m. ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[GASTOS_CAJA](
	[Id] [uniqueidentifier] NOT NULL,
	[TurnoCajaId] [uniqueidentifier] NOT NULL,
	[Concepto] [varchar](150) COLLATE Modern_Spanish_CI_AI NOT NULL,
	[Monto] [decimal](18, 2) NOT NULL,
	[Categoria] [varchar](30) COLLATE Modern_Spanish_CI_AI NOT NULL,
	[MetodoPago] [varchar](20) COLLATE Modern_Spanish_CI_AI NOT NULL,
	[FechaHora] [datetime] NOT NULL,
	[EsSincronizado] [bit] NOT NULL,
	[UltimaModificacion] [datetime] NOT NULL,
 CONSTRAINT [PK_GASTOS_CAJA] PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[SESIONES_MESAS]    Script Date: 5/10/2026 10:22:51 p. m. ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[SESIONES_MESAS](
	[Id] [uniqueidentifier] NOT NULL,
	[CuentaId] [uniqueidentifier] NOT NULL,
	[MesaId] [uniqueidentifier] NOT NULL,
	[HoraInicio] [datetime] NOT NULL,
	[HoraFin] [datetime] NULL,
	[EsSincronizado] [bit] NOT NULL,
	[UltimaModificacion] [datetime] NOT NULL,
 CONSTRAINT [PK_SESIONES_MESAS] PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[PRODUCTOS]    Script Date: 5/10/2026 10:22:51 p. m. ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[PRODUCTOS](
	[Id] [uniqueidentifier] NOT NULL,
	[CategoriaId] [uniqueidentifier] NOT NULL,
	[Nombre] [varchar](100) COLLATE Modern_Spanish_CI_AI NOT NULL,
	[PrecioVenta] [decimal](18, 2) NOT NULL,
	[CostoCompra] [decimal](18, 2) NOT NULL,
	[StockActual] [int] NOT NULL,
	[StockMinimo] [int] NOT NULL,
	[Activo] [bit] NOT NULL,
	[EsSincronizado] [bit] NOT NULL,
	[UltimaModificacion] [datetime] NOT NULL,
 CONSTRAINT [PK_PRODUCTOS] PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  View [dbo].[VW_COLA_SINCRONIZACION]    Script Date: 5/10/2026 10:22:51 p. m. ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE   VIEW [dbo].[VW_COLA_SINCRONIZACION] AS
SELECT 'CLIENTES'       AS Tabla, Id, UltimaModificacion FROM dbo.CLIENTES              WHERE EsSincronizado = 0
UNION ALL
SELECT 'JUGADORES'      AS Tabla, Id, UltimaModificacion FROM dbo.JUGADORES             WHERE EsSincronizado = 0
UNION ALL
SELECT 'RIVALIDADES'    AS Tabla, Id, UltimaModificacion FROM dbo.RIVALIDADES           WHERE EsSincronizado = 0
UNION ALL
SELECT 'PRODUCTOS'      AS Tabla, Id, UltimaModificacion FROM dbo.PRODUCTOS             WHERE EsSincronizado = 0
UNION ALL
SELECT 'PROMOCIONES'    AS Tabla, Id, UltimaModificacion FROM dbo.PROMOCIONES           WHERE EsSincronizado = 0
UNION ALL
SELECT 'MESAS_BILLAR'   AS Tabla, Id, UltimaModificacion FROM dbo.MESAS_BILLAR          WHERE EsSincronizado = 0
UNION ALL
SELECT 'TURNOS_CAJA'    AS Tabla, Id, UltimaModificacion FROM dbo.TURNOS_CAJA           WHERE EsSincronizado = 0
UNION ALL
SELECT 'GASTOS_CAJA'    AS Tabla, Id, UltimaModificacion FROM dbo.GASTOS_CAJA           WHERE EsSincronizado = 0
UNION ALL
SELECT 'MAQUINAS'       AS Tabla, Id, UltimaModificacion FROM dbo.MAQUINAS              WHERE EsSincronizado = 0
UNION ALL
SELECT 'MAQUINAS_MOV'   AS Tabla, Id, UltimaModificacion FROM dbo.MAQUINAS_MOVIMIENTOS  WHERE EsSincronizado = 0
UNION ALL
SELECT 'CUENTAS'        AS Tabla, Id, UltimaModificacion FROM dbo.CUENTAS               WHERE EsSincronizado = 0
UNION ALL
SELECT 'SESIONES_MESAS' AS Tabla, Id, UltimaModificacion FROM dbo.SESIONES_MESAS        WHERE EsSincronizado = 0
UNION ALL
SELECT 'PEDIDOS_CUENTAS' AS Tabla, Id, UltimaModificacion FROM dbo.PEDIDOS_CUENTAS      WHERE EsSincronizado = 0
UNION ALL
SELECT 'FACTURAS'       AS Tabla, Id, UltimaModificacion FROM dbo.FACTURAS              WHERE EsSincronizado = 0
UNION ALL
SELECT 'ABONOS_FIADO'   AS Tabla, Id, UltimaModificacion FROM dbo.ABONOS_FIADO          WHERE EsSincronizado = 0
UNION ALL
SELECT 'CIERRE_DIA'     AS Tabla, Id, UltimaModificacion FROM dbo.CIERRE_DIA            WHERE EsSincronizado = 0;
GO
/****** Object:  Table [dbo].[CATEGORIAS]    Script Date: 5/10/2026 10:22:51 p. m. ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[CATEGORIAS](
	[Id] [uniqueidentifier] NOT NULL,
	[Nombre] [varchar](50) COLLATE Modern_Spanish_CI_AI NOT NULL,
	[Icono] [varchar](10) COLLATE Modern_Spanish_CI_AI NULL,
	[ColorHex] [varchar](9) COLLATE Modern_Spanish_CI_AI NULL,
	[EsSincronizado] [bit] NOT NULL,
	[UltimaModificacion] [datetime] NOT NULL,
 CONSTRAINT [PK_CATEGORIAS] PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY],
 CONSTRAINT [UQ_CATEGORIAS_Nombre] UNIQUE NONCLUSTERED 
(
	[Nombre] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[PARTICIPANTE_MARCAS_TIEMPO]    Script Date: 5/10/2026 10:22:51 p. m. ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[PARTICIPANTE_MARCAS_TIEMPO](
	[Id] [uniqueidentifier] NOT NULL,
	[ParticipanteId] [uniqueidentifier] NOT NULL,
	[MarcaTiempo] [datetime] NOT NULL,
	[CarambolasEnMarca] [int] NOT NULL,
 CONSTRAINT [PK_MARCAS_TIEMPO] PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[PARTICIPANTES]    Script Date: 5/10/2026 10:22:51 p. m. ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[PARTICIPANTES](
	[Id] [uniqueidentifier] NOT NULL,
	[SesionMesaId] [uniqueidentifier] NOT NULL,
	[JugadorId] [uniqueidentifier] NOT NULL,
	[Puntaje] [int] NOT NULL,
	[Posicion] [int] NULL,
	[EsGanador] [bit] NOT NULL,
	[EsSincronizado] [bit] NOT NULL,
	[UltimaModificacion] [datetime] NOT NULL,
 CONSTRAINT [PK_PARTICIPANTES] PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY],
 CONSTRAINT [UQ_PARTICIPANTES_Sesion_Jug] UNIQUE NONCLUSTERED 
(
	[SesionMesaId] ASC,
	[JugadorId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Index [IX_ABONOS_Factura]    Script Date: 5/10/2026 10:22:51 p. m. ******/
CREATE NONCLUSTERED INDEX [IX_ABONOS_Factura] ON [dbo].[ABONOS_FIADO]
(
	[FacturaId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [IX_ABONOS_Turno]    Script Date: 5/10/2026 10:22:51 p. m. ******/
CREATE NONCLUSTERED INDEX [IX_ABONOS_Turno] ON [dbo].[ABONOS_FIADO]
(
	[TurnoCajaId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [IX_CIERRE_Sync]    Script Date: 5/10/2026 10:22:51 p. m. ******/
CREATE NONCLUSTERED INDEX [IX_CIERRE_Sync] ON [dbo].[CIERRE_DIA]
(
	[EsSincronizado] ASC,
	[UltimaModificacion] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [IX_CLIENTES_Nombre]    Script Date: 5/10/2026 10:22:51 p. m. ******/
CREATE NONCLUSTERED INDEX [IX_CLIENTES_Nombre] ON [dbo].[CLIENTES]
(
	[Nombre] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [IX_CLIENTES_Sync]    Script Date: 5/10/2026 10:22:51 p. m. ******/
CREATE NONCLUSTERED INDEX [IX_CLIENTES_Sync] ON [dbo].[CLIENTES]
(
	[EsSincronizado] ASC,
	[UltimaModificacion] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [IX_CUENTAS_Abiertas]    Script Date: 5/10/2026 10:22:51 p. m. ******/
CREATE NONCLUSTERED INDEX [IX_CUENTAS_Abiertas] ON [dbo].[CUENTAS]
(
	[Estado] ASC
)
WHERE ([Estado]='ABIERTA')
WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [IX_CUENTAS_Cliente]    Script Date: 5/10/2026 10:22:51 p. m. ******/
CREATE NONCLUSTERED INDEX [IX_CUENTAS_Cliente] ON [dbo].[CUENTAS]
(
	[ClienteId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [IX_CUENTAS_Sync]    Script Date: 5/10/2026 10:22:51 p. m. ******/
CREATE NONCLUSTERED INDEX [IX_CUENTAS_Sync] ON [dbo].[CUENTAS]
(
	[EsSincronizado] ASC,
	[UltimaModificacion] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [IX_CUENTAS_Turno]    Script Date: 5/10/2026 10:22:51 p. m. ******/
CREATE NONCLUSTERED INDEX [IX_CUENTAS_Turno] ON [dbo].[CUENTAS]
(
	[TurnoCajaId] ASC,
	[Estado] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [IX_FACTURAS_Fiado]    Script Date: 5/10/2026 10:22:51 p. m. ******/
CREATE NONCLUSTERED INDEX [IX_FACTURAS_Fiado] ON [dbo].[FACTURAS]
(
	[EstadoPago] ASC
)
WHERE ([EstadoPago]='FIADO')
WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [IX_FACTURAS_Sync]    Script Date: 5/10/2026 10:22:51 p. m. ******/
CREATE NONCLUSTERED INDEX [IX_FACTURAS_Sync] ON [dbo].[FACTURAS]
(
	[EsSincronizado] ASC,
	[UltimaModificacion] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [IX_FACTURAS_TurnoCajaId]    Script Date: 5/10/2026 10:22:51 p. m. ******/
CREATE NONCLUSTERED INDEX [IX_FACTURAS_TurnoCajaId] ON [dbo].[FACTURAS]
(
	[TurnoCajaId] ASC,
	[EstadoPago] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [IX_GASTOS_Sync]    Script Date: 5/10/2026 10:22:51 p. m. ******/
CREATE NONCLUSTERED INDEX [IX_GASTOS_Sync] ON [dbo].[GASTOS_CAJA]
(
	[EsSincronizado] ASC,
	[UltimaModificacion] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [IX_GASTOS_Turno]    Script Date: 5/10/2026 10:22:51 p. m. ******/
CREATE NONCLUSTERED INDEX [IX_GASTOS_Turno] ON [dbo].[GASTOS_CAJA]
(
	[TurnoCajaId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [IX_JUGADORES_Cliente]    Script Date: 5/10/2026 10:22:51 p. m. ******/
CREATE NONCLUSTERED INDEX [IX_JUGADORES_Cliente] ON [dbo].[JUGADORES]
(
	[ClienteId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [IX_JUGADORES_Record]    Script Date: 5/10/2026 10:22:51 p. m. ******/
CREATE NONCLUSTERED INDEX [IX_JUGADORES_Record] ON [dbo].[JUGADORES]
(
	[RecordCarambolas] DESC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [IX_JUGADORES_Sync]    Script Date: 5/10/2026 10:22:51 p. m. ******/
CREATE NONCLUSTERED INDEX [IX_JUGADORES_Sync] ON [dbo].[JUGADORES]
(
	[EsSincronizado] ASC,
	[UltimaModificacion] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [IX_MAQ_MOV_Maquina]    Script Date: 5/10/2026 10:22:51 p. m. ******/
CREATE NONCLUSTERED INDEX [IX_MAQ_MOV_Maquina] ON [dbo].[MAQUINAS_MOVIMIENTOS]
(
	[MaquinaId] ASC,
	[Tipo] ASC,
	[FechaHora] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [IX_MAQ_MOV_Sync]    Script Date: 5/10/2026 10:22:51 p. m. ******/
CREATE NONCLUSTERED INDEX [IX_MAQ_MOV_Sync] ON [dbo].[MAQUINAS_MOVIMIENTOS]
(
	[EsSincronizado] ASC,
	[UltimaModificacion] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [IX_MESAS_Sync]    Script Date: 5/10/2026 10:22:51 p. m. ******/
CREATE NONCLUSTERED INDEX [IX_MESAS_Sync] ON [dbo].[MESAS_BILLAR]
(
	[EsSincronizado] ASC,
	[UltimaModificacion] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [IX_MARCAS_Participante]    Script Date: 5/10/2026 10:22:51 p. m. ******/
CREATE NONCLUSTERED INDEX [IX_MARCAS_Participante] ON [dbo].[PARTICIPANTE_MARCAS_TIEMPO]
(
	[ParticipanteId] ASC,
	[MarcaTiempo] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [IX_PEDIDOS_Cuenta_Estado]    Script Date: 5/10/2026 10:22:51 p. m. ******/
CREATE NONCLUSTERED INDEX [IX_PEDIDOS_Cuenta_Estado] ON [dbo].[PEDIDOS_CUENTAS]
(
	[CuentaId] ASC,
	[EstadoPedido] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [IX_PEDIDOS_Sync]    Script Date: 5/10/2026 10:22:51 p. m. ******/
CREATE NONCLUSTERED INDEX [IX_PEDIDOS_Sync] ON [dbo].[PEDIDOS_CUENTAS]
(
	[EsSincronizado] ASC,
	[UltimaModificacion] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [IX_PRODUCTOS_Sync]    Script Date: 5/10/2026 10:22:51 p. m. ******/
CREATE NONCLUSTERED INDEX [IX_PRODUCTOS_Sync] ON [dbo].[PRODUCTOS]
(
	[EsSincronizado] ASC,
	[UltimaModificacion] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [IX_PROMOCIONES_Producto]    Script Date: 5/10/2026 10:22:51 p. m. ******/
CREATE NONCLUSTERED INDEX [IX_PROMOCIONES_Producto] ON [dbo].[PROMOCIONES]
(
	[ProductoId] ASC,
	[Activa] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [IX_RIVALIDADES_JugA]    Script Date: 5/10/2026 10:22:51 p. m. ******/
CREATE NONCLUSTERED INDEX [IX_RIVALIDADES_JugA] ON [dbo].[RIVALIDADES]
(
	[JugadorAId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [IX_RIVALIDADES_JugB]    Script Date: 5/10/2026 10:22:51 p. m. ******/
CREATE NONCLUSTERED INDEX [IX_RIVALIDADES_JugB] ON [dbo].[RIVALIDADES]
(
	[JugadorBId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [IX_RIVALIDADES_Sync]    Script Date: 5/10/2026 10:22:51 p. m. ******/
CREATE NONCLUSTERED INDEX [IX_RIVALIDADES_Sync] ON [dbo].[RIVALIDADES]
(
	[EsSincronizado] ASC,
	[UltimaModificacion] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [IX_SESIONES_Cuenta]    Script Date: 5/10/2026 10:22:51 p. m. ******/
CREATE NONCLUSTERED INDEX [IX_SESIONES_Cuenta] ON [dbo].[SESIONES_MESAS]
(
	[CuentaId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [IX_SESIONES_MesaId]    Script Date: 5/10/2026 10:22:51 p. m. ******/
CREATE NONCLUSTERED INDEX [IX_SESIONES_MesaId] ON [dbo].[SESIONES_MESAS]
(
	[MesaId] ASC,
	[HoraFin] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [IX_SESIONES_Sync]    Script Date: 5/10/2026 10:22:51 p. m. ******/
CREATE NONCLUSTERED INDEX [IX_SESIONES_Sync] ON [dbo].[SESIONES_MESAS]
(
	[EsSincronizado] ASC,
	[UltimaModificacion] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [IX_TURNOS_Sync]    Script Date: 5/10/2026 10:22:51 p. m. ******/
CREATE NONCLUSTERED INDEX [IX_TURNOS_Sync] ON [dbo].[TURNOS_CAJA]
(
	[EsSincronizado] ASC,
	[UltimaModificacion] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
ALTER TABLE [dbo].[ABONOS_FIADO] ADD  DEFAULT (newsequentialid()) FOR [Id]
GO
ALTER TABLE [dbo].[ABONOS_FIADO] ADD  DEFAULT ('EFECTIVO') FOR [MetodoPago]
GO
ALTER TABLE [dbo].[ABONOS_FIADO] ADD  DEFAULT (getdate()) FOR [FechaHora]
GO
ALTER TABLE [dbo].[ABONOS_FIADO] ADD  DEFAULT ((0)) FOR [EsSincronizado]
GO
ALTER TABLE [dbo].[ABONOS_FIADO] ADD  DEFAULT (getdate()) FOR [UltimaModificacion]
GO
ALTER TABLE [dbo].[CATEGORIAS] ADD  DEFAULT (newsequentialid()) FOR [Id]
GO
ALTER TABLE [dbo].[CATEGORIAS] ADD  DEFAULT ((0)) FOR [EsSincronizado]
GO
ALTER TABLE [dbo].[CATEGORIAS] ADD  DEFAULT (getdate()) FOR [UltimaModificacion]
GO
ALTER TABLE [dbo].[CIERRE_DIA] ADD  DEFAULT (newsequentialid()) FOR [Id]
GO
ALTER TABLE [dbo].[CIERRE_DIA] ADD  DEFAULT (CONVERT([date],getdate())) FOR [Fecha]
GO
ALTER TABLE [dbo].[CIERRE_DIA] ADD  DEFAULT ((0)) FOR [TotalTiempo]
GO
ALTER TABLE [dbo].[CIERRE_DIA] ADD  DEFAULT ((0)) FOR [TotalLicor]
GO
ALTER TABLE [dbo].[CIERRE_DIA] ADD  DEFAULT ((0)) FOR [TotalOtros]
GO
ALTER TABLE [dbo].[CIERRE_DIA] ADD  DEFAULT ((0)) FOR [TotalGeneral]
GO
ALTER TABLE [dbo].[CIERRE_DIA] ADD  DEFAULT ((0)) FOR [TotalFiado]
GO
ALTER TABLE [dbo].[CIERRE_DIA] ADD  DEFAULT ((0)) FOR [TotalGastos]
GO
ALTER TABLE [dbo].[CIERRE_DIA] ADD  DEFAULT ((0)) FOR [TotalPremiosMaq]
GO
ALTER TABLE [dbo].[CIERRE_DIA] ADD  DEFAULT ((0)) FOR [TotalCobrosFiado]
GO
ALTER TABLE [dbo].[CIERRE_DIA] ADD  DEFAULT ((0)) FOR [Confirmado]
GO
ALTER TABLE [dbo].[CIERRE_DIA] ADD  DEFAULT ((0)) FOR [EsSincronizado]
GO
ALTER TABLE [dbo].[CIERRE_DIA] ADD  DEFAULT (getdate()) FOR [UltimaModificacion]
GO
ALTER TABLE [dbo].[CLIENTES] ADD  DEFAULT (newsequentialid()) FOR [Id]
GO
ALTER TABLE [dbo].[CLIENTES] ADD  DEFAULT ((1)) FOR [Activo]
GO
ALTER TABLE [dbo].[CLIENTES] ADD  DEFAULT ((0)) FOR [Visitas]
GO
ALTER TABLE [dbo].[CLIENTES] ADD  DEFAULT ((0)) FOR [GastoAcumulado]
GO
ALTER TABLE [dbo].[CLIENTES] ADD  DEFAULT (getdate()) FOR [FechaRegistro]
GO
ALTER TABLE [dbo].[CLIENTES] ADD  DEFAULT ((0)) FOR [EsSincronizado]
GO
ALTER TABLE [dbo].[CLIENTES] ADD  DEFAULT (getdate()) FOR [UltimaModificacion]
GO
ALTER TABLE [dbo].[CUENTAS] ADD  DEFAULT (newsequentialid()) FOR [Id]
GO
ALTER TABLE [dbo].[CUENTAS] ADD  DEFAULT (getdate()) FOR [HoraApertura]
GO
ALTER TABLE [dbo].[CUENTAS] ADD  DEFAULT ('ABIERTA') FOR [Estado]
GO
ALTER TABLE [dbo].[CUENTAS] ADD  DEFAULT ((0)) FOR [EsSincronizado]
GO
ALTER TABLE [dbo].[CUENTAS] ADD  DEFAULT (getdate()) FOR [UltimaModificacion]
GO
ALTER TABLE [dbo].[FACTURAS] ADD  DEFAULT (newsequentialid()) FOR [Id]
GO
ALTER TABLE [dbo].[FACTURAS] ADD  DEFAULT ((0)) FOR [SubtotalTiempo]
GO
ALTER TABLE [dbo].[FACTURAS] ADD  DEFAULT ((0)) FOR [SubtotalLicor]
GO
ALTER TABLE [dbo].[FACTURAS] ADD  DEFAULT ((0)) FOR [SubtotalSnacks]
GO
ALTER TABLE [dbo].[FACTURAS] ADD  DEFAULT ((0)) FOR [SubtotalOtros]
GO
ALTER TABLE [dbo].[FACTURAS] ADD  DEFAULT ((0)) FOR [TotalPendienteFiado]
GO
ALTER TABLE [dbo].[FACTURAS] ADD  DEFAULT ('PENDIENTE') FOR [EstadoPago]
GO
ALTER TABLE [dbo].[FACTURAS] ADD  DEFAULT ((0)) FOR [EsSincronizado]
GO
ALTER TABLE [dbo].[FACTURAS] ADD  DEFAULT (getdate()) FOR [UltimaModificacion]
GO
ALTER TABLE [dbo].[GASTOS_CAJA] ADD  DEFAULT (newsequentialid()) FOR [Id]
GO
ALTER TABLE [dbo].[GASTOS_CAJA] ADD  DEFAULT ('EFECTIVO') FOR [MetodoPago]
GO
ALTER TABLE [dbo].[GASTOS_CAJA] ADD  DEFAULT (getdate()) FOR [FechaHora]
GO
ALTER TABLE [dbo].[GASTOS_CAJA] ADD  DEFAULT ((0)) FOR [EsSincronizado]
GO
ALTER TABLE [dbo].[GASTOS_CAJA] ADD  DEFAULT (getdate()) FOR [UltimaModificacion]
GO
ALTER TABLE [dbo].[JUGADORES] ADD  DEFAULT (newsequentialid()) FOR [Id]
GO
ALTER TABLE [dbo].[JUGADORES] ADD  DEFAULT ((0)) FOR [RecordCarambolas]
GO
ALTER TABLE [dbo].[JUGADORES] ADD  DEFAULT (getdate()) FOR [FechaRegistro]
GO
ALTER TABLE [dbo].[JUGADORES] ADD  DEFAULT ((0)) FOR [EsSincronizado]
GO
ALTER TABLE [dbo].[JUGADORES] ADD  DEFAULT (getdate()) FOR [UltimaModificacion]
GO
ALTER TABLE [dbo].[MAQUINAS] ADD  DEFAULT (newsequentialid()) FOR [Id]
GO
ALTER TABLE [dbo].[MAQUINAS] ADD  DEFAULT ((1)) FOR [Activa]
GO
ALTER TABLE [dbo].[MAQUINAS] ADD  DEFAULT ((0)) FOR [EsSincronizado]
GO
ALTER TABLE [dbo].[MAQUINAS] ADD  DEFAULT (getdate()) FOR [UltimaModificacion]
GO
ALTER TABLE [dbo].[MAQUINAS_MOVIMIENTOS] ADD  DEFAULT (newsequentialid()) FOR [Id]
GO
ALTER TABLE [dbo].[MAQUINAS_MOVIMIENTOS] ADD  DEFAULT (getdate()) FOR [FechaHora]
GO
ALTER TABLE [dbo].[MAQUINAS_MOVIMIENTOS] ADD  DEFAULT ((0)) FOR [EsSincronizado]
GO
ALTER TABLE [dbo].[MAQUINAS_MOVIMIENTOS] ADD  DEFAULT (getdate()) FOR [UltimaModificacion]
GO
ALTER TABLE [dbo].[MESAS_BILLAR] ADD  DEFAULT (newsequentialid()) FOR [Id]
GO
ALTER TABLE [dbo].[MESAS_BILLAR] ADD  DEFAULT ('DISPONIBLE') FOR [Estado]
GO
ALTER TABLE [dbo].[MESAS_BILLAR] ADD  DEFAULT ((0)) FOR [EsSincronizado]
GO
ALTER TABLE [dbo].[MESAS_BILLAR] ADD  DEFAULT (getdate()) FOR [UltimaModificacion]
GO
ALTER TABLE [dbo].[PARTICIPANTE_MARCAS_TIEMPO] ADD  DEFAULT (newsequentialid()) FOR [Id]
GO
ALTER TABLE [dbo].[PARTICIPANTE_MARCAS_TIEMPO] ADD  DEFAULT (getdate()) FOR [MarcaTiempo]
GO
ALTER TABLE [dbo].[PARTICIPANTE_MARCAS_TIEMPO] ADD  DEFAULT ((1)) FOR [CarambolasEnMarca]
GO
ALTER TABLE [dbo].[PARTICIPANTES] ADD  DEFAULT (newsequentialid()) FOR [Id]
GO
ALTER TABLE [dbo].[PARTICIPANTES] ADD  DEFAULT ((0)) FOR [Puntaje]
GO
ALTER TABLE [dbo].[PARTICIPANTES] ADD  DEFAULT ((0)) FOR [EsGanador]
GO
ALTER TABLE [dbo].[PARTICIPANTES] ADD  DEFAULT ((0)) FOR [EsSincronizado]
GO
ALTER TABLE [dbo].[PARTICIPANTES] ADD  DEFAULT (getdate()) FOR [UltimaModificacion]
GO
ALTER TABLE [dbo].[PEDIDOS_CUENTAS] ADD  DEFAULT (newsequentialid()) FOR [Id]
GO
ALTER TABLE [dbo].[PEDIDOS_CUENTAS] ADD  DEFAULT ('ENTREGADO') FOR [EstadoPedido]
GO
ALTER TABLE [dbo].[PEDIDOS_CUENTAS] ADD  DEFAULT ((0)) FOR [EsSincronizado]
GO
ALTER TABLE [dbo].[PEDIDOS_CUENTAS] ADD  DEFAULT (getdate()) FOR [UltimaModificacion]
GO
ALTER TABLE [dbo].[PEDIDOS_CUENTAS] ADD  CONSTRAINT [DF_PEDIDOS_CUENTAS_FechaHora]  DEFAULT (sysdatetime()) FOR [FechaHora]
GO
ALTER TABLE [dbo].[PRODUCTOS] ADD  DEFAULT (newsequentialid()) FOR [Id]
GO
ALTER TABLE [dbo].[PRODUCTOS] ADD  DEFAULT ((0)) FOR [StockActual]
GO
ALTER TABLE [dbo].[PRODUCTOS] ADD  DEFAULT ((0)) FOR [StockMinimo]
GO
ALTER TABLE [dbo].[PRODUCTOS] ADD  DEFAULT ((1)) FOR [Activo]
GO
ALTER TABLE [dbo].[PRODUCTOS] ADD  DEFAULT ((0)) FOR [EsSincronizado]
GO
ALTER TABLE [dbo].[PRODUCTOS] ADD  DEFAULT (getdate()) FOR [UltimaModificacion]
GO
ALTER TABLE [dbo].[PROMOCIONES] ADD  DEFAULT (newsequentialid()) FOR [Id]
GO
ALTER TABLE [dbo].[PROMOCIONES] ADD  DEFAULT ((127)) FOR [DiasSemana]
GO
ALTER TABLE [dbo].[PROMOCIONES] ADD  DEFAULT ((1)) FOR [Activa]
GO
ALTER TABLE [dbo].[PROMOCIONES] ADD  DEFAULT ((0)) FOR [EsSincronizado]
GO
ALTER TABLE [dbo].[PROMOCIONES] ADD  DEFAULT (getdate()) FOR [UltimaModificacion]
GO
ALTER TABLE [dbo].[RIVALIDADES] ADD  DEFAULT (newsequentialid()) FOR [Id]
GO
ALTER TABLE [dbo].[RIVALIDADES] ADD  DEFAULT ((0)) FOR [PartidasJugadas]
GO
ALTER TABLE [dbo].[RIVALIDADES] ADD  DEFAULT ((0)) FOR [VictoriasA]
GO
ALTER TABLE [dbo].[RIVALIDADES] ADD  DEFAULT ((0)) FOR [VictoriasB]
GO
ALTER TABLE [dbo].[RIVALIDADES] ADD  DEFAULT ((0)) FOR [EsSincronizado]
GO
ALTER TABLE [dbo].[RIVALIDADES] ADD  DEFAULT (getdate()) FOR [UltimaModificacion]
GO
ALTER TABLE [dbo].[SESIONES_MESAS] ADD  DEFAULT (newsequentialid()) FOR [Id]
GO
ALTER TABLE [dbo].[SESIONES_MESAS] ADD  DEFAULT (getdate()) FOR [HoraInicio]
GO
ALTER TABLE [dbo].[SESIONES_MESAS] ADD  DEFAULT ((0)) FOR [EsSincronizado]
GO
ALTER TABLE [dbo].[SESIONES_MESAS] ADD  DEFAULT (getdate()) FOR [UltimaModificacion]
GO
ALTER TABLE [dbo].[TURNOS_CAJA] ADD  DEFAULT (newsequentialid()) FOR [Id]
GO
ALTER TABLE [dbo].[TURNOS_CAJA] ADD  DEFAULT (getdate()) FOR [FechaApertura]
GO
ALTER TABLE [dbo].[TURNOS_CAJA] ADD  DEFAULT ((0)) FOR [EsSincronizado]
GO
ALTER TABLE [dbo].[TURNOS_CAJA] ADD  DEFAULT (getdate()) FOR [UltimaModificacion]
GO
ALTER TABLE [dbo].[ABONOS_FIADO]  WITH CHECK ADD  CONSTRAINT [FK_ABONOS_FACTURA] FOREIGN KEY([FacturaId])
REFERENCES [dbo].[FACTURAS] ([Id])
GO
ALTER TABLE [dbo].[ABONOS_FIADO] CHECK CONSTRAINT [FK_ABONOS_FACTURA]
GO
ALTER TABLE [dbo].[ABONOS_FIADO]  WITH CHECK ADD  CONSTRAINT [FK_ABONOS_TURNO] FOREIGN KEY([TurnoCajaId])
REFERENCES [dbo].[TURNOS_CAJA] ([Id])
GO
ALTER TABLE [dbo].[ABONOS_FIADO] CHECK CONSTRAINT [FK_ABONOS_TURNO]
GO
ALTER TABLE [dbo].[CIERRE_DIA]  WITH CHECK ADD  CONSTRAINT [FK_CIERRE_DIA_TURNO] FOREIGN KEY([TurnoCajaId])
REFERENCES [dbo].[TURNOS_CAJA] ([Id])
GO
ALTER TABLE [dbo].[CIERRE_DIA] CHECK CONSTRAINT [FK_CIERRE_DIA_TURNO]
GO
ALTER TABLE [dbo].[CUENTAS]  WITH CHECK ADD  CONSTRAINT [FK_CUENTAS_CLIENTE] FOREIGN KEY([ClienteId])
REFERENCES [dbo].[CLIENTES] ([Id])
GO
ALTER TABLE [dbo].[CUENTAS] CHECK CONSTRAINT [FK_CUENTAS_CLIENTE]
GO
ALTER TABLE [dbo].[CUENTAS]  WITH CHECK ADD  CONSTRAINT [FK_CUENTAS_MESA] FOREIGN KEY([MesaId])
REFERENCES [dbo].[MESAS_BILLAR] ([Id])
GO
ALTER TABLE [dbo].[CUENTAS] CHECK CONSTRAINT [FK_CUENTAS_MESA]
GO
ALTER TABLE [dbo].[CUENTAS]  WITH CHECK ADD  CONSTRAINT [FK_CUENTAS_TURNO] FOREIGN KEY([TurnoCajaId])
REFERENCES [dbo].[TURNOS_CAJA] ([Id])
GO
ALTER TABLE [dbo].[CUENTAS] CHECK CONSTRAINT [FK_CUENTAS_TURNO]
GO
ALTER TABLE [dbo].[FACTURAS]  WITH CHECK ADD  CONSTRAINT [FK_FACTURAS_CUENTA] FOREIGN KEY([CuentaId])
REFERENCES [dbo].[CUENTAS] ([Id])
GO
ALTER TABLE [dbo].[FACTURAS] CHECK CONSTRAINT [FK_FACTURAS_CUENTA]
GO
ALTER TABLE [dbo].[FACTURAS]  WITH CHECK ADD  CONSTRAINT [FK_FACTURAS_TURNO] FOREIGN KEY([TurnoCajaId])
REFERENCES [dbo].[TURNOS_CAJA] ([Id])
GO
ALTER TABLE [dbo].[FACTURAS] CHECK CONSTRAINT [FK_FACTURAS_TURNO]
GO
ALTER TABLE [dbo].[GASTOS_CAJA]  WITH CHECK ADD  CONSTRAINT [FK_GASTOS_TURNO] FOREIGN KEY([TurnoCajaId])
REFERENCES [dbo].[TURNOS_CAJA] ([Id])
GO
ALTER TABLE [dbo].[GASTOS_CAJA] CHECK CONSTRAINT [FK_GASTOS_TURNO]
GO
ALTER TABLE [dbo].[JUGADORES]  WITH CHECK ADD  CONSTRAINT [FK_JUGADORES_CLIENTE] FOREIGN KEY([ClienteId])
REFERENCES [dbo].[CLIENTES] ([Id])
GO
ALTER TABLE [dbo].[JUGADORES] CHECK CONSTRAINT [FK_JUGADORES_CLIENTE]
GO
ALTER TABLE [dbo].[MAQUINAS_MOVIMIENTOS]  WITH CHECK ADD  CONSTRAINT [FK_MAQ_MOV_MAQUINA] FOREIGN KEY([MaquinaId])
REFERENCES [dbo].[MAQUINAS] ([Id])
GO
ALTER TABLE [dbo].[MAQUINAS_MOVIMIENTOS] CHECK CONSTRAINT [FK_MAQ_MOV_MAQUINA]
GO
ALTER TABLE [dbo].[MAQUINAS_MOVIMIENTOS]  WITH CHECK ADD  CONSTRAINT [FK_MAQ_MOV_TURNO] FOREIGN KEY([TurnoCajaId])
REFERENCES [dbo].[TURNOS_CAJA] ([Id])
GO
ALTER TABLE [dbo].[MAQUINAS_MOVIMIENTOS] CHECK CONSTRAINT [FK_MAQ_MOV_TURNO]
GO
ALTER TABLE [dbo].[PARTICIPANTE_MARCAS_TIEMPO]  WITH CHECK ADD  CONSTRAINT [FK_MARCAS_PARTICIPANTE] FOREIGN KEY([ParticipanteId])
REFERENCES [dbo].[PARTICIPANTES] ([Id])
GO
ALTER TABLE [dbo].[PARTICIPANTE_MARCAS_TIEMPO] CHECK CONSTRAINT [FK_MARCAS_PARTICIPANTE]
GO
ALTER TABLE [dbo].[PARTICIPANTES]  WITH CHECK ADD  CONSTRAINT [FK_PARTICIPANTES_JUGADOR] FOREIGN KEY([JugadorId])
REFERENCES [dbo].[JUGADORES] ([Id])
GO
ALTER TABLE [dbo].[PARTICIPANTES] CHECK CONSTRAINT [FK_PARTICIPANTES_JUGADOR]
GO
ALTER TABLE [dbo].[PARTICIPANTES]  WITH CHECK ADD  CONSTRAINT [FK_PARTICIPANTES_SESION] FOREIGN KEY([SesionMesaId])
REFERENCES [dbo].[SESIONES_MESAS] ([Id])
GO
ALTER TABLE [dbo].[PARTICIPANTES] CHECK CONSTRAINT [FK_PARTICIPANTES_SESION]
GO
ALTER TABLE [dbo].[PEDIDOS_CUENTAS]  WITH CHECK ADD  CONSTRAINT [FK_PEDIDOS_CUENTA] FOREIGN KEY([CuentaId])
REFERENCES [dbo].[CUENTAS] ([Id])
GO
ALTER TABLE [dbo].[PEDIDOS_CUENTAS] CHECK CONSTRAINT [FK_PEDIDOS_CUENTA]
GO
ALTER TABLE [dbo].[PEDIDOS_CUENTAS]  WITH CHECK ADD  CONSTRAINT [FK_PEDIDOS_PRODUCTO] FOREIGN KEY([ProductoId])
REFERENCES [dbo].[PRODUCTOS] ([Id])
GO
ALTER TABLE [dbo].[PEDIDOS_CUENTAS] CHECK CONSTRAINT [FK_PEDIDOS_PRODUCTO]
GO
ALTER TABLE [dbo].[PRODUCTOS]  WITH CHECK ADD  CONSTRAINT [FK_PRODUCTOS_CATEGORIAS] FOREIGN KEY([CategoriaId])
REFERENCES [dbo].[CATEGORIAS] ([Id])
GO
ALTER TABLE [dbo].[PRODUCTOS] CHECK CONSTRAINT [FK_PRODUCTOS_CATEGORIAS]
GO
ALTER TABLE [dbo].[PROMOCIONES]  WITH CHECK ADD  CONSTRAINT [FK_PROMOCIONES_PRODUCTO] FOREIGN KEY([ProductoId])
REFERENCES [dbo].[PRODUCTOS] ([Id])
GO
ALTER TABLE [dbo].[PROMOCIONES] CHECK CONSTRAINT [FK_PROMOCIONES_PRODUCTO]
GO
ALTER TABLE [dbo].[RIVALIDADES]  WITH CHECK ADD  CONSTRAINT [FK_RIVALIDADES_JUGADOR_A] FOREIGN KEY([JugadorAId])
REFERENCES [dbo].[JUGADORES] ([Id])
GO
ALTER TABLE [dbo].[RIVALIDADES] CHECK CONSTRAINT [FK_RIVALIDADES_JUGADOR_A]
GO
ALTER TABLE [dbo].[RIVALIDADES]  WITH CHECK ADD  CONSTRAINT [FK_RIVALIDADES_JUGADOR_B] FOREIGN KEY([JugadorBId])
REFERENCES [dbo].[JUGADORES] ([Id])
GO
ALTER TABLE [dbo].[RIVALIDADES] CHECK CONSTRAINT [FK_RIVALIDADES_JUGADOR_B]
GO
ALTER TABLE [dbo].[SESIONES_MESAS]  WITH CHECK ADD  CONSTRAINT [FK_SESIONES_CUENTA] FOREIGN KEY([CuentaId])
REFERENCES [dbo].[CUENTAS] ([Id])
GO
ALTER TABLE [dbo].[SESIONES_MESAS] CHECK CONSTRAINT [FK_SESIONES_CUENTA]
GO
ALTER TABLE [dbo].[SESIONES_MESAS]  WITH CHECK ADD  CONSTRAINT [FK_SESIONES_MESA] FOREIGN KEY([MesaId])
REFERENCES [dbo].[MESAS_BILLAR] ([Id])
GO
ALTER TABLE [dbo].[SESIONES_MESAS] CHECK CONSTRAINT [FK_SESIONES_MESA]
GO
ALTER TABLE [dbo].[ABONOS_FIADO]  WITH CHECK ADD  CONSTRAINT [CK_ABONOS_Metodo] CHECK  (([MetodoPago]='TRANSFERENCIA' OR [MetodoPago]='DAVIPLATA' OR [MetodoPago]='NEQUI' OR [MetodoPago]='TARJETA' OR [MetodoPago]='EFECTIVO'))
GO
ALTER TABLE [dbo].[ABONOS_FIADO] CHECK CONSTRAINT [CK_ABONOS_Metodo]
GO
ALTER TABLE [dbo].[ABONOS_FIADO]  WITH CHECK ADD  CONSTRAINT [CK_ABONOS_Monto] CHECK  (([Monto]>(0)))
GO
ALTER TABLE [dbo].[ABONOS_FIADO] CHECK CONSTRAINT [CK_ABONOS_Monto]
GO
ALTER TABLE [dbo].[CIERRE_DIA]  WITH CHECK ADD  CONSTRAINT [CK_CIERRE_Totales] CHECK  (([TotalTiempo]>=(0) AND [TotalLicor]>=(0) AND [TotalOtros]>=(0) AND [TotalGeneral]>=(0) AND [TotalFiado]>=(0) AND [TotalGastos]>=(0) AND [TotalPremiosMaq]>=(0) AND [TotalCobrosFiado]>=(0)))
GO
ALTER TABLE [dbo].[CIERRE_DIA] CHECK CONSTRAINT [CK_CIERRE_Totales]
GO
ALTER TABLE [dbo].[CLIENTES]  WITH CHECK ADD  CONSTRAINT [CK_CLIENTES_Gasto] CHECK  (([GastoAcumulado]>=(0)))
GO
ALTER TABLE [dbo].[CLIENTES] CHECK CONSTRAINT [CK_CLIENTES_Gasto]
GO
ALTER TABLE [dbo].[CLIENTES]  WITH CHECK ADD  CONSTRAINT [CK_CLIENTES_Visitas] CHECK  (([Visitas]>=(0)))
GO
ALTER TABLE [dbo].[CLIENTES] CHECK CONSTRAINT [CK_CLIENTES_Visitas]
GO
ALTER TABLE [dbo].[CUENTAS]  WITH CHECK ADD  CONSTRAINT [CK_CUENTAS_Cierre] CHECK  (([HoraCierre] IS NULL OR [HoraCierre]>=[HoraApertura]))
GO
ALTER TABLE [dbo].[CUENTAS] CHECK CONSTRAINT [CK_CUENTAS_Cierre]
GO
ALTER TABLE [dbo].[CUENTAS]  WITH CHECK ADD  CONSTRAINT [CK_CUENTAS_Estado] CHECK  (([Estado]='CANCELADA' OR [Estado]='LIQUIDADA' OR [Estado]='ABIERTA'))
GO
ALTER TABLE [dbo].[CUENTAS] CHECK CONSTRAINT [CK_CUENTAS_Estado]
GO
ALTER TABLE [dbo].[CUENTAS]  WITH CHECK ADD  CONSTRAINT [CK_CUENTAS_Identidad] CHECK  (([ClienteId] IS NOT NULL OR [NombreLibre] IS NOT NULL OR [TipoCuenta]='VENTA_RAPIDA'))
GO
ALTER TABLE [dbo].[CUENTAS] CHECK CONSTRAINT [CK_CUENTAS_Identidad]
GO
ALTER TABLE [dbo].[CUENTAS]  WITH CHECK ADD  CONSTRAINT [CK_CUENTAS_Tarifa] CHECK  (([TarifaPorHora] IS NULL OR [TarifaPorHora]>=(0)))
GO
ALTER TABLE [dbo].[CUENTAS] CHECK CONSTRAINT [CK_CUENTAS_Tarifa]
GO
ALTER TABLE [dbo].[CUENTAS]  WITH CHECK ADD  CONSTRAINT [CK_CUENTAS_Tipo] CHECK  (([TipoCuenta]='VENTA_RAPIDA' OR [TipoCuenta]='DOMINO' OR [TipoCuenta]='CARTAS' OR [TipoCuenta]='BILLAR' OR [TipoCuenta]='LICORES'))
GO
ALTER TABLE [dbo].[CUENTAS] CHECK CONSTRAINT [CK_CUENTAS_Tipo]
GO
ALTER TABLE [dbo].[FACTURAS]  WITH CHECK ADD  CONSTRAINT [CK_FACTURAS_EstadoPago] CHECK  (([EstadoPago]='ANULADO' OR [EstadoPago]='FIADO' OR [EstadoPago]='PAGADO' OR [EstadoPago]='PENDIENTE'))
GO
ALTER TABLE [dbo].[FACTURAS] CHECK CONSTRAINT [CK_FACTURAS_EstadoPago]
GO
ALTER TABLE [dbo].[FACTURAS]  WITH CHECK ADD  CONSTRAINT [CK_FACTURAS_Fiado] CHECK  (([TotalPendienteFiado]>=(0)))
GO
ALTER TABLE [dbo].[FACTURAS] CHECK CONSTRAINT [CK_FACTURAS_Fiado]
GO
ALTER TABLE [dbo].[FACTURAS]  WITH CHECK ADD  CONSTRAINT [CK_FACTURAS_Metodo2] CHECK  (([MetodoPagoSecundario] IS NULL OR ([MetodoPagoSecundario]='FIADO' OR [MetodoPagoSecundario]='TRANSFERENCIA' OR [MetodoPagoSecundario]='DAVIPLATA' OR [MetodoPagoSecundario]='NEQUI' OR [MetodoPagoSecundario]='TARJETA' OR [MetodoPagoSecundario]='EFECTIVO')))
GO
ALTER TABLE [dbo].[FACTURAS] CHECK CONSTRAINT [CK_FACTURAS_Metodo2]
GO
ALTER TABLE [dbo].[FACTURAS]  WITH CHECK ADD  CONSTRAINT [CK_FACTURAS_MetodoPago] CHECK  (([MetodoPago] IS NULL OR ([MetodoPago]='FIADO' OR [MetodoPago]='TRANSFERENCIA' OR [MetodoPago]='DAVIPLATA' OR [MetodoPago]='NEQUI' OR [MetodoPago]='TARJETA' OR [MetodoPago]='EFECTIVO')))
GO
ALTER TABLE [dbo].[FACTURAS] CHECK CONSTRAINT [CK_FACTURAS_MetodoPago]
GO
ALTER TABLE [dbo].[FACTURAS]  WITH CHECK ADD  CONSTRAINT [CK_FACTURAS_Subtotales] CHECK  (([SubtotalTiempo]>=(0) AND [SubtotalLicor]>=(0) AND [SubtotalSnacks]>=(0) AND [SubtotalOtros]>=(0)))
GO
ALTER TABLE [dbo].[FACTURAS] CHECK CONSTRAINT [CK_FACTURAS_Subtotales]
GO
ALTER TABLE [dbo].[FACTURAS]  WITH CHECK ADD  CONSTRAINT [CK_FACTURAS_Total] CHECK  (([TotalPagar]>=(0)))
GO
ALTER TABLE [dbo].[FACTURAS] CHECK CONSTRAINT [CK_FACTURAS_Total]
GO
ALTER TABLE [dbo].[GASTOS_CAJA]  WITH CHECK ADD  CONSTRAINT [CK_GASTOS_Categoria] CHECK  (([Categoria]='ADELANTO_EMPLEADO' OR [Categoria]='OTROS' OR [Categoria]='SERVICIOS' OR [Categoria]='TRANSPORTE' OR [Categoria]='INSUMOS'))
GO
ALTER TABLE [dbo].[GASTOS_CAJA] CHECK CONSTRAINT [CK_GASTOS_Categoria]
GO
ALTER TABLE [dbo].[GASTOS_CAJA]  WITH CHECK ADD  CONSTRAINT [CK_GASTOS_Metodo] CHECK  (([MetodoPago]='TRANSFERENCIA' OR [MetodoPago]='DAVIPLATA' OR [MetodoPago]='NEQUI' OR [MetodoPago]='TARJETA' OR [MetodoPago]='EFECTIVO'))
GO
ALTER TABLE [dbo].[GASTOS_CAJA] CHECK CONSTRAINT [CK_GASTOS_Metodo]
GO
ALTER TABLE [dbo].[GASTOS_CAJA]  WITH CHECK ADD  CONSTRAINT [CK_GASTOS_Monto] CHECK  (([Monto]>(0)))
GO
ALTER TABLE [dbo].[GASTOS_CAJA] CHECK CONSTRAINT [CK_GASTOS_Monto]
GO
ALTER TABLE [dbo].[JUGADORES]  WITH CHECK ADD  CONSTRAINT [CK_JUGADORES_Record] CHECK  (([RecordCarambolas]>=(0)))
GO
ALTER TABLE [dbo].[JUGADORES] CHECK CONSTRAINT [CK_JUGADORES_Record]
GO
ALTER TABLE [dbo].[MAQUINAS_MOVIMIENTOS]  WITH CHECK ADD  CONSTRAINT [CK_MAQ_MOV_Monto] CHECK  (([Monto]>=(0)))
GO
ALTER TABLE [dbo].[MAQUINAS_MOVIMIENTOS] CHECK CONSTRAINT [CK_MAQ_MOV_Monto]
GO
ALTER TABLE [dbo].[MAQUINAS_MOVIMIENTOS]  WITH CHECK ADD  CONSTRAINT [CK_MAQ_MOV_Tipo] CHECK  (([Tipo]='CUADRE' OR [Tipo]='PREMIO'))
GO
ALTER TABLE [dbo].[MAQUINAS_MOVIMIENTOS] CHECK CONSTRAINT [CK_MAQ_MOV_Tipo]
GO
ALTER TABLE [dbo].[MAQUINAS_MOVIMIENTOS]  WITH CHECK ADD  CONSTRAINT [CK_MAQ_MOV_Turno] CHECK  (([Tipo]<>'PREMIO' OR [TurnoCajaId] IS NOT NULL))
GO
ALTER TABLE [dbo].[MAQUINAS_MOVIMIENTOS] CHECK CONSTRAINT [CK_MAQ_MOV_Turno]
GO
ALTER TABLE [dbo].[MESAS_BILLAR]  WITH CHECK ADD  CONSTRAINT [CK_MESAS_Estado] CHECK  (([Estado]='MANTENIMIENTO' OR [Estado]='OCUPADA' OR [Estado]='DISPONIBLE'))
GO
ALTER TABLE [dbo].[MESAS_BILLAR] CHECK CONSTRAINT [CK_MESAS_Estado]
GO
ALTER TABLE [dbo].[MESAS_BILLAR]  WITH CHECK ADD  CONSTRAINT [CK_MESAS_Tipo] CHECK  (([Tipo]='SNOOKER' OR [Tipo]='CARAMBOLA' OR [Tipo]='POOL'))
GO
ALTER TABLE [dbo].[MESAS_BILLAR] CHECK CONSTRAINT [CK_MESAS_Tipo]
GO
ALTER TABLE [dbo].[PARTICIPANTE_MARCAS_TIEMPO]  WITH CHECK ADD  CONSTRAINT [CK_MARCAS_Carambolas] CHECK  (([CarambolasEnMarca]>=(1)))
GO
ALTER TABLE [dbo].[PARTICIPANTE_MARCAS_TIEMPO] CHECK CONSTRAINT [CK_MARCAS_Carambolas]
GO
ALTER TABLE [dbo].[PARTICIPANTES]  WITH CHECK ADD  CONSTRAINT [CK_PARTICIPANTES_Posicion] CHECK  (([Posicion] IS NULL OR [Posicion]>=(1) AND [Posicion]<=(4)))
GO
ALTER TABLE [dbo].[PARTICIPANTES] CHECK CONSTRAINT [CK_PARTICIPANTES_Posicion]
GO
ALTER TABLE [dbo].[PARTICIPANTES]  WITH CHECK ADD  CONSTRAINT [CK_PARTICIPANTES_Puntaje] CHECK  (([Puntaje]>=(0)))
GO
ALTER TABLE [dbo].[PARTICIPANTES] CHECK CONSTRAINT [CK_PARTICIPANTES_Puntaje]
GO
ALTER TABLE [dbo].[PEDIDOS_CUENTAS]  WITH CHECK ADD  CONSTRAINT [CK_PEDIDOS_Cantidad] CHECK  (([Cantidad]>(0)))
GO
ALTER TABLE [dbo].[PEDIDOS_CUENTAS] CHECK CONSTRAINT [CK_PEDIDOS_Cantidad]
GO
ALTER TABLE [dbo].[PEDIDOS_CUENTAS]  WITH CHECK ADD  CONSTRAINT [CK_PEDIDOS_Categoria] CHECK  (([CategoriaConsumo]='OTROS' OR [CategoriaConsumo]='BEBIDAS_NO_ALCOHOLICAS' OR [CategoriaConsumo]='SNACKS' OR [CategoriaConsumo]='BEBIDAS_ALCOHOLICAS' OR [CategoriaConsumo]='TIEMPO'))
GO
ALTER TABLE [dbo].[PEDIDOS_CUENTAS] CHECK CONSTRAINT [CK_PEDIDOS_Categoria]
GO
ALTER TABLE [dbo].[PEDIDOS_CUENTAS]  WITH CHECK ADD  CONSTRAINT [CK_PEDIDOS_Costo] CHECK  (([CostoCompraHist]>=(0)))
GO
ALTER TABLE [dbo].[PEDIDOS_CUENTAS] CHECK CONSTRAINT [CK_PEDIDOS_Costo]
GO
ALTER TABLE [dbo].[PEDIDOS_CUENTAS]  WITH CHECK ADD  CONSTRAINT [CK_PEDIDOS_Estado] CHECK  (([EstadoPedido]='CANCELADO' OR [EstadoPedido]='ENTREGADO' OR [EstadoPedido]='PENDIENTE'))
GO
ALTER TABLE [dbo].[PEDIDOS_CUENTAS] CHECK CONSTRAINT [CK_PEDIDOS_Estado]
GO
ALTER TABLE [dbo].[PEDIDOS_CUENTAS]  WITH CHECK ADD  CONSTRAINT [CK_PEDIDOS_Precio] CHECK  (([PrecioUnitarioHist]>=(0)))
GO
ALTER TABLE [dbo].[PEDIDOS_CUENTAS] CHECK CONSTRAINT [CK_PEDIDOS_Precio]
GO
ALTER TABLE [dbo].[PRODUCTOS]  WITH CHECK ADD  CONSTRAINT [CK_PRODUCTOS_Costo] CHECK  (([CostoCompra]>=(0)))
GO
ALTER TABLE [dbo].[PRODUCTOS] CHECK CONSTRAINT [CK_PRODUCTOS_Costo]
GO
ALTER TABLE [dbo].[PRODUCTOS]  WITH CHECK ADD  CONSTRAINT [CK_PRODUCTOS_Precio] CHECK  (([PrecioVenta]>=(0)))
GO
ALTER TABLE [dbo].[PRODUCTOS] CHECK CONSTRAINT [CK_PRODUCTOS_Precio]
GO
ALTER TABLE [dbo].[PRODUCTOS]  WITH CHECK ADD  CONSTRAINT [CK_PRODUCTOS_Stock] CHECK  (([StockActual]>=(0)))
GO
ALTER TABLE [dbo].[PRODUCTOS] CHECK CONSTRAINT [CK_PRODUCTOS_Stock]
GO
ALTER TABLE [dbo].[PRODUCTOS]  WITH CHECK ADD  CONSTRAINT [CK_PRODUCTOS_StockMin] CHECK  (([StockMinimo]>=(0)))
GO
ALTER TABLE [dbo].[PRODUCTOS] CHECK CONSTRAINT [CK_PRODUCTOS_StockMin]
GO
ALTER TABLE [dbo].[PROMOCIONES]  WITH CHECK ADD  CONSTRAINT [CK_PROMOCIONES_Dias] CHECK  (([DiasSemana]>=(1) AND [DiasSemana]<=(127)))
GO
ALTER TABLE [dbo].[PROMOCIONES] CHECK CONSTRAINT [CK_PROMOCIONES_Dias]
GO
ALTER TABLE [dbo].[PROMOCIONES]  WITH CHECK ADD  CONSTRAINT [CK_PROMOCIONES_Precio] CHECK  (([PrecioPromo]>=(0)))
GO
ALTER TABLE [dbo].[PROMOCIONES] CHECK CONSTRAINT [CK_PROMOCIONES_Precio]
GO
ALTER TABLE [dbo].[RIVALIDADES]  WITH CHECK ADD  CONSTRAINT [CK_RIVALIDADES_NoAutoRival] CHECK  (([JugadorAId]<>[JugadorBId]))
GO
ALTER TABLE [dbo].[RIVALIDADES] CHECK CONSTRAINT [CK_RIVALIDADES_NoAutoRival]
GO
ALTER TABLE [dbo].[RIVALIDADES]  WITH CHECK ADD  CONSTRAINT [CK_RIVALIDADES_Partidas] CHECK  (([PartidasJugadas]>=(0)))
GO
ALTER TABLE [dbo].[RIVALIDADES] CHECK CONSTRAINT [CK_RIVALIDADES_Partidas]
GO
ALTER TABLE [dbo].[RIVALIDADES]  WITH CHECK ADD  CONSTRAINT [CK_RIVALIDADES_Suma] CHECK  ((([VictoriasA]+[VictoriasB])<=[PartidasJugadas]))
GO
ALTER TABLE [dbo].[RIVALIDADES] CHECK CONSTRAINT [CK_RIVALIDADES_Suma]
GO
ALTER TABLE [dbo].[RIVALIDADES]  WITH CHECK ADD  CONSTRAINT [CK_RIVALIDADES_Victorias] CHECK  (([VictoriasA]>=(0) AND [VictoriasB]>=(0)))
GO
ALTER TABLE [dbo].[RIVALIDADES] CHECK CONSTRAINT [CK_RIVALIDADES_Victorias]
GO
ALTER TABLE [dbo].[SESIONES_MESAS]  WITH CHECK ADD  CONSTRAINT [CK_SESIONES_HoraFin] CHECK  (([HoraFin] IS NULL OR [HoraFin]>=[HoraInicio]))
GO
ALTER TABLE [dbo].[SESIONES_MESAS] CHECK CONSTRAINT [CK_SESIONES_HoraFin]
GO
ALTER TABLE [dbo].[TURNOS_CAJA]  WITH CHECK ADD  CONSTRAINT [CK_TURNOS_Base] CHECK  (([BaseEfectivo]>=(0)))
GO
ALTER TABLE [dbo].[TURNOS_CAJA] CHECK CONSTRAINT [CK_TURNOS_Base]
GO
ALTER TABLE [dbo].[TURNOS_CAJA]  WITH CHECK ADD  CONSTRAINT [CK_TURNOS_FechaCierre] CHECK  (([FechaCierre] IS NULL OR [FechaCierre]>=[FechaApertura]))
GO
ALTER TABLE [dbo].[TURNOS_CAJA] CHECK CONSTRAINT [CK_TURNOS_FechaCierre]
GO
/****** Object:  Trigger [dbo].[TR_ABONOS_ActualizarFactura]    Script Date: 5/10/2026 10:22:51 p. m. ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

-- ★ NUEVO v6: abono actualiza la factura original (pago de fiado NO es venta nueva)
CREATE   TRIGGER [dbo].[TR_ABONOS_ActualizarFactura]
ON [dbo].[ABONOS_FIADO] AFTER INSERT
AS
BEGIN
    SET NOCOUNT ON;

    UPDATE f SET
        f.TotalPendienteFiado = f.TotalPendienteFiado - x.MontoAbonado,
        f.EstadoPago = CASE WHEN f.TotalPendienteFiado - x.MontoAbonado <= 0 THEN 'PAGADO' ELSE 'FIADO' END,
        f.UltimaModificacion = GETDATE(),
        f.EsSincronizado = 0
    FROM dbo.FACTURAS f
    INNER JOIN (SELECT FacturaId, SUM(Monto) AS MontoAbonado FROM inserted GROUP BY FacturaId) x
        ON x.FacturaId = f.Id;

    IF EXISTS (SELECT 1 FROM dbo.FACTURAS WHERE TotalPendienteFiado < 0)
    BEGIN
        RAISERROR('El abono excede la deuda pendiente de la factura.',16,1);
        ROLLBACK TRANSACTION;
    END
END;
GO
ALTER TABLE [dbo].[ABONOS_FIADO] ENABLE TRIGGER [TR_ABONOS_ActualizarFactura]
GO
/****** Object:  Trigger [dbo].[TR_CIERRE_DIA_NoEditarConfirmado]    Script Date: 5/10/2026 10:22:51 p. m. ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

-- ============================================================
--  BLOQUE 8 — Triggers
-- ============================================================

-- Antifraude: cierre confirmado es inmutable
CREATE   TRIGGER [dbo].[TR_CIERRE_DIA_NoEditarConfirmado]
ON [dbo].[CIERRE_DIA] AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    IF EXISTS (SELECT 1 FROM deleted WHERE Confirmado = 1)
    BEGIN
        RAISERROR('No se puede modificar un CIERRE_DIA confirmado. Operación irreversible.',16,1);
        ROLLBACK TRANSACTION;
    END
END;
GO
ALTER TABLE [dbo].[CIERRE_DIA] ENABLE TRIGGER [TR_CIERRE_DIA_NoEditarConfirmado]
GO
/****** Object:  Trigger [dbo].[TR_PARTICIPANTES_ActualizarRivalidades]    Script Date: 5/10/2026 10:22:51 p. m. ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

-- Rivalidades automáticas al declarar ganador
CREATE   TRIGGER [dbo].[TR_PARTICIPANTES_ActualizarRivalidades]
ON [dbo].[PARTICIPANTES] AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    IF NOT EXISTS (SELECT 1 FROM inserted WHERE EsGanador = 1) RETURN;

    DECLARE @SesionId UNIQUEIDENTIFIER = (SELECT TOP 1 SesionMesaId FROM inserted);
    DECLARE @GanadorId UNIQUEIDENTIFIER = (SELECT TOP 1 JugadorId FROM inserted WHERE EsGanador = 1);

    DECLARE @Jugadores TABLE (JugadorId UNIQUEIDENTIFIER);
    INSERT INTO @Jugadores SELECT JugadorId FROM dbo.PARTICIPANTES WHERE SesionMesaId = @SesionId;

    DECLARE @JugA UNIQUEIDENTIFIER, @JugB UNIQUEIDENTIFIER;
    DECLARE cur CURSOR FOR
        SELECT a.JugadorId, b.JugadorId
        FROM @Jugadores a CROSS JOIN @Jugadores b
        WHERE a.JugadorId < b.JugadorId;

    OPEN cur;
    FETCH NEXT FROM cur INTO @JugA, @JugB;
    WHILE @@FETCH_STATUS = 0
    BEGIN
        IF NOT EXISTS (SELECT 1 FROM dbo.RIVALIDADES WHERE JugadorAId = @JugA AND JugadorBId = @JugB)
            INSERT INTO dbo.RIVALIDADES (Id, JugadorAId, JugadorBId, PartidasJugadas, VictoriasA, VictoriasB, UltimaPartida)
            VALUES (NEWID(), @JugA, @JugB, 0, 0, 0, GETDATE());

        UPDATE dbo.RIVALIDADES SET
            PartidasJugadas    = PartidasJugadas + 1,
            VictoriasA         = VictoriasA + CASE WHEN @GanadorId = @JugA THEN 1 ELSE 0 END,
            VictoriasB         = VictoriasB + CASE WHEN @GanadorId = @JugB THEN 1 ELSE 0 END,
            UltimaPartida      = GETDATE(),
            UltimaModificacion = GETDATE(),
            EsSincronizado     = 0
        WHERE JugadorAId = @JugA AND JugadorBId = @JugB;

        FETCH NEXT FROM cur INTO @JugA, @JugB;
    END;
    CLOSE cur; DEALLOCATE cur;
END;
GO
ALTER TABLE [dbo].[PARTICIPANTES] ENABLE TRIGGER [TR_PARTICIPANTES_ActualizarRivalidades]
GO
/****** Object:  Trigger [dbo].[TR_PEDIDOS_GestionarStock]    Script Date: 5/10/2026 10:22:51 p. m. ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

-- ★ v6: Stock al ENTREGAR — ahora cubre INSERT directo como ENTREGADO
--   (aprendizaje del POS: en el bar se entrega al pedir)
CREATE   TRIGGER [dbo].[TR_PEDIDOS_GestionarStock]
ON [dbo].[PEDIDOS_CUENTAS] AFTER INSERT, UPDATE
AS
BEGIN
    SET NOCOUNT ON;

    -- Reducir: INSERT directo como ENTREGADO
    UPDATE p SET p.StockActual = p.StockActual - i.Cantidad,
                 p.UltimaModificacion = GETDATE(), p.EsSincronizado = 0
    FROM dbo.PRODUCTOS p
    INNER JOIN inserted i ON i.ProductoId = p.Id
    LEFT  JOIN deleted  d ON d.Id = i.Id
    WHERE i.EstadoPedido = 'ENTREGADO'
      AND d.Id IS NULL
      AND i.CategoriaConsumo <> 'TIEMPO';   -- el tiempo no es inventario

    -- Reducir: transición a ENTREGADO
    UPDATE p SET p.StockActual = p.StockActual - i.Cantidad,
                 p.UltimaModificacion = GETDATE(), p.EsSincronizado = 0
    FROM dbo.PRODUCTOS p
    INNER JOIN inserted i ON i.ProductoId = p.Id
    INNER JOIN deleted  d ON d.Id = i.Id
    WHERE i.EstadoPedido = 'ENTREGADO' AND d.EstadoPedido <> 'ENTREGADO'
      AND i.CategoriaConsumo <> 'TIEMPO';

    -- Restituir: cancelación de un pedido que estaba ENTREGADO (corrección validada en POS)
    UPDATE p SET p.StockActual = p.StockActual + i.Cantidad,
                 p.UltimaModificacion = GETDATE(), p.EsSincronizado = 0
    FROM dbo.PRODUCTOS p
    INNER JOIN inserted i ON i.ProductoId = p.Id
    INNER JOIN deleted  d ON d.Id = i.Id
    WHERE i.EstadoPedido = 'CANCELADO' AND d.EstadoPedido = 'ENTREGADO'
      AND i.CategoriaConsumo <> 'TIEMPO';
END;
GO
ALTER TABLE [dbo].[PEDIDOS_CUENTAS] ENABLE TRIGGER [TR_PEDIDOS_GestionarStock]
GO
