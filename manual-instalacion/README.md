# Manual de instalación y operación — Contact Center Hub

Este es el punto de entrada vigente para instalar y actualizar el sistema. Versión de referencia: aplicación 0.1.0, migraciones 001–004. Revisado: 18/11/2026.

| Necesidad | Documento |
|---|---|
| Preparar una PC o servidor | [01 · Requisitos](01-requisitos.md) |
| Clonar, instalar, compilar e iniciar | [02 · Instalación en una PC](02-instalacion-pc.md) |
| Configurar .env, SQL y MFA | [03 · Configuración](03-configuracion.md) |
| Crear o actualizar las tablas con SSMS | [04 · Base de datos](04-base-datos.md) |
| Primer administrador y usuarios posteriores | [05 · Acceso y usuarios](05-acceso-usuarios.md) |
| Desplegar y operar la aplicación | [06 · Despliegue y operación](06-despliegue-operacion.md) |
| Resolver errores conocidos | [07 · Solución de problemas](07-solucion-problemas.md) |
| Consultar cambios y evidencia | [08 · Historial](08-historial.md) |
| Mantener manual y SQL actualizados | [09 · Mantenimiento](09-mantenimiento-manual.md) |

**Único archivo SQL de instalación/actualización:** [sql/Instalar-Actualizar-Hub.sql](sql/Instalar-Actualizar-Hub.sql).
Se usa tanto para una instalación nueva como para aplicar migraciones pendientes. No ejecutar migraciones individuales. Las fuentes de database/migrations son internas y versionadas; no se eliminan ni se editan después de aplicadas.

Los scripts antiguos de database/deployment se conservan como referencia histórica. El alta inicial local genera un SQL privado de identidad; no sustituye ni duplica el instalador del esquema y nunca se publica.

Separar los hitos: crear tablas no instala la API, no crea el primer usuario del portal y no acredita un pase de aplicación a producción. El usuario confirmó mediante captura la aplicación de 001–004 y 19 tablas en el servidor remoto; quedan pendientes la validación integral de esa API/SQL y los controles de producción detallados en los documentos técnicos.
