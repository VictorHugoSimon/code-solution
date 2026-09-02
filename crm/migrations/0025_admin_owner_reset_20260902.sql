-- Code Solution CRM owner credential — 2026-09-02
-- Owner-approved permanent credential alignment after CRM access recovery.
-- Plaintext password is NOT stored; only PBKDF2-SHA256 output + random salt.
-- Username: admin. Password material: PBKDF2-SHA256, 100000 iterations.

UPDATE panel_users
SET
  display_name = 'Administrador Code Solution',
  role = 'admin',
  active = 1,
  password_hash = '9b00c178651e9b2e185a5bc0464697b320fe3fda93a7d0e5ef6344c5e5dc39fb',
  password_salt = 'f85a61ab3771b8fb428b29f0caf26f1e5e5aee44dc367b9d',
  password_iterations = 100000,
  session_version = COALESCE(session_version, 0) + 1,
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
WHERE username = 'admin' COLLATE NOCASE
  AND NOT EXISTS (
    SELECT 1 FROM panel_audit_log
    WHERE action = 'admin_owner_password_reset_2026_09_02'
  );

UPDATE panel_sessions
SET revoked_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
WHERE user_id = (
    SELECT id FROM panel_users WHERE username = 'admin' COLLATE NOCASE LIMIT 1
  )
  AND revoked_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM panel_audit_log
    WHERE action = 'admin_owner_password_reset_2026_09_02'
  );

INSERT INTO panel_audit_log
  (id, user_id, username, action, target_type, target_id, metadata_json, created_at)
SELECT lower(hex(randomblob(16))), id, username,
  'admin_owner_password_reset_2026_09_02',
  'panel_user', id,
  '{"reason":"owner-approved-final-crm-access","iterations":100000,"plaintextStored":false,"sessionsRevoked":true}',
  strftime('%Y-%m-%dT%H:%M:%fZ','now')
FROM panel_users
WHERE username = 'admin' COLLATE NOCASE
  AND NOT EXISTS (
    SELECT 1 FROM panel_audit_log
    WHERE action = 'admin_owner_password_reset_2026_09_02'
  );
