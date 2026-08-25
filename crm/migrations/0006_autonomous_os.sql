PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS autonomy_goals (
  id TEXT PRIMARY KEY,
  goal_key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  domain TEXT NOT NULL,
  target_json TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  priority INTEGER NOT NULL DEFAULT 50,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_autonomy_goals_status_priority ON autonomy_goals(status, priority DESC);

CREATE TABLE IF NOT EXISTS autonomy_runs (
  id TEXT PRIMARY KEY,
  trigger_type TEXT NOT NULL,
  status TEXT NOT NULL,
  started_at TEXT NOT NULL,
  completed_at TEXT,
  tasks_created INTEGER NOT NULL DEFAULT 0,
  tasks_executed INTEGER NOT NULL DEFAULT 0,
  approvals_requested INTEGER NOT NULL DEFAULT 0,
  summary_json TEXT,
  error_text TEXT
);
CREATE INDEX IF NOT EXISTS idx_autonomy_runs_started ON autonomy_runs(started_at DESC);

CREATE TABLE IF NOT EXISTS autonomy_tasks (
  id TEXT PRIMARY KEY,
  unique_key TEXT NOT NULL UNIQUE,
  agent TEXT NOT NULL,
  action_type TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  title TEXT NOT NULL,
  payload_json TEXT,
  risk_level TEXT NOT NULL DEFAULT 'low',
  approval_required INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'queued',
  priority INTEGER NOT NULL DEFAULT 50,
  scheduled_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  completed_at TEXT,
  error_text TEXT
);
CREATE INDEX IF NOT EXISTS idx_autonomy_tasks_status_priority ON autonomy_tasks(status, priority DESC, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_autonomy_tasks_agent_status ON autonomy_tasks(agent, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_autonomy_tasks_entity ON autonomy_tasks(entity_type, entity_id, created_at DESC);

CREATE TABLE IF NOT EXISTS autonomy_decisions (
  id TEXT PRIMARY KEY,
  task_id TEXT,
  agent TEXT NOT NULL,
  decision_type TEXT NOT NULL,
  rationale TEXT,
  confidence REAL,
  policy TEXT,
  decision_json TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (task_id) REFERENCES autonomy_tasks(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_autonomy_decisions_task ON autonomy_decisions(task_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_autonomy_decisions_agent ON autonomy_decisions(agent, created_at DESC);

CREATE TABLE IF NOT EXISTS autonomy_approvals (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending',
  requested_by TEXT NOT NULL,
  decided_by TEXT,
  note TEXT,
  created_at TEXT NOT NULL,
  decided_at TEXT,
  FOREIGN KEY (task_id) REFERENCES autonomy_tasks(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_autonomy_approvals_status ON autonomy_approvals(status, created_at ASC);

INSERT OR IGNORE INTO autonomy_goals (id,goal_key,name,domain,target_json,status,priority,created_at,updated_at) VALUES
  ('goal-commercial-sla','commercial_sla','Nenhum lead qualificado sem próxima ação','commercial','{"metric":"open_hot_leads_without_action","target":0}','active',100,datetime('now'),datetime('now')),
  ('goal-qualified-pipeline','qualified_pipeline','Aumentar pipeline B2B qualificado sem spam','growth','{"metric":"high_intent_prospects","direction":"increase"}','active',90,datetime('now'),datetime('now')),
  ('goal-organic-demand','organic_demand','Gerar demanda orgânica recorrente com conteúdo útil','marketing','{"metric":"organic_leads","direction":"increase"}','active',80,datetime('now'),datetime('now')),
  ('goal-safe-autonomy','safe_autonomy','Automatizar ações internas e exigir aprovação em ações externas críticas','governance','{"external_actions":"approval_required"}','active',100,datetime('now'),datetime('now'));
