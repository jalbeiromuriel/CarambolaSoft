/* =====================================================================
   CarambolaSoft / El Parche de Jony  -  Marcador (Contador del billar) sobre la BD real v6.2
   PROPUESTA: NO se ha ejecutado. Probar en la BD de laboratorio, con backup. Va DESPUES del delta v6.2
   (usa PARTICIPANTES.Equipo, que agrega ese delta).

   Reglas confirmadas por Albeiro (2026-10-06):
     - Solo se registra el numero de carambolas de cada serie. NO existe la entrada en 0.
       (Por eso CK_MARCAS_Carambolas >= 1 se queda tal cual.)
     - El record es POR JUGADOR y es su TACADA (serie) mas alta. El Reto del Parche es la mayor de todas.
     - El telefono del cliente es dato nuevo y solo lo ve el administrador.
     - Invitados: juegan y suman, pero no cuentan para record ni rivalidades.

   Enfoque: en vez de 5 tablas MARCADOR_*, se reutilizan PARTICIPANTES y PARTICIPANTE_MARCAS_TIEMPO
   (decisiones #2 y #7) y se agrega solo lo que falta.
   ===================================================================== */
SET ANSI_NULLS ON;
GO
SET QUOTED_IDENTIFIER ON;
GO

/* ---------- 1. Telefono del cliente (solo administrador) ---------- */
IF COL_LENGTH('dbo.CLIENTES', 'Telefono') IS NULL
    ALTER TABLE dbo.CLIENTES ADD Telefono VARCHAR(20) COLLATE Modern_Spanish_CI_AI NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_CLIENTES_Telefono')
ALTER TABLE dbo.CLIENTES ADD CONSTRAINT CK_CLIENTES_Telefono
    CHECK (Telefono IS NULL OR (LEN(Telefono) BETWEEN 7 AND 20 AND Telefono NOT LIKE '%[^0-9+ -]%'));
GO
-- [RIESGO] La base no puede ocultar una columna por rol. El control va en el API:
--   el DTO que sincroniza CLIENTES hacia la tablet de mesa NO incluye Telefono, y el telefono
--   se sirve solo por un endpoint de administrador. Asi no queda copiado en el IndexedDB de la mesa.

/* ---------- 2. Jugador creado desde un cliente ---------- */
-- El Marcador agrega jugadores desde CLIENTES. JUGADORES exige PasswordHash NOT NULL, pero no hay login todavia.
-- Propuesta: PasswordHash opcional; el API crea el Jugador (ClienteId, Username generado) la primera vez que el cliente juega.
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.JUGADORES') AND name = 'PasswordHash' AND is_nullable = 0)
    ALTER TABLE dbo.JUGADORES ALTER COLUMN PasswordHash VARCHAR(256) COLLATE Modern_Spanish_CI_AI NULL;
GO

/* ---------- 3. Participantes: invitados ---------- */
IF COL_LENGTH('dbo.PARTICIPANTES', 'NombreInvitado') IS NULL
    ALTER TABLE dbo.PARTICIPANTES ADD NombreInvitado VARCHAR(100) COLLATE Modern_Spanish_CI_AI NULL;
GO
-- UQ (SesionMesaId, JugadorId) trata NULL como un valor: dos invitados en la misma partida chocarian.
IF EXISTS (SELECT 1 FROM sys.key_constraints WHERE name = 'UQ_PARTICIPANTES_Sesion_Jug')
    ALTER TABLE dbo.PARTICIPANTES DROP CONSTRAINT UQ_PARTICIPANTES_Sesion_Jug;
GO
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.PARTICIPANTES') AND name = 'JugadorId' AND is_nullable = 0)
    ALTER TABLE dbo.PARTICIPANTES ALTER COLUMN JugadorId UNIQUEIDENTIFIER NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_PARTICIPANTES_Sesion_Jug')
CREATE UNIQUE INDEX UX_PARTICIPANTES_Sesion_Jug ON dbo.PARTICIPANTES (SesionMesaId, JugadorId) WHERE JugadorId IS NOT NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_PARTICIPANTES_Identidad')
ALTER TABLE dbo.PARTICIPANTES ADD CONSTRAINT CK_PARTICIPANTES_Identidad
    CHECK ((JugadorId IS NOT NULL AND NombreInvitado IS NULL) OR (JugadorId IS NULL AND NombreInvitado IS NOT NULL));
GO

