-- Script de creación de base de datos y tabla para SQL Server Express
-- Ajusta el nombre de la base de datos si es necesario.

IF DB_ID('BD_TEST_IA') IS NULL
BEGIN
    CREATE DATABASE BD_TEST_IA;
END
GO

USE BD_TEST_IA;
GO

IF OBJECT_ID('dbo.Users', 'U') IS NOT NULL
BEGIN
    DROP TABLE dbo.Users;
END
GO

CREATE TABLE dbo.Users (
    id INT IDENTITY(1,1) PRIMARY KEY,
    name NVARCHAR(100) NOT NULL,
    email NVARCHAR(150) NOT NULL UNIQUE,
    password NVARCHAR(255) NOT NULL,
    role NVARCHAR(30) NOT NULL DEFAULT 'user',
    assignedLocationId INT NULL,
    estado BIT NOT NULL DEFAULT 1,
    createdAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    updatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
);
GO

-- Ejemplo de inserción de datos
-- Inserciones de ejemplo comentadas porque ahora se requiere `password` y `estado`.
-- INSERT INTO dbo.Users (name, email, password, estado)
-- VALUES
--     ('Juan Pérez', 'juan.perez@example.com', 'hashed_password_here', 1),
--     ('María López', 'maria.lopez@example.com', 'hashed_password_here', 1);
GO
