PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS linkedin_prospects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  title TEXT,
  company TEXT NOT NULL,
  segment TEXT,
  location TEXT,
  linkedin_url TEXT NOT NULL,
  company_url TEXT,
  owner TEXT NOT NULL DEFAULT 'ercilaine',
  status TEXT NOT NULL DEFAULT 'pesquisar',
  score INTEGER NOT NULL DEFAULT 0 CHECK (score >= 0 AND score <= 100),
  pain TEXT,
  context TEXT,
  notes TEXT,
  next_action TEXT,
  next_action_due TEXT,
  touch_count INTEGER NOT NULL DEFAULT 0 CHECK (touch_count >= 0),
  last_touch_at TEXT,
  crm_lead_id TEXT,
  source TEXT NOT NULL DEFAULT 'linkedin',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (crm_lead_id) REFERENCES leads(id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_linkedin_prospects_profile ON linkedin_prospects(linkedin_url);
CREATE INDEX IF NOT EXISTS idx_linkedin_prospects_owner_status ON linkedin_prospects(owner, status, score DESC);
CREATE INDEX IF NOT EXISTS idx_linkedin_prospects_due ON linkedin_prospects(next_action_due, status);
CREATE INDEX IF NOT EXISTS idx_linkedin_prospects_company ON linkedin_prospects(company);

CREATE TABLE IF NOT EXISTS linkedin_prospect_events (
  id TEXT PRIMARY KEY,
  prospect_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  note TEXT,
  actor TEXT,
  metadata_json TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (prospect_id) REFERENCES linkedin_prospects(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_linkedin_events_prospect_created ON linkedin_prospect_events(prospect_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_linkedin_events_type_created ON linkedin_prospect_events(event_type, created_at DESC);
