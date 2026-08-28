-- Code Solution admin credential rotation — 2026-08-28
-- Owner-approved reset to establish a known human credential after access troubleshooting.
-- Plaintext password is NOT stored here; only PBKDF2-SHA256 output + random salt.

UPDATE panel_users
SET
  display_name = 'Administrador Code Solution',
  role = 'admin',
  active = 1,
  password_hash = 'eb7d53ed5cccca89ad6bb4c4000d495e0d0af6dafb107cf362daa0fa0bb21227',
  password_salt = 'fce8272cbe2fda5297f3bc240cfaba5dc719e8abed1f2221',
  password_iterations = 180000,
  session_version = COALESCE(session_version, 0) + 1,
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
WHERE username = 'admin' COLLATE NOCASE
  AND NOT EXISTS (
    SELECT 1 FROM panel_audit_log
    WHERE action = 'admin_password_rotation_2026_08_28_owner_approved'
  );

UPDATE panel_sessions
SET revoked_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
WHERE user_id = (
    SELECT id FROM panel_users WHERE username = 'admin' COLLATE NOCASE LIMIT 1
  )
  AND revoked_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM panel_audit_log
    WHERE action = 'admin_password_rotation_2026_08_28_owner_approved'
  );

INSERT INTO panel_audit_log
  (id, user_id, username, action, target_type, target_id, metadata_json, created_at)
SELECT
  lower(hex(randomblob(16))),
  id,
  username,
  'admin_password_rotation_2026_08_28_owner_approved',
  'panel_user',
  id,
  '{"reason":"owner-approved-known-human-credential","passwordStorage":"pbkdf2-sha256","plaintextStored":false}',
  strftime('%Y-%m-%dT%H:%M:%fZ','now')
FROM panel_users
WHERE username = 'admin' COLLATE NOCASE
  AND NOT EXISTS (
    SELECT 1 FROM panel_audit_log
    WHERE action = 'admin_password_rotation_2026_08_28_owner_approved'
  );
