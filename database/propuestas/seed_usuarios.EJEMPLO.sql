/* PLANTILLA — copia este archivo como seed_usuarios.sql (ese nombre está en .gitignore), cambia los
   nombres, roles y PIN, y córrelo en SSMS. NUNCA subas el archivo con PIN reales a GitHub.
   Usa la tabla USUARIOS que ya existe en el LAB (PinHash + PinSal). Si el usuario ya existe (mismo Nombre)
   le actualiza el PIN; si no, lo crea. PIN: 4 a 6 dígitos. Rol: ADMIN, PATRONA o EMPLEADO.
   Hash: 'S256:' + SHA-256 hexadecimal minúscula de "<PinSal>:<PIN>" (el mismo formato de la app). */
USE ElParcheDeJony_LAB;
GO
DECLARE @t TABLE (Nombre VARCHAR(80), Rol VARCHAR(10), Pin VARCHAR(6));
INSERT @t VALUES
    ('Albeiro', 'ADMIN',    '0000'),     -- <- cambia el PIN
    ('Dahiana', 'PATRONA',  '0000');     -- <- cambia el PIN
--  ,('Nombre empleado', 'EMPLEADO', '0000')   -- agrega una línea por empleado (separadas por coma)

DECLARE @n VARCHAR(80), @rol VARCHAR(10), @pin VARCHAR(6), @sal VARCHAR(64);
DECLARE c CURSOR LOCAL FAST_FORWARD FOR SELECT Nombre, Rol, Pin FROM @t;
OPEN c; FETCH NEXT FROM c INTO @n, @rol, @pin;
WHILE @@FETCH_STATUS = 0
BEGIN
    SET @sal = CONVERT(VARCHAR(36), NEWID());
    DECLARE @hash VARCHAR(128) = 'S256:' + LOWER(CONVERT(VARCHAR(64), HASHBYTES('SHA2_256', CONCAT(@sal, ':', @pin)), 2));
    IF EXISTS (SELECT 1 FROM dbo.USUARIOS WHERE Nombre = @n)
        UPDATE dbo.USUARIOS SET Rol = @rol, PinSal = @sal, PinHash = @hash, Activo = 1,
               IntentosFallidos = 0, BloqueadoHastaUtc = NULL, EsSincronizado = 0, UltimaModificacion = GETDATE()
        WHERE Nombre = @n;
    ELSE
        INSERT dbo.USUARIOS (Id, Nombre, Rol, PinSal, PinHash, Activo, IntentosFallidos, EsSincronizado, UltimaModificacion)
        VALUES (NEWID(), @n, @rol, @sal, @hash, 1, 0, 0, GETDATE());
    FETCH NEXT FROM c INTO @n, @rol, @pin;
END
CLOSE c; DEALLOCATE c;

SELECT Nombre, Rol, Activo, CASE WHEN PinHash IS NULL THEN 'sin PIN' ELSE 'con PIN' END AS Pin FROM dbo.USUARIOS ORDER BY Nombre;
