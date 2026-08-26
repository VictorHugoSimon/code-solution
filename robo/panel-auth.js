const SESSION_HOURS = 8;
const DEFAULT_ITERATIONS = 100000;
const ROLES = new Set(['admin','comercial','marketing','leitura_executiva']);
const BOOTSTRAP_ADMIN_USERNAME = 'admin';
const BOOTSTRAP_ADMIN_PASSWORD_SHA256 = 'c4467ec1a165ac8214bb31db4fffdc45e8ea0612e8e2e696f2cc701de9a5a325';
const BOOTSTRAP_ADMIN_AUDIT_ACTION = 'bootstrap_known_password_consumed';

export async function handlePanelAuth(request, env) {
  const url = new URL(request.url);
  if (!url.pathname.startsWith('/auth/')) return null;
  const cors = corsHeaders(request, env);
  if (request.method === 'OPTIONS') return new Response(null, { status:204, headers:cors });
  if (!env.CRM_DB) return reply({ok:false,error:'crm_db_not_configured'},503,cors);

  if (url.pathname === '/auth/login' && request.method === 'POST') return login(request, env, cors);
  if (url.pathname === '/auth/bootstrap-reset' && request.method === 'POST') return bootstrapReset(request, env, cors);

  const session = await authenticatePanelSession(request, env);
  if (!session) return reply({ok:false,error:'unauthorized'},401,cors);

  if (url.pathname === '/auth/session' && request.method === 'GET') {
    return reply({ok:true,user:publicUser(session.user),expiresAt:session.expiresAt,permissions:rolePermissions(session.user.role)},200,cors);
  }
  if (url.pathname === '/auth/logout' && request.method === 'POST') return logout(session, env, cors);

  if (session.user.role !== 'admin') return reply({ok:false,error:'forbidden'},403,cors);
  if (url.pathname === '/auth/users' && request.method === 'GET') return listUsers(env,cors);
  if (url.pathname === '/auth/users' && request.method === 'POST') return createUser(request,env,session.user,cors);
  if (/^\/auth\/users\/[^/]+$/.test(url.pathname) && request.method === 'PATCH') return updateUser(request,env,session.user,cors);
  if (/^\/auth\/users\/[^/]+\/revoke$/.test(url.pathname) && request.method === 'POST') return revokeUserSessions(request,env,session.user,cors);
  if (url.pathname === '/auth/audit' && request.method === 'GET') return listAudit(request,env,cors);
  return reply({ok:false,error:'not_found'},404,cors);
}

export async function authenticatePanelSession(request, env) {
  if (!env.CRM_DB) return null;
  const token = bearer(request.headers.get('authorization'));
  if (!token || token.length < 32 || token.length > 300) return null;
  const tokenHash = await sha256Hex(token);
  const row = await env.CRM_DB.prepare(`SELECT s.token_hash,s.user_id,s.session_version,s.expires_at,s.revoked_at,
      u.username,u.display_name,u.role,u.active,u.session_version AS current_version
    FROM panel_sessions s JOIN panel_users u ON u.id=s.user_id WHERE s.token_hash=? LIMIT 1`).bind(tokenHash).first();
  if (!row || row.revoked_at || !row.active || Number(row.session_version)!==Number(row.current_version)) return null;
  if (Date.parse(row.expires_at) <= Date.now()) return null;
  return {
    tokenHash,
    expiresAt:row.expires_at,
    user:{id:row.user_id,username:row.username,displayName:row.display_name,role:row.role,active:Boolean(row.active)},
  };
}

export function rolePermissions(role) {
  const all = ['overview','crm_read','crm_write','attendance','agenda','prospecting','marketing','intelligence','growth','reports','users'];
  if (role === 'admin') return all;
  if (role === 'comercial') return ['overview','crm_read','crm_write','attendance','agenda','prospecting','reports'];
  if (role === 'marketing') return ['overview','crm_read','marketing','intelligence','growth','reports'];
  return ['overview','crm_read','intelligence','reports'];
}

