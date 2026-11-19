SET XACT_ABORT ON;
ALTER TABLE core.local_credentials ADD mfa_secret_cipher nvarchar(512) NULL,mfa_last_counter bigint NULL;
GRANT UPDATE(password_hash,mfa_last_counter) ON core.local_credentials TO hub_runtime;
GRANT UPDATE(must_change_password) ON core.users TO hub_runtime;
