import baseWorker from './worker.js';
import {
  getGrowthStatus,
  runSocialAgent,
  runWeeklyPlanAgent,
  snapshotGrowthMetrics,
} from './growth-engine.js';
import { runRadarAgentRobust } from './radar-agent.js';

const DAILY_CRON = '0 11 * * 1-5';
const BLOG_CRON = '0 12 * * 2,5';
const PLAN_CRON = '0 13 * * 1';
const METRICS_CRON = '0 20 * * 5';
const BUILD = 'growth-orchestrator-2026-08-24.2';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === '/growth/status' && request.method === 'GET') {
      try {
        const status = await getGrowthStatus(env);
        return json({ ...status, build: BUILD, schedules: { daily: DAILY_CRON, blog: BLOG_CRON, weeklyPlan: PLAN_CRON, metrics: METRICS_CRON } });
      } catch (error) {
        return json({ ok: false, error: cleanError(error), build: BUILD }, 500);
      }
    }

    if (url.pathname === '/run-growth' && request.method === 'POST') {
      if (!safeEqual(url.searchParams.get('key') || '', env.MANUAL_KEY || '')) return json({ ok: false, error: 'unauthorized' }, 401);
      const agent = String(url.searchParams.get('agent') || 'daily').toLowerCase();
      try {
        let result;
        if (agent === 'radar') result = await runRadarAgentRobust(env, { trigger: 'manual' });
        else if (agent === 'social') result = await runSocialAgent(env, { trigger: 'manual' });
        else if (agent === 'plan' || agent === 'planejamento') result = await runWeeklyPlanAgent(env, { trigger: 'manual' });
        else if (agent === 'metrics') result = await snapshotGrowthMetrics(env);
        else result = await runDailyGrowthRobust(env, { trigger: 'manual' });
        return json({ ok: true, agent, result, build: BUILD });
      } catch (error) {
        return json({ ok: false, agent, error: cleanError(error), build: BUILD }, 500);
      }
    }

    return baseWorker.fetch(request, env, ctx);
  },

  async scheduled(event, env, ctx) {
    const cron = String(event?.cron || '');
    if (cron === DAILY_CRON) {
      ctx.waitUntil(runDailyGrowthRobust(env, { trigger: 'cron' }).catch(logError('daily growth')));
      return;
    }
    if (cron === BLOG_CRON) {
      return baseWorker.scheduled(event, env, ctx);
    }
    if (cron === PLAN_CRON) {
      ctx.waitUntil(runWeeklyPlanAgent(env, { trigger: 'cron' }).catch(logError('weekly plan')));
      return;
    }
    if (cron === METRICS_CRON) {
      ctx.waitUntil(snapshotGrowthMetrics(env).catch(logError('metrics')));
      return;
    }
    ctx.waitUntil(runDailyGrowthRobust(env, { trigger: 'cron_fallback' }).catch(logError('fallback growth')));
  },
};

async function runDailyGrowthRobust(env, meta = {}) {
  const radar = await runRadarAgentRobust(env, meta);
  const social = await runSocialAgent(env, meta);
  const metrics = await snapshotGrowthMetrics(env);
  return { radar, social, metrics };
}

function logError(label) {
  return (error) => console.error(`${label} failed`, cleanError(error));
}
function json(value, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}
function safeEqual(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
function cleanError(error) {
  return String(error?.message || error).replace(/[A-Za-z0-9_\-]{24,}/g, '[redacted]').slice(0, 500);
}