async function login(request, env, cors) {
  const body = await readBody(request);
  const username = clean(body.username,80).toLowerCase();
  const password = String(body.password||'');
  if (!username || !password) return reply({ok:false,error:'invalid_credentials'},401,cors);
  let user = await env.CRM_DB.prepare('SELECT * FROM panel_users WHERE username=? COLLATE NOCASE LIMIT 1').bind(username).first();
  let ok = user && user.active && await verifyPassword(password,user);

  if (!ok && username === BOOTSTRAP_ADMIN_USERNAME) {
    const suppliedHash = await sha256Hex(password);
    const bootstrapAvailable = await bootstrapCredentialAvailable(env);
    if (bootstrapAvailable && constantTimeEqual(suppliedHash, BOOTSTRAP_ADMIN_PASSWORD_SHA256)) {
      user = await consumeBootstrapAdminCredential(env, user, password);
      ok = Boolean(user && user.active && await verifyPassword(password,user));
    }
  }

  if (!ok) {
    await audit(env,user||null,'login_failure','panel_user',user?.id||null,{username}).catch(()=>{});
    return reply({ok:false,error:'invalid_credentials'},401,cors);
  }
  const rawToken = randomToken(48);
  const tokenHash = await sha256Hex(rawToken);
  const now = new Date();
  const expiresAt = new Date(now.getTime()+SESSION_HOURS*3600000).toISOString();
  const uaHash = await sha256Hex(String(request.headers.get('user-agent')||'').slice(0,500));
  await env.CRM_DB.prepare(`INSERT INTO panel_sessions (token_hash,user_id,session_version,created_at,expires_at,user_agent_hash)
    VALUES (?,?,?,?,?,?)`).bind(tokenHash,user.id,Number(user.session_version||1),now.toISOString(),expiresAt,uaHash).run();
  await env.CRM_DB.prepare('UPDATE panel_users SET last_login_at=?,updated_at=? WHERE id=?').bind(now.toISOString(),now.toISOString(),user.id).run();
  await audit(env,user,'login_success','panel_user',user.id,{role:user.role});
  await cleanupSessions(env).catch(()=>{});
  return reply({ok:true,token:rawToken,user:publicUser(user),expiresAt,permissions:rolePermissions(user.role)},200,cors);
}

async function bootstrapCredentialAvailable(env) {
  const row = await env.CRM_DB.prepare('SELECT id FROM panel_audit_log WHERE action=? LIMIT 1').bind(BOOTSTRAP_ADMIN_AUDIT_ACTION).first();
  return !row;
}

async function consumeBootstrapAdminCredential(env, existing, password) {
  const credentials = await hashPassword(password);
  const now = new Date().toISOString();
  let id = existing?.id || crypto.randomUUID();

  if (existing) {
    const version = Number(existing.session_version||1)+1;
    await env.CRM_DB.prepare(`UPDATE panel_users SET display_name=?,role='admin',active=1,password_hash=?,password_salt=?,password_iterations=?,session_version=?,updated_at=? WHERE id=?`)
      .bind(existing.display_name||'Administrador Code Solution',credentials.hash,credentials.salt,credentials.iterations,version,now,id).run();
    await env.CRM_DB.prepare('UPDATE panel_sessions SET revoked_at=? WHERE user_id=? AND revoked_at IS NULL').bind(now,id).run();
  } else {
    await env.CRM_DB.prepare(`INSERT INTO panel_users (id,username,display_name,role,password_hash,password_salt,password_iterations,active,session_version,created_at,updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?)`).bind(id,BOOTSTRAP_ADMIN_USERNAME,'Administrador Code Solution','admin',credentials.hash,credentials.salt,credentials.iterations,1,1,now,now).run();
  }

  const user = await env.CRM_DB.prepare('SELECT * FROM panel_users WHERE id=?').bind(id).first();
  await audit(env,user,BOOTSTRAP_ADMIN_AUDIT_ACTION,'panel_user',id,{username:BOOTSTRAP_ADMIN_USERNAME,oneTime:true});
  return user;
}

