import { authenticatePanelSession } from './panel-auth.js';

const LOGIN_WINDOW_MINUTES = 15;
const LOGIN_FAILURE_LIMIT = 8;
const PASSWORD_ITERATIONS = 180000;

export async function handlePanelAuthEnhancements(request, env) {
  const url = new URL(request.url);
  if (!url.pathname.startsWith('/auth/')) return null;
  if (!env.CRM_DB) return null;

  if (url.pathname === '/auth/login' && request.method === 'POST') {
    return enforceLoginRateLimit(request, env);
  }

  if (url.pathname === '/auth/me/password' && request.method === 'POST') {
    return changeOwnPassword(request, env);
  }

  if (url.pathname === '/auth/me/security' && request.method === 'GET') {
    return securitySummary(request, env);
  }

  if (url.pathname === '/auth/me/revoke-others' && request.method === 'POST') {
    return revokeOtherSessions(request, env);
  }

  return null;
}

async function enforceLoginRateLimit(request, env) {
  const body = await readJson(request.clone());
  const username = clean(body.username, 80).toLowerCase();
  if (!username) return null;

  const cutoff = new Date(Date.now() - LOGIN_WINDOW_MINUTES * 60_000).toISOString();
  const like = `%\"username\":\"${escapeLike(username)}\"%`;
  const row = await env.CRM_DB.prepare(`SELECT COUNT(*) AS n
    FROM panel_audit_log
    WHERE action='login_failure'
      AND created_at>=?
      AND (username=? COLLATE NOCASE OR metadata_json LIKE ? ESCAPE '\\')`)
    .bind(cutoff, username, like).first();

  const failures = Number(row?.n || 0);
  if (failures < LOGIN_FAILURE_LIMIT) return null;

  await audit(env, null, 'login_rate_limited', 'panel_user', null, {
    username,
    failures,
    windowMinutes: LOGIN_WINDOW_MINUTES,
  }).catch(() => {});

  return reply({
    ok: false,
    error: 'too_many_login_attempts',
    retryAfterSeconds: LOGIN_WINDOW_MINUTES * 60,
  }, 429, {
    'Retry-After': String(LOGIN_WINDOW_MINUTES * 60),
    'X-RateLimit-Limit': String(LOGIN_FAILURE_LIMIT),
    'X-RateLimit-Remaining': '0',
  });
}

async function changeOwnPassword(request, env) {
  const session = await authenticatePanelSession(request, env);
  if (!session) return reply({ ok:false, error:'unauthorized' }, 401);

  const body = await readJson(request);
  const currentPassword = String(body.currentPassword || '');
  const newPassword = String(body.newPassword || '');
  if (!currentPassword || !newPassword) return reply({ ok:false, error:'passwords_required' }, 400);

  const policy = passwordPolicy(newPassword);
  if (!policy.ok) return reply({ ok:false, error:'weak_password', requirements:policy.requirements }, 400);

  const user = await env.CRM_DB.prepare('SELECT * FROM panel_users WHERE id=? LIMIT 1')
    .bind(session.user.id).first();
  if (!user || !user.active) return reply({ ok:false, error:'unauthorized' }, 401);

  const currentOk = await verifyPassword(currentPassword, user);
  if (!currentOk) {
    await audit(env, session.user, 'password_change_failure', 'panel_user', user.id, { reason:'current_password_invalid' }).catch(() => {});
    return reply({ ok:false, error:'current_password_invalid' }, 401);
  }

  const sameAsCurrent = await verifyPassword(newPassword, user);
  if (sameAsCurrent) return reply({ ok:false, error:'password_must_change' }, 409);

  const credentials = await hashPassword(newPassword);
  const now = new Date().toISOString();
  const nextVersion = Number(user.session_version || 1) + 1;

  await env.CRM_DB.prepare(`UPDATE panel_users
    SET password_hash=?,password_salt=?,password_iterations=?,session_version=?,updated_at=?
    WHERE id=?`)
    .bind(credentials.hash, credentials.salt, credentials.iterations, nextVersion, now, user.id).run();

  await env.CRM_DB.prepare('UPDATE panel_sessions SET revoked_at=? WHERE user_id=? AND revoked_at IS NULL')
    .bind(now, user.id).run();

  await audit(env, session.user, 'password_changed_self', 'panel_user', user.id, {
    sessionsRevoked: true,
    sessionVersion: nextVersion,
  });

  return reply({ ok:true, reauthenticate:true, sessionsRevoked:true }, 200);
}

