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
admin:local no es un asistente de producción y no debe adaptarse cambiando sus validaciones. El proyecto dispone de admin:provision para una identidad corporativa OIDC explícita con MFA, previa configuración y autorización. Requiere una cuenta instaladora y un subject real del proveedor; no copia el usuario local. Ver [autenticación](../docs/security/authentication.md).

No se ha implementado un asistente de primer administrador LOCAL para producción. Debe definirse y revisarse ese procedimiento antes de usar cuentas locales administrativas en ese ambiente. Crear tablas no resuelve este paso. No ejecutar comandos de bootstrap a ciegas.

## Usuarios posteriores
Con un administrador autorizado: Usuarios → Nuevo usuario. Indicar nombre, login, roles y motivo. Entregar privadamente el código de activación, válido por 24 horas. El usuario entra a /activate, elige su contraseña y confirma su autenticador. Luego inicia sesión con un nuevo código TOTP. Para pérdida, vencimiento o bloqueo de una invitación pendiente, usar Renovar activación.

Las altas y cambios administrativos requieren MFA y sesión iniciada hace menos de 15 minutos. Se auditan y se restringen a la autoridad del operador. No puedes modificar tu propio acceso ni tus propios roles. Ver [detalle del alta](../docs/security/user-enrollment.md).

## Rol operativo
Asignar sólo los permisos de negocio registrados por los módulos. No asignar CORE.* al usuario que no debe ver administración. CORE.MODULES.READ corresponde al Centro de módulos administrativo, no al uso de las aplicaciones. Los permisos se suman entre todos los roles asignados. La importación de módulos aún está pendiente; no se deben inventar permisos operativos que no existan.

## Usar una cuenta desde otra PC
La cuenta local pertenece al portal y se almacena en la base SQL, no en el navegador ni en el equipo. Dos API que atiendan la misma base deben usar la misma MFA_ENCRYPTION_KEY autorizada para poder validar las cuentas existentes. No duplicar el usuario ni ejecutar de nuevo el bootstrap cuando la base ya tiene administrador.

Si la segunda PC apunta a otra base vacía, allí no existe la cuenta creada en desarrollo. admin:local sólo permite el primer administrador de ContactCenterHub_Dev en SQLEXPRESS01 local; no sirve para aprovisionar una base remota de producción. El código TOTP del portal tiene **6 dígitos**, no 8.

El login presenta usuario, contraseña y TOTP. Tras validar las credenciales iniciales y detectar cambio obligatorio, muestra un segundo paso con nueva contraseña, confirmación y TOTP, en vez de acumular campos. Al volver al inicio se borran contraseña y códigos del formulario. El método corporativo sólo aparece si está configurado.
