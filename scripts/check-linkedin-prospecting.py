from pathlib import Path
import sqlite3

conn = sqlite3.connect(':memory:')
for migration in sorted(Path('crm/migrations').glob('*.sql')):
    conn.executescript(migration.read_text(encoding='utf-8'))

tables = {row[0] for row in conn.execute("SELECT name FROM sqlite_master WHERE type='table'")}
required = {'linkedin_prospects', 'linkedin_prospect_events', 'prospecting_daily_activity', 'leads'}
assert required <= tables, f'missing LinkedIn tables: {sorted(required - tables)}'

prospect_cols = {row[1] for row in conn.execute('PRAGMA table_info(linkedin_prospects)')}
assert {
    'id','name','title','company','segment','location','linkedin_url','company_url','owner','status','score',
    'pain','context','notes','next_action','next_action_due','touch_count','last_touch_at','crm_lead_id',
    'source','created_at','updated_at'
} <= prospect_cols

event_cols = {row[1] for row in conn.execute('PRAGMA table_info(linkedin_prospect_events)')}
assert {'id','prospect_id','event_type','note','actor','metadata_json','created_at'} <= event_cols

conn.execute("""INSERT INTO linkedin_prospects
(id,name,company,linkedin_url,owner,status,score,source,created_at,updated_at)
VALUES ('li-test','Decisor Teste','Empresa Teste','https://www.linkedin.com/in/decisor-teste','ercilaine','conectar',72,'linkedin',datetime('now'),datetime('now'))""")
conn.execute("""INSERT INTO linkedin_prospect_events
(id,prospect_id,event_type,note,actor,created_at)
VALUES ('li-event','li-test','conexao_enviada','Teste de contrato','ercilaine',datetime('now'))""")
assert conn.execute("SELECT score FROM linkedin_prospects WHERE id='li-test'").fetchone()[0] == 72
assert conn.execute("SELECT count(*) FROM linkedin_prospect_events WHERE prospect_id='li-test'").fetchone()[0] == 1

conn.close()
print('LinkedIn organic prospecting schema contract: OK')
