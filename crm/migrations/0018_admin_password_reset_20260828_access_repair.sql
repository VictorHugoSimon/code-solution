-- Code Solution admin credential reset — 2026-08-28 owner-approved access repair
-- Plaintext password is NOT stored in the repository. Only PBKDF2-SHA256 output + random salt.

UPDATE panel_users
SET
  display_name = 'Administrador Code Solution',
  role = 'admin',
  active = 1,
  password_hash = '3cd8f2657efa1ba416d383bc8ee0bc8edbdd2be58c85c6f8db8225261878c1da',
  password_salt = '61fe1a006d77a763e2ee09fceaed3ce93e380c7dea9aa638',
  password_iterations = 180000,
  session_version = COALESCE(session_version, 0) + 1,
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
WHERE username = 'admin' COLLATE NOCASE
  AND NOT EXISTS (
    SELECT 1 FROM panel_audit_log
    WHERE action = 'admin_password_reset_2026_08_28_owner_access_repair_v3'
  );

UPDATE panel_sessions
SET revoked_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
WHERE user_id = (
    SELECT id FROM panel_users WHERE username = 'admin' COLLATE NOCASE LIMIT 1
  )
  AND revoked_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM panel_audit_log
    WHERE action = 'admin_password_reset_2026_08_28_owner_access_repair_v3'
  );

INSERT INTO panel_audit_log
  (id, user_id, username, action, target_type, target_id, metadata_json, created_at)
SELECT
  lower(hex(randomblob(16))),
  id,
  username,
  'admin_password_reset_2026_08_28_owner_access_repair_v3',
  'panel_user',
  id,
  '{"reason":"owner-approved-access-repair-v3","passwordStorage":"pbkdf2-sha256","plaintextStored":false,"sessionsRevoked":true}',
  strftime('%Y-%m-%dT%H:%M:%fZ','now')
FROM panel_users
WHERE username = 'admin' COLLATE NOCASE
  AND NOT EXISTS (
    SELECT 1 FROM panel_audit_log
    WHERE action = 'admin_password_reset_2026_08_28_owner_access_repair_v3'
  );
