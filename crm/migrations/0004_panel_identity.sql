PRAGMA foreign_keys = ON;

-- Individual panel identities, revocable sessions and audit trail.
CREATE TABLE IF NOT EXISTS panel_users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE COLLATE NOCASE,
  display_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin','comercial','marketing','leitura_executiva')),
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  password_iterations INTEGER NOT NULL DEFAULT 100000,
  active INTEGER NOT NULL DEFAULT 1,
  session_version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  last_login_at TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_panel_users_username ON panel_users(username COLLATE NOCASE);
CREATE INDEX IF NOT EXISTS idx_panel_users_role_active ON panel_users(role,active,username);

CREATE TABLE IF NOT EXISTS panel_sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  session_version INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  revoked_at TEXT,
  user_agent_hash TEXT,
  FOREIGN KEY (user_id) REFERENCES panel_users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_panel_sessions_user ON panel_sessions(user_id,expires_at DESC);
CREATE INDEX IF NOT EXISTS idx_panel_sessions_expiry ON panel_sessions(expires_at,revoked_at);

CREATE TABLE IF NOT EXISTS panel_audit_log (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  username TEXT,
  action TEXT NOT NULL,
  target_type TEXT,
  target_id TEXT,
  metadata_json TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES panel_users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_panel_audit_created ON panel_audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_panel_audit_user ON panel_audit_log(user_id,created_at DESC);

-- Initial administrator. The plaintext password is never stored in the repository;
-- only PBKDF2-SHA256 material is persisted. Existing rows are preserved on re-runs.
INSERT OR IGNORE INTO panel_users (
  id,username,display_name,role,password_hash,password_salt,password_iterations,active,session_version,created_at,updated_at
) VALUES (
  'panel-admin-primary','admin','Administrador Code Solution','admin',
  '29339efeb77edb2f93fe6dd467c98ce766c327aa5993048bbfe5324db3fcfe5e',
  '9f79ab6a5b532ff1c205b89e27b00fe690f51f86aca8f04c',
  180000,1,1,datetime('now'),datetime('now')
);
