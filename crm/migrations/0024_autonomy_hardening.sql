PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS autonomy_ai_daily_usage (
  usage_date TEXT NOT NULL,
  agent TEXT NOT NULL,
  model TEXT NOT NULL,
  calls INTEGER NOT NULL DEFAULT 0,
  reserved_tokens INTEGER NOT NULL DEFAULT 0,
  successful_calls INTEGER NOT NULL DEFAULT 0,
  failed_calls INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (usage_date, agent, model)
);
CREATE INDEX IF NOT EXISTS idx_autonomy_ai_usage_date_agent ON autonomy_ai_daily_usage(usage_date DESC, agent);

CREATE TABLE IF NOT EXISTS autonomy_replay_audit (
  id TEXT PRIMARY KEY,
  dead_letter_id TEXT NOT NULL,
  task_id TEXT NOT NULL,
  agent TEXT NOT NULL,
  action_type TEXT NOT NULL,
  outcome TEXT NOT NULL CHECK (outcome IN ('requeued','rejected')),
  reason TEXT,
  requested_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (dead_letter_id) REFERENCES autonomy_dead_letters(id) ON DELETE CASCADE,
  FOREIGN KEY (task_id) REFERENCES autonomy_tasks(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_autonomy_replay_audit_created ON autonomy_replay_audit(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_autonomy_replay_audit_task ON autonomy_replay_audit(task_id, created_at DESC);

-- The queue budget is fail-closed. Disabled agents/global autonomy accept the
-- task record for audit, but defer execution instead of letting it run.
CREATE TRIGGER IF NOT EXISTS trg_autonomy_queue_budget_after_insert
AFTER INSERT ON autonomy_tasks
WHEN NEW.status='queued' AND NEW.approval_required=0
BEGIN
  UPDATE autonomy_tasks
  SET status='deferred', updated_at=datetime('now')
  WHERE id=NEW.id
    AND (
      SELECT COUNT(*) FROM autonomy_tasks
      WHERE agent=NEW.agent AND status='queued' AND approval_required=0
    ) > (
      CASE
        WHEN COALESCE((SELECT enabled FROM autonomy_agent_controls WHERE agent_id='__global__'),0)=0 THEN 0
        WHEN COALESCE((SELECT enabled FROM autonomy_agent_controls WHERE agent_id=NEW.agent),1)=0 THEN 0
        ELSE COALESCE((SELECT max_tasks_per_run FROM autonomy_agent_controls WHERE agent_id=NEW.agent),10)
      END
    );
END;

CREATE TRIGGER IF NOT EXISTS trg_autonomy_queue_budget_after_update
AFTER UPDATE OF status ON autonomy_tasks
WHEN NEW.status='queued' AND OLD.status<>'queued' AND NEW.approval_required=0
BEGIN
  UPDATE autonomy_tasks
  SET status='deferred', updated_at=datetime('now')
  WHERE id=NEW.id
    AND (
      SELECT COUNT(*) FROM autonomy_tasks
      WHERE agent=NEW.agent AND status='queued' AND approval_required=0
    ) > (
      CASE
        WHEN COALESCE((SELECT enabled FROM autonomy_agent_controls WHERE agent_id='__global__'),0)=0 THEN 0
        WHEN COALESCE((SELECT enabled FROM autonomy_agent_controls WHERE agent_id=NEW.agent),1)=0 THEN 0
        ELSE COALESCE((SELECT max_tasks_per_run FROM autonomy_agent_controls WHERE agent_id=NEW.agent),10)
      END
    );
END;
