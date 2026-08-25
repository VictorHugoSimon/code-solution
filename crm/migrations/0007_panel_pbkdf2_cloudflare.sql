PRAGMA foreign_keys = ON;

-- Cloudflare Workers WebCrypto currently accepts PBKDF2 iteration counts up to 100000.
-- Re-key the built-in administrator using PBKDF2-SHA256 material generated at 100000 iterations.
-- No plaintext password is stored in this repository.
UPDATE panel_users
SET password_hash='5d4dd8e9c980b60aa3235f656da22529e60664e38c0fbd5fb5db00982018149f',
    password_salt='772dd1275076f31d23d16306be8cf9674c2484795968e083',
    password_iterations=100000,
    active=1,
    session_version=session_version+1,
    updated_at=datetime('now')
WHERE username='admin' COLLATE NOCASE;

UPDATE panel_sessions
SET revoked_at=datetime('now')
WHERE user_id=(SELECT id FROM panel_users WHERE username='admin' COLLATE NOCASE)
  AND revoked_at IS NULL;

UPDATE panel_audit_log
SET action='login_failure_pre_pbkdf2_fix'
WHERE username='admin' COLLATE NOCASE
  AND action='login_failure'
  AND created_at>=datetime('now','-30 minutes');
