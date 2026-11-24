-- 012: Monitoreo TC, cargas historicas acumulativas (sin alterar los datos existentes).
-- Ejecutar por el instalador SQL del Hub; nunca por un ZIP arbitrario.
CREATE TABLE core.monitoreo_tc_cargas (
 carga_id uniqueidentifier NOT NULL CONSTRAINT PK_monitoreo_tc_cargas PRIMARY KEY,
 archivo nvarchar(120) NOT NULL,
 sha256 char(64) NOT NULL,
 usuario_hub uniqueidentifier NOT NULL,
 fecha_carga datetime2(3) NOT NULL CONSTRAINT DF_monitoreo_tc_cargas_fecha DEFAULT SYSUTCDATETIME(),
 registros_archivo int NOT NULL,
 insertados int NOT NULL,
 omitidos int NOT NULL,
 estado varchar(20) NOT NULL CONSTRAINT CK_monitoreo_tc_cargas_estado CHECK (estado IN ('ACTIVADA','SIN_NOVEDAD')),
 CONSTRAINT CK_monitoreo_tc_cargas_sha CHECK (sha256 NOT LIKE '%[^0-9a-f]%')
);
GO
CREATE INDEX IX_monitoreo_tc_cargas_fecha ON core.monitoreo_tc_cargas(fecha_carga DESC);
GO
CREATE PROCEDURE core.monitoreo_tc_importar
 @usuario uniqueidentifier,
 @archivo nvarchar(120),
 @sha256 char(64),
 @datos nvarchar(max),
 @esperados int
