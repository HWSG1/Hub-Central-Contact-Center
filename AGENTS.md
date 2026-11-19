# Contact Center Hub
Lea docs/architecture/phase-0.md y docs/security/controls.md antes de cambiar el núcleo.
Angular standalone estricto; NestJS modular; SQL Server 2022 con migraciones versionadas.
Prohibidos accesos simulados, cuentas ocultas, contraseñas predeterminadas, roles de frontend, SQL arbitrario, ejecución de paquetes y secretos en Git.
Toda API de negocio exige sesión, usuario activo, permiso, alcance y módulo habilitado. Denegar por defecto.
No conectar SAP HANA ni desplegar a producción sin autorización explícita.
No modificar bases ajenas. Separar migrador y cuenta de runtime. Consultas parametrizadas.
No declarar cumplimiento ASVS ni controles no comprobados. Mantener matriz de pendientes.
Ejecutar npm test y npm run build. No deshabilitar TLS para resolver conectividad.
