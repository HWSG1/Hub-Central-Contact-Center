SET XACT_ABORT ON;
CREATE TABLE core.user_invitations(
 user_id uniqueidentifier NOT NULL PRIMARY KEY REFERENCES core.users(id),
 login nvarchar(128) NOT NULL UNIQUE,
 token_hash char(64) NOT NULL UNIQUE,
 mfa_secret_cipher varchar(512) NOT NULL,
 expires_at datetime2 NOT NULL,
 consumed_at datetime2 NULL,
 attempts int NOT NULL DEFAULT 0 CHECK(attempts BETWEEN 0 AND 5)
);
INSERT core.permissions(code) VALUES('CORE.USERS.CREATE');
INSERT core.role_permissions(role_id,permission_id)
 SELECT r.id,p.id FROM core.roles r CROSS JOIN core.permissions p WHERE r.code='PLATFORM_ADMIN' AND p.code='CORE.USERS.CREATE';
GRANT INSERT ON core.users TO hub_runtime;
GRANT INSERT ON core.local_credentials TO hub_runtime;
GRANT SELECT,INSERT,UPDATE ON core.user_invitations TO hub_runtime;