async function revokeOtherSessions(request, env) {
  const session = await authenticatePanelSession(request, env);
  if (!session) return reply({ ok:false, error:'unauthorized' }, 401);

  const now = new Date().toISOString();
  const result = await env.CRM_DB.prepare(`UPDATE panel_sessions
    SET revoked_at=?
    WHERE user_id=? AND token_hash<>? AND revoked_at IS NULL AND expires_at>?`)
    .bind(now, session.user.id, session.tokenHash, now).run();
  const revoked = Number(result?.meta?.changes || 0);

  await audit(env, session.user, 'other_sessions_revoked_self', 'panel_user', session.user.id, {
    revoked,
    currentSessionPreserved: true,
  });

  return reply({ ok:true, revoked, currentSessionPreserved:true }, 200);
}

async function securitySummary(request, env) {
  const session = await authenticatePanelSession(request, env);
  if (!session) return reply({ ok:false, error:'unauthorized' }, 401);

  const cutoff = new Date(Date.now() - LOGIN_WINDOW_MINUTES * 60_000).toISOString();
  const [failures, sessions, passwordEvent] = await Promise.all([
    env.CRM_DB.prepare(`SELECT COUNT(*) AS n FROM panel_audit_log
      WHERE action='login_failure' AND created_at>=? AND username=? COLLATE NOCASE`)
      .bind(cutoff, session.user.username).first(),
    env.CRM_DB.prepare(`SELECT COUNT(*) AS n FROM panel_sessions
      WHERE user_id=? AND revoked_at IS NULL AND expires_at>?`)
      .bind(session.user.id, new Date().toISOString()).first(),
    env.CRM_DB.prepare(`SELECT created_at FROM panel_audit_log
      WHERE user_id=? AND action IN ('password_changed_self','break_glass_password_reset','user_updated')
      ORDER BY created_at DESC LIMIT 1`)
      .bind(session.user.id).first(),
  ]);

  return reply({
    ok: true,
    user: session.user,
    security: {
      failedLogins15m: Number(failures?.n || 0),
      activeSessions: Number(sessions?.n || 0),
      passwordUpdatedAt: passwordEvent?.created_at || null,
      loginWindowMinutes: LOGIN_WINDOW_MINUTES,
      loginFailureLimit: LOGIN_FAILURE_LIMIT,
    },
  }, 200);
}

async function hashPassword(password) {
  const saltBytes = crypto.getRandomValues(new Uint8Array(24));
  const salt = hex(saltBytes);
  const hash = await pbkdf2(password, salt, PASSWORD_ITERATIONS);
  return { hash, salt, iterations: PASSWORD_ITERATIONS };
}

async function verifyPassword(password, user) {
  const hash = await pbkdf2(password, String(user.password_salt), Number(user.password_iterations || PASSWORD_ITERATIONS));
  return constantTimeEqual(hash, String(user.password_hash));
}

async function pbkdf2(password, saltHex, iterations) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name:'PBKDF2', hash:'SHA-256', salt:fromHex(saltHex), iterations }, key, 256);
  return hex(new Uint8Array(bits));
}

function passwordPolicy(password) {
  const value = String(password || '');
  const requirements = ['mínimo 12 caracteres','letra minúscula','letra maiúscula','número','símbolo'];
  const ok = value.length >= 12 && /[a-z]/.test(value) && /[A-Z]/.test(value) && /\d/.test(value) && /[^A-Za-z0-9]/.test(value);
  return { ok, requirements };
}

async function audit(env, user, action, targetType, targetId, metadata) {
  await env.CRM_DB.prepare(`INSERT INTO panel_audit_log
    (id,user_id,username,action,target_type,target_id,metadata_json,created_at)
    VALUES (?,?,?,?,?,?,?,?)`)
    .bind(
      crypto.randomUUID(),
      user?.id || null,
      user?.username || null,
      action,
      targetType || null,
      targetId || null,
      JSON.stringify(metadata || {}).slice(0, 3000),
      new Date().toISOString(),
    ).run();
}

async function readJson(request) {
  try { return await request.json(); } catch { return {}; }
}

function reply(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type':'application/json; charset=utf-8',
      'cache-control':'no-store',
      'x-content-type-options':'nosniff',
      ...extraHeaders,
    },
  });
}

function clean(value, max) {
  return String(value || '').replace(/[<>]/g, '').trim().slice(0, max);
}

function escapeLike(value) {
  return String(value).replace(/[\\%_]/g, (char) => `\\${char}`);
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
