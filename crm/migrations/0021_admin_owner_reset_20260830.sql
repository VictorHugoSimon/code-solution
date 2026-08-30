-- Code Solution CRM owner password reset — 2026-08-30
-- Owner-approved reset. Plaintext password is NOT stored in GitHub or D1.
-- Only PBKDF2-SHA256 output and a random 24-byte salt are persisted.

UPDATE panel_users
SET
  display_name = 'Administrador Code Solution',
  role = 'admin',
  active = 1,
  password_hash = 'ea0c6caf954038189ab247e90ffb8abaa9b1e48142496062089da96e4999a820',
  password_salt = 'c90e7492d8d831af71894c74c1dd80ef9d0980524ebfd6b8',
  password_iterations = 100000,
  session_version = COALESCE(session_version, 0) + 1,
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
WHERE username = 'admin' COLLATE NOCASE
  AND NOT EXISTS (
    SELECT 1 FROM panel_audit_log
    WHERE action = 'admin_owner_password_reset_2026_08_30'
  );

UPDATE panel_sessions
SET revoked_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
WHERE user_id = (
    SELECT id FROM panel_users WHERE username = 'admin' COLLATE NOCASE LIMIT 1
  )
  AND revoked_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM panel_audit_log
    WHERE action = 'admin_owner_password_reset_2026_08_30'
  );

INSERT INTO panel_audit_log
  (id, user_id, username, action, target_type, target_id, metadata_json, created_at)
SELECT lower(hex(randomblob(16))), id, username,
  'admin_owner_password_reset_2026_08_30',
  'panel_user', id,
  '{"reason":"owner-approved-reset","iterations":100000,"plaintextStored":false,"sessionsRevoked":true}',
  strftime('%Y-%m-%dT%H:%M:%fZ','now')
FROM panel_users
WHERE username = 'admin' COLLATE NOCASE
  AND NOT EXISTS (
    SELECT 1 FROM panel_audit_log
    WHERE action = 'admin_owner_password_reset_2026_08_30'
  );
