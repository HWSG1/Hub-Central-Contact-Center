# Contact Center Hub

Portal Angular + API NestJS + SQL Server 2022. Incluye autenticación local con MFA, soporte OIDC, roles/permisos, administración de usuarios, activación por invitación, catálogo y auditoría. La importación de módulos y otros controles de producción siguen pendientes; no se declara una plataforma bancaria certificada.

## Instalar o actualizar
Comenzar por [el manual de instalación](manual-instalacion/README.md). Contiene requisitos, instalación en otra PC, configuración, acceso, despliegue y solución de problemas.

**SQL único:** [Instalar-Actualizar-Hub.sql](manual-instalacion/sql/Instalar-Actualizar-Hub.sql), generado desde migraciones versionadas. Sirve para instalaciones nuevas y migraciones pendientes. Por defecto sólo revisa; exige servidor y base explícitos.

## Arranque de desarrollo
Con Node 24.x >=24.15, .env configurado, base e identidad inicial preparadas según el manual:

~~~powershell
npm.cmd ci
npm.cmd run build
~~~

En dos terminales: npm.cmd run start:api y npm.cmd run start:web. En .env definir FRONTEND_PORT=4200, BACKEND_PORT=3000 y APP_ORIGIN=http://localhost:4200. Abrir http://localhost:4200. El frontend configura automáticamente su proxy /api al puerto del backend y aísla la variable genérica PORT para evitar conflictos con Angular. Los .env antiguos con PORT=3000 siguen funcionando. dist y .env no se incluyen en GitHub: compilar y configurar en cada instalación. No hay credenciales predeterminadas.

## Desarrollo y documentación
- npm.cmd test: pruebas y verificación del manual/SQL.
- npm.cmd run docs:build: regenerar SQL consolidado sin conectar a SQL.
- npm.cmd run docs:check: verificar artefacto y hashes.
- [Arquitectura](docs/architecture/phase-0.md), [controles](docs/security/controls.md) y [SDK de módulos](packages/module-sdk/README.md).

Actualizar manual e historial junto con cada cambio relevante, según AGENTS.md. Nunca publicar .env ni .local.
