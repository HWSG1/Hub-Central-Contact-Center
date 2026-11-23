-- 010: Instalador controlado para la auditoria del modulo OFERTAS_TLV.
-- No ejecuta SQL suministrado por ZIP y no reemplaza datos de clientes.
-- Se ejecuta en la transaccion de instalacion o en la migracion DBA autorizada.
CREATE PROCEDURE core.prepare_tlv_auditoria_v1
WITH EXECUTE AS OWNER
AS
BEGIN
 SET NOCOUNT ON;
 SET XACT_ABORT ON;
 IF @@TRANCOUNT=0 THROW 52100,'La preparacion TLV requiere transaccion.',1;
 IF NOT EXISTS (SELECT 1 FROM core.modules WHERE code='OFERTAS_TLV')
    THROW 52101,'El modulo TLV no esta registrado.',1;
 IF NOT EXISTS (
   SELECT 1 FROM sys.schemas
   WHERE name=N'mod_ofertas_tlv' AND principal_id=DATABASE_PRINCIPAL_ID(N'hub_package_owner')
 )
    THROW 52102,'El esquema TLV no pertenece al instalador autorizado.',1;
 IF OBJECT_ID(N'mod_ofertas_tlv.base_tlv',N'U') IS NULL
    THROW 52103,'Falta la tabla base_tlv del modulo TLV.',1;
 IF COL_LENGTH('mod_ofertas_tlv.base_tlv','carga_id') IS NULL
    EXEC sys.sp_executesql N'ALTER TABLE mod_ofertas_tlv.base_tlv ADD carga_id uniqueidentifier NULL';
 IF COL_LENGTH('mod_ofertas_tlv.base_tlv','archivo_fila') IS NULL
    EXEC sys.sp_executesql N'ALTER TABLE mod_ofertas_tlv.base_tlv ADD archivo_fila int NULL';
 IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'mod_ofertas_tlv.base_tlv') AND name='IX_base_tlv_carga_activo')
    EXEC sys.sp_executesql N'CREATE INDEX IX_base_tlv_carga_activo ON mod_ofertas_tlv.base_tlv(carga_id,activo) INCLUDE (TIPO_BASE)';
 IF OBJECT_ID(N'mod_ofertas_tlv.cargas',N'U') IS NULL
    EXEC sys.sp_executesql N'CREATE TABLE mod_ofertas_tlv.cargas (
  carga_id uniqueidentifier NOT NULL CONSTRAINT PK_tlv_cargas PRIMARY KEY,
  archivo nvarchar(260) NOT NULL,
  sha256 char(64) NOT NULL,
  modalidad varchar(20) NOT NULL CONSTRAINT CK_tlv_modalidad CHECK (modalidad IN (''REEMPLAZO_TOTAL'',''REEMPLAZO_TIPO'')),
  tipo_base nvarchar(300) NULL,
  periodo date NULL,
  usuario_bd sysname NOT NULL,
  usuario_hub uniqueidentifier NULL,
  esperados int NOT NULL,
  insertados int NOT NULL CONSTRAINT DF_tlv_insertados DEFAULT (0),
  rechazados int NOT NULL CONSTRAINT DF_tlv_rechazados DEFAULT (0),
  estado varchar(15) NOT NULL CONSTRAINT CK_tlv_estado CHECK (estado IN (''CARGANDO'',''ACTIVADA'',''FALLIDA'')),
  error_resumen nvarchar(1000) NULL,
  creado_en datetime2(3) NOT NULL CONSTRAINT DF_tlv_creado_en DEFAULT SYSUTCDATETIME(),
  activado_en datetime2(3) NULL,
  CONSTRAINT CK_tlv_tipo_modalidad CHECK (
    (modalidad=''REEMPLAZO_TOTAL'' AND tipo_base IS NULL) OR
    (modalidad=''REEMPLAZO_TIPO'' AND tipo_base IS NOT NULL)
  )
);';
 IF OBJECT_ID(N'mod_ofertas_tlv.carga_eventos',N'U') IS NULL
    EXEC sys.sp_executesql N'CREATE TABLE mod_ofertas_tlv.carga_eventos (
 evento_id bigint IDENTITY(1,1) NOT NULL CONSTRAINT PK_tlv_eventos PRIMARY KEY,
 carga_id uniqueidentifier NOT NULL,
 operacion varchar(30) NOT NULL,
 usuario_bd sysname NOT NULL,
 usuario_hub uniqueidentifier NULL,
 detalle nvarchar(1000) NULL,
 fecha_utc datetime2(3) NOT NULL CONSTRAINT DF_tlv_evento_fecha DEFAULT SYSUTCDATETIME(),
 CONSTRAINT FK_tlv_eventos_carga FOREIGN KEY(carga_id) REFERENCES mod_ofertas_tlv.cargas(carga_id)
);';
 IF OBJECT_ID(N'mod_ofertas_tlv.carga_errores',N'U') IS NULL
    EXEC sys.sp_executesql N'CREATE TABLE mod_ofertas_tlv.carga_errores (
 error_id bigint IDENTITY(1,1) NOT NULL CONSTRAINT PK_tlv_errores PRIMARY KEY,
 carga_id uniqueidentifier NOT NULL,
 fila_excel int NULL,
 columna varchar(60) NULL,
 motivo nvarchar(500) NOT NULL,
 fecha_utc datetime2(3) NOT NULL CONSTRAINT DF_tlv_error_fecha DEFAULT SYSUTCDATETIME(),
 CONSTRAINT FK_tlv_errores_carga FOREIGN KEY(carga_id) REFERENCES mod_ofertas_tlv.cargas(carga_id)
);';
 IF OBJECT_ID(N'mod_ofertas_tlv.activar_carga',N'P') IS NULL
    EXEC sys.sp_executesql N'CREATE PROCEDURE mod_ofertas_tlv.activar_carga @carga_id uniqueidentifier
