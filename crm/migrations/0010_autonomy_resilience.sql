PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS autonomy_task_retries (
  task_id TEXT PRIMARY KEY,
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 3,
  status TEXT NOT NULL DEFAULT 'retrying' CHECK (status IN ('retrying','inflight','recovered','exhausted')),
  next_attempt_at TEXT,
  last_error TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (task_id) REFERENCES autonomy_tasks(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_autonomy_retries_status_next ON autonomy_task_retries(status, next_attempt_at);

CREATE TABLE IF NOT EXISTS autonomy_dead_letters (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL UNIQUE,
  agent TEXT NOT NULL,
  action_type TEXT NOT NULL,
  reason TEXT NOT NULL,
  payload_json TEXT,
  created_at TEXT NOT NULL,
  resolved_at TEXT,
  resolution_note TEXT,
  FOREIGN KEY (task_id) REFERENCES autonomy_tasks(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_autonomy_dlq_open ON autonomy_dead_letters(resolved_at, created_at DESC);

CREATE TABLE IF NOT EXISTS autonomy_agent_daily_usage (
  agent TEXT NOT NULL,
  usage_date TEXT NOT NULL,
  completed_tasks INTEGER NOT NULL DEFAULT 0,
  failed_tasks INTEGER NOT NULL DEFAULT 0,
  retries INTEGER NOT NULL DEFAULT 0,
  dead_letters INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (agent, usage_date)
);
CREATE INDEX IF NOT EXISTS idx_autonomy_usage_date ON autonomy_agent_daily_usage(usage_date DESC, agent);

CREATE TABLE IF NOT EXISTS autonomy_policy_versions (
  id TEXT PRIMARY KEY,
  policy_version TEXT NOT NULL UNIQUE,
  prompt_version TEXT,
  description TEXT,
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0,1)),
  created_at TEXT NOT NULL
);

INSERT OR IGNORE INTO autonomy_policy_versions (id,policy_version,prompt_version,description,active,created_at) VALUES
  ('policy-governance-2026-08-27-1','autonomy-policy-2026-08-27.1','mixed-v1','Fail closed, human approval for external actions, retry only for low-risk internal tasks, DLQ after exhaustion.',1,datetime('now'));

INSERT OR IGNORE INTO autonomy_agent_controls (agent_id,enabled,shadow_mode,max_tasks_per_run,note,updated_at) VALUES
  ('orchestrator',1,0,50,'Coordenação interna do Autonomous OS',datetime('now')),
  ('sales_ops',1,0,20,'Ações comerciais internas e próximas ações',datetime('now')),
  ('prospecting',1,0,15,'Qualificação interna; abordagem externa continua human-gated',datetime('now')),
  ('content',1,0,10,'Preparação interna; publicação externa continua human-gated',datetime('now')),
  ('reliability',1,0,20,'Monitoramento e alertas internos',datetime('now')),
  ('proposal',1,0,10,'Draft automático; envio continua human-gated',datetime('now')),
  ('governance',1,0,50,'Supervisor de saúde, retry, DLQ e política fail-closed',datetime('now'));

INSERT OR IGNORE INTO autonomy_goals (id,goal_key,name,domain,target_json,status,priority,created_at,updated_at) VALUES
  ('goal-autonomy-resilience','autonomy_resilience','Nenhuma falha autônoma some silenciosamente','governance','{"metric":"open_dead_letters","target":0,"retry_max":3}','active',100,datetime('now'),datetime('now'));
