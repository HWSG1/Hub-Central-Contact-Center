# Contact Center Hub — Enterprise Modular Platform
Proyecto local Angular 22 + NestJS 12 + SQL Server 2022. Implementación inicial de fases 0 y 1; no es una plataforma bancaria certificada ni está listo para producción.

## Qué incluye
Login premium inspirado en los HTML, layout responsive, modo oscuro, catálogo autorizado, sesión BFF persistida, OIDC Code+PKCE, autenticación local Argon2id deshabilitada inicialmente, guard RBAC, auditoría inicial, migración SQL y aprovisionamiento corporativo por CLI.

## Preparación
1. Node 24 LTS >=24.15, npm y Microsoft ODBC Driver para SQL Server.
2. npm ci.
3. Copiar .env.example a .env y configurar SQL cifrado. Instancia SQLEXPRESS01 detectada en puerto 14331.
4. Resolver certificado confiable; ejecutar scripts/create-database.sql con cuenta instaladora y npm run db:migrate.
5. Configurar IdP corporativo y aprovisionar identidad autorizada según docs/security/authentication.md.
6. npm test; npm run build.
7. npm run start:api y npm run start:web en terminales separadas. Abrir http://localhost:4200.

No hay cuenta de prueba ni contraseña de acceso. Sin IdP configurado el login comunica que no está disponible; no concede acceso.

## Documentación
- docs/architecture/phase-0.md: alcance, ADR y criterios.
- docs/architecture/data-model.md: modelo de datos.
- docs/security/: amenazas, controles, RBAC y autenticación.
- docs/deployment/windows.md: SQL, IIS, servicio y operación.
- packages/module-sdk/: contrato y manifiesto inicial.

## Pendiente
SQL real bloqueado por certificado no confiable. Configuración IdP y MFA corporativo requiere Infraestructura. Fase 2 (administración, MFA local, recuperación), fase 3 (carga/validación de paquetes y SDK completo), fases 4/5 (firma, pipeline, revisión y UAT) no están completadas. No se modificó SAP HANA ni se desplegó producción.

Evidencia de compilación, pruebas y vulnerabilidad pendiente en tooling: docs/verification.md. No confundir npm audit de producción sin alertas con ausencia de riesgos en desarrollo.

## Administrador local (actualización)
Ejecutar npm.cmd run admin:local y seguir docs/deployment/local-admin.md. Genera alta para SSMS, configura MFA y exige cambio inicial. Verificar SQL con npm.cmd run db:check. No hay credenciales predeterminadas.
