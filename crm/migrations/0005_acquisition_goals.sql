PRAGMA foreign_keys = ON;

-- Weekly acquisition goals by channel. Zero means "not configured" and is never
-- treated as an observed KPI or fabricated target.
CREATE TABLE IF NOT EXISTS acquisition_channel_goals (
  channel TEXT PRIMARY KEY COLLATE NOCASE,
  weekly_sessions_goal INTEGER NOT NULL DEFAULT 0 CHECK (weekly_sessions_goal >= 0),
  weekly_leads_goal INTEGER NOT NULL DEFAULT 0 CHECK (weekly_leads_goal >= 0),
  weekly_wins_goal INTEGER NOT NULL DEFAULT 0 CHECK (weekly_wins_goal >= 0),
  active INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_acquisition_channel_goals_active ON acquisition_channel_goals(active, channel);

INSERT OR IGNORE INTO acquisition_channel_goals
(channel,weekly_sessions_goal,weekly_leads_goal,weekly_wins_goal,active,updated_at)
VALUES
('linkedin',0,0,0,1,datetime('now')),
('google',0,0,0,1,datetime('now')),
('instagram',0,0,0,1,datetime('now')),
('facebook',0,0,0,1,datetime('now')),
('whatsapp',0,0,0,1,datetime('now')),
('site',0,0,0,1,datetime('now')),
('direto',0,0,0,1,datetime('now'));
