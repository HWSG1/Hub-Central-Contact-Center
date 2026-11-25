-- 014: corregir auditoria obligatoria en operaciones de Monitoreo TC.
-- Mantiene las migraciones 012/013 intactas y todos los datos historicos.
ALTER PROCEDURE core.monitoreo_tc_importar
 @usuario uniqueidentifier,
 @correlation varchar(64),
 @archivo nvarchar(120),
 @sha256 char(64),
 @datos nvarchar(max),
 @esperados int
WITH EXECUTE AS 'hub_package_owner'
AS
BEGIN
 SET NOCOUNT ON;
 SET XACT_ABORT ON;
 IF @usuario IS NULL OR NULLIF(@correlation,'') IS NULL OR @archivo IS NULL OR LEN(@archivo) NOT BETWEEN 5 AND 120 OR
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
  INSERT core.audit_events(user_id,action,result,correlation_id,resource_type,resource_id,details)
  VALUES(@usuario,'MONITOREO_TC.BASE.ACTIVATE','SUCCESS',@correlation,'monitoreo_tc',@carga,
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
ALTER PROCEDURE core.monitoreo_tc_guardar_codigo
 @usuario uniqueidentifier,
 @correlation varchar(64),
 @operacion varchar(12),
 @codigo varchar(40),
 @descripcion nvarchar(300)=NULL,
 @accion varchar(40)=NULL
WITH EXECUTE AS 'hub_package_owner'
AS
BEGIN
 SET NOCOUNT ON;
 SET XACT_ABORT ON;
 IF @usuario IS NULL OR NULLIF(@correlation,'') IS NULL OR @operacion NOT IN ('CREAR','EDITAR','DESACTIVAR')
 OR @codigo IS NULL OR LEN(@codigo) NOT BETWEEN 1 AND 10
 OR @codigo COLLATE Latin1_General_100_BIN2 LIKE '%[^A-Z0-9]%'
 THROW 52100,'Operacion o codigo invalido.',1;
 IF @operacion<>'DESACTIVAR'
 AND (@descripcion IS NULL OR LEN(LTRIM(RTRIM(@descripcion))) NOT BETWEEN 1 AND 300
 OR @accion NOT IN ('A','D'))
 THROW 52101,'Descripcion o accion invalida.',1;
 IF NOT EXISTS(
  SELECT 1 FROM core.users u
  JOIN core.user_roles ur ON ur.user_id=u.id
  JOIN core.roles r ON r.id=ur.role_id AND r.enabled=1
  JOIN core.role_permissions rp ON rp.role_id=r.id
  JOIN core.permissions p ON p.id=rp.permission_id
  WHERE u.id=@usuario AND u.enabled=1 AND p.code='CORE.MODULES.MANAGE'
 ) THROW 52102,'Sin permisos de administracion.',1;
 IF OBJECT_ID(N'mod_monitoreo_tc.codigos_respuesta',N'U') IS NULL
 THROW 52103,'Instala el modulo de Monitoreo TC antes de administrar codigos.',1;
 BEGIN TRY
  BEGIN TRANSACTION;
  DECLARE @lock int,@matches int,@active int;
  EXEC @lock=sys.sp_getapplock @Resource=N'monitoreo.tc.codigos',@LockMode='Exclusive',@LockOwner='Transaction',@LockTimeout=10000;
  IF @lock<0 THROW 52104,'Otra modificacion esta en curso.',1;
  SELECT @matches=COUNT(*),@active=COALESCE(SUM(CASE WHEN activo=1 THEN 1 ELSE 0 END),0)
    FROM mod_monitoreo_tc.codigos_respuesta WITH(UPDLOCK,HOLDLOCK) WHERE codigo=@codigo;
  IF @matches>1 THROW 52105,'Existen codigos repetidos; requiere revision del administrador.',1;
  IF @operacion='CREAR'
  BEGIN
    IF @active>0 THROW 52106,'El codigo ya existe.',1;
    IF @matches=1
      UPDATE mod_monitoreo_tc.codigos_respuesta
       SET descripcion=@descripcion,accion=@accion,activo=1,registrado_por=CONVERT(nvarchar(36),@usuario)
       WHERE codigo=@codigo;
    ELSE
      INSERT mod_monitoreo_tc.codigos_respuesta(codigo,descripcion,accion,registrado_por)
       VALUES(@codigo,@descripcion,@accion,CONVERT(nvarchar(36),@usuario));
  END;
  IF @operacion='EDITAR'
  BEGIN
    IF @active<>1 THROW 52107,'Codigo inexistente o desactivado.',1;
    UPDATE mod_monitoreo_tc.codigos_respuesta SET descripcion=@descripcion,accion=@accion,
      registrado_por=CONVERT(nvarchar(36),@usuario) WHERE codigo=@codigo AND activo=1;
  END;
  IF @operacion='DESACTIVAR'
  BEGIN
    IF @active<>1 THROW 52107,'Codigo inexistente o desactivado.',1;
    UPDATE mod_monitoreo_tc.codigos_respuesta SET activo=0 WHERE codigo=@codigo AND activo=1;
  END;
  INSERT core.audit_events(user_id,action,result,correlation_id,resource_type,resource_id,details)
  VALUES(@usuario,CONCAT('MONITOREO_TC.CODE.',@operacion),'SUCCESS',@correlation,'monitoreo_codigo',NULL,
    (SELECT @codigo codigo,@operacion operacion,@accion accion FOR JSON PATH,WITHOUT_ARRAY_WRAPPER));
  COMMIT;
  SELECT @codigo AS codigo,@operacion AS operacion;
 END TRY
 BEGIN CATCH
  IF @@TRANCOUNT>0 ROLLBACK;
  THROW;
 END CATCH
END;
GO
