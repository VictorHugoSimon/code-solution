from pathlib import Path
import sqlite3

conn = sqlite3.connect(':memory:')
for migration in sorted(Path('crm/migrations').glob('*.sql')):
    conn.executescript(migration.read_text(encoding='utf-8'))

lead_cols = {row[1] for row in conn.execute('PRAGMA table_info(leads)')}
required_lead_cols = {
    'id','name','whatsapp','email','company','segment','need','business_type','urgency','budget',
    'decision_maker','source','campaign','medium','content','term','landing_page','referrer','status',
    'score','temperature','owner','next_action','next_action_due','estimated_value_cents',
    'expected_close_date','loss_reason','notes','consent_at','created_at','updated_at'
}
assert not (required_lead_cols - lead_cols), f'missing leads columns: {sorted(required_lead_cols - lead_cols)}'

required_tables = {
    'leads','lead_events','crm_tasks','crm_alerts','crm_owners','crm_automation_runs',
    'lead_acquisition_links','acquisition_events','panel_users','panel_sessions','panel_audit_log',
    'autonomy_goals','autonomy_runs','autonomy_tasks','autonomy_decisions','autonomy_approvals',
    'crm_proposals','crm_proposal_events'
}
tables = {row[0] for row in conn.execute("SELECT name FROM sqlite_master WHERE type='table'")}
assert not (required_tables - tables), f'missing tables: {sorted(required_tables - tables)}'

user_cols = {row[1] for row in conn.execute('PRAGMA table_info(panel_users)')}
assert {'id','username','display_name','role','password_hash','password_salt','password_iterations','active','session_version','last_login_at'} <= user_cols
session_cols = {row[1] for row in conn.execute('PRAGMA table_info(panel_sessions)')}
assert {'token_hash','user_id','session_version','expires_at','revoked_at'} <= session_cols

autonomy_task_cols = {row[1] for row in conn.execute('PRAGMA table_info(autonomy_tasks)')}
assert {'unique_key','agent','action_type','risk_level','approval_required','status','priority','payload_json'} <= autonomy_task_cols
autonomy_approval_cols = {row[1] for row in conn.execute('PRAGMA table_info(autonomy_approvals)')}
assert {'task_id','status','requested_by','decided_by','note','created_at','decided_at'} <= autonomy_approval_cols

proposal_cols = {row[1] for row in conn.execute('PRAGMA table_info(crm_proposals)')}
assert {
    'id','lead_id','version','status','approval_status','title','executive_summary','scope_json',
    'architecture_json','roadmap_json','estimate_json','risks_json','assumptions_json','discovery_gaps_json',
    'commercial_draft','source_snapshot_json','generation_mode','prompt_version','approved_by','approved_at'
} <= proposal_cols
proposal_event_cols = {row[1] for row in conn.execute('PRAGMA table_info(crm_proposal_events)')}
assert {'proposal_id','lead_id','event_type','actor','note','metadata_json','created_at'} <= proposal_event_cols

admin = conn.execute("SELECT username,role,password_hash,password_salt,password_iterations,active FROM panel_users WHERE username='admin'").fetchone()
assert admin and admin[0] == 'admin' and admin[1] == 'admin' and admin[5] == 1
assert len(admin[2]) == 64 and len(admin[3]) >= 32 and admin[4] == 100000

conn.execute("INSERT INTO panel_audit_log (id,user_id,username,action,created_at) VALUES ('audit-test','panel-admin-primary','admin','schema_test',datetime('now'))")
assert conn.execute("SELECT count(*) FROM panel_audit_log WHERE action='schema_test'").fetchone()[0] == 1
assert conn.execute("SELECT count(*) FROM autonomy_goals WHERE status='active'").fetchone()[0] >= 4

conn.execute("INSERT INTO leads (id,name,whatsapp,need,status,created_at,updated_at) VALUES ('proposal-lead','Teste','5518999999999','Automatizar processo comercial','proposta',datetime('now'),datetime('now'))")
conn.execute("INSERT INTO crm_proposals (id,lead_id,version,status,approval_status,title,created_at,updated_at) VALUES ('proposal-test','proposal-lead',1,'pending_approval','pending','Proposta teste',datetime('now'),datetime('now'))")
assert conn.execute("SELECT count(*) FROM crm_proposals WHERE lead_id='proposal-lead' AND status='pending_approval'").fetchone()[0] == 1

conn.close()
print('CRM + panel identity + Autonomous OS + Proposal Agent schema contract: OK')
