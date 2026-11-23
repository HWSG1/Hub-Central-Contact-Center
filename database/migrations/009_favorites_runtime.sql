-- Allow the authenticated Hub API to persist application shortcuts per user.
-- The API verifies that each application is published and authorized before writing.
GRANT INSERT, DELETE ON OBJECT::core.user_favorites TO hub_runtime;
