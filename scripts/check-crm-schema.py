from pathlib import Path
import sqlite3

sql = Path('crm/migrations/0001_init.sql').read_text(encoding='utf-8')
conn = sqlite3.connect(':memory:')
conn.executescript(sql)
conn.executescript(sql)  # migration must be safe to reapply

lead_cols = {row[1] for row in conn.execute('PRAGMA table_info(leads)')}
required_lead_cols = {
    'id','name','whatsapp','email','company','segment','need','business_type','urgency','budget',
    'decision_maker','source','campaign','medium','content','term','landing_page','referrer','status',
    'score','temperature','owner','next_action','next_action_due','estimated_value_cents',
    'expected_close_date','loss_reason','notes','consent_at','created_at','updated_at'
}
missing = required_lead_cols - lead_cols
assert not missing, f'missing leads columns: {sorted(missing)}'

event_cols = {row[1] for row in conn.execute('PRAGMA table_info(lead_events)')}
assert {'id','lead_id','event_type','text','actor','metadata_json','created_at'} <= event_cols

conn.execute(
    '''INSERT INTO leads (
       id,name,whatsapp,email,company,segment,need,business_type,urgency,budget,decision_maker,
       source,campaign,medium,content,term,landing_page,referrer,status,score,temperature,owner,
       next_action,next_action_due,estimated_value_cents,expected_close_date,loss_reason,notes,
       consent_at,created_at,updated_at
       ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)''',
    (
        'test-lead','Teste','5518999999999',None,'Code Solution','Tecnologia','Automação','b2b','media',None,1,
        'ci',None,None,None,None,'/assistente/',None,'novo',80,'quente','Victor',
        'Agendar discovery','2026-08-25',1500000,'2026-09-30',None,None,
        '2026-08-22T12:00:00Z','2026-08-22T12:00:00Z','2026-08-22T12:00:00Z'
    )
)
conn.execute(
    'INSERT INTO lead_events (id,lead_id,event_type,text,created_at) VALUES (?,?,?,?,?)',
    ('event-1','test-lead','lead_created','Teste CI','2026-08-22T12:00:00Z')
)
assert conn.execute('SELECT score FROM leads WHERE id=?', ('test-lead',)).fetchone()[0] == 80
assert conn.execute('SELECT count(*) FROM lead_events WHERE lead_id=?', ('test-lead',)).fetchone()[0] == 1
conn.close()
print('CRM schema contract: OK')
