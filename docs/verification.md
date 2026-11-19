> Registro histórico de verificaciones. Para estado y procedimiento vigentes, ver [manual e historial](../manual-instalacion/08-historial.md). Los bloqueos iniciales que siguen no describen necesariamente el entorno actual.

# Contact Center Hub — entrega inicial

Ubicación: E:\Odair\Proyectos Personales\Angular\contact-center-hub

## Implementado
- Monorepo Angular 22.2.6 / herramientas 22.2.7, NestJS 12.5.1 y TypeScript 6 estricto.
- Login premium con partículas, movimiento reducido, mostrar contraseña, estados reales y recursos locales.
- Layout responsive, modo oscuro, catálogo autorizado y vistas iniciales de módulos/auditoría.
- Sesiones opacas SQL, CSRF, guard RBAC global, Argon2id y adaptador OIDC Code+PKCE.
- Migraciones, bootstrap corporativo por CLI sin credenciales predeterminadas, contrato inicial de módulos, OpenAPI sin endpoint público, documentación IIS/servicio Windows.
- Arquitectura/ADR, ER, STRIDE, matriz de seguridad y registro de riesgos.

## Verificado
- Compilación Angular de producción: correcta; 284.61 kB iniciales, carga diferida por pantalla.
- Compilación TypeScript API y arranque NestJS: correctos.
- 18 pruebas automatizadas: 18 aprobadas. Usan dobles de persistencia; no sustituyen integración SQL.
- HTTP real: providers 200; auth/me, catálogo, módulos y auditoría sin sesión 401; origen falso 403; rol inyectado al DTO 400; frontend 200.
- Login revisado en navegador; control mostrar contraseña funcional; ancho móvil sin desbordamiento horizontal. Portal autenticado no inspeccionado visualmente porque no existe identidad provisionada.
- npm audit --omit=dev: cero vulnerabilidades reportadas.
- npm audit completo: 11 dependencias de desarrollo con severidad alta por picomatch <=4.0.7 (GHSA-fc5q-39xc-vjpf). La versión más reciente disponible es 4.0.7; pendiente corrección upstream. No se aplicó la sugerencia de degradar Angular a una versión obsoleta.

## Bloqueos reales
SQLEXPRESS01 responde por TCP 14331, pero su cadena de certificado no es confiable. sqlcmd cifrado y el migrador del proyecto fallan al validar TLS. No se creó ContactCenterHub_Dev ni se aplicaron migraciones. Configurar CA/certificado y DNS según docs/deployment/windows.md.
Faltan issuer, client ID, secreto, callback y política MFA corporativos. No hay usuario inicial ni acceso simulado.

## Alcance pendiente
Es una implementación inicial de fases 0 y 1, no la plataforma completa. Integración SQL/IdP, administración de usuarios/roles, MFA local, recuperación, validación/cuarentena de paquetes, firma, pipeline, SIEM y UAT pendientes. El contrato JSON Schema aún no está conectado a un importador. No se conectó SAP HANA ni se desplegó producción.

## Inicio
Usar Node 24 LTS >=24.15. En la carpeta del proyecto: npm ci; revisar .env; resolver SQL/TLS; ejecutar scripts/create-database.sql contra desarrollo y npm run db:migrate; configurar OIDC y aprovisionar identidad según docs/security/authentication.md.
En dos terminales: npm run start:api y npm run start:web. Abrir http://localhost:4200.
El .env de desarrollo habilita el formulario local para inspección, pero no contiene contraseñas ni usuarios. .env.example deja ese proveedor apagado por defecto. No hay credenciales con las cuales entrar hasta aprovisionar una identidad autorizada.

## Referencias técnicas
https://angular.dev/reference/versions
https://docs.nestjs.com/faq/versions
https://github.com/advisories/GHSA-fc5q-39xc-vjpf
