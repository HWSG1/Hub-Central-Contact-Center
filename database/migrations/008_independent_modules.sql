CREATE USER hub_package_owner WITHOUT LOGIN;
GRANT CREATE SCHEMA,CREATE TABLE TO hub_package_owner;
CREATE TABLE core.module_packages(version_id uniqueidentifier PRIMARY KEY REFERENCES core.module_versions(id),archive varbinary(max) NOT NULL);
GRANT INSERT ON core.module_packages TO hub_runtime;
GO
CREATE PROCEDURE core.create_package_storage @code varchar(40),@definition nvarchar(max)
WITH EXECUTE AS 'hub_package_owner'
AS
BEGIN
 SET NOCOUNT ON;
 SET XACT_ABORT ON;
 IF @@TRANCOUNT=0 THROW 51900,'Se requiere transaccion.',1;
 IF @code IS NULL OR LEN(@code)<3 OR @code COLLATE Latin1_General_100_BIN2 LIKE '%[^A-Z0-9_]%' OR LEFT(@code,1) COLLATE Latin1_General_100_BIN2 NOT LIKE '[A-Z]'
  THROW 51901,'Codigo no valido.',1;
 IF ISJSON(@definition)<>1 OR LEN(@definition)>100000 THROW 51902,'Definicion no valida.',1;
 DECLARE @schema sysname=N'mod_'+LOWER(@code),@ddl nvarchar(max),@table sysname,@columns nvarchar(max),@indexes nvarchar(max),@name sysname,@type nvarchar(50),@nullable bit;
 IF SCHEMA_ID(@schema) IS NOT NULL THROW 51903,'El esquema ya existe. No se reemplaza.',1;
 SET @ddl=N'CREATE SCHEMA '+QUOTENAME(@schema)+N' AUTHORIZATION hub_package_owner;';
 EXEC sys.sp_executesql @ddl;
 IF (SELECT COUNT(*) FROM OPENJSON(@definition,'$.tables')) NOT BETWEEN 1 AND 10 THROW 51902,'Tablas no validas.',1;
 DECLARE tables_cursor CURSOR LOCAL FAST_FORWARD FOR SELECT name,columns, indexes FROM OPENJSON(@definition,'$.tables') WITH(name nvarchar(48),columns nvarchar(max) AS JSON,indexes nvarchar(max) AS JSON);
 OPEN tables_cursor;FETCH NEXT FROM tables_cursor INTO @table,@columns,@indexes;
 WHILE @@FETCH_STATUS=0
 BEGIN
  IF @table IS NULL OR LEN(@table)=0 OR @table COLLATE Latin1_General_100_BIN2 LIKE '%[^A-Za-z0-9_]%' OR LEFT(@table,1) COLLATE Latin1_General_100_BIN2 NOT LIKE '[A-Za-z]' THROW 51904,'Tabla no valida.',1;
  IF (SELECT COUNT(*) FROM OPENJSON(@columns)) NOT BETWEEN 1 AND 100 THROW 51904,'Columnas no validas.',1;
  SET @ddl=N'CREATE TABLE '+QUOTENAME(@schema)+N'.'+QUOTENAME(@table)+N'([id] bigint IDENTITY(1,1) NOT NULL PRIMARY KEY,[activo] bit NOT NULL DEFAULT 1,[cargado_en] datetime2 NOT NULL DEFAULT SYSUTCDATETIME()';
  DECLARE columns_cursor CURSOR LOCAL FAST_FORWARD FOR SELECT name,type,nullable FROM OPENJSON(@columns) WITH(name nvarchar(48),type nvarchar(50),nullable bit);
  OPEN columns_cursor;FETCH NEXT FROM columns_cursor INTO @name,@type,@nullable;
  WHILE @@FETCH_STATUS=0
  BEGIN
   IF @name IS NULL OR LEN(@name)=0 OR @name COLLATE Latin1_General_100_BIN2 LIKE '%[^A-Za-z0-9_]%' OR LEFT(@name,1) COLLATE Latin1_General_100_BIN2 NOT LIKE '[A-Za-z]' OR LOWER(@name) IN('id','activo','cargado_en') THROW 51905,'Columna no valida.',1;
   IF @nullable IS NULL OR @type IS NULL OR @type COLLATE Latin1_General_100_BIN2 NOT IN('varchar(40)','nvarchar(300)','nvarchar(2000)','decimal(19,4)','decimal(9,4)','int','bigint','date','bit') THROW 51906,'Tipo no valido.',1;
   SET @ddl+=N','+QUOTENAME(@name)+N' '+@type+CASE WHEN @nullable=1 THEN N' NULL' ELSE N' NOT NULL' END;
   FETCH NEXT FROM columns_cursor INTO @name,@type,@nullable;
  END;
  CLOSE columns_cursor;DEALLOCATE columns_cursor;
  SET @ddl+=N');';EXEC sys.sp_executesql @ddl;
  DECLARE @index nvarchar(max),@indexFields nvarchar(max),@counter int=0;
  IF (SELECT COUNT(*) FROM OPENJSON(@indexes))>5 THROW 51907,'Demasiados indices.',1;
  DECLARE indexes_cursor CURSOR LOCAL FAST_FORWARD FOR SELECT value FROM OPENJSON(@indexes);
  OPEN indexes_cursor;FETCH NEXT FROM indexes_cursor INTO @index;
  WHILE @@FETCH_STATUS=0
  BEGIN
   IF (SELECT COUNT(*) FROM OPENJSON(@index)) NOT BETWEEN 1 AND 4 OR EXISTS(SELECT 1 FROM OPENJSON(@index) WHERE LEN(value)>48 OR value COLLATE Latin1_General_100_BIN2 LIKE '%[^A-Za-z0-9_]%' OR LEN(value)=0) THROW 51907,'Indice no valido.',1;
   SELECT @indexFields=STRING_AGG(CONVERT(nvarchar(max),QUOTENAME(value)),N',') WITHIN GROUP(ORDER BY CONVERT(int,[key])) FROM OPENJSON(@index);
   SET @counter+=1;
   SET @ddl=N'CREATE INDEX '+QUOTENAME(N'ix_'+CONVERT(nvarchar(10),@counter))+N' ON '+QUOTENAME(@schema)+N'.'+QUOTENAME(@table)+N'('+@indexFields+N');';EXEC sys.sp_executesql @ddl;
   FETCH NEXT FROM indexes_cursor INTO @index;
  END;
  CLOSE indexes_cursor;DEALLOCATE indexes_cursor;
  FETCH NEXT FROM tables_cursor INTO @table,@columns,@indexes;
 END;
 CLOSE tables_cursor;DEALLOCATE tables_cursor;
 SET @ddl=N'GRANT SELECT ON SCHEMA::'+QUOTENAME(@schema)+N' TO hub_runtime;';EXEC sys.sp_executesql @ddl;
END;
GO
CREATE PROCEDURE core.register_package_permission @code varchar(40)
WITH EXECUTE AS OWNER
AS
BEGIN
 SET NOCOUNT ON;
 IF @@TRANCOUNT=0 OR @code IS NULL OR @code COLLATE Latin1_General_100_BIN2 LIKE '%[^A-Z0-9_]%' OR @code LIKE 'CORE%' OR NOT EXISTS(SELECT 1 FROM core.modules WHERE code=@code) THROW 51908,'Modulo no valido.',1;
 DECLARE @permission varchar(150)=@code+'.USE';
 IF EXISTS(SELECT 1 FROM core.permissions WHERE code=@permission) THROW 51908,'Permiso existente.',1;
 INSERT core.permissions(code) VALUES(@permission);
 INSERT core.role_permissions(role_id,permission_id) SELECT r.id,p.id FROM core.roles r CROSS JOIN core.permissions p WHERE r.code='PLATFORM_ADMIN' AND p.code=@permission;
END;
GO
GRANT EXECUTE ON core.create_package_storage TO hub_runtime;
GRANT EXECUTE ON core.register_package_permission TO hub_runtime;
