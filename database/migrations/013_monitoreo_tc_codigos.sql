-- 013: administracion auditada de codigos de respuesta de Monitoreo TC.
-- No se altera el esquema de los paquetes firmados ni se borran eventos.
IF OBJECT_ID(N'mod_monitoreo_tc.codigos_respuesta',N'U') IS NOT NULL
BEGIN
 GRANT SELECT ON mod_monitoreo_tc.codigos_respuesta TO hub_runtime;
END;
GO
CREATE PROCEDURE core.monitoreo_tc_guardar_codigo
 @usuario uniqueidentifier,
 @operacion varchar(12),
 @codigo varchar(40),
 @descripcion nvarchar(300)=NULL,
 @accion varchar(40)=NULL
WITH EXECUTE AS 'hub_package_owner'
AS
BEGIN
 SET NOCOUNT ON;
 SET XACT_ABORT ON;
 IF @usuario IS NULL OR @operacion NOT IN ('CREAR','EDITAR','DESACTIVAR')
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
  INSERT core.audit_events(user_id,action,result,resource_type,resource_id,details)
  VALUES(@usuario,CONCAT('MONITOREO_TC.CODE.',@operacion),'SUCCESS','monitoreo_codigo',@codigo,
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
GRANT EXECUTE ON core.monitoreo_tc_guardar_codigo TO hub_runtime;