WITH EXECUTE AS 'hub_package_owner'
AS
BEGIN
 SET NOCOUNT ON;
 SET XACT_ABORT ON;
 IF @usuario IS NULL OR @archivo IS NULL OR LEN(@archivo) NOT BETWEEN 5 AND 120 OR
    @archivo LIKE '%[\\/:*?"<>|]%' OR @sha256 IS NULL OR LEN(@sha256)<>64 OR @sha256 LIKE '%[^0-9a-f]%'
    OR @esperados NOT BETWEEN 1 AND 50000 OR ISJSON(@datos)<>1
  THROW 52001,'Parametros de importacion invalidos.',1;
 IF NOT EXISTS (
  SELECT 1 FROM core.users u
  JOIN core.user_roles ur ON ur.user_id=u.id
  JOIN core.roles r ON r.id=ur.role_id AND r.enabled=1
  JOIN core.role_permissions rp ON rp.role_id=r.id
  JOIN core.permissions p ON p.id=rp.permission_id
  WHERE u.id=@usuario AND u.enabled=1 AND p.code='CORE.MODULES.MANAGE'
 )
  THROW 52002,'Usuario sin autoridad para administrar bases.',1;
 IF NOT EXISTS(SELECT 1 FROM core.modules WHERE code='MONITOREO_TC' AND enabled=1)
    OR OBJECT_ID(N'mod_monitoreo_tc.alertas',N'U') IS NULL
  THROW 52003,'Instala y publica Monitoreo TC antes de importar.',1;
 BEGIN TRY
  BEGIN TRANSACTION;
  DECLARE @lock int;
  EXEC @lock=sys.sp_getapplock @Resource=N'core.monitoreo_tc.import',@LockMode='Exclusive',@LockOwner='Transaction',@LockTimeout=15000;
  IF @lock<0 THROW 52004,'Hay otra importacion de Monitoreo TC en proceso.',1;
  DECLARE @incoming table (
   id_trx varchar(40) NOT NULL PRIMARY KEY,
   dni varchar(40) NULL, cuenta varchar(40) NULL, tarjeta_referencia varchar(40) NULL,
   tarjeta_ref10 varchar(40) NULL, tarjeta_enmascarada nvarchar(300) NULL,
   fecha_evento date NOT NULL,fecha_hora_origen nvarchar(300) NULL,
   regla nvarchar(300) NULL,regla_id varchar(40) NULL,respuesta_codigo varchar(40) NULL,
   comercio nvarchar(300) NULL,monto decimal(19,4) NULL,estado_tarjeta_origen varchar(40) NULL
  );
  INSERT @incoming
  SELECT id_trx,dni,cuenta,tarjeta_referencia,tarjeta_ref10,tarjeta_enmascarada,
   TRY_CONVERT(date,fecha_evento,23),fecha_hora_origen,regla,regla_id,respuesta_codigo,comercio,
   TRY_CONVERT(decimal(19,4),monto),estado_tarjeta_origen
  FROM OPENJSON(@datos) WITH (
   id_trx varchar(40) '$.id_trx', dni varchar(40) '$.dni',
   cuenta varchar(40) '$.cuenta',tarjeta_referencia varchar(40) '$.tarjeta_referencia',
   tarjeta_ref10 varchar(40) '$.tarjeta_ref10',tarjeta_enmascarada nvarchar(300) '$.tarjeta_enmascarada',
   fecha_evento varchar(10) '$.fecha_evento',fecha_hora_origen nvarchar(300) '$.fecha_hora_origen',
   regla nvarchar(300) '$.regla',regla_id varchar(40) '$.regla_id',
   respuesta_codigo varchar(40) '$.respuesta_codigo',comercio nvarchar(300) '$.comercio',
   monto varchar(40) '$.monto',estado_tarjeta_origen varchar(40) '$.estado_tarjeta_origen'
  );
  IF (SELECT COUNT(*) FROM @incoming)<>@esperados
   THROW 52005,'Conteo o identificadores duplicados en el lote.',1;
  IF EXISTS(SELECT 1 FROM @incoming WHERE fecha_evento IS NULL OR LEN(id_trx)<1)
   THROW 52006,'Filas invalidas en la base.',1;
  DECLARE @carga uniqueidentifier=NEWID(),@insertados int;
  INSERT mod_monitoreo_tc.alertas
   (id_trx,dni,cuenta,tarjeta_referencia,tarjeta_ref10,tarjeta_enmascarada,fecha_evento,
    fecha_hora_origen,regla,regla_id,respuesta_codigo,comercio,monto,estado_tarjeta_origen)
  SELECT src.id_trx,src.dni,src.cuenta,src.tarjeta_referencia,src.tarjeta_ref10,
    src.tarjeta_enmascarada,src.fecha_evento,src.fecha_hora_origen,src.regla,src.regla_id,
    src.respuesta_codigo,src.comercio,src.monto,src.estado_tarjeta_origen
  FROM @incoming src
  WHERE NOT EXISTS (SELECT 1 FROM mod_monitoreo_tc.alertas prev WITH (UPDLOCK,HOLDLOCK)
                    WHERE prev.id_trx=src.id_trx);
  SET @insertados=@@ROWCOUNT;
  INSERT core.monitoreo_tc_cargas
   (carga_id,archivo,sha256,usuario_hub,registros_archivo,insertados,omitidos,estado)
  VALUES(@carga,@archivo,@sha256,@usuario,@esperados,@insertados,@esperados-@insertados,
         CASE WHEN @insertados>0 THEN 'ACTIVADA' ELSE 'SIN_NOVEDAD' END);
  INSERT core.audit_events(user_id,action,result,resource_type,resource_id,details)
  VALUES(@usuario,'MONITOREO_TC.BASE.ACTIVATE','SUCCESS','monitoreo_tc',CONVERT(varchar(36),@carga),
         (SELECT @archivo AS archivo,@sha256 AS sha256,@esperados AS registros,
                 @insertados AS insertados,(@esperados-@insertados) AS omitidos FOR JSON PATH,WITHOUT_ARRAY_WRAPPER));
  COMMIT TRANSACTION;
  SELECT CONVERT(varchar(36),@carga) carga_id,@insertados insertados,
         @esperados-@insertados omitidos;
 END TRY
 BEGIN CATCH
  IF @@TRANCOUNT>0 ROLLBACK TRANSACTION;
  THROW;
 END CATCH
END;
GO
GRANT EXECUTE ON core.monitoreo_tc_importar TO hub_runtime;
