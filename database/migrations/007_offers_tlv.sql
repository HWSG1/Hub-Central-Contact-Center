-- Additive TLV contract. Prior migrations and existing offers remain unchanged.
CREATE PROCEDURE core.install_ofertas_tlv_v1
WITH EXECUTE AS 'hub_offers_installer'
AS
BEGIN
 SET NOCOUNT ON;
 SET XACT_ABORT ON;
 IF @@TRANCOUNT=0 THROW 51800,'La instalacion requiere una transaccion.',1;
 IF OBJECT_ID(N'ofertas.base_tlv') IS NOT NULL
  THROW 51801,'La tabla TLV ya existe. No se modifica ni reemplaza.',1;
 CREATE TABLE ofertas.base_tlv(
  id bigint IDENTITY(1,1) NOT NULL CONSTRAINT PK_base_tlv PRIMARY KEY,
  [TIPO_BASE] nvarchar(300) NULL,
  [DNI] varchar(40) NULL,
  [CODIGO_CLIENTE] varchar(40) NULL,
  [COD_CLIENTE_CRM] varchar(40) NULL,
  [CUENTA] varchar(40) NULL,
  [NUMERO_ADICIONALES_QUE_APLICA] nvarchar(300) NULL,
  [NOMBRE_TC] nvarchar(300) NULL,
  [METAL] nvarchar(300) NULL,
  [HRE_ACTIVO] nvarchar(300) NULL,
  [ASISTENCIA_VIP_ACTIVO] nvarchar(300) NULL,
  [VAP_ACTIVO] nvarchar(300) NULL,
  [TASA_EXTRA] decimal(9,4) NULL,
  [MONTO_OFERTA_EXTRA] decimal(19,4) NULL,
  [TASA_INTRA] decimal(9,4) NULL,
  [MONTO_OFERTA_INTRA] decimal(19,4) NULL,
  [MONTO_OFERTA_CC] decimal(19,4) NULL,
  [RANGO_TASA_EXTRA] nvarchar(300) NULL,
  [ID_AREA] nvarchar(300) NULL,
  [MES_BASE] date NULL,
  [MAIL] nvarchar(300) NULL,
  [LIMITE] decimal(19,4) NULL,
  [FLAG_FINAL_PAGO_CONTADO] nvarchar(300) NULL,
  [FLAG_EMPLEADO] nvarchar(300) NULL,
  [ID_ORDEN_CRM] varchar(40) NULL,
  [TIPO_FINANCIAMIENTO] nvarchar(300) NULL,
  [FECHA_COMPRA] date NULL,
  [PLAZO] int NULL,
  [CUENTA_DESTINO] varchar(40) NULL,
  [MONTO] decimal(19,4) NULL,
  [COMERCIO] nvarchar(300) NULL,
  [NOMBRE_CLIENTE] nvarchar(300) NULL,
  [CATEGORIA] nvarchar(300) NULL,
  [PAGO_IMPUESTO] decimal(19,4) NULL,
  [COTIZACION] varchar(40) NULL,
  [OFERTA_CRM] varchar(40) NULL,
  [FLAG1] nvarchar(300) NULL,
  [COLOR_ACTUAL] nvarchar(300) NULL,
  [LIMITE_NUEVO_USD] decimal(19,4) NULL,
  [COLOR_NUEVO] nvarchar(300) NULL,
  [DIFERENCIA] decimal(19,4) NULL,
  [CANTIDAD_TC] int NULL,
  [TC_INGRESADA] varchar(40) NULL,
  activo bit NOT NULL CONSTRAINT DF_base_tlv_activo DEFAULT 1,
  cargado_en datetime2 NOT NULL CONSTRAINT DF_base_tlv_cargado DEFAULT SYSUTCDATETIME()
 );
 CREATE INDEX IX_base_tlv_dni ON ofertas.base_tlv(DNI,activo,id);
 CREATE INDEX IX_base_tlv_cliente ON ofertas.base_tlv(CODIGO_CLIENTE,activo,id);
 CREATE INDEX IX_base_tlv_cuenta ON ofertas.base_tlv(CUENTA,activo,id);
