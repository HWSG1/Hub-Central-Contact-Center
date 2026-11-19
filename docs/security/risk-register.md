# Riesgos y decisiones pendientes
| Prioridad | Riesgo / dependencia | Acción / responsable |
|---|---|---|
| Alta | SQL TLS no confiable | Infraestructura configura certificado/CA y nombre DNS; validar cifrado antes de migrar |
| Alta | Sin tenant/IdP configurado | Infraestructura entrega issuer, client, callback y política MFA; probar Code+PKCE |
| Alta | MFA local y recuperación no implementados | Desarrollo fase 2; login deniega require_mfa/must_change_password |
| Alta | Administración RBAC no implementada | Desarrollo fase 2, segregación de funciones y reautenticación |
| Alta | Instalador de módulos no implementado | Mantenerlo no disponible hasta cuarentena, firma y pipeline |
| Alta | Sin validación SQL/IdP de extremo a extremo | Pruebas integración tras resolver infraestructura; no UAT bancario antes |
| Media | Límites en memoria por proceso | IIS controla por IP; Redis/servicio distribuido al escalar |
| Media | Revocación de identidad corporativa no inmediata | Definir back-channel/revalidación con Seguridad |
| Media | Matriz ASVS no mapeada a todos los requisitos individuales | Revisión humana y pruebas de seguridad fase 5 |
| Media | Plantilla de servicio sin cuenta asignada | Configurar gMSA/cuenta mínima antes de instalar; jamás LocalSystem predeterminado |

Alta: picomatch <=4.0.7 afecta tooling de desarrollo; npm audit reporta 11 dependencias altas, sin parche publicado. Compilar sólo código confiable, no exponer dev server y actualizar cuando exista corrección. Producción auditada sin alertas conocidas.
