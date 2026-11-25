-- 011: append-only permissions for declarative, signed package operations.
-- No direct DDL or cross-schema access for the package runtime.
CREATE PROCEDURE core.grant_package_append @code varchar(40), @table varchar(48)
WITH EXECUTE AS 'hub_package_owner'
AS
BEGIN
 SET NOCOUNT ON;
 SET XACT_ABORT ON;
 IF @@TRANCOUNT=0 THROW 51920,'Se requiere transaccion.',1;
 IF @code IS NULL OR LEN(@code)<3 OR @code COLLATE Latin1_General_100_BIN2 LIKE '%[^A-Z0-9_]%' OR LEFT(@code,1) COLLATE Latin1_General_100_BIN2 NOT LIKE '[A-Z]'
  THROW 51921,'Modulo no valido.',1;
 IF @table IS NULL OR LEN(@table)=0 OR @table COLLATE Latin1_General_100_BIN2 LIKE '%[^A-Za-z0-9_]%' OR LEFT(@table,1) COLLATE Latin1_General_100_BIN2 NOT LIKE '[A-Za-z]'
  THROW 51922,'Tabla no valida.',1;
 DECLARE @schema sysname=N'mod_'+LOWER(@code);
 IF OBJECT_ID(QUOTENAME(@schema)+N'.'+QUOTENAME(@table),N'U') IS NULL
  THROW 51923,'Tabla del modulo inexistente.',1;
 DECLARE @ddl nvarchar(max)=N'GRANT INSERT ON OBJECT::'+QUOTENAME(@schema)+N'.'+QUOTENAME(@table)+N' TO hub_runtime;';
 EXEC sys.sp_executesql @ddl;
END;
GO
GRANT EXECUTE ON core.grant_package_append TO hub_runtime;
