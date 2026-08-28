const DEFAULT_WINDOW_DAYS = 7;
const MAX_WINDOW_DAYS = 30;

export async function handleAutonomyTelemetryApi(request, env) {
  const url = new URL(request.url);
  if (url.pathname !== '/crm/autonomy/telemetry') return null;
  if (request.method !== 'GET') return json({ ok: false, error: 'method_not_allowed' }, 405);
  if (!authorizeAdmin(request, env)) return json({ ok: false, error: 'unauthorized' }, 401);
  if (!env.CRM_DB) return json({ ok: false, error: 'autonomy_db_not_configured' }, 503);

  const days = clampDays(url.searchParams.get('days'));
  try {
    const telemetry = await buildTelemetry(env.CRM_DB, days);
    return json({ ok: true, ...telemetry }, 200);
  } catch (error) {
    return json({ ok: false, error: 'telemetry_query_failed', detail: cleanError(error) }, 500);
  }
}

export async function buildTelemetry(db, days = DEFAULT_WINDOW_DAYS) {
  const safeDays = clampDays(days);
  const since = new Date(Date.now() - safeDays * 86400000).toISOString();
  const since24h = new Date(Date.now() - 86400000).toISOString();

  const [taskRows, retryRows, dlqRows, runRows, usageRows, recentRows] = await Promise.all([
    db.prepare(`SELECT
        agent,
        COUNT(*) AS total_tasks,
        SUM(CASE WHEN status='completed' THEN 1 ELSE 0 END) AS completed_tasks,
        SUM(CASE WHEN status='failed' THEN 1 ELSE 0 END) AS failed_tasks,
        SUM(CASE WHEN status='waiting_approval' THEN 1 ELSE 0 END) AS waiting_approval,
        SUM(CASE WHEN status IN ('queued','running','retry_scheduled') THEN 1 ELSE 0 END) AS active_tasks,
        AVG(CASE WHEN completed_at IS NOT NULL THEN (julianday(completed_at)-julianday(created_at))*86400.0 END) AS avg_latency_seconds,
        MAX(CASE WHEN completed_at IS NOT NULL THEN (julianday(completed_at)-julianday(created_at))*86400.0 END) AS max_latency_seconds,
        MAX(updated_at) AS last_activity_at
      FROM autonomy_tasks
      WHERE created_at >= ?
      GROUP BY agent
      ORDER BY total_tasks DESC, agent ASC`).bind(since).all(),

    db.prepare(`SELECT t.agent,
        COALESCE(SUM(r.attempts),0) AS retry_attempts,
        SUM(CASE WHEN r.status='exhausted' THEN 1 ELSE 0 END) AS exhausted_tasks,
        SUM(CASE WHEN r.status='retrying' THEN 1 ELSE 0 END) AS retrying_tasks
      FROM autonomy_task_retries r
      JOIN autonomy_tasks t ON t.id=r.task_id
      WHERE r.updated_at >= ?
      GROUP BY t.agent`).bind(since).all(),

    db.prepare(`SELECT agent,
        COUNT(*) AS dead_letters_total,
        SUM(CASE WHEN resolved_at IS NULL THEN 1 ELSE 0 END) AS dead_letters_open,
        MAX(created_at) AS last_dead_letter_at
      FROM autonomy_dead_letters
      WHERE created_at >= ? OR resolved_at IS NULL
      GROUP BY agent`).bind(since).all(),

    db.prepare(`SELECT
        COUNT(*) AS total_runs,
        SUM(CASE WHEN status='success' THEN 1 ELSE 0 END) AS successful_runs,
        SUM(CASE WHEN status='failed' THEN 1 ELSE 0 END) AS failed_runs,
        AVG(CASE WHEN completed_at IS NOT NULL THEN (julianday(completed_at)-julianday(started_at))*86400.0 END) AS avg_run_seconds,
        MAX(CASE WHEN completed_at IS NOT NULL THEN (julianday(completed_at)-julianday(started_at))*86400.0 END) AS max_run_seconds,
        MAX(started_at) AS last_run_at
      FROM autonomy_runs
      WHERE started_at >= ?`).bind(since).first(),

    db.prepare(`SELECT agent,usage_date,completed_tasks,failed_tasks,retries,dead_letters,updated_at
      FROM autonomy_agent_daily_usage
      WHERE usage_date >= date(?)
      ORDER BY usage_date ASC, agent ASC`).bind(since).all(),

    db.prepare(`SELECT id,agent,action_type,status,risk_level,approval_required,created_at,updated_at,completed_at,error_text
      FROM autonomy_tasks
      WHERE updated_at >= ?
      ORDER BY updated_at DESC
      LIMIT 30`).bind(since24h).all(),
  ]);

  const retriesByAgent = toMap(retryRows.results, 'agent');
  const dlqByAgent = toMap(dlqRows.results, 'agent');
  const dailyByAgent = groupBy(usageRows.results, 'agent');

  const agents = (taskRows.results || []).map((row) => {
    const retry = retriesByAgent.get(row.agent) || {};
    const dlq = dlqByAgent.get(row.agent) || {};
    const total = Number(row.total_tasks || 0);
    const completed = Number(row.completed_tasks || 0);
    const failed = Number(row.failed_tasks || 0);
    const terminal = completed + failed;
    const successRate = terminal ? round((completed / terminal) * 100, 1) : null;
    return {
      agent: row.agent,
      totalTasks: total,
      completedTasks: completed,
      failedTasks: failed,
      waitingApproval: Number(row.waiting_approval || 0),
      activeTasks: Number(row.active_tasks || 0),
      successRatePct: successRate,
      avgLatencySeconds: nullableRound(row.avg_latency_seconds, 1),
      maxLatencySeconds: nullableRound(row.max_latency_seconds, 1),
      retryAttempts: Number(retry.retry_attempts || 0),
      retryingTasks: Number(retry.retrying_tasks || 0),
      exhaustedTasks: Number(retry.exhausted_tasks || 0),
      deadLettersTotal: Number(dlq.dead_letters_total || 0),
      deadLettersOpen: Number(dlq.dead_letters_open || 0),
      lastActivityAt: row.last_activity_at || null,
      lastDeadLetterAt: dlq.last_dead_letter_at || null,
      daily: (dailyByAgent.get(row.agent) || []).map((day) => ({
        date: day.usage_date,
        completedTasks: Number(day.completed_tasks || 0),
        failedTasks: Number(day.failed_tasks || 0),
        retries: Number(day.retries || 0),
        deadLetters: Number(day.dead_letters || 0),
      })),
    };
  });

  const allTaskCount = agents.reduce((sum, agent) => sum + agent.totalTasks, 0);
  const allCompleted = agents.reduce((sum, agent) => sum + agent.completedTasks, 0);
  const allFailed = agents.reduce((sum, agent) => sum + agent.failedTasks, 0);
  const allTerminal = allCompleted + allFailed;
  const openDlq = agents.reduce((sum, agent) => sum + agent.deadLettersOpen, 0);
  const retryAttempts = agents.reduce((sum, agent) => sum + agent.retryAttempts, 0);
  const runTotal = Number(runRows?.total_runs || 0);
  const runSuccess = Number(runRows?.successful_runs || 0);
  const runFailed = Number(runRows?.failed_runs || 0);

  return {
    generatedAt: new Date().toISOString(),
    windowDays: safeDays,
    costTelemetry: {
      status: 'not_instrumented',
      reason: 'Token/API usage and provider pricing are not persisted per autonomous task; no financial estimate is fabricated.',
    },
    summary: {
      tasks: allTaskCount,
      completedTasks: allCompleted,
      failedTasks: allFailed,
      taskSuccessRatePct: allTerminal ? round((allCompleted / allTerminal) * 100, 1) : null,
      retryAttempts,
      openDeadLetters: openDlq,
      runs: runTotal,
      successfulRuns: runSuccess,
      failedRuns: runFailed,
      runSuccessRatePct: runTotal ? round((runSuccess / runTotal) * 100, 1) : null,
      avgRunSeconds: nullableRound(runRows?.avg_run_seconds, 1),
      maxRunSeconds: nullableRound(runRows?.max_run_seconds, 1),
      lastRunAt: runRows?.last_run_at || null,
    },
    agents,
    recentActivity: (recentRows.results || []).map((row) => ({
      id: row.id,
      agent: row.agent,
      actionType: row.action_type,
      status: row.status,
      riskLevel: row.risk_level,
      approvalRequired: Number(row.approval_required || 0) === 1,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      completedAt: row.completed_at,
      durationSeconds: durationSeconds(row.created_at, row.completed_at),
      error: row.error_text ? String(row.error_text).slice(0, 240) : null,
    })),
  };
}

