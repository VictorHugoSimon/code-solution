PRAGMA foreign_keys = ON;

-- Commercial automation, SLA and governance. Idempotent by design.
CREATE TABLE IF NOT EXISTS crm_alerts (
  id TEXT PRIMARY KEY,
  lead_id TEXT,
  alert_type TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'warning',
  status TEXT NOT NULL DEFAULT 'open',
  title TEXT NOT NULL,
  detail TEXT,
  owner TEXT,
  due_at TEXT,
  unique_key TEXT NOT NULL,
  created_at TEXT NOT NULL,
  resolved_at TEXT,
  FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_crm_alerts_unique_key ON crm_alerts(unique_key);
CREATE INDEX IF NOT EXISTS idx_crm_alerts_status_severity ON crm_alerts(status,severity,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_crm_alerts_lead ON crm_alerts(lead_id,status,created_at DESC);

CREATE TABLE IF NOT EXISTS crm_owners (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  active INTEGER NOT NULL DEFAULT 1,
  weight INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_crm_owners_active ON crm_owners(active,name);

INSERT OR IGNORE INTO crm_owners (id,name,active,weight,created_at,updated_at)
VALUES ('commercial-default','Comercial',1,1,datetime('now'),datetime('now'));

CREATE TABLE IF NOT EXISTS crm_automation_runs (
  id TEXT PRIMARY KEY,
  trigger_type TEXT NOT NULL,
  started_at TEXT NOT NULL,
  completed_at TEXT,
  leads_scanned INTEGER NOT NULL DEFAULT 0,
  alerts_created INTEGER NOT NULL DEFAULT 0,
  tasks_created INTEGER NOT NULL DEFAULT 0,
  owners_assigned INTEGER NOT NULL DEFAULT 0,
  notifications_sent INTEGER NOT NULL DEFAULT 0,
  error_text TEXT
);
CREATE INDEX IF NOT EXISTS idx_crm_automation_runs_started ON crm_automation_runs(started_at DESC);

-- A deterministic task id (next:<lead_id>) is used by the automation layer so
-- each lead has at most one active "next action" task that can be safely updated.
CREATE INDEX IF NOT EXISTS idx_crm_tasks_owner_status_due ON crm_tasks(owner,status,due_at);

-- Privacy-safe link between anonymous acquisition session and CRM lead.
-- It lets the Growth dashboard measure visit -> lead without adding more PII to leads.
CREATE TABLE IF NOT EXISTS lead_acquisition_links (
  lead_id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  source TEXT,
  medium TEXT,
  campaign TEXT,
  landing_page TEXT,
  linked_at TEXT NOT NULL,
  FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_lead_acquisition_session ON lead_acquisition_links(session_id);
CREATE INDEX IF NOT EXISTS idx_lead_acquisition_source ON lead_acquisition_links(source,campaign,linked_at DESC);
