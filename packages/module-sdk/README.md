# SDK de integración v1 (contrato inicial)
Cada módulo tiene frontend, backend, migraciones, pruebas y propietario independientes.
No puede importar repositorios privados del núcleo ni escribir tablas core.
Las APIs reciben la identidad resuelta por un guard de servidor, exigen permiso y alcance del recurso; nunca aceptan roles de la petición.
El catálogo usa module.enabled + published + required_permission. Registrar una ruta NO instala código.
El mapa de importaciones lazy se construye con artefactos revisados. Rutas fuera del mapa no se ejecutan.
El asistente ZIP admite únicamente el descriptor de un módulo incluido. Firma, SBOM, ejecución de migraciones de negocio y despliegue de código externo siguen pendientes; no existe endpoint de ejecución de paquetes.

Primera entrega operativa: el formato separado hub-builtin-v1 permite activar únicamente CORTA_CUOTAS 1.0.0 ya compilado. El manifiesto se compara íntegramente con el registro backend; no ejecuta paquetes ni concede permisos. Ver manual-instalacion/10-modulos.md. No confundir la huella del descriptor con firma de artefacto.
