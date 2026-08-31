-- Code Solution CRM owner password reset — 2026-08-31
-- Owner-approved reset. Plaintext password is NOT stored in GitHub or D1.
-- PBKDF2-SHA256, 100000 iterations, random 24-byte salt.

UPDATE panel_users
SET
  display_name = 'Administrador Code Solution',
  role = 'admin',
  active = 1,
  password_hash = 'a89529e67346667168389174979ba451a28b114feacdb1f70c6f55f4b3802527',
  password_salt = 'f70ea157fdaa5fc27859f6b001781d1b82211e631c309ce1',
  password_iterations = 100000,
  session_version = COALESCE(session_version, 0) + 1,
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
WHERE username = 'admin' COLLATE NOCASE
  AND NOT EXISTS (
    SELECT 1 FROM panel_audit_log
    WHERE action = 'admin_owner_password_reset_2026_08_31'
  );

UPDATE panel_sessions
SET revoked_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
WHERE user_id = (
    SELECT id FROM panel_users WHERE username = 'admin' COLLATE NOCASE LIMIT 1
  )
  AND revoked_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM panel_audit_log
    WHERE action = 'admin_owner_password_reset_2026_08_31'
  );

INSERT INTO panel_audit_log
  (id, user_id, username, action, target_type, target_id, metadata_json, created_at)
SELECT lower(hex(randomblob(16))), id, username,
  'admin_owner_password_reset_2026_08_31',
  'panel_user', id,
  '{"reason":"owner-approved-reset","iterations":100000,"plaintextStored":false,"sessionsRevoked":true}',
  strftime('%Y-%m-%dT%H:%M:%fZ','now')
FROM panel_users
WHERE username = 'admin' COLLATE NOCASE
  AND NOT EXISTS (
    SELECT 1 FROM panel_audit_log
    WHERE action = 'admin_owner_password_reset_2026_08_31'
  );
