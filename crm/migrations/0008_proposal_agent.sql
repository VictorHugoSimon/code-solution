PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS crm_proposals (
  id TEXT PRIMARY KEY,
  lead_id TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'pending_approval' CHECK (status IN ('draft','pending_approval','approved','rejected','sent','superseded')),
  approval_status TEXT NOT NULL DEFAULT 'pending' CHECK (approval_status IN ('pending','approved','rejected')),
  title TEXT NOT NULL,
  executive_summary TEXT,
  scope_json TEXT NOT NULL DEFAULT '[]',
  out_of_scope_json TEXT NOT NULL DEFAULT '[]',
  architecture_json TEXT NOT NULL DEFAULT '[]',
  roadmap_json TEXT NOT NULL DEFAULT '[]',
  estimate_json TEXT NOT NULL DEFAULT '{}',
  risks_json TEXT NOT NULL DEFAULT '[]',
  assumptions_json TEXT NOT NULL DEFAULT '[]',
  discovery_gaps_json TEXT NOT NULL DEFAULT '[]',
  commercial_draft TEXT,
  source_snapshot_json TEXT NOT NULL DEFAULT '{}',
  generation_mode TEXT NOT NULL DEFAULT 'managed_ai',
  model TEXT,
  prompt_version TEXT NOT NULL DEFAULT 'proposal-v1',
  created_by TEXT NOT NULL DEFAULT 'proposal-agent',
  approved_by TEXT,
  approved_at TEXT,
  rejection_reason TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE,
  UNIQUE (lead_id, version)
);

CREATE INDEX IF NOT EXISTS idx_crm_proposals_lead_version ON crm_proposals(lead_id, version DESC);
CREATE INDEX IF NOT EXISTS idx_crm_proposals_status_created ON crm_proposals(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_crm_proposals_approval ON crm_proposals(approval_status, updated_at DESC);

CREATE TABLE IF NOT EXISTS crm_proposal_events (
  id TEXT PRIMARY KEY,
  proposal_id TEXT NOT NULL,
  lead_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  actor TEXT,
  note TEXT,
  metadata_json TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (proposal_id) REFERENCES crm_proposals(id) ON DELETE CASCADE,
  FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_crm_proposal_events_proposal_created ON crm_proposal_events(proposal_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_crm_proposal_events_lead_created ON crm_proposal_events(lead_id, created_at DESC);