END;
GO
GRANT EXECUTE ON core.install_ofertas_tlv_v1 TO hub_runtime;
GO
ALTER PROCEDURE core.install_ofertas_v1
WITH EXECUTE AS 'hub_offers_installer'
AS
BEGIN
 SET NOCOUNT ON;
 SET XACT_ABORT ON;
 -- Called within the same transaction as module registration and its audit.
 IF @@TRANCOUNT=0 THROW 51800,'La instalacion requiere una transaccion.',1;
 IF OBJECT_ID(N'ofertas.ofertas_cliente') IS NOT NULL
  THROW 51801,'La tabla de ofertas ya existe. No se modifica ni reemplaza.',1;
 CREATE TABLE ofertas.ofertas_cliente(
  id bigint IDENTITY(1,1) NOT NULL CONSTRAINT PK_ofertas_cliente PRIMARY KEY,
  base_origen nvarchar(120) NOT NULL,
  producto varchar(20) NOT NULL,
  codigo_oferta nvarchar(100) NULL,
  lote nvarchar(100) NULL,
  dni varchar(32) NULL,
  codigo_cliente varchar(32) NULL,
  cuenta varchar(32) NULL,
  nombre_cliente nvarchar(200) NOT NULL,
  agencia nvarchar(150) NULL,
  telefono1 nvarchar(30) NULL,
  telefono2 nvarchar(30) NULL,
  telefono3 nvarchar(30) NULL,
  direccion nvarchar(500) NULL,
  monto_oferta decimal(18,2) NULL,
  tasa_anual decimal(7,4) NULL,
  tasa_minima decimal(7,4) NULL,
  tasa_maxima decimal(7,4) NULL,
  oferta nvarchar(2000) NOT NULL,
  tipo_tarjeta nvarchar(100) NULL,
  limite_usd decimal(18,2) NULL,
  limite_lps decimal(18,2) NULL,
  limite_actual decimal(18,2) NULL,
  nuevo_limite decimal(18,2) NULL,
  vigente_desde date NULL,
  vigente_hasta date NULL,
  activo bit NOT NULL CONSTRAINT DF_ofertas_activo DEFAULT 1,
  cargado_en datetime2 NOT NULL CONSTRAINT DF_ofertas_cargado DEFAULT SYSUTCDATETIME(),
  CONSTRAINT CK_ofertas_producto CHECK(producto IN('PREAPROBADAS','TC_TITULAR','AUMENTO_LIMITE','EXTRA','INTRA','CORTA_CUOTAS')),
  CONSTRAINT CK_ofertas_identidad CHECK(NULLIF(LTRIM(RTRIM(dni)),'') IS NOT NULL OR NULLIF(LTRIM(RTRIM(codigo_cliente)),'') IS NOT NULL OR NULLIF(LTRIM(RTRIM(cuenta)),'') IS NOT NULL),
  CONSTRAINT CK_ofertas_nombre CHECK(LEN(LTRIM(RTRIM(nombre_cliente)))>0 AND LEN(LTRIM(RTRIM(base_origen)))>0 AND LEN(LTRIM(RTRIM(oferta)))>0),
  CONSTRAINT CK_ofertas_montos CHECK((monto_oferta IS NULL OR monto_oferta>=0) AND (limite_usd IS NULL OR limite_usd>=0) AND (limite_lps IS NULL OR limite_lps>=0) AND (limite_actual IS NULL OR limite_actual>=0) AND (nuevo_limite IS NULL OR nuevo_limite>=0)),
  CONSTRAINT CK_ofertas_tasas CHECK((tasa_anual IS NULL OR tasa_anual BETWEEN 0 AND 100) AND (tasa_minima IS NULL OR tasa_minima BETWEEN 0 AND 100) AND (tasa_maxima IS NULL OR tasa_maxima BETWEEN 0 AND 100) AND (tasa_minima IS NULL OR tasa_maxima IS NULL OR tasa_minima<=tasa_maxima)),
  CONSTRAINT CK_ofertas_vigencia CHECK(vigente_desde IS NULL OR vigente_hasta IS NULL OR vigente_desde<=vigente_hasta)
 );
 -- Deliberately non-unique: a customer/account can have many offers in any base.
 CREATE INDEX IX_ofertas_dni ON ofertas.ofertas_cliente(dni,activo,id);
 CREATE INDEX IX_ofertas_cliente ON ofertas.ofertas_cliente(codigo_cliente,activo,id);
 CREATE INDEX IX_ofertas_cuenta ON ofertas.ofertas_cliente(cuenta,activo,id);
 EXEC core.install_ofertas_tlv_v1;
END;
GO
-- Existing installations receive the new empty table during the Hub update.
-- Fresh installations defer its creation to the module installation transaction.
IF EXISTS(SELECT 1 FROM core.modules WHERE code='OFERTAS')
 EXEC core.install_ofertas_tlv_v1;
