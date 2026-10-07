/* =====================================================================
   CarambolaSoft / Mero Parche  -  Usuarios y roles (v6.3)
   PROPUESTA: probada en LAB el 2026-10-07 (4 pruebas OK); NO ejecutada contra la BD real. Con backup.
   Va DESPUES del delta v6.2. Idempotente.
   Roles (decididos 2026-10-07):
     ADMIN    : control total (usuarios, precios, datos de pago, todo).
     PATRONA  : caja, inventario, clientes e informes.
     EMPLEADO : solo registrar pedidos.
   La matriz de permisos vive en el codigo (API y frontend), no en la BD: solo
   se guarda el rol. El PIN NUNCA se guarda: solo PinHash + PinSal (hash con sal
   calculado por el API, p. ej. PBKDF2). Este script NO crea usuarios ni PINs
   (repo publico): el primer ADMIN se aprovisiona por un endpoint seguro.
   ===================================================================== */
SET ANSI_NULLS ON;
GO
SET QUOTED_IDENTIFIER ON;
GO

IF OBJECT_ID('dbo.USUARIOS') IS NULL
CREATE TABLE dbo.USUARIOS (
    Id                  UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_USUARIOS PRIMARY KEY
                        CONSTRAINT DF_USU_Id DEFAULT NEWSEQUENTIALID(),
    Nombre              VARCHAR(80) COLLATE Modern_Spanish_CI_AI NOT NULL,
    Rol                 VARCHAR(10) COLLATE Modern_Spanish_CI_AI NOT NULL,
    PinHash             VARCHAR(128) COLLATE Modern_Spanish_CI_AI NULL,   -- hash con sal; NULL = aun sin PIN
    PinSal              VARCHAR(64)  COLLATE Modern_Spanish_CI_AI NULL,
    Activo              BIT          NOT NULL CONSTRAINT DF_USU_Activo DEFAULT 1,   -- nunca se borra: se desactiva
    IntentosFallidos    INT          NOT NULL CONSTRAINT DF_USU_Intentos DEFAULT 0,
    BloqueadoHastaUtc   DATETIME2    NULL,                                        -- bloqueo temporal anti fuerza bruta (PIN de 4 digitos)
    UltimoAccesoUtc     DATETIME2    NULL,
    EsSincronizado      BIT          NOT NULL CONSTRAINT DF_USU_Sync DEFAULT 0,
    UltimaModificacion  DATETIME     NOT NULL CONSTRAINT DF_USU_UM DEFAULT GETDATE(),
    CONSTRAINT CK_USU_Rol       CHECK (Rol IN ('ADMIN', 'PATRONA', 'EMPLEADO')),
    CONSTRAINT CK_USU_Intentos  CHECK (IntentosFallidos >= 0),
    CONSTRAINT UQ_USU_Nombre    UNIQUE (Nombre)
);
GO

/* TURNOS_CAJA.UsuarioId (NOT NULL, sin FK) debe apuntar a USUARIOS.
   NO se agrega la FK aqui: los turnos existentes traen UsuarioId que aun no estan en USUARIOS.
   Pasos al migrar: 1) crear los usuarios, 2) actualizar TURNOS_CAJA.UsuarioId, 3) agregar la FK:
     ALTER TABLE dbo.TURNOS_CAJA ADD CONSTRAINT FK_TURNOS_Usuario FOREIGN KEY (UsuarioId) REFERENCES dbo.USUARIOS(Id); */

/* [RIESGO] Un PIN de 4 digitos tiene solo 10.000 combinaciones: el API debe contar IntentosFallidos,
   bloquear con BloqueadoHastaUtc (p. ej. 5 fallos = 5 min) y devolver el mismo mensaje exista o no el usuario.
   [RIESGO] Siempre debe quedar al menos un ADMIN activo: validar en el API al desactivar o cambiar rol.
   [MEJORA] Auditar anulaciones, cambios de precio y reaperturas guardando el UsuarioId (siguiente delta). */
