PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS leads (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  interest TEXT NOT NULL,
  message TEXT,
  consent INTEGER NOT NULL DEFAULT 0,
  consent_at TEXT,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  utm_content TEXT,
  utm_term TEXT,
  referrer TEXT,
  landing_page TEXT,
  stage TEXT NOT NULL DEFAULT 'Novo Lead',
  owner TEXT NOT NULL DEFAULT 'Ser Vital',
  next_action TEXT,
  next_action_at TEXT,
  value_potential REAL NOT NULL DEFAULT 0,
  scheduled_at TEXT,
  paid INTEGER NOT NULL DEFAULT 0,
  attended INTEGER NOT NULL DEFAULT 0,
  recurring INTEGER NOT NULL DEFAULT 0,
  last_contact_at TEXT,
  notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_leads_created_at ON leads(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_stage ON leads(stage);
CREATE INDEX IF NOT EXISTS idx_leads_phone ON leads(phone);
CREATE INDEX IF NOT EXISTS idx_leads_campaign ON leads(utm_campaign);

CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  lead_id TEXT,
  event_type TEXT NOT NULL,
  source TEXT,
  payload TEXT,
  FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_events_created_at ON events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_events_lead_id ON events(lead_id);

CREATE TABLE IF NOT EXISTS content_items (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  publish_at TEXT,
  channel TEXT NOT NULL,
  format TEXT,
  pillar TEXT,
  title TEXT NOT NULL,
  slug TEXT,
  status TEXT NOT NULL DEFAULT 'Ideia',
  cta TEXT,
  url TEXT,
  notes TEXT
);

CREATE TABLE IF NOT EXISTS automation_runs (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  flow_id TEXT NOT NULL,
  lead_id TEXT,
  status TEXT NOT NULL,
  message TEXT,
  payload TEXT,
  FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE SET NULL
);
