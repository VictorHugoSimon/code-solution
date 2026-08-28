-- Code Solution admin credential reset — 2026-08-28 owner-approved final chat access
-- Plaintext password is NOT stored in the repository. Only PBKDF2-SHA256 output + random salt.

UPDATE panel_users
SET
  display_name = 'Administrador Code Solution',
  role = 'admin',
  active = 1,
  password_hash = '323e04d6cd5108d8d8ca31fcc2ae4ba235c4be493a88658a96a63cecfba2b4cd',
  password_salt = '9d88c6c71b984a81a3a4f054606f206a4d691ca6e95af5f3',
  password_iterations = 180000,
  session_version = COALESCE(session_version, 0) + 1,
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
WHERE username = 'admin' COLLATE NOCASE
  AND NOT EXISTS (
    SELECT 1 FROM panel_audit_log
    WHERE action = 'admin_password_reset_2026_08_28_owner_chat_final_v2'
  );

UPDATE panel_sessions
SET revoked_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
WHERE user_id = (
    SELECT id FROM panel_users WHERE username = 'admin' COLLATE NOCASE LIMIT 1
  )
  AND revoked_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM panel_audit_log
    WHERE action = 'admin_password_reset_2026_08_28_owner_chat_final_v2'
  );

INSERT INTO panel_audit_log
  (id, user_id, username, action, target_type, target_id, metadata_json, created_at)
SELECT
  lower(hex(randomblob(16))),
  id,
  username,
  'admin_password_reset_2026_08_28_owner_chat_final_v2',
  'panel_user',
  id,
  '{"reason":"owner-approved-final-chat-login-reset-v2","passwordStorage":"pbkdf2-sha256","plaintextStored":false,"sessionsRevoked":true}',
  strftime('%Y-%m-%dT%H:%M:%fZ','now')
FROM panel_users
WHERE username = 'admin' COLLATE NOCASE
  AND NOT EXISTS (
    SELECT 1 FROM panel_audit_log
    WHERE action = 'admin_password_reset_2026_08_28_owner_chat_final_v2'
  );
