SET XACT_ABORT ON;
INSERT core.permissions(code) VALUES('CORE.MODULES.MANAGE'),('CORTA_CUOTAS.USE');
-- Explicit installer grant; importing a descriptor never grants permissions.
INSERT core.role_permissions(role_id,permission_id)
SELECT r.id,p.id FROM core.roles r CROSS JOIN core.permissions p
WHERE r.code='PLATFORM_ADMIN' AND p.code IN ('CORE.MODULES.MANAGE','CORTA_CUOTAS.USE');
GRANT INSERT ON core.modules TO hub_runtime;
GRANT UPDATE(enabled) ON core.modules TO hub_runtime;
GRANT INSERT ON core.module_versions TO hub_runtime;
GRANT INSERT ON core.module_installations TO hub_runtime;
GRANT UPDATE(state) ON core.module_installations TO hub_runtime;
GRANT INSERT ON core.application_catalog TO hub_runtime;
GRANT UPDATE(published) ON core.application_catalog TO hub_runtime;
