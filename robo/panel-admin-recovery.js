// Recovery release marker: 2026-09-02 final owner CRM credential reset v5
const RECOVERY_USERNAME = 'admin';
const RECOVERY_PASSWORD_SHA256 = 'c4467ec1a165ac8214bb31db4fffdc45e8ea0612e8e2e696f2cc701de9a5a325';
const RECOVERY_AUDIT_ACTION = 'admin_recovery_2026_09_02_final_v5';
const PASSWORD_ITERATIONS = 100000;
const SESSION_HOURS = 8;

const ADMIN_PERMISSIONS = [
  'overview','crm_read','crm_write','attendance','agenda','prospecting',
  'marketing','intelligence','growth','reports','users',
];

export async function handlePanelAdminRecovery(request, env) {
  const url = new URL(request.url);
  if (url.pathname !== '/auth/login' || request.method !== 'POST' || !env.CRM_DB) return null;

  let body = {};
  try { body = await request.clone().json(); } catch { return null; }
  const username = String(body.username || '').trim().toLowerCase();
  const password = String(body.password || '');
  if (username !== RECOVERY_USERNAME || !password) return null;

  const suppliedHash = await sha256Hex(password);
  if (!constantTimeEqual(suppliedHash, RECOVERY_PASSWORD_SHA256)) return null;

  const consumed = await env.CRM_DB.prepare('SELECT id FROM panel_audit_log WHERE action=? LIMIT 1')
    .bind(RECOVERY_AUDIT_ACTION).first();
  if (consumed) return null;

  const now = new Date();
  const nowIso = now.toISOString();
  let user = await env.CRM_DB.prepare('SELECT * FROM panel_users WHERE username=? COLLATE NOCASE LIMIT 1')
    .bind(RECOVERY_USERNAME).first();
  const credentials = await hashPassword(password);

  if (user) {
    const version = Number(user.session_version || 1) + 1;
    await env.CRM_DB.prepare(`UPDATE panel_users
      SET display_name=?,role='admin',active=1,password_hash=?,password_salt=?,password_iterations=?,session_version=?,updated_at=?
      WHERE id=?`)
      .bind(
        user.display_name || 'Administrador Code Solution',
        credentials.hash,
        credentials.salt,
        credentials.iterations,
        version,
        nowIso,
        user.id,
      ).run();
    await env.CRM_DB.prepare('UPDATE panel_sessions SET revoked_at=? WHERE user_id=? AND revoked_at IS NULL')
      .bind(nowIso, user.id).run();
  } else {
    const id = crypto.randomUUID();
    await env.CRM_DB.prepare(`INSERT INTO panel_users
      (id,username,display_name,role,password_hash,password_salt,password_iterations,active,session_version,created_at,updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?)`)
      .bind(
        id,
        RECOVERY_USERNAME,
        'Administrador Code Solution',
        'admin',
        credentials.hash,
        credentials.salt,
        credentials.iterations,
        1,
        1,
        nowIso,
        nowIso,
      ).run();
  }

  user = await env.CRM_DB.prepare('SELECT * FROM panel_users WHERE username=? COLLATE NOCASE LIMIT 1')
    .bind(RECOVERY_USERNAME).first();
  if (!user) return reply({ ok:false, error:'recovery_user_unavailable' }, 500, request);

  await env.CRM_DB.prepare(`INSERT INTO panel_audit_log
    (id,user_id,username,action,target_type,target_id,metadata_json,created_at)
    VALUES (?,?,?,?,?,?,?,?)`)
    .bind(
      crypto.randomUUID(),
      user.id,
      user.username,
      RECOVERY_AUDIT_ACTION,
      'panel_user',
      user.id,
      JSON.stringify({ oneTime:true, reason:'final-owner-crm-credential-reset-v5' }),
      nowIso,
    ).run();

  const rawToken = randomToken(48);
  const tokenHash = await sha256Hex(rawToken);
  const expiresAt = new Date(now.getTime() + SESSION_HOURS * 3600000).toISOString();
  const uaHash = await sha256Hex(String(request.headers.get('user-agent') || '').slice(0, 500));

  await env.CRM_DB.prepare(`INSERT INTO panel_sessions
    (token_hash,user_id,session_version,created_at,expires_at,user_agent_hash)
    VALUES (?,?,?,?,?,?)`)
    .bind(
      tokenHash,
      user.id,
      Number(user.session_version || 1),
      nowIso,
      expiresAt,
      uaHash,
    ).run();

  await env.CRM_DB.prepare('UPDATE panel_users SET last_login_at=?,updated_at=? WHERE id=?')
    .bind(nowIso, nowIso, user.id).run();

  return reply({
    ok: true,
    token: rawToken,
    user: {
      id: user.id,
      username: user.username,
      displayName: user.display_name,
      role: 'admin',
      active: true,
    },
    expiresAt,
    permissions: ADMIN_PERMISSIONS,
    recoveryConsumed: true,
  }, 200, request);
}

async function hashPassword(password) {
  const saltBytes = crypto.getRandomValues(new Uint8Array(24));
  const salt = hex(saltBytes);
  const hash = await pbkdf2(password, salt, PASSWORD_ITERATIONS);
  return { hash, salt, iterations: PASSWORD_ITERATIONS };
}

async function pbkdf2(password, saltHex, iterations) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({
    name:'PBKDF2',
    hash:'SHA-256',
    salt:fromHex(saltHex),
    iterations,
  }, key, 256);
  return hex(new Uint8Array(bits));
}

async function sha256Hex(value) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(value)));
  return hex(new Uint8Array(bytes));
}

function randomToken(length) {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function constantTimeEqual(a, b) {
  const x = new TextEncoder().encode(String(a));
  const y = new TextEncoder().encode(String(b));
  let diff = x.length ^ y.length;
  const length = Math.max(x.length, y.length);
  for (let i = 0; i < length; i++) diff |= (x[i] || 0) ^ (y[i] || 0);
  return diff === 0;
}

function hex(bytes) {
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function fromHex(value) {
  const out = new Uint8Array(value.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(value.slice(i * 2, i * 2 + 2), 16);
  return out;
}

function reply(data, status, request) {
  const origin = String(request.headers.get('origin') || '');
  const headers = {
    'content-type':'application/json; charset=utf-8',
    'cache-control':'no-store',
    'x-content-type-options':'nosniff',
  };
  if (origin === 'https://www.codesolution.com.br' || origin === 'https://codesolution.com.br') {
    headers['access-control-allow-origin'] = origin;
    headers['vary'] = 'Origin';
  }
  return new Response(JSON.stringify(data), { status, headers });
}