/* ---------- 4. Marcas por serie: sincronizables y corregibles sin borrar ---------- */
IF COL_LENGTH('dbo.PARTICIPANTE_MARCAS_TIEMPO', 'EsSincronizado') IS NULL
    ALTER TABLE dbo.PARTICIPANTE_MARCAS_TIEMPO ADD EsSincronizado BIT NOT NULL CONSTRAINT DF_MARCAS_Sync DEFAULT 0;
IF COL_LENGTH('dbo.PARTICIPANTE_MARCAS_TIEMPO', 'UltimaModificacion') IS NULL
    ALTER TABLE dbo.PARTICIPANTE_MARCAS_TIEMPO ADD UltimaModificacion DATETIME NOT NULL CONSTRAINT DF_MARCAS_UM DEFAULT GETDATE();
-- "Corregir ultima": la serie original queda ANULADA y se inserta la corregida con CorrigeA apuntando a la original.
-- Si se corrige a 0, solo se anula (no hay entrada en 0). Las marcas nunca se borran ni se editan en su valor.
IF COL_LENGTH('dbo.PARTICIPANTE_MARCAS_TIEMPO', 'Anulada') IS NULL
    ALTER TABLE dbo.PARTICIPANTE_MARCAS_TIEMPO ADD Anulada BIT NOT NULL CONSTRAINT DF_MARCAS_Anulada DEFAULT 0;
IF COL_LENGTH('dbo.PARTICIPANTE_MARCAS_TIEMPO', 'CorrigeA') IS NULL
    ALTER TABLE dbo.PARTICIPANTE_MARCAS_TIEMPO ADD CorrigeA UNIQUEIDENTIFIER NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_MARCAS_CorrigeA')
ALTER TABLE dbo.PARTICIPANTE_MARCAS_TIEMPO ADD CONSTRAINT FK_MARCAS_CorrigeA
    FOREIGN KEY (CorrigeA) REFERENCES dbo.PARTICIPANTE_MARCAS_TIEMPO(Id);
GO

/* ---------- 5. Anti doble conteo de rivalidades ---------- */
IF COL_LENGTH('dbo.SESIONES_MESAS', 'RivalidadesAplicadas') IS NULL
    ALTER TABLE dbo.SESIONES_MESAS ADD RivalidadesAplicadas BIT NOT NULL CONSTRAINT DF_SESIONES_RivApl DEFAULT 0;
GO
-- Partidas anteriores que ya tenian ganador no deben volver a contarse.
UPDATE s SET RivalidadesAplicadas = 1
FROM dbo.SESIONES_MESAS s
WHERE s.RivalidadesAplicadas = 0 AND EXISTS (SELECT 1 FROM dbo.PARTICIPANTES p WHERE p.SesionMesaId = s.Id AND p.EsGanador = 1);
GO

/* ---------- 6. Triggers ---------- */

-- 6.1 Puntaje y record salen SIEMPRE de las marcas no anuladas.
--     Puntaje = suma de series. RecordCarambolas = mejor serie del jugador (su tacada mas alta).
CREATE OR ALTER TRIGGER dbo.TR_MARCAS_Derivados
ON dbo.PARTICIPANTE_MARCAS_TIEMPO AFTER INSERT, UPDATE
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @P TABLE (Id UNIQUEIDENTIFIER PRIMARY KEY);
    INSERT @P SELECT DISTINCT ParticipanteId FROM inserted;

    UPDATE pa
       SET pa.Puntaje = ISNULL(t.Total, 0), pa.UltimaModificacion = GETDATE(), pa.EsSincronizado = 0
    FROM dbo.PARTICIPANTES pa
    INNER JOIN @P x ON x.Id = pa.Id
    OUTER APPLY (SELECT SUM(m.CarambolasEnMarca) AS Total
                 FROM dbo.PARTICIPANTE_MARCAS_TIEMPO m
                 WHERE m.ParticipanteId = pa.Id AND m.Anulada = 0) t
    WHERE pa.Puntaje <> ISNULL(t.Total, 0);

    UPDATE j
       SET j.RecordCarambolas = ISNULL(r.Mejor, 0), j.UltimaModificacion = GETDATE(), j.EsSincronizado = 0
    FROM dbo.JUGADORES j
    INNER JOIN (SELECT DISTINCT pa.JugadorId
                FROM dbo.PARTICIPANTES pa INNER JOIN @P x ON x.Id = pa.Id
                WHERE pa.JugadorId IS NOT NULL) a ON a.JugadorId = j.Id          -- invitados no tienen record
    OUTER APPLY (SELECT MAX(m.CarambolasEnMarca) AS Mejor
                 FROM dbo.PARTICIPANTE_MARCAS_TIEMPO m
                 INNER JOIN dbo.PARTICIPANTES p2 ON p2.Id = m.ParticipanteId
                 WHERE p2.JugadorId = j.Id AND m.Anulada = 0) r
    WHERE j.RecordCarambolas <> ISNULL(r.Mejor, 0);
