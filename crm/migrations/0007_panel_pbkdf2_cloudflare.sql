PRAGMA foreign_keys = ON;

-- One-time Cloudflare PBKDF2 credential repair for the built-in administrator.
-- The plaintext password is never stored in this repository; only PBKDF2-SHA256 material is persisted.
-- A durable audit marker prevents future deploys from rotating the password or revoking sessions again.
UPDATE panel_users
SET password_hash='eac2782ac6c06dc7c1ecb6138a4ff0ea167ad46e59d431a0c80befda8e55186a',
    password_salt='797f0126bf89b86b75f0f9572ce99938d99b056df15b72cb',
    password_iterations=100000,
    role='admin',
    active=1,
    session_version=session_version+1,
    updated_at=datetime('now')
WHERE username='admin' COLLATE NOCASE
  AND NOT EXISTS (
    SELECT 1 FROM panel_audit_log WHERE action='panel_pbkdf2_v2_applied'
  );

UPDATE panel_sessions
SET revoked_at=datetime('now')
WHERE user_id=(SELECT id FROM panel_users WHERE username='admin' COLLATE NOCASE)
  AND revoked_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM panel_audit_log WHERE action='panel_pbkdf2_v2_applied'
  );

INSERT OR IGNORE INTO panel_audit_log (
  id,user_id,username,action,target_type,target_id,metadata_json,created_at
)
SELECT
  'migration-0007-panel-pbkdf2-v2',
  id,
  username,
  'panel_pbkdf2_v2_applied',
  'panel_user',
  id,
  '{"reason":"one_time_admin_credential_repair","iterations":100000}',
  datetime('now')
FROM panel_users
WHERE username='admin' COLLATE NOCASE
  AND NOT EXISTS (
    SELECT 1 FROM panel_audit_log WHERE action='panel_pbkdf2_v2_applied'
  );