AS
BEGIN
 SET NOCOUNT ON; SET XACT_ABORT ON;
 BEGIN TRANSACTION;
 BEGIN TRY
  DECLARE @lock int,@modalidad varchar(20),@tipo nvarchar(300),@esperados int,@insertados bigint;
  EXEC @lock=sys.sp_getapplock @Resource=''TLV_CAMBIO_BASE_VIGENTE'',@LockMode=''Exclusive'',@LockOwner=''Transaction'',@LockTimeout=20000;
  IF @lock<0 THROW 52010,''No se obtuvo el bloqueo de activacion.'',1;
  SELECT @modalidad=modalidad,@tipo=tipo_base,@esperados=esperados FROM mod_ofertas_tlv.cargas WITH (UPDLOCK,HOLDLOCK)
   WHERE carga_id=@carga_id AND estado=''CARGANDO'';
  IF @modalidad IS NULL THROW 52011,''La carga no existe o no esta pendiente.'',1;
  SELECT @insertados=COUNT_BIG(*) FROM mod_ofertas_tlv.base_tlv WHERE carga_id=@carga_id AND activo=0;
  IF @insertados<>@esperados OR @insertados=0 THROW 52012,''La cantidad cargada no coincide con la validacion.'',1;
  IF @modalidad=''REEMPLAZO_TIPO'' AND EXISTS(
      SELECT 1 FROM mod_ofertas_tlv.base_tlv WHERE carga_id=@carga_id AND (TIPO_BASE IS NULL OR TIPO_BASE<>@tipo))
      THROW 52013,''La carga contiene otro tipo de base.'',1;
  IF @modalidad=''REEMPLAZO_TOTAL''
    UPDATE mod_ofertas_tlv.base_tlv SET activo=0 WHERE activo=1;
  ELSE
    UPDATE mod_ofertas_tlv.base_tlv SET activo=0 WHERE activo=1 AND TIPO_BASE=@tipo;
  UPDATE mod_ofertas_tlv.base_tlv SET activo=1 WHERE carga_id=@carga_id AND activo=0;
  UPDATE mod_ofertas_tlv.cargas SET estado=''ACTIVADA'',activado_en=SYSUTCDATETIME(),insertados=CONVERT(int,@insertados) WHERE carga_id=@carga_id;
  INSERT mod_ofertas_tlv.carga_eventos(carga_id,operacion,usuario_bd,detalle)
   VALUES(@carga_id,''ACTIVAR'',ORIGINAL_LOGIN(),CONCAT(''Modalidad '',@modalidad,''; filas '',@insertados));
  COMMIT TRANSACTION;
 END TRY
 BEGIN CATCH IF @@TRANCOUNT>0 ROLLBACK TRANSACTION; THROW; END CATCH;