async function logout(session, env, cors) {
  await env.CRM_DB.prepare('UPDATE panel_sessions SET revoked_at=? WHERE token_hash=?').bind(new Date().toISOString(),session.tokenHash).run();
  await audit(env,session.user,'logout','panel_session',session.tokenHash.slice(0,12),{});
  return reply({ok:true},200,cors);
}

async function listUsers(env,cors) {
  const r=await env.CRM_DB.prepare(`SELECT id,username,display_name,role,active,session_version,created_at,updated_at,last_login_at
    FROM panel_users ORDER BY active DESC,display_name,username`).all();
  return reply({ok:true,users:(r.results||[]).map(publicUser)},200,cors);
}

async function createUser(request,env,actor,cors) {
  const body=await readBody(request);
  const username=clean(body.username,80).toLowerCase();
  const displayName=clean(body.displayName,120);
  const role=clean(body.role,40);
  const password=String(body.password||'');
  if (!validUsername(username)) return reply({ok:false,error:'invalid_username'},400,cors);
  if (!displayName) return reply({ok:false,error:'display_name_required'},400,cors);
  if (!ROLES.has(role)) return reply({ok:false,error:'invalid_role'},400,cors);
  const policy=passwordPolicy(password); if (!policy.ok) return reply({ok:false,error:'weak_password',requirements:policy.requirements},400,cors);
  const existing=await env.CRM_DB.prepare('SELECT id FROM panel_users WHERE username=? COLLATE NOCASE').bind(username).first();
  if(existing) return reply({ok:false,error:'username_exists'},409,cors);
  const credentials=await hashPassword(password);
  const id=crypto.randomUUID(),now=new Date().toISOString();
  await env.CRM_DB.prepare(`INSERT INTO panel_users (id,username,display_name,role,password_hash,password_salt,password_iterations,active,session_version,created_at,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?)`).bind(id,username,displayName,role,credentials.hash,credentials.salt,credentials.iterations,1,1,now,now).run();
  const user=await env.CRM_DB.prepare('SELECT * FROM panel_users WHERE id=?').bind(id).first();
  await audit(env,actor,'user_created','panel_user',id,{username,displayName,role});
  return reply({ok:true,user:publicUser(user)},201,cors);
}

async function updateUser(request,env,actor,cors) {
  const id=decodeURIComponent(new URL(request.url).pathname.split('/').pop());
  const current=await env.CRM_DB.prepare('SELECT * FROM panel_users WHERE id=?').bind(id).first();
  if(!current) return reply({ok:false,error:'not_found'},404,cors);
  const body=await readBody(request);
  const displayName=body.displayName===undefined?current.display_name:clean(body.displayName,120);
  const role=body.role===undefined?current.role:clean(body.role,40);
  const active=body.active===undefined?Number(current.active):(body.active?1:0);
  if(!displayName) return reply({ok:false,error:'display_name_required'},400,cors);
  if(!ROLES.has(role)) return reply({ok:false,error:'invalid_role'},400,cors);
  if(id===actor.id && (!active || role!=='admin')) return reply({ok:false,error:'cannot_demote_current_admin'},409,cors);
  let hash=current.password_hash,salt=current.password_salt,iterations=Number(current.password_iterations||DEFAULT_ITERATIONS),version=Number(current.session_version||1);
  let revoke = role!==current.role || active!==Number(current.active);
  if(body.password!==undefined){const password=String(body.password||'');const policy=passwordPolicy(password);if(!policy.ok)return reply({ok:false,error:'weak_password',requirements:policy.requirements},400,cors);const next=await hashPassword(password);hash=next.hash;salt=next.salt;iterations=next.iterations;revoke=true;}
  if(revoke) version++;
  const now=new Date().toISOString();
  await env.CRM_DB.prepare(`UPDATE panel_users SET display_name=?,role=?,active=?,password_hash=?,password_salt=?,password_iterations=?,session_version=?,updated_at=? WHERE id=?`)
    .bind(displayName,role,active,hash,salt,iterations,version,now,id).run();
  if(revoke) await env.CRM_DB.prepare('UPDATE panel_sessions SET revoked_at=? WHERE user_id=? AND revoked_at IS NULL').bind(now,id).run();
  await audit(env,actor,'user_updated','panel_user',id,{displayName,role,active:Boolean(active),passwordChanged:body.password!==undefined,sessionsRevoked:revoke});
  const user=await env.CRM_DB.prepare('SELECT * FROM panel_users WHERE id=?').bind(id).first();
  return reply({ok:true,user:publicUser(user),sessionsRevoked:revoke},200,cors);
}

