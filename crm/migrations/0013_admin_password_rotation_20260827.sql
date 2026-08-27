-- Code Solution admin credential rotation — 2026-08-27
-- Owner-approved reset after login access troubleshooting.
-- Plaintext password is NOT stored here; only PBKDF2-SHA256 output + random salt.

UPDATE panel_users
SET
  display_name = 'Administrador Code Solution',
  role = 'admin',
  active = 1,
  password_hash = 'cff8e7c602d8fc4057f8726f677e2bd2425d25477bec7929c1283d7546437269',
  password_salt = 'fa516c0b7656ed3f16fc0a2043e3ee63b247dc5da33e2023',
  password_iterations = 180000,
  session_version = COALESCE(session_version, 0) + 1,
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
WHERE username = 'admin' COLLATE NOCASE
  AND NOT EXISTS (
    SELECT 1 FROM panel_audit_log
    WHERE action = 'admin_password_rotation_2026_08_27_owner_approved'
  );

UPDATE panel_sessions
SET revoked_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
WHERE user_id = (
    SELECT id FROM panel_users WHERE username = 'admin' COLLATE NOCASE LIMIT 1
  )
  AND revoked_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM panel_audit_log
    WHERE action = 'admin_password_rotation_2026_08_27_owner_approved'
  );

INSERT INTO panel_audit_log
  (id, user_id, username, action, target_type, target_id, metadata_json, created_at)
SELECT
  lower(hex(randomblob(16))),
  id,
  username,
  'admin_password_rotation_2026_08_27_owner_approved',
  'panel_user',
  id,
  '{"reason":"owner-approved-login-access-reset","passwordStorage":"pbkdf2-sha256","plaintextStored":false}',
  strftime('%Y-%m-%dT%H:%M:%fZ','now')
FROM panel_users
WHERE username = 'admin' COLLATE NOCASE
  AND NOT EXISTS (
    SELECT 1 FROM panel_audit_log
    WHERE action = 'admin_password_rotation_2026_08_27_owner_approved'
  );
