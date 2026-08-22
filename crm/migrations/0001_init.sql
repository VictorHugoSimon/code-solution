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
