# Contact Center Hub
Lea docs/architecture/phase-0.md y docs/security/controls.md antes de cambiar el núcleo.
Angular standalone estricto; NestJS modular; SQL Server 2022 con migraciones versionadas.
Prohibidos accesos simulados, cuentas ocultas, contraseñas predeterminadas, roles de frontend, SQL arbitrario, ejecución de paquetes no firmados o de editores no autorizados y secretos en Git.
Toda API de negocio exige sesión, usuario activo, permiso, alcance y módulo habilitado. Denegar por defecto.
No conectar SAP HANA ni desplegar a producción sin autorización explícita.
No modificar bases ajenas. Separar migrador y cuenta de runtime. Consultas parametrizadas.
No declarar cumplimiento ASVS ni controles no comprobados. Mantener matriz de pendientes.
Ejecutar npm test y npm run build. No deshabilitar TLS para resolver conectividad.

## Manual de instalación obligatorio
Fuente operativa vigente: manual-instalacion/README.md. Con cada cambio de requisitos, comandos, .env, SQL, permisos, acceso o despliegue, actualizar el capítulo afectado y 08-historial.md en la misma entrega.
El único SQL operativo es manual-instalacion/sql/Instalar-Actualizar-Hub.sql; generarlo con npm run docs:build desde database/migrations. No mantener copias manuales nuevas. Nunca editar migraciones aplicadas ni sus hashes; agregar una nueva migración y registrar su hash revisado en checksums.json. Conservar finales LF.
Ejecutar npm run docs:check (también incluido en npm test). Mantener parámetros del SQL versionado en NULL y Apply=0. Las copias parametrizadas y los secretos son privados.

El usuario autorizó módulos independientes mediante ZIP completo. Seguir ADR 004: firmas, ejecutor separado, consultas y migraciones declarativas acotadas. No importar código del ZIP en el proceso de la API.
