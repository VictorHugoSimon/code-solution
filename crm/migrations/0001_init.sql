PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS leads (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  whatsapp TEXT NOT NULL,
  email TEXT,
  company TEXT,
  segment TEXT,
  need TEXT NOT NULL,
  business_type TEXT,
  urgency TEXT,
  budget TEXT,
  decision_maker INTEGER DEFAULT 0,
  source TEXT,
  campaign TEXT,
  medium TEXT,
  content TEXT,
  term TEXT,
  landing_page TEXT,
  referrer TEXT,
  status TEXT NOT NULL DEFAULT 'novo',
  score INTEGER NOT NULL DEFAULT 0 CHECK (score >= 0 AND score <= 100),
  temperature TEXT NOT NULL DEFAULT 'frio',
  owner TEXT,
  next_action TEXT,
  next_action_due TEXT,
  estimated_value_cents INTEGER,
  expected_close_date TEXT,
  loss_reason TEXT,
  notes TEXT,
  consent_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_owner ON leads(owner);
CREATE INDEX IF NOT EXISTS idx_leads_source ON leads(source);
CREATE INDEX IF NOT EXISTS idx_leads_temperature ON leads(temperature);
CREATE INDEX IF NOT EXISTS idx_leads_created_at ON leads(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_next_action_due ON leads(next_action_due);

CREATE TABLE IF NOT EXISTS lead_events (
  id TEXT PRIMARY KEY,
  lead_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  text TEXT,
  actor TEXT,
  metadata_json TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_lead_events_lead_created ON lead_events(lead_id, created_at DESC);

CREATE TABLE IF NOT EXISTS crm_tasks (
  id TEXT PRIMARY KEY,
  lead_id TEXT NOT NULL,
  title TEXT NOT NULL,
  due_at TEXT,
  status TEXT NOT NULL DEFAULT 'aberta',
  owner TEXT,
  created_at TEXT NOT NULL,
  completed_at TEXT,
  FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_crm_tasks_due ON crm_tasks(status, due_at);
CREATE INDEX IF NOT EXISTS idx_crm_tasks_lead ON crm_tasks(lead_id);

CREATE TABLE IF NOT EXISTS crm_audit_log (
  id TEXT PRIMARY KEY,
  lead_id TEXT,
  action TEXT NOT NULL,
  actor TEXT,
  before_json TEXT,
  after_json TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_crm_audit_created ON crm_audit_log(created_at DESC);

-- Growth Engine bootstrap. Kept in the idempotent production bootstrap because
-- deploy-workers applies this file on every production release.
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
