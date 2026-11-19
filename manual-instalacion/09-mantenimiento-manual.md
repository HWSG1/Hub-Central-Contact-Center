# 09 · Regla de mantenimiento

Cada cambio que altere requisitos, comandos, configuración, esquema SQL, permisos, acceso, despliegue o mensajes de error debe actualizar el capítulo correspondiente y el historial en la misma entrega. Esto también está indicado en AGENTS.md.

## Cambio de base
1. Agregar una migración nueva con número consecutivo en database/migrations. Nunca editar o renombrar una migración aplicada.
2. Añadir su SHA-256 exacto en database/migrations/checksums.json después de revisión. No sustituir hashes antiguos. Los archivos deben usar UTF-8 y LF; .gitattributes conserva LF al clonar.
3. Ejecutar npm.cmd run docs:build. El generador no conecta a SQL y reconstruye el único instalador con todas las migraciones.
4. Revisar el diff del SQL generado, actualizar el capítulo SQL y el historial. Dejar @ExpectedServer=NULL, @DatabaseName=NULL y @Apply=0 en el archivo versionado.
5. Ejecutar npm.cmd test y npm.cmd run build. npm test incluye docs:check y falla si el consolidado o hashes no coinciden. Probar SQL real por separado en un entorno autorizado antes del pase.

## Cambio sin SQL
Actualizar los capítulos afectados y el historial. docs:check comprueba que existen los capítulos y que el instalador coincide con las fuentes; no puede comprobar la exactitud semántica del texto. La revisión humana sigue siendo necesaria.

No copiar contraseñas, .env, SQL privados de bootstrap, claves MFA, datos reales o destinos internos nuevos al manual público. Usar marcadores genéricos y conservar los parámetros reales en copias privadas de despliegue.