END;
GO

-- 6.2 Rivalidades (decision #8) corregidas. El trigger del v6 real:
--     a) contaba de nuevo en CUALQUIER update de un participante cuando ya habia un ganador (el recalculo de Puntaje lo dispararia);
--     b) en parejas contaba a los companeros como rivales;
--     c) tomaba un solo ganador y una sola sesion por lote.
--     Ahora: solo cuando alguien pasa de EsGanador 0 a 1, una vez por sesion (RivalidadesAplicadas),
--     sin companeros de equipo y sin invitados. Un empate no marca ganador, asi que no cuenta.
--     REQUISITO para el API: marcar a todos los ganadores de la partida (ambos de la pareja) en UN SOLO UPDATE.
CREATE OR ALTER TRIGGER dbo.TR_PARTICIPANTES_ActualizarRivalidades
ON dbo.PARTICIPANTES AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @S TABLE (SesionMesaId UNIQUEIDENTIFIER PRIMARY KEY);
    INSERT @S
    SELECT DISTINCT i.SesionMesaId
    FROM inserted i
    INNER JOIN deleted d ON d.Id = i.Id
    INNER JOIN dbo.SESIONES_MESAS se ON se.Id = i.SesionMesaId
    WHERE i.EsGanador = 1 AND d.EsGanador = 0 AND se.RivalidadesAplicadas = 0;

    IF NOT EXISTS (SELECT 1 FROM @S) RETURN;

    ;WITH par AS (
        SELECT a.JugadorId AS JugA, b.JugadorId AS JugB, a.EsGanador AS GanaA, b.EsGanador AS GanaB
        FROM dbo.PARTICIPANTES a
        INNER JOIN dbo.PARTICIPANTES b ON b.SesionMesaId = a.SesionMesaId AND a.JugadorId < b.JugadorId  -- NULL (invitado) queda fuera
        INNER JOIN @S ss ON ss.SesionMesaId = a.SesionMesaId
        WHERE a.Equipo IS NULL OR b.Equipo IS NULL OR a.Equipo <> b.Equipo
    ),
    agg AS (
        SELECT JugA, JugB, COUNT(*) AS Partidas, SUM(CAST(GanaA AS INT)) AS VA, SUM(CAST(GanaB AS INT)) AS VB
        FROM par GROUP BY JugA, JugB
    )
    MERGE dbo.RIVALIDADES AS t
    USING agg AS g ON t.JugadorAId = g.JugA AND t.JugadorBId = g.JugB
    WHEN MATCHED THEN UPDATE SET
         t.PartidasJugadas = t.PartidasJugadas + g.Partidas,
         t.VictoriasA = t.VictoriasA + g.VA,
         t.VictoriasB = t.VictoriasB + g.VB,
         t.UltimaPartida = GETDATE(), t.UltimaModificacion = GETDATE(), t.EsSincronizado = 0
    WHEN NOT MATCHED THEN INSERT (Id, JugadorAId, JugadorBId, PartidasJugadas, VictoriasA, VictoriasB, UltimaPartida)
         VALUES (NEWID(), g.JugA, g.JugB, g.Partidas, g.VA, g.VB, GETDATE());

    UPDATE se SET se.RivalidadesAplicadas = 1, se.UltimaModificacion = GETDATE(), se.EsSincronizado = 0
    FROM dbo.SESIONES_MESAS se INNER JOIN @S ss ON ss.SesionMesaId = se.Id;
END;
GO

/* ---------- 7. Vistas ---------- */

