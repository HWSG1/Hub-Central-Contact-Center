> Instalación vigente: [manual central](../../manual-instalacion/README.md). Las referencias a instaladores separados y evidencias de bloqueo siguientes son históricas; para ejecutar SQL usar el consolidado del manual.

# Desarrollo y despliegue Windows
## SQL Server
Instancia solicitada: SQLEXPRESS01. Registro local: MSSQL16.SQLEXPRESS01, TCP 14331. La conexión cifrada a localhost:14331 respondió con cadena de certificación no confiable. No se creó ni modificó una base.
Configurar certificado emitido por CA confiable en SQL Server Configuration Manager; incluir nombre DNS del servidor en SAN, conceder lectura de clave privada a la cuenta SQL, reiniciar servicio en ventana autorizada e instalar cadena CA pública en el almacén apropiado del equipo cliente. No distribuir claves privadas. Usar SQL_SERVER con el DNS del certificado y SQL_PORT=14331. No activar TrustServerCertificate.
Validar: sqlcmd -S tcp:NOMBRE_DNS,14331 -E -N -Q "SELECT SERVERPROPERTY('ProductVersion')".
Ejecutar scripts/create-database.sql únicamente contra desarrollo con cuenta instaladora; después npm run db:migrate. El migrador necesita DDL, el backend sólo rol hub_runtime. Crear login Windows para la cuenta de servicio, usuario de base y pertenencia a hub_runtime. Nunca db_owner para runtime.
## Inicio local
Instalar Node 24 LTS >=24.15 y npm. npm ci. Copiar .env.example a .env, ajustar SQL/TLS e IdP. npm run db:migrate, npm test y npm run build. Terminal 1: npm run start:api. Terminal 2: npm run start:web. Abrir http://localhost:4200. Las dos aplicaciones usan el mismo origen mediante proxy. No hay login de demostración.
## IIS
Compilar, copiar dist/web/browser e infrastructure/iis/web.config a la carpeta del sitio. Instalar URL Rewrite y ARR, habilitar proxy y preservar Host y Origin. Restringir bindings a DNS corporativo. Eliminar encabezados de identidad del cliente en el proxy; la API no confía en ellos ni habilita trust proxy. Configurar límites en IIS y rate limiting por cliente allí (la API verá loopback y aplica un límite agregado).
TLS corporativo obligatorio; revisar CSP de Angular autoCsp y no introducir CDN. Probar deep links, callback, encabezados y cookies Secure con NODE_ENV=production.
## Servicio
Usar WinSW aprobado por Infraestructura. XML de ejemplo no instala nada. Configurar una cuenta de servicio dedicada/gMSA con permisos mínimos antes de instalar; no LocalSystem ni administrador. Runtime sólo lectura a código y acceso a secretos protegido por ACL; logs rotados en directorio específico. Backend escucha 127.0.0.1.
## Operación
Separar secretos de despliegue y runtime. Rotar secretos OIDC/SQL mediante gestor corporativo y reiniciar el servicio; revocar sesiones si hay incidente. Programar backup full/diferencial/log conforme al recovery model, cifrar copias, verificar restauración aislada y retención. SQL Express no dispone de SQL Agent: usar planificador aprobado. Definir RPO/RTO con negocio.
Monitorear disponibilidad, latencia, errores y auditoría mediante SIEM; no loguear cookies/contraseñas. Integración SIEM y alertas pendiente.
Escalado: múltiples BFF con sesiones SQL compartidas, limitador distribuido y balanceo; frontend estático por IIS; servicios de módulos separados y privilegios independientes. Probar carga antes de definir capacidad.
No desplegar a producción con los pendientes de docs/security/controls.md.
