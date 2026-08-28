-- Code Solution admin access reset — 2026-08-28
-- Owner-approved known credential for immediate CRM access recovery.
-- Plaintext password is intentionally NOT stored in the repository; only PBKDF2-SHA256 output + random salt.

UPDATE panel_users
SET
  display_name = 'Administrador Code Solution',
  role = 'admin',
  active = 1,
  password_hash = 'ebb489ad99928c9632444a6f5d8c7e783ca54242baebe4044c04972c9f5e1a5d',
  password_salt = '1e97d54ce17d7a92bfe9d8b7cf70e03502febbdb005b0951',
  password_iterations = 180000,
  session_version = COALESCE(session_version, 0) + 1,
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
WHERE username = 'admin' COLLATE NOCASE
  AND NOT EXISTS (
    SELECT 1 FROM panel_audit_log
    WHERE action = 'admin_password_reset_2026_08_28_chat_approved'
  );

UPDATE panel_sessions
SET revoked_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
WHERE user_id = (
    SELECT id FROM panel_users WHERE username = 'admin' COLLATE NOCASE LIMIT 1
  )
  AND revoked_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM panel_audit_log
    WHERE action = 'admin_password_reset_2026_08_28_chat_approved'
  );

INSERT INTO panel_audit_log
  (id, user_id, username, action, target_type, target_id, metadata_json, created_at)
SELECT
  lower(hex(randomblob(16))),
  id,
  username,
  'admin_password_reset_2026_08_28_chat_approved',
  'panel_user',
  id,
  '{"reason":"owner-approved-immediate-access-recovery","passwordStorage":"pbkdf2-sha256","plaintextStored":false,"sessionsRevoked":true}',
  strftime('%Y-%m-%dT%H:%M:%fZ','now')
FROM panel_users
WHERE username = 'admin' COLLATE NOCASE
  AND NOT EXISTS (
    SELECT 1 FROM panel_audit_log
    WHERE action = 'admin_password_reset_2026_08_28_chat_approved'
  );
