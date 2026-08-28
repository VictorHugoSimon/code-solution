-- Code Solution admin authentication compatibility fix — 2026-08-28
-- Cloudflare Workers currently caps WebCrypto PBKDF2 at 100,000 iterations.
-- Keep the canonical human password unchanged; only its derived PBKDF2 parameters are adjusted.
-- Plaintext password is never stored in the repository.

UPDATE panel_users
SET
  password_hash = 'ccc9c7dedecefee78730672a6e38348e003f8f4abfb03f83a2e224c7f0eb37ef',
  password_salt = 'e3e89491fc5b66a11325c4aef6d81eedd84387ea1ca2250c',
  password_iterations = 100000,
  active = 1,
  role = 'admin',
  session_version = COALESCE(session_version, 0) + 1,
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
WHERE username = 'admin' COLLATE NOCASE
  AND NOT EXISTS (
    SELECT 1 FROM panel_audit_log
    WHERE action = 'admin_cloudflare_pbkdf2_100k_2026_08_28'
  );

UPDATE panel_sessions
SET revoked_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
WHERE user_id = (
    SELECT id FROM panel_users WHERE username = 'admin' COLLATE NOCASE LIMIT 1
  )
  AND revoked_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM panel_audit_log
    WHERE action = 'admin_cloudflare_pbkdf2_100k_2026_08_28'
  );

INSERT INTO panel_audit_log
  (id, user_id, username, action, target_type, target_id, metadata_json, created_at)
SELECT lower(hex(randomblob(16))), id, username,
  'admin_cloudflare_pbkdf2_100k_2026_08_28',
  'panel_user', id,
  '{"reason":"cloudflare-pbkdf2-runtime-limit","iterations":100000,"plaintextStored":false,"sessionsRevoked":true}',
  strftime('%Y-%m-%dT%H:%M:%fZ','now')
FROM panel_users
WHERE username = 'admin' COLLATE NOCASE
  AND NOT EXISTS (
    SELECT 1 FROM panel_audit_log
    WHERE action = 'admin_cloudflare_pbkdf2_100k_2026_08_28'
  );
