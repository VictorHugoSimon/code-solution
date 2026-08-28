-- Code Solution canonical admin access — 2026-08-28
-- Establish one deterministic owner credential and disable legacy automatic recovery credentials.
-- Plaintext password is NOT stored in the repository; only PBKDF2-SHA256 output + random salt.

UPDATE panel_users
SET
  display_name = 'Administrador Code Solution',
  role = 'admin',
  active = 1,
  password_hash = 'd4fd6c1576c0b6bf868589b475c8409a15560d1f277b8d73282857e6e5140b82',
  password_salt = 'e3e89491fc5b66a11325c4aef6d81eedd84387ea1ca2250c',
  password_iterations = 180000,
  session_version = COALESCE(session_version, 0) + 1,
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
WHERE username = 'admin' COLLATE NOCASE
  AND NOT EXISTS (
    SELECT 1 FROM panel_audit_log
    WHERE action = 'admin_canonical_access_2026_08_28_v4'
  );

UPDATE panel_sessions
SET revoked_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
WHERE user_id = (
    SELECT id FROM panel_users WHERE username = 'admin' COLLATE NOCASE LIMIT 1
  )
  AND revoked_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM panel_audit_log
    WHERE action = 'admin_canonical_access_2026_08_28_v4'
  );

-- Permanently consume the two legacy automatic-recovery credentials so they can no longer rewrite admin access.
INSERT INTO panel_audit_log
  (id, user_id, username, action, target_type, target_id, metadata_json, created_at)
SELECT lower(hex(randomblob(16))), id, username,
  'admin_recovery_2026_08_27_existing_password_consumed',
  'panel_user', id,
  '{"disabledBy":"admin_canonical_access_2026_08_28_v4","legacyAutomaticRecovery":true}',
  strftime('%Y-%m-%dT%H:%M:%fZ','now')
FROM panel_users
WHERE username = 'admin' COLLATE NOCASE
  AND NOT EXISTS (
    SELECT 1 FROM panel_audit_log
    WHERE action = 'admin_recovery_2026_08_27_existing_password_consumed'
  );

INSERT INTO panel_audit_log
  (id, user_id, username, action, target_type, target_id, metadata_json, created_at)
SELECT lower(hex(randomblob(16))), id, username,
  'bootstrap_known_password_consumed',
  'panel_user', id,
  '{"disabledBy":"admin_canonical_access_2026_08_28_v4","legacyBootstrapCredential":true}',
  strftime('%Y-%m-%dT%H:%M:%fZ','now')
FROM panel_users
WHERE username = 'admin' COLLATE NOCASE
  AND NOT EXISTS (
    SELECT 1 FROM panel_audit_log
    WHERE action = 'bootstrap_known_password_consumed'
  );

INSERT INTO panel_audit_log
  (id, user_id, username, action, target_type, target_id, metadata_json, created_at)
SELECT lower(hex(randomblob(16))), id, username,
  'admin_canonical_access_2026_08_28_v4',
  'panel_user', id,
  '{"reason":"canonical-owner-login","passwordStorage":"pbkdf2-sha256","plaintextStored":false,"sessionsRevoked":true,"legacyRecoveryDisabled":true}',
  strftime('%Y-%m-%dT%H:%M:%fZ','now')
FROM panel_users
WHERE username = 'admin' COLLATE NOCASE
  AND NOT EXISTS (
    SELECT 1 FROM panel_audit_log
    WHERE action = 'admin_canonical_access_2026_08_28_v4'
  );
