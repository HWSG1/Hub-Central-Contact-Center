# SDK de integración v1 (contrato inicial)
Cada módulo tiene frontend, backend, migraciones, pruebas y propietario independientes.
No puede importar repositorios privados del núcleo ni escribir tablas core.
Las APIs reciben la identidad resuelta por un guard de servidor, exigen permiso y alcance del recurso; nunca aceptan roles de la petición.
El catálogo usa module.enabled + published + required_permission. Registrar una ruta NO instala código.
El mapa de importaciones lazy se construye con artefactos revisados. Rutas fuera del mapa no se ejecutan.
Importación ZIP, firma, SBOM y pipeline pendientes: no existe endpoint de ejecución ni instalación automática.
