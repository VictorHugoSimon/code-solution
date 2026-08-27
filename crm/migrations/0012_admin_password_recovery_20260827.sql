-- Code Solution admin credential recovery — 2026-08-27
-- Idempotent: runs only while the recovery audit marker does not exist.
-- The plaintext password is never stored here; only PBKDF2-SHA256 output + random salt.

UPDATE panel_users
SET
  password_hash = '0bb24640189f69d679f0fec175b1ab330d527967aaead745a51b37522814e5d9',
  password_salt = '3d42e741710b688905e983cd33ff92e31a813a46efbc7647',
  password_iterations = 100000,
  active = 1,
  role = 'admin',
  session_version = COALESCE(session_version, 0) + 1,
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
WHERE username = 'admin' COLLATE NOCASE
  AND NOT EXISTS (
    SELECT 1 FROM panel_audit_log
    WHERE action = 'admin_password_recovery_persisted_2026_08_27'
  );

UPDATE panel_sessions
SET revoked_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
WHERE user_id = (
    SELECT id FROM panel_users WHERE username = 'admin' COLLATE NOCASE LIMIT 1
  )
  AND revoked_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM panel_audit_log
    WHERE action = 'admin_password_recovery_persisted_2026_08_27'
  );

INSERT INTO panel_audit_log
  (id, user_id, username, action, target_type, target_id, metadata_json, created_at)
SELECT
  lower(hex(randomblob(16))),
  id,
  username,
  'admin_password_recovery_persisted_2026_08_27',
  'panel_user',
  id,
  '{"reason":"owner-approved-credential-recovery","passwordStorage":"pbkdf2-sha256","plaintextStored":false,"oneTime":true}',
  strftime('%Y-%m-%dT%H:%M:%fZ','now')
FROM panel_users
WHERE username = 'admin' COLLATE NOCASE
  AND NOT EXISTS (
    SELECT 1 FROM panel_audit_log
    WHERE action = 'admin_password_recovery_persisted_2026_08_27'
  );