-- Reto del Parche: la tacada mas alta de todos los jugadores registrados (sin filas = "sin record").
CREATE OR ALTER VIEW dbo.VW_RECORD_CASA AS
SELECT TOP 1
    j.Id                                   AS JugadorId,
    COALESCE(cl.Apodo, cl.Nombre, j.Username) AS Jugador,
    j.RecordCarambolas                     AS Serie,
    (SELECT MIN(m.MarcaTiempo)
       FROM dbo.PARTICIPANTE_MARCAS_TIEMPO m
       INNER JOIN dbo.PARTICIPANTES p ON p.Id = m.ParticipanteId
      WHERE p.JugadorId = j.Id AND m.Anulada = 0 AND m.CarambolasEnMarca = j.RecordCarambolas) AS Fecha
FROM dbo.JUGADORES j
LEFT JOIN dbo.CLIENTES cl ON cl.Id = j.ClienteId
WHERE j.RecordCarambolas > 0
ORDER BY j.RecordCarambolas DESC, Fecha ASC;     -- empate: gana quien lo hizo primero
GO

-- Tarjeta de cada jugador en el marcador: puntaje, promedio, ultima, mejor y entradas (series contadas).
CREATE OR ALTER VIEW dbo.VW_MARCADOR_PARTICIPANTE AS
SELECT
    pa.Id                                  AS ParticipanteId,
    pa.SesionMesaId,
    pa.JugadorId,
    COALESCE(cl.Nombre, j.Username, pa.NombreInvitado) AS Nombre,
    cl.Apodo,
    CAST(CASE WHEN pa.JugadorId IS NULL THEN 1 ELSE 0 END AS BIT) AS EsInvitado,
    pa.Equipo,
    pa.Puntaje,
    ISNULL(e.Entradas, 0)                  AS Entradas,
    CAST(CASE WHEN e.Entradas > 0 THEN pa.Puntaje * 1.0 / e.Entradas ELSE 0 END AS DECIMAL(6,2)) AS Promedio,
    ISNULL(e.Mejor, 0)                     AS Mejor,
    ISNULL(u.Serie, 0)                     AS Ultima
FROM dbo.PARTICIPANTES pa
LEFT JOIN dbo.JUGADORES j  ON j.Id  = pa.JugadorId
LEFT JOIN dbo.CLIENTES  cl ON cl.Id = j.ClienteId
OUTER APPLY (SELECT COUNT(*) AS Entradas, MAX(m.CarambolasEnMarca) AS Mejor
             FROM dbo.PARTICIPANTE_MARCAS_TIEMPO m
             WHERE m.ParticipanteId = pa.Id AND m.Anulada = 0) e
OUTER APPLY (SELECT TOP 1 m.CarambolasEnMarca AS Serie
             FROM dbo.PARTICIPANTE_MARCAS_TIEMPO m
             WHERE m.ParticipanteId = pa.Id AND m.Anulada = 0
             ORDER BY m.MarcaTiempo DESC, m.Id DESC) u;
GO

/* ---------- 8. Pendiente y decisiones ---------- */
-- [PENDIENTE] VW_COLA_SINCRONIZACION no incluye PARTICIPANTE_MARCAS_TIEMPO: agregar su rama UNION ALL
--             (ahora que la tabla tiene EsSincronizado y UltimaModificacion).
-- [RIESGO]    RecordCarambolas pasa a derivarse de las marcas. Si hay records historicos del POS o de cuadernos,
--             se pierden en cuanto el jugador registre una serie. Importarlos como marcas de una sesion de migracion.
-- [RIESGO]    MarcaTiempo es DATETIME con GETDATE() (hora local). Decision #12/#17: el servidor debe sellar UTC antes del go-live.
-- [DECIDIR]   Un chico = una SesionMesa (NUEVO CHICO abre otra sesion bajo la misma Cuenta). El tiempo de mesa se cobra
--             por Cuenta; confirmar que Liquidar no suma el tiempo dos veces cuando una cuenta tiene varias sesiones.
-- [DECIDIR]   Partida suelta (sin cuenta): se deja SESIONES_MESAS.CuentaId NOT NULL. El Marcador solo agrega
--             participantes a una sesion que la barra ya abrio; el Marcador no abre cuentas ni cobra.
-- [DECIDIR]   Ganador invitado: las demas parejas registradas cuentan la partida jugada sin victoria para nadie.
-- [API]       Corregir ultima = marcar Anulada=1 la serie y, si el valor corregido es >= 1, insertar otra con CorrigeA.
-- [API]       El PIN de Finalizar se valida contra el API; para trabajar sin internet, guardar en la tablet solo un hash
--             con sal y revalidar al sincronizar. Nunca el PIN en el JS (la maqueta tiene 1234 de ejemplo).
