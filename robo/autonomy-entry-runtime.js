import baseRuntime from './atendente-auth-growth-runtime.js';
import { AUTONOMY_AGENTS, handleAutonomyApi, runAutonomousOrchestrator } from './autonomous-os.js';

const AUTONOMY_BUILD = 'autonomous-os-2026-08-26.1';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === '/autonomy/health' && request.method === 'GET') {
      return new Response(JSON.stringify({
        ok: true,
        service: 'code-solution-autonomous-os',
        build: AUTONOMY_BUILD,
        failMode: 'fail_closed',
        agents: AUTONOMY_AGENTS.filter((agent) => String(agent.status).startsWith('active')).map((agent) => agent.id),
        approvalGates: ['external_message', 'content_publish', 'proposal_send', 'discount', 'financial_commitment', 'destructive_change'],
      }), {
        status: 200,
        headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' },
      });
    }

    const autonomy = await handleAutonomyApi(request, env);
    if (autonomy) return autonomy;
    return baseRuntime.fetch(request, env, ctx);
  },

  async scheduled(event, env, ctx) {
    if (typeof baseRuntime.scheduled === 'function') await baseRuntime.scheduled(event, env, ctx);
    ctx.waitUntil(runAutonomousOrchestrator(env, { trigger: 'scheduled_30m' }).catch((error) => {
      console.error('Autonomous OS scheduled run failed', String(error?.message || error).slice(0, 500));
    }));
  },
};
