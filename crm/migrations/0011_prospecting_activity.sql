PRAGMA foreign_keys = ON;

-- Daily organic prospecting execution. Targets are operational; observed values
-- are recorded separately so the dashboard never confuses plans with outcomes.
CREATE TABLE IF NOT EXISTS prospecting_daily_activity (
  id TEXT PRIMARY KEY,
  activity_date TEXT NOT NULL,
  owner TEXT NOT NULL DEFAULT 'admin',
  channel TEXT NOT NULL DEFAULT 'linkedin',
  connections INTEGER NOT NULL DEFAULT 0 CHECK (connections >= 0),
  interactions INTEGER NOT NULL DEFAULT 0 CHECK (interactions >= 0),
  first_messages INTEGER NOT NULL DEFAULT 0 CHECK (first_messages >= 0),
  followups INTEGER NOT NULL DEFAULT 0 CHECK (followups >= 0),
  content_posts INTEGER NOT NULL DEFAULT 0 CHECK (content_posts >= 0),
  qualified_replies INTEGER NOT NULL DEFAULT 0 CHECK (qualified_replies >= 0),
  meetings_booked INTEGER NOT NULL DEFAULT 0 CHECK (meetings_booked >= 0),
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(activity_date, owner, channel)
);

CREATE INDEX IF NOT EXISTS idx_prospecting_activity_date
  ON prospecting_daily_activity(activity_date DESC, channel, owner);
CREATE INDEX IF NOT EXISTS idx_prospecting_activity_owner
  ON prospecting_daily_activity(owner, activity_date DESC);
