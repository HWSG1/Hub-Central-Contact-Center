SET XACT_ABORT ON;
ALTER TABLE core.roles ADD enabled bit NOT NULL CONSTRAINT df_roles_enabled DEFAULT 1,description nvarchar(500) NOT NULL CONSTRAINT df_roles_description DEFAULT N'',version int NOT NULL CONSTRAINT df_roles_version DEFAULT 1;
ALTER TABLE core.users ADD security_version int NOT NULL CONSTRAINT df_users_security_version DEFAULT 1;
ALTER TABLE core.audit_events ADD resource_type varchar(30) NULL,resource_id uniqueidentifier NULL,details nvarchar(max) NULL CONSTRAINT ck_audit_details CHECK(details IS NULL OR ISJSON(details)=1);
INSERT core.permissions(code) VALUES('CORE.ROLES.MANAGE'),('CORE.PERMISSIONS.ASSIGN'),('CORE.USERS.UPDATE'),('CORE.USERS.DISABLE'),('CORE.USERS.ROLES_ASSIGN');
-- Explicit migration grant to the seeded platform administrator role. Runtime uses permissions, never the role name.
INSERT core.role_permissions(role_id,permission_id)
SELECT r.id,p.id FROM core.roles r CROSS JOIN core.permissions p
WHERE r.code='PLATFORM_ADMIN' AND p.code IN ('CORE.ROLES.MANAGE','CORE.PERMISSIONS.ASSIGN','CORE.USERS.UPDATE','CORE.USERS.DISABLE','CORE.USERS.ROLES_ASSIGN');
GRANT INSERT ON core.roles TO hub_runtime;
GRANT UPDATE(name,description,enabled,version) ON core.roles TO hub_runtime;
GRANT INSERT,DELETE ON core.role_permissions TO hub_runtime;
GRANT INSERT,DELETE ON core.user_roles TO hub_runtime;
GRANT UPDATE(enabled,security_version) ON core.users TO hub_runtime;
CREATE INDEX ix_user_roles_role ON core.user_roles(role_id,user_id);
CREATE INDEX ix_role_permissions_permission ON core.role_permissions(permission_id,role_id);