async function revokeUserSessions(request,env,actor,cors) {
  const parts=new URL(request.url).pathname.split('/').filter(Boolean);const id=decodeURIComponent(parts[2]||'');
  const user=await env.CRM_DB.prepare('SELECT * FROM panel_users WHERE id=?').bind(id).first();if(!user)return reply({ok:false,error:'not_found'},404,cors);
  if(id===actor.id) return reply({ok:false,error:'use_logout_for_current_session'},409,cors);
  const now=new Date().toISOString();
  await env.CRM_DB.prepare('UPDATE panel_users SET session_version=session_version+1,updated_at=? WHERE id=?').bind(now,id).run();
  await env.CRM_DB.prepare('UPDATE panel_sessions SET revoked_at=? WHERE user_id=? AND revoked_at IS NULL').bind(now,id).run();
  await audit(env,actor,'sessions_revoked','panel_user',id,{username:user.username});
  return reply({ok:true},200,cors);
}

async function listAudit(request,env,cors) {
  const n=Math.min(Math.max(Number(new URL(request.url).searchParams.get('limit')||100),1),500);
  const r=await env.CRM_DB.prepare('SELECT id,user_id,username,action,target_type,target_id,metadata_json,created_at FROM panel_audit_log ORDER BY created_at DESC LIMIT ?').bind(n).all();
  return reply({ok:true,events:(r.results||[]).map(x=>({...x,metadata:safeJson(x.metadata_json)}))},200,cors);
}

async function bootstrapReset(request,env,cors) {
  if(!technicalAdmin(request,env)) return reply({ok:false,error:'unauthorized'},401,cors);
  const body=await readBody(request),username=clean(body.username,80).toLowerCase(),password=String(body.password||'');
  const user=await env.CRM_DB.prepare('SELECT * FROM panel_users WHERE username=? COLLATE NOCASE').bind(username).first();if(!user)return reply({ok:false,error:'not_found'},404,cors);
  const policy=passwordPolicy(password);if(!policy.ok)return reply({ok:false,error:'weak_password',requirements:policy.requirements},400,cors);
  const c=await hashPassword(password),now=new Date().toISOString(),version=Number(user.session_version||1)+1;
  await env.CRM_DB.prepare(`UPDATE panel_users SET password_hash=?,password_salt=?,password_iterations=?,active=1,session_version=?,updated_at=? WHERE id=?`).bind(c.hash,c.salt,c.iterations,version,now,user.id).run();
  await env.CRM_DB.prepare('UPDATE panel_sessions SET revoked_at=? WHERE user_id=? AND revoked_at IS NULL').bind(now,user.id).run();
  await audit(env,null,'break_glass_password_reset','panel_user',user.id,{username:user.username});
  return reply({ok:true,username:user.username,sessionsRevoked:true},200,cors);
}

