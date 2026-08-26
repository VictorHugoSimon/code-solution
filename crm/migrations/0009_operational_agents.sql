PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS autonomy_agent_controls (
  agent_id TEXT PRIMARY KEY,
  enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0,1)),
  shadow_mode INTEGER NOT NULL DEFAULT 1 CHECK (shadow_mode IN (0,1)),
  max_tasks_per_run INTEGER NOT NULL DEFAULT 10 CHECK (max_tasks_per_run >= 1 AND max_tasks_per_run <= 100),
  note TEXT,
  updated_at TEXT NOT NULL
);

INSERT OR IGNORE INTO autonomy_agent_controls (agent_id,enabled,shadow_mode,max_tasks_per_run,note,updated_at) VALUES
  ('__global__',1,0,50,'Kill switch global do Autonomous OS',datetime('now')),
  ('delivery',1,1,10,'Delivery Agent inicia em shadow: prepara handoff interno sem criar projeto externo',datetime('now')),
  ('executive',1,0,2,'Executive Agent gera somente brief interno e indicadores',datetime('now'));

CREATE TABLE IF NOT EXISTS delivery_handoffs (
  id TEXT PRIMARY KEY,
  lead_id TEXT NOT NULL UNIQUE,
  proposal_id TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','reviewed','activated','archived')),
  summary_json TEXT NOT NULL DEFAULT '{}',
  created_by TEXT NOT NULL DEFAULT 'delivery-agent',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_delivery_handoffs_status_updated ON delivery_handoffs(status, updated_at DESC);

CREATE TABLE IF NOT EXISTS executive_briefs (
  id TEXT PRIMARY KEY,
  brief_date TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'ready' CHECK (status IN ('ready','reviewed','archived')),
  summary_json TEXT NOT NULL DEFAULT '{}',
  created_by TEXT NOT NULL DEFAULT 'executive-agent',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_executive_briefs_date ON executive_briefs(brief_date DESC);

INSERT OR IGNORE INTO autonomy_goals (id,goal_key,name,domain,target_json,status,priority,created_at,updated_at) VALUES
  ('goal-delivery-handoff','delivery_handoff','Todo negócio ganho com handoff interno preparado','projects','{"metric":"won_deals_without_handoff","target":0}','active',95,datetime('now'),datetime('now')),
  ('goal-executive-brief','executive_daily_brief','Brief executivo interno atualizado diariamente','executive','{"metric":"daily_brief_ready","target":1}','active',85,datetime('now'),datetime('now'));
