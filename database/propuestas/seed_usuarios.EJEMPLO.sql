/* PLANTILLA — copia este archivo como seed_usuarios.sql (ese nombre está en .gitignore), cambia los
   nombres, roles y PIN, y córrelo en SSMS. NUNCA subas el archivo con PIN reales a GitHub.
   Pon los mismos nombres que tienen los usuarios en la app. PIN: 4 a 6 dígitos. */
USE ElParcheDeJony_LAB;
GO
DECLARE @salt VARCHAR(40), @pin VARCHAR(6);

-- ===== Usuario 1 =====
SET @salt = CONVERT(VARCHAR(36), NEWID()); SET @pin = '0000';          -- <- cambia el PIN
INSERT dbo.USUARIOS (Nombre, Rol, Salt, PinHash)
VALUES ('Albeiro', 'ADMIN', @salt, 'S256:' + LOWER(CONVERT(VARCHAR(64), HASHBYTES('SHA2_256', CONCAT(@salt, ':', @pin)), 2)));

-- ===== Usuario 2 =====
SET @salt = CONVERT(VARCHAR(36), NEWID()); SET @pin = '0000';          -- <- cambia el PIN
INSERT dbo.USUARIOS (Nombre, Rol, Salt, PinHash)
VALUES ('Dahiana', 'PATRONA', @salt, 'S256:' + LOWER(CONVERT(VARCHAR(64), HASHBYTES('SHA2_256', CONCAT(@salt, ':', @pin)), 2)));

-- (copia un bloque más por cada empleado, con Rol 'EMPLEADO')
SELECT Nombre, Rol, Activo FROM dbo.USUARIOS ORDER BY Nombre;
