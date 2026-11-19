# Instalación local con SSMS
Conectar a JanOda_PC_00\SQLEXPRESS01. Abrir Install-Local.sql y ejecutar el archivo completo con F5, sin seleccionar un fragmento y sin modo SQLCMD.
Crea ContactCenterHub_Dev si no existe; aplica 001_core.sql en transacción, verifica las 18 tablas y registra el mismo hash que scripts/migrate.ts. Repetir con la misma versión sólo verifica; no duplica datos semilla. No se crea ninguna identidad de acceso.
Si existe core sin historial o el hash difiere, se detiene para revisión. No borrar tablas para evitar la validación.
Una falla deja la base recién creada vacía, pero revierte los cambios de la migración. No usar este archivo en producción: valida máquina e instancia local.
Archivo generado desde el SQL actual; regenerar cuando cambie la fuente antes de su primera aplicación. Nunca modificar una migración ya aplicada.
Conectar la API y aprovisionar una identidad son pasos separados; el certificado TLS sigue siendo necesario.
Validación: archivo generado y cotejado con la migración. Ejecución SQL pendiente por el certificado de conexión.

## Actualización de administración
Ejecutar Update-Security-Administration.sql completo en SSMS con la API detenida. Requiere 001 y 002 ya aplicadas. Ver docs/security/administration.md. No repetir el bootstrap de administrador.

## Alta de usuarios desde la web
Update-User-Enrollment.sql aplica 004 sobre 001–003 en la instancia local, con la API detenida. No repetir bootstrap. Ver docs/security/user-enrollment.md.