function clampDays(value) {
  const parsed = Number(value || DEFAULT_WINDOW_DAYS);
  if (!Number.isFinite(parsed)) return DEFAULT_WINDOW_DAYS;
  return Math.min(MAX_WINDOW_DAYS, Math.max(1, Math.round(parsed)));
}

function toMap(rows = [], key) {
  return new Map(rows.map((row) => [row[key], row]));
}

function groupBy(rows = [], key) {
  const map = new Map();
  for (const row of rows) {
    const value = row[key];
    if (!map.has(value)) map.set(value, []);
    map.get(value).push(row);
  }
  return map;
}

function durationSeconds(start, end) {
  if (!start || !end) return null;
  const a = Date.parse(start);
  const b = Date.parse(end);
  if (!Number.isFinite(a) || !Number.isFinite(b) || b < a) return null;
  return round((b - a) / 1000, 1);
}

function nullableRound(value, digits = 1) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return null;
  return round(Number(value), digits);
}

function round(value, digits = 1) {
  const factor = 10 ** digits;
  return Math.round(Number(value) * factor) / factor;
}

function authorizeAdmin(request, env) {
  const expected = env.CRM_ADMIN_KEY || '';
  if (!expected) return false;
  const provided = request.headers.get('x-crm-key') || request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || '';
  return safeEqual(provided, expected);
}

function safeEqual(a, b) {
  const x = new TextEncoder().encode(String(a || ''));
  const y = new TextEncoder().encode(String(b || ''));
  let diff = x.length ^ y.length;
  const length = Math.max(x.length, y.length);
  for (let i = 0; i < length; i++) diff |= (x[i] || 0) ^ (y[i] || 0);
  return diff === 0;
}

function cleanError(error) {
  return String(error?.message || error || 'unknown_error').replace(/[\r\n\t]+/g, ' ').slice(0, 500);
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
    },
  });
}
