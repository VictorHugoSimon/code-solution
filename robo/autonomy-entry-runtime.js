import baseRuntime from './atendente-auth-growth-runtime.js';
import { AUTONOMY_AGENTS, handleAutonomyApi, runAutonomousOrchestrator } from './autonomous-os.js';
import { OPERATIONAL_AGENTS, enrichAutonomySummaryResponse, handleOperationalAgentApi, runOperationalAgents } from './operational-agents.js';

const AUTONOMY_BUILD = 'autonomous-os-2026-08-26.2';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === '/autonomy/health' && request.method === 'GET') {
      const core = AUTONOMY_AGENTS.filter((agent) => String(agent.status).startsWith('active')).map((agent) => agent.id);
      const operational = OPERATIONAL_AGENTS.filter((agent) => String(agent.status).startsWith('active')).map((agent) => agent.id);
      return new Response(JSON.stringify({
        ok: true,
        service: 'code-solution-autonomous-os',
        build: AUTONOMY_BUILD,
        failMode: 'fail_closed',
        agents: [...new Set([...core, ...operational])],
        operationalAgents: operational,
        approvalGates: ['external_message', 'content_publish', 'proposal_send', 'delivery_external_activation', 'discount', 'financial_commitment', 'destructive_change'],
      }), {
        status: 200,
        headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' },
      });
    }

    const operationalApi = await handleOperationalAgentApi(request, env);
    if (operationalApi) return operationalApi;

    if (url.pathname === '/crm/autonomy/run' && request.method === 'POST') {
      const coreResponse = await handleAutonomyApi(request, env);
      if (!coreResponse || !coreResponse.ok) return coreResponse;
      const core = await coreResponse.json();
      const operational = await runOperationalAgents(env, { trigger: 'manual' });
      return jsonFrom(coreResponse, { ...core, operational });
    }

    const autonomy = await handleAutonomyApi(request, env);
    if (autonomy) {
      if (url.pathname === '/crm/autonomy/summary' && request.method === 'GET') {
        return enrichAutonomySummaryResponse(autonomy, env);
      }
      return autonomy;
    }
    return baseRuntime.fetch(request, env, ctx);
  },

  async scheduled(event, env, ctx) {
    if (typeof baseRuntime.scheduled === 'function') await baseRuntime.scheduled(event, env, ctx);
    ctx.waitUntil(Promise.allSettled([
      runAutonomousOrchestrator(env, { trigger: 'scheduled_30m' }),
      runOperationalAgents(env, { trigger: 'scheduled_30m' }),
    ]).then((results) => {
      for (const result of results) if (result.status === 'rejected') console.error('Autonomous OS scheduled run failed', String(result.reason?.message || result.reason).slice(0, 500));
    }));
  },
};

function jsonFrom(source, data) {
  const headers = new Headers(source.headers);
  headers.set('content-type', 'application/json; charset=utf-8');
  headers.set('cache-control', 'no-store');
  return new Response(JSON.stringify(data), { status: source.status, headers });
}
