# Manual de instalaciÃ³n y operaciÃ³n â€” Contact Center Hub

Este es el punto de entrada vigente para instalar y actualizar el sistema. VersiÃ³n de referencia: aplicaciÃ³n 0.1.0, migraciones 001â€“006. Revisado: 20/11/2026.

| Necesidad | Documento |
|---|---|
| Preparar una PC o servidor | [01 Â· Requisitos](01-requisitos.md) |
| Clonar, instalar, compilar e iniciar | [02 Â· InstalaciÃ³n en una PC](02-instalacion-pc.md) |
| Configurar .env, SQL y MFA | [03 Â· ConfiguraciÃ³n](03-configuracion.md) |
| Crear o actualizar las tablas con SSMS | [04 Â· Base de datos](04-base-datos.md) |
| Primer administrador y usuarios posteriores | [05 Â· Acceso y usuarios](05-acceso-usuarios.md) |
| Desplegar y operar la aplicaciÃ³n | [06 Â· Despliegue y operaciÃ³n](06-despliegue-operacion.md) |
| Resolver errores conocidos | [07 Â· SoluciÃ³n de problemas](07-solucion-problemas.md) |
| Consultar cambios y evidencia | [08 Â· Historial](08-historial.md) |
| Mantener manual y SQL actualizados | [09 Â· Mantenimiento](09-mantenimiento-manual.md) |
| Buscador de ofertas, instalaciÃ³n y carga de datos | [11 Â· Buscador de ofertas](11-buscador-ofertas.md) |
| Importar mÃ³dulos y probar Corta Cuotas | [10 Â· MÃ³dulos](10-modulos.md) |

**Ãšnico archivo SQL de instalaciÃ³n/actualizaciÃ³n:** [sql/Instalar-Actualizar-Hub.sql](sql/Instalar-Actualizar-Hub.sql).
Se usa tanto para una instalaciÃ³n nueva como para aplicar migraciones pendientes. No ejecutar migraciones individuales. Las fuentes de database/migrations son internas y versionadas; no se eliminan ni se editan despuÃ©s de aplicadas.

Los scripts antiguos de database/deployment se conservan como referencia histÃ³rica. El alta inicial local genera un SQL privado de identidad; no sustituye ni duplica el instalador del esquema y nunca se publica.

Separar los hitos: crear tablas no instala la API, no crea el primer usuario del portal y no acredita un pase de aplicaciÃ³n a producciÃ³n. El usuario confirmÃ³ mediante captura la aplicaciÃ³n de 001â€“004 y 19 tablas en el servidor remoto; quedan pendientes la validaciÃ³n integral de esa API/SQL y los controles de producciÃ³n detallados en los documentos tÃ©cnicos.

- [12 · Instalador de paquetes independientes](12-paquetes-independientes.md).