END;';
 IF OBJECT_ID(N'mod_ofertas_tlv.restaurar_carga',N'P') IS NULL
    EXEC sys.sp_executesql N'CREATE PROCEDURE mod_ofertas_tlv.restaurar_carga @carga_id uniqueidentifier
AS
BEGIN
 SET NOCOUNT ON; SET XACT_ABORT ON;
 BEGIN TRANSACTION;
 BEGIN TRY
  DECLARE @lock int,@modalidad varchar(20),@tipo nvarchar(300);
  EXEC @lock=sys.sp_getapplock @Resource=''TLV_CAMBIO_BASE_VIGENTE'',@LockMode=''Exclusive'',@LockOwner=''Transaction'',@LockTimeout=20000;
  IF @lock<0 THROW 52020,''No se obtuvo el bloqueo para restaurar.'',1;
  SELECT @modalidad=modalidad,@tipo=tipo_base FROM mod_ofertas_tlv.cargas WITH(UPDLOCK,HOLDLOCK)
   WHERE carga_id=@carga_id AND estado=''ACTIVADA'';
  IF @modalidad IS NULL THROW 52021,''La carga indicada no esta activada en el historial.'',1;
  IF NOT EXISTS(SELECT 1 FROM mod_ofertas_tlv.base_tlv WHERE carga_id=@carga_id)
   THROW 52022,''La carga seleccionada no conserva registros.'',1;
  IF @modalidad=''REEMPLAZO_TOTAL''
    UPDATE mod_ofertas_tlv.base_tlv SET activo=0 WHERE activo=1;
  ELSE
    UPDATE mod_ofertas_tlv.base_tlv SET activo=0 WHERE activo=1 AND TIPO_BASE=@tipo;
  UPDATE mod_ofertas_tlv.base_tlv SET activo=1 WHERE carga_id=@carga_id;
  INSERT mod_ofertas_tlv.carga_eventos(carga_id,operacion,usuario_bd,detalle)
    VALUES(@carga_id,''RESTAURAR'',ORIGINAL_LOGIN(),''Restauracion autorizada.'');
  COMMIT TRANSACTION;
 END TRY
 BEGIN CATCH IF @@TRANCOUNT>0 ROLLBACK TRANSACTION; THROW; END CATCH;
END;';
 -- Permisos minimos para la identidad SQL utilizada por la API.
 GRANT INSERT ON OBJECT::mod_ofertas_tlv.base_tlv TO hub_runtime;
 GRANT SELECT,INSERT,UPDATE ON OBJECT::mod_ofertas_tlv.cargas TO hub_runtime;
 GRANT SELECT,INSERT ON OBJECT::mod_ofertas_tlv.carga_eventos TO hub_runtime;
 GRANT SELECT,INSERT ON OBJECT::mod_ofertas_tlv.carga_errores TO hub_runtime;
 GRANT EXECUTE ON OBJECT::mod_ofertas_tlv.activar_carga TO hub_runtime;
 -- restaurar_carga NO se concede al rol de la aplicacion.
END;
GO
GRANT EXECUTE ON OBJECT::core.prepare_tlv_auditoria_v1 TO hub_runtime;
GO
-- Si TLV ya estaba instalado, completar sus dependencias durante migracion 010.
IF EXISTS (SELECT 1 FROM core.modules WHERE code='OFERTAS_TLV')
   EXEC core.prepare_tlv_auditoria_v1;
