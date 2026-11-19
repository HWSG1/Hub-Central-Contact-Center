# 05 · Primer acceso y usuarios

No hay contraseña predeterminada ni cuenta de demostración. Crear las tablas no crea un administrador del portal.

## Primer administrador de desarrollo local
Sólo para NODE_ENV=development, SQL_DATABASE=ContactCenterHub_Dev e instancia SQLEXPRESS01 en la PC donde se ejecuta el asistente:
1. Instalar todas las migraciones con el SQL consolidado de [04](04-base-datos.md).
2. Desde la raíz del proyecto ejecutar npm.cmd run admin:local en una terminal interactiva.
3. Elegir usuario, nombre y contraseña inicial; vincular la clave TOTP manual y confirmar un código vigente.
4. Abrir en SSMS el SQL PRIVADO generado en .local/alta-admin-….sql y ejecutarlo completo contra esa instancia local. No publicarlo en GitHub ni enviarlo por correo.
5. Reiniciar la API. Ingresar con las credenciales elegidas y un código nuevo del autenticador. Completar el cambio obligatorio de contraseña inicial.

El asistente no conecta a SQL; crea el archivo privado y configura MFA en .env. No se puede repetir si el bootstrap ya se completó. Esta excepción es un alta de identidad, no otro instalador de tablas. No borrar la marca de bootstrap ni desactivar MFA para resolver incidencias.

## Primer administrador remoto / producción
El asistente independiente `npm.cmd run admin:remote` genera un SQL privado de alta; no conecta al servidor, no carga ni modifica .env, no crea tablas y no cambia admin:local. Requiere que el DBA haya aplicado las migraciones del instalador consolidado y que todavía no exista administrador ni bootstrap completado.

1. En la API destino, configure LOCAL_AUTH_ENABLED=true y una MFA_ENCRYPTION_KEY privada de 32 bytes hexadecimales (64 caracteres). Conserve una clave existente; todas las API de esa base deben compartirla. Para una base NUEVA sin clave, puede generar una con `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"` y guardarla privadamente en la configuración de la API. No la comparta ni la suba a Git.
2. Ejecute `npm.cmd run admin:remote` desde la raíz del proyecto en una terminal interactiva. Introduzca el ServerName exacto de SQL (no la IP ni el puerto), la base, la clave MFA de esa API, usuario, nombre y contraseña. La clave y contraseñas se solicitan ocultas.
3. Agregue la clave manual al autenticador: basado en tiempo, 6 dígitos, 30 segundos. Confirme un código vigente.
4. Abra el SQL privado indicado en .local/alta-admin-remoto-….sql desde SSMS, conectado al servidor correcto y con la base destino seleccionada. Ejecútelo completo con @Apply=0 para revisar; luego cambie a 1 y ejecute completo para crear el administrador. Use una cuenta instaladora autorizada; no eleve la cuenta SQL de runtime.
5. Reinicie la API destino si cambió su configuración. Ingrese con el usuario elegido, contraseña inicial y un NUEVO código del autenticador. Complete el cambio obligatorio de contraseña.

El SQL verifica servidor/base, hashes de migraciones y ausencia de bootstrap/administrador; serializa el alta, crea credenciales Argon2id y MFA cifrado, asigna PLATFORM_ADMIN y audita en una transacción. No contiene la contraseña ni la clave MFA de la API en texto plano; aun así es un artefacto privado. No reutilizarlo para usuarios posteriores ni eliminar la marca bootstrap. Si se pierde el autenticador, la recuperación administrativa continúa pendiente. No se ha validado este procedimiento contra el servidor de producción; las pruebas automatizadas verifican la generación y las salvaguardas del SQL.

La alternativa corporativa sigue siendo admin:provision con identidad OIDC y MFA del proveedor. El alta no constituye una certificación de seguridad ni resuelve los pendientes de recuperación y revisión integral documentados en la matriz de controles.

## Usuarios posteriores
Con un administrador autorizado: Usuarios → Nuevo usuario. Indicar nombre, login, roles y motivo. Entregar privadamente el código de activación, válido por 24 horas. El usuario entra a /activate, elige su contraseña y confirma su autenticador. Luego inicia sesión con un nuevo código TOTP. Para pérdida, vencimiento o bloqueo de una invitación pendiente, usar Renovar activación.

Las altas y cambios administrativos requieren MFA y sesión iniciada hace menos de 15 minutos. Se auditan y se restringen a la autoridad del operador. No puedes modificar tu propio acceso ni tus propios roles. Ver [detalle del alta](../docs/security/user-enrollment.md).

## Rol operativo
Asignar sólo los permisos de negocio registrados por los módulos. No asignar CORE.* al usuario que no debe ver administración. CORE.MODULES.READ corresponde al Centro de módulos administrativo, no al uso de las aplicaciones. Los permisos se suman entre todos los roles asignados. La importación de módulos aún está pendiente; no se deben inventar permisos operativos que no existan.

## Usar una cuenta desde otra PC
La cuenta local pertenece al portal y se almacena en la base SQL, no en el navegador ni en el equipo. Dos API que atiendan la misma base deben usar la misma MFA_ENCRYPTION_KEY autorizada para poder validar las cuentas existentes. No duplicar el usuario ni ejecutar de nuevo el bootstrap cuando la base ya tiene administrador.

Si la segunda PC apunta a otra base vacía, allí no existe la cuenta creada en desarrollo. admin:local sólo permite el primer administrador de ContactCenterHub_Dev en SQLEXPRESS01 local; para el primer administrador de una base remota use admin:remote según el procedimiento anterior. El código TOTP del portal tiene **6 dígitos**, no 8.

El login presenta usuario, contraseña y TOTP. Tras validar las credenciales iniciales y detectar cambio obligatorio, muestra un segundo paso con nueva contraseña, confirmación y TOTP, en vez de acumular campos. Al volver al inicio se borran contraseña y códigos del formulario. El método corporativo sólo aparece si está configurado.
