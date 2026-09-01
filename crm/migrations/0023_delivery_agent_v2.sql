-- Code Solution Delivery Agent v2 — 2026-09-01
-- Shadow-first internal project/backlog/report/release/incident artifacts.

CREATE TABLE IF NOT EXISTS delivery_projects (
  id TEXT PRIMARY KEY,
  lead_id TEXT NOT NULL UNIQUE,
  handoff_id TEXT,
  proposal_id TEXT,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'shadow_draft',
  health TEXT NOT NULL DEFAULT 'unknown',
  owner TEXT,
  target_date TEXT,
  scope_json TEXT NOT NULL DEFAULT '[]',
  risks_json TEXT NOT NULL DEFAULT '[]',
  assumptions_json TEXT NOT NULL DEFAULT '[]',
  created_by TEXT NOT NULL DEFAULT 'delivery-agent-v2',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_delivery_projects_status ON delivery_projects(status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_delivery_projects_handoff ON delivery_projects(handoff_id);

CREATE TABLE IF NOT EXISTS delivery_backlog_items (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  parent_id TEXT,
  item_type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'backlog',
  priority INTEGER NOT NULL DEFAULT 50,
  owner TEXT,
  due_at TEXT,
  risk_level TEXT NOT NULL DEFAULT 'low',
  blocked_reason TEXT,
  source_ref TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_delivery_backlog_project ON delivery_backlog_items(project_id, status, sort_order);
CREATE INDEX IF NOT EXISTS idx_delivery_backlog_due ON delivery_backlog_items(status, due_at);

CREATE TABLE IF NOT EXISTS delivery_status_reports (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  report_date TEXT NOT NULL,
  health TEXT NOT NULL,
  summary TEXT NOT NULL,
  metrics_json TEXT NOT NULL DEFAULT '{}',
  risks_json TEXT NOT NULL DEFAULT '[]',
  next_actions_json TEXT NOT NULL DEFAULT '[]',
  generated_by TEXT NOT NULL DEFAULT 'delivery-agent-v2',
  created_at TEXT NOT NULL,
  UNIQUE(project_id, report_date)
);
CREATE INDEX IF NOT EXISTS idx_delivery_reports_project ON delivery_status_reports(project_id, report_date DESC);

CREATE TABLE IF NOT EXISTS delivery_release_notes (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  version TEXT NOT NULL,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  items_json TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'draft',
  generated_by TEXT NOT NULL DEFAULT 'delivery-agent-v2',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(project_id, version)
);
CREATE INDEX IF NOT EXISTS idx_delivery_release_project ON delivery_release_notes(project_id, created_at DESC);

CREATE TABLE IF NOT EXISTS delivery_incidents (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'medium',
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  detected_at TEXT NOT NULL,
  resolved_at TEXT,
  triage_json TEXT NOT NULL DEFAULT '{}',
  rca_json TEXT NOT NULL DEFAULT '{}',
  created_by TEXT NOT NULL DEFAULT 'delivery-agent-v2',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_delivery_incidents_project ON delivery_incidents(project_id, status, detected_at DESC);
