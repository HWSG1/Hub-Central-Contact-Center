# STRIDE — modelo inicial
Activos: identidades, credenciales, sesiones, asignaciones RBAC, auditoría, catálogo y futuros datos bancarios.
Límites de confianza: navegador/API, IIS/backend, backend/SQL, IdP/backend, paquete/pipeline y núcleo/módulo.
| Amenaza | Escenario | Mitigación actual / pendiente |
|---|---|---|
| Suplantación | Cookie robada, identidad externa por correo | Cookie HttpOnly/Secure producción, hash SQL, PKCE/state/nonce y issuer+subject; MFA IdP para administrador |
| Manipulación | SQL injection, permisos del navegador, paquete adulterado | Parámetros SQL, RBAC servidor, DTO sin propiedades extra; ZIP no habilitado, firma pendiente |
| Repudio | Modificar bitácora | Auditoría SQL; rol runtime denegado UPDATE/DELETE; SIEM y WORM pendientes |
| Divulgación | CDN, tokens persistidos, secretos expuestos | Recursos locales, no localStorage, respuestas no-store, TLS SQL obligatorio; gestión corporativa de secretos pendiente |
| Denegación | Brute force, cuerpo enorme, pool saturado | Rate limit, bloqueo por cuenta, 16 KB y timeout SQL; limitador distribuido y pruebas carga pendientes |
| Elevación | Cambiar propios roles, IDOR, ejecutar ZIP | Sin API de asignaciones ni ejecución; permisos explícitos reevaluados; validación de alcances por módulo pendiente |
Riesgos residuales: compromiso del host/IdP, robo de sesión por dispositivo comprometido, personal privilegiado SQL, librerías vulnerables. No es una certificación ni autorización de producción.
