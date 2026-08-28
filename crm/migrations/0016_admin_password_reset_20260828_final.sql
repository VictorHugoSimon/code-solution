-- Code Solution admin credential reset — 2026-08-28 final access recovery
-- Owner-approved reset to a known credential shared only in the private chat.
-- Plaintext password is NOT stored in the repository; only PBKDF2-SHA256 output + random salt.

UPDATE panel_users
SET
  display_name = 'Administrador Code Solution',
  role = 'admin',
  active = 1,
  password_hash = 'e817524747ef2caa789b7eb0faeff1b4597301b4bd82e6810631d6ec61bb9624',
  password_salt = '61e351df07768c9ac3ac1d110548116fd7f77ac22f878783',
  password_iterations = 180000,
  session_version = COALESCE(session_version, 0) + 1,
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
WHERE username = 'admin' COLLATE NOCASE
  AND NOT EXISTS (
    SELECT 1 FROM panel_audit_log
    WHERE action = 'admin_password_reset_2026_08_28_final_chat_approved'
  );

UPDATE panel_sessions
SET revoked_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
WHERE user_id = (
    SELECT id FROM panel_users WHERE username = 'admin' COLLATE NOCASE LIMIT 1
  )
  AND revoked_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM panel_audit_log
    WHERE action = 'admin_password_reset_2026_08_28_final_chat_approved'
  );

INSERT INTO panel_audit_log
  (id, user_id, username, action, target_type, target_id, metadata_json, created_at)
SELECT
  lower(hex(randomblob(16))),
  id,
  username,
  'admin_password_reset_2026_08_28_final_chat_approved',
  'panel_user',
  id,
  '{"reason":"owner-approved-final-login-access-reset","passwordStorage":"pbkdf2-sha256","plaintextStored":false,"sessionsRevoked":true}',
  strftime('%Y-%m-%dT%H:%M:%fZ','now')
FROM panel_users
WHERE username = 'admin' COLLATE NOCASE
  AND NOT EXISTS (
    SELECT 1 FROM panel_audit_log
    WHERE action = 'admin_password_reset_2026_08_28_final_chat_approved'
  );
