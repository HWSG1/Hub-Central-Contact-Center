# 07 · Solución de problemas

| Síntoma | Comprobación / acción |
|---|---|
| Cannot find module ...dist/api/main.js | En la raíz: npm.cmd ci, después npm.cmd run build:api y sólo si finaliza bien npm.cmd run start:api. dist no está en GitHub. |
| No existe .env | Crear desde .env.example sólo si no hay uno existente. Completar sus valores de forma privada. |
| Falta MFA_ENCRYPTION_KEY o login falla tras mover la API | Verificar la clave autorizada para esa base; no regenerarla ni copiar una de otro ambiente. |
| Invalid column name TaskFlow al ejecutar el instalador | Escribir el nombre como literal: DECLARE @DatabaseName sysname = N'TaskFlow';. No usar TaskFlow sin comillas. |
| SOLO REVISION: no se aplicaron cambios | @Apply=0. Es el resultado esperado; no se crearon objetos. |
| Migración con otro hash | Comparar fuentes y versión aprobada; conservar LF. No editar el hash en SQL ni borrar el historial para forzar la aplicación. |
| El instalador detecta migración desconocida | El paquete SQL puede ser más antiguo que la base. Obtener la versión correcta; no continuar con un instalador viejo. |
| Permission denied al crear esquema/rol/permisos | La cuenta instaladora necesita más que CREATE TABLE. Revisar con DBA; no convertir el login de runtime en administrador. |
| SQL responde, certificado no confiable | Revisar cadena CA, SAN/DNS, fecha y almacén de confianza de la identidad que ejecuta la API. No desactivar TLS ni confiar ciegamente en cualquier certificado. |
| No se reconoce .\scripts\… | Ejecutar primero cd a la raíz del proyecto. El directorio actual de PowerShell importa. |
| EADDRINUSE / puerto ocupado | Identificar el proceso que usa el puerto antes de detenerlo. Si se cambia PORT, actualizar el proxy correspondiente. |
| Forbidden por Origin | APP_ORIGIN debe coincidir exactamente con la URL del navegador. No mezclar localhost y 127.0.0.1. |
| Login rechaza un TOTP recién usado | Esperar el siguiente código; se previene el uso repetido. Verificar hora del teléfono/equipo. |
| No aparecen aplicaciones | Requiere aplicaciones publicadas, módulos habilitados y permisos asignados. Un catálogo vacío es válido. |
| No aparece Nuevo usuario | Requiere CORE.USERS.READ para la pantalla y CORE.USERS.CREATE para el alta. Verificar migración 004 y volver a iniciar sesión. |
| Cambio de seguridad pide iniciar sesión otra vez | Las operaciones administrativas exigen MFA y sesión iniciada hace menos de 15 minutos. |
| Activación vencida o bloqueada | Administrador: Usuarios → Renovar activación; entrega un código nuevo. No reiniciar bootstrap. |

Al informar errores, enviar el comando y mensaje sin contraseñas, tokens, claves MFA, cookies ni contenido de .env. La salida de db:check es diagnóstico; no modifica datos. Si falla un comando de instalación, detener la secuencia y corregir ese fallo antes de seguir.

## Mensaje «El servicio de acceso no está disponible»
Este mensaje corresponde a un fallo de conexión con la API o una respuesta de error del servidor. No demuestra por sí solo una contraseña inválida o que falte el usuario. En la PC donde corre la API, comprobar su terminal y ejecutar npm.cmd run db:check. Revisar servidor, puerto, base, permisos y confianza TLS sin compartir .env ni secretos. Si db:check funciona pero el login sigue fallando, revisar el error de API y las migraciones/permisos de runtime.

## Tamaño del login
El login adapta espacios a la altura disponible, conserva campos de 16px y controles de al menos 44px. El botón corporativo no configurado no se muestra. El cambio inicial de contraseña es un segundo paso visual; no altera el requisito de MFA ni la validación de la API. En pantallas excepcionalmente bajas, zoom alto o teclado móvil abierto se permite el desplazamiento imprescindible, para no recortar controles.

## connection.queryRaw is not a function
Corregido el conflicto entre los controladores mssql: se carga únicamente el seleccionado por SQL_AUTH. Actualizar código, ejecutar npm.cmd run build:api y reiniciar la API; db:check usa directamente el código fuente. No recrear cuentas ni tablas. El archivo .env aparece atenuado en VS Code porque .gitignore lo excluye; start:api y db:check lo cargan con --env-file=.env desde la raíz del proyecto. Las variables ya definidas en la terminal tienen prioridad sobre el archivo. Nunca imprimir el archivo completo para diagnosticar.

## La calculadora muestra Integración frontend pendiente
Actualizar el frontend: esa etiqueta correspondía a una tarjeta provisional del catálogo, no a la falta del módulo. Tras incorporar la corrección, recompilar y desplegar el frontend en IIS según el procedimiento vigente, o reiniciar start:web si se usa ng serve. No volver a importar el módulo ni ejecutar SQL. Con el módulo publicado y permiso CORTA_CUOTAS.USE, también se puede abrir /modules/corta-cuotas directamente en el origen del portal.

## Column enabled repetida: esquema existente sin historial 003/004
Si dbo.hub_migrations solo registra 001/002 pero existen las columnas de administración e invitaciones, no reejecutar migraciones ni insertar hashes a ciegas. Revisar también tipos, nulabilidad, defaults, CHECK, claves, índices, permisos de runtime y asignaciones al administrador. Para el caso local documentado se preparó un artefacto privado de reconciliación, con destino limitado, revisión predeterminada y validación de esos requisitos antes de registrar 003/004. Solo completa historial y audita la adopción de objetos preexistentes; no es otro instalador. Si una comprobación falla, detener y revisar las diferencias. Después de reconciliar, usar el único SQL consolidado para aplicar 005 pendiente. El applied_at de una reconciliación refleja la fecha de adopción, no la ejecución original.

## each value in roles must be a UUID
La validación RFC de UUID rechazaba GUID admitidos por uniqueidentifier de SQL Server, incluidos identificadores secuenciales. La API ahora valida el formato GUID completo de 36 caracteres (8-4-4-4-12 hexadecimales) sin imponer versión ni variante RFC, tanto en roles enviados como en rutas administrativas. Mantiene límites, unicidad, consultas parametrizadas y comprobación de existencia/autoridad. Actualizar código, ejecutar npm.cmd run build:api y reiniciar API. No modificar IDs ni ejecutar SQL para corregirlo.
