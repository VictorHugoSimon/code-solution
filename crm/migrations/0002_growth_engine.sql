PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS growth_runs (
  id TEXT PRIMARY KEY,
  agent TEXT NOT NULL,
  trigger_type TEXT,
  status TEXT NOT NULL,
  started_at TEXT NOT NULL,
  completed_at TEXT,
  summary_json TEXT,
  error_text TEXT
);

CREATE INDEX IF NOT EXISTS idx_growth_runs_agent_started ON growth_runs(agent, started_at DESC);

CREATE TABLE IF NOT EXISTS growth_accounts (
  id TEXT PRIMARY KEY,
  company TEXT NOT NULL,
  domain TEXT,
  segment TEXT,
  location TEXT,
  source_url TEXT NOT NULL,
  source_title TEXT,
  signal_type TEXT,
  signal_text TEXT,
  score INTEGER NOT NULL DEFAULT 0 CHECK (score >= 0 AND score <= 100),
  priority TEXT NOT NULL DEFAULT 'baixa',
  status TEXT NOT NULL DEFAULT 'novo',
  outreach_angle TEXT,
  suggested_message TEXT,
  discovered_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_growth_accounts_source_company ON growth_accounts(source_url, company);
CREATE INDEX IF NOT EXISTS idx_growth_accounts_status_score ON growth_accounts(status, score DESC);
CREATE INDEX IF NOT EXISTS idx_growth_accounts_segment ON growth_accounts(segment);
CREATE INDEX IF NOT EXISTS idx_growth_accounts_updated ON growth_accounts(updated_at DESC);

CREATE TABLE IF NOT EXISTS growth_topics (
  id TEXT PRIMARY KEY,
  topic TEXT NOT NULL,
  pillar TEXT NOT NULL,
  keyword TEXT NOT NULL,
  intent TEXT,
  score INTEGER NOT NULL DEFAULT 0 CHECK (score >= 0 AND score <= 100),
  rationale TEXT,
  source_url TEXT,
  status TEXT NOT NULL DEFAULT 'aberto',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_growth_topics_status_score ON growth_topics(status, score DESC, created_at DESC);

CREATE TABLE IF NOT EXISTS growth_content (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  channel TEXT NOT NULL,
  title TEXT,
  body TEXT NOT NULL,
  cta TEXT,
  source_article_slug TEXT,
  source_topic_id TEXT,
  status TEXT NOT NULL DEFAULT 'pronto',
  scheduled_for TEXT,
  published_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  metadata_json TEXT,
  FOREIGN KEY (source_topic_id) REFERENCES growth_topics(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_growth_content_status_channel ON growth_content(status, channel, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_growth_content_schedule ON growth_content(status, scheduled_for);

CREATE TABLE IF NOT EXISTS growth_metrics (
  id TEXT PRIMARY KEY,
  metric_date TEXT NOT NULL,
  prospects_discovered INTEGER NOT NULL DEFAULT 0,
  high_intent_prospects INTEGER NOT NULL DEFAULT 0,
  content_ready INTEGER NOT NULL DEFAULT 0,
  articles_published INTEGER NOT NULL DEFAULT 0,
  crm_leads INTEGER NOT NULL DEFAULT 0,
  crm_hot_leads INTEGER NOT NULL DEFAULT 0,
  organic_leads INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_growth_metrics_date ON growth_metrics(metric_date);
