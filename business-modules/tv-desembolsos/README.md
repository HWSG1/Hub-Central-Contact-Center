# TV_DESEMBOLSOS · Televentas y desembolsos

**Módulo independiente para Contact Center Hub** — `hub-package-v2`, editor Ed25519 autorizado, versión 1.0.0. Este directorio solo contiene código y migraciones declarativas; **ningún dato de SharePoint ni secreto**.

## Alcance acordado
- Registro directo de **cuatro campos**: certificado de exactamente 9 números (texto), tipo de venta (EXTRA, INTRA, CORTA CUOTAS), tipo de desembolso (CUENTA, VENTANILLA) y fecha de desembolso obligatoria.
- El usuario operador viene exclusivamente de la **sesión autenticada del Hub**. Un cliente no puede suplantarlo mediante parámetros del módulo.
- **Mis desembolsos:** mes actual de Honduras por defecto y selección de otros meses; filtrado forzoso por usuario autenticado; paginación de 50 registros.
- **TV_Ventas se excluye por completo**: no se crea tabla, no se consulta ni se importa.
- `Usuarios` de SharePoint tampoco concede permisos: los administra el Hub.
- Única tabla operativa `mod_tv_desembolsos.certificados`, permiso `TV_DESEMBOLSOS.USE`.
- Se conservan campos auxiliares nullable en la tabla para el histórico de `TV_Certificados`; no se muestran en el formulario. Los registros nuevos requieren todos sus campos mediante validación del backend.

## Dependencia técnica del instalador
El Hub en `main` solo tiene broker SELECT. La rama de este módulo agrega declaraciones restringidas de inserción y consultas por actor/mes, puente sandbox, y la migración **011_package_append.sql**. No incluye SQL arbitrario desde el ZIP. Las escrituras están limitadas a las columnas declaradas del módulo y al actor inyectado por servidor, bajo `TV_DESEMBOLSOS.USE`, sesión/MFA y CSRF del Hub. El permiso SQL `INSERT` se concede **solo al objeto declarado** durante la instalación transaccional. Un administrador DBA debe evaluar esta concesión para el entorno.

La nueva función de instalación no modifica Ofertas TLV: módulos anteriores conservan intactos sus contratos de consulta y hashes SQL. La actualización de un módulo previamente instalado que cambie tablas o consultas sigue bloqueada.

## Instalación (QA primero)
1. Actualizar código del Hub desde el PR aprobado y ejecutar `npm ci`, `npm test`, `npm run build` y `npm run docs:check`; verificar Node 26 para módulos (`MODULE_NODE`).
2. Revisar `database/migrations/011_package_append.sql` y aplicar el **SQL consolidado** mediante el procedimiento del manual, servidor/base explícitos y `@Apply=0` antes de `@Apply=1`. No ejecutarlo sobre producción sin CAB/autorización.
3. Firmar el paquete con **clave privada Ed25519 del editor autorizado** mediante `npm run modules:pack -- business-modules/tv-desembolsos RUTA_CLAVE_PRIVADA business-modules/packages/tv-desembolsos-1.0.0.zip`. La clave privada no se coloca en el ZIP ni se sube a Git.
4. Revisar que la **clave pública correspondiente** ya esté en el archivo `MODULE_TRUST_FILE` del ambiente (QA y producción con controles separados). No añadir al registro de confianza una clave incluida por el propio paquete.
5. Hub → Centro de módulos → Importar módulo → cargar ZIP firmado → Analizar → confirmar objeto `mod_tv_desembolsos.certificados` y permiso `TV_DESEMBOLSOS.USE` → instalar → publicar.
6. Asignar `TV_DESEMBOLSOS.USE` al rol autorizado del operador. Probar aislamiento por operador, validaciones y duplicados antes de habilitar el registro real.

## Datos históricos
El Excel proporcionado contiene **16,538 registros** en `TV_Certificados`, de los cuales **3** no tienen certificado, **79** no tienen tipo de venta y **146** no tienen tipo de desembolso. Se admiten nulos de legado; **no eliminar** esas filas. Los 9 certificados repetidos deben conservarse durante la importación. **No importar TV_Ventas**.

El histórico se carga **fuera del ZIP**, desde el CSV privado generado a partir del Excel. Se incluye `scripts/importar_historico.py`:
- por defecto **solo previsualiza** y verifica el conteo, sin abrir SQL;
- `--apply` exige destino y confirmación explícitos, conexión Windows cifrada y certificado SQL verificado;
- es idempotente por `id_origen` único en archivo (hash de origen) y no borra ni actualiza filas;
- sin mapeo de usuario, conserva `correo_origen` y deja `registrado_por` nulo: esos registros no se asignan automáticamente al historial personal.

Un administrador debe aprobar el mapeo email histórico → GUID de `core.users` antes de importar con `--mapping`. Ejemplo de archivo *privado*: columnas `correo,hub_user_id`. No copiar ese archivo al ZIP ni al repositorio.

```powershell
python business-modules/tv-desembolsos/scripts/importar_historico.py --csv "C:\ruta\TV_Certificados_Historico_Importacion.csv"
# SOLO luego de aprobación QA / DBA:
python business-modules/tv-desembolsos/scripts/importar_historico.py --csv "C:\ruta\TV_Certificados_Historico_Importacion.csv" --server SERVIDOR --database BASE_QA --mapping "C:\ruta\mapeo.csv" --apply --confirm TV_CERTIFICADOS_16538
```

## Pruebas y límites
Las pruebas unitarias del contrato están en `tests/security/tv-desembolsos.test.ts`. Se debe validar compilación, SQL consolidado, firma del editor, instalación y ejecución real en QA, concurrencia (certificado duplicado) y permisos `INSERT`/lectura efectivos. **No asumir que una revisión de código prueba integridad en SQL real**. No se han ejecutado escrituras SQL ni un despliegue desde esta conversación.

## Modelado de datos
La tabla del instalador agrega `id`, `activo`, `cargado_en`; las columnas específicas son `certificado`, `tipo_venta`, `tipo_desembolso`, `fecha_desembolso`, `registrado_por` y auxiliares legacy: `correo_origen`, `id_origen`, `gestion_origen`, `estado_origen`, `observacion_origen`, `cuenta_tc_origen`, `fecha_creacion_origen`. Fecha de desembolso es `date`; fecha creación original es texto ISO por limitación del contrato v2, no representa una zona horaria arbitraria.
