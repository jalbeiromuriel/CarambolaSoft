/* =====================================================================
   CarambolaSoft · BD ElParcheDeJony · DELTA v6.7 — USUARIOS (login del API)
   ESTADO: PROPUESTA. Probar primero en ElParcheDeJony_LAB, con backup. Idempotente.

   El API valida el PIN contra esta tabla y entrega un token. El PIN NUNCA se guarda: solo
   Salt + PinHash con el mismo formato de la app: 'S256:' + SHA-256 en hexadecimal minúscula de "<Salt>:<PIN>".
   Los usuarios (con sus PIN) se cargan con un script local que NO se sube a GitHub:
   ver database/propuestas/seed_usuarios.EJEMPLO.sql
   ===================================================================== */
USE ElParcheDeJony_LAB;
GO
IF OBJECT_ID('dbo.USUARIOS') IS NULL
CREATE TABLE dbo.USUARIOS (
    Id                  UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_USUARIOS PRIMARY KEY CONSTRAINT DF_USU_Id DEFAULT NEWSEQUENTIALID(),
    Nombre              VARCHAR(60) COLLATE Modern_Spanish_CI_AI NOT NULL,
    Rol                 VARCHAR(10) COLLATE Modern_Spanish_CI_AI NOT NULL,
    Salt                VARCHAR(40) NOT NULL,
    PinHash             VARCHAR(70) NOT NULL,
    Activo              BIT          NOT NULL CONSTRAINT DF_USU_Activo DEFAULT 1,
    Intentos            INT          NOT NULL CONSTRAINT DF_USU_Intentos DEFAULT 0,
    BloqueadoHasta      DATETIME2    NULL,
    UltimoLogin         DATETIME2    NULL,
    UltimaModificacion  DATETIME     NOT NULL CONSTRAINT DF_USU_UM DEFAULT GETDATE(),
    CONSTRAINT UQ_USUARIOS_Nombre UNIQUE (Nombre),
    CONSTRAINT CK_USUARIOS_Rol CHECK (Rol IN ('ADMIN', 'PATRONA', 'EMPLEADO'))
);
GO
SELECT OBJECT_ID('dbo.USUARIOS') AS TablaUsuarios;   -- un número (no NULL)