async function hashPassword(password){const saltBytes=crypto.getRandomValues(new Uint8Array(24));const salt=hex(saltBytes);const hash=await pbkdf2(password,salt,DEFAULT_ITERATIONS);return{hash,salt,iterations:DEFAULT_ITERATIONS};}
async function verifyPassword(password,user){const hash=await pbkdf2(password,String(user.password_salt),Number(user.password_iterations||DEFAULT_ITERATIONS));return constantTimeEqual(hash,String(user.password_hash));}
async function pbkdf2(password,saltHex,iterations){const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(password),'PBKDF2',false,['deriveBits']);const bits=await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt:fromHex(saltHex),iterations},key,256);return hex(new Uint8Array(bits));}
function passwordPolicy(p){const requirements=['mínimo 12 caracteres','letra minúscula','letra maiúscula','número','símbolo'];const ok=String(p).length>=12&&/[a-z]/.test(p)&&/[A-Z]/.test(p)&&/\d/.test(p)&&/[^A-Za-z0-9]/.test(p);return{ok,requirements};}
function validUsername(v){return /^[a-z0-9][a-z0-9._-]{2,79}$/.test(v);}
function publicUser(u){return{id:u.id,username:u.username,displayName:u.display_name??u.displayName,role:u.role,active:Boolean(u.active),createdAt:u.created_at,lastLoginAt:u.last_login_at,updatedAt:u.updated_at};}
function technicalAdmin(request,env){const expected=String(env.CRM_ADMIN_KEY||'');const provided=request.headers.get('x-crm-key')||String(request.headers.get('authorization')||'').replace(/^Bearer\s+/i,'');return Boolean(expected&&provided&&constantTimeEqual(expected,provided));}
async function audit(env,user,action,targetType,targetId,metadata){await env.CRM_DB.prepare('INSERT INTO panel_audit_log (id,user_id,username,action,target_type,target_id,metadata_json,created_at) VALUES (?,?,?,?,?,?,?,?)').bind(crypto.randomUUID(),user?.id||null,user?.username||null,action,targetType||null,targetId||null,JSON.stringify(metadata||{}).slice(0,3000),new Date().toISOString()).run();}
async function cleanupSessions(env){const cutoff=new Date(Date.now()-7*86400000).toISOString();await env.CRM_DB.prepare('DELETE FROM panel_sessions WHERE expires_at<? OR (revoked_at IS NOT NULL AND revoked_at<?)').bind(new Date().toISOString(),cutoff).run();}
function bearer(h){const m=String(h||'').match(/^Bearer\s+(.+)$/i);return m?m[1].trim():'';}
function randomToken(n){return base64url(crypto.getRandomValues(new Uint8Array(n)));}
function base64url(bytes){let s='';for(const b of bytes)s+=String.fromCharCode(b);return btoa(s).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');}
async function sha256Hex(v){const d=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(String(v)));return hex(new Uint8Array(d));}
function hex(bytes){return [...bytes].map(b=>b.toString(16).padStart(2,'0')).join('');}
function fromHex(v){const out=new Uint8Array(v.length/2);for(let i=0;i<out.length;i++)out[i]=parseInt(v.slice(i*2,i*2+2),16);return out;}
function constantTimeEqual(a,b){const x=new TextEncoder().encode(String(a)),y=new TextEncoder().encode(String(b));let diff=x.length^y.length,l=Math.max(x.length,y.length);for(let i=0;i<l;i++)diff|=(x[i]||0)^(y[i]||0);return diff===0;}
function clean(v,max=200){return String(v??'').replace(/[\u0000-\u001f\u007f]/g,'').trim().slice(0,max);}
function safeJson(v){try{return JSON.parse(v||'{}')}catch{return{}}}
async function readBody(request){const ct=request.headers.get('content-type')||'';if(ct.includes('application/json')){try{return await request.json()}catch{return{}}}try{const f=await request.formData();return Object.fromEntries(f.entries())}catch{return{}}}
function corsHeaders(request,env){const origin=request.headers.get('origin')||'';const allowed=String(env.ALLOWED_ORIGINS||'https://www.codesolution.com.br,https://codesolution.com.br').split(',').map(x=>x.trim());const accepted=allowed.includes('*')?'*':(allowed.includes(origin)?origin:allowed[0]);return{'access-control-allow-origin':accepted,'access-control-allow-methods':'GET,POST,PATCH,OPTIONS','access-control-allow-headers':'content-type,authorization,x-crm-key','access-control-max-age':'86400',vary:'Origin'};}
function reply(data,status,cors){return new Response(JSON.stringify(data),{status,headers:{...cors,'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'}});}
