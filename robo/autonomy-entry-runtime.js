import baseRuntime from './lead-email-runtime.js';
import { AUTONOMY_AGENTS, handleAutonomyApi, runAutonomousOrchestrator } from './autonomous-os.js';
import { OPERATIONAL_AGENTS, enrichAutonomySummaryResponse, handleOperationalAgentApi, runOperationalAgents } from './operational-agents.js';
import { DELIVERY_AGENT_V2, handleDeliveryAgentV2Api, runDeliveryAgentV2 } from './delivery-agent-v2.js';
import { handleAutonomyTelemetryApi } from './autonomy-telemetry.js';
import {
  AUTONOMY_POLICY_VERSION,
  RESILIENCE_AGENT,
  enrichResilienceSummaryResponse,
  getResilienceHealth,
  handleResilienceApi,
  isGlobalAutonomyEnabled,
  runAutonomyMaintenance,
} from './autonomy-resilience.js';

const AUTONOMY_BUILD = 'autonomous-os-2026-09-01.delivery-v2';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === '/autonomy/health' && request.method === 'GET') {
      const core = AUTONOMY_AGENTS.filter((agent) => String(agent.status).startsWith('active')).map((agent) => agent.id);
      const operational = OPERATIONAL_AGENTS.filter((agent) => String(agent.status).startsWith('active')).map((agent) => agent.id);
      const resilience = await getResilienceHealth(env);
      return new Response(JSON.stringify({
        ok: true,
        service: 'code-solution-autonomous-os',
        build: AUTONOMY_BUILD,
        failMode: 'fail_closed',
        policyVersion: AUTONOMY_POLICY_VERSION,
        globalAutonomyEnabled: resilience.globalEnabled,
        resilience,
        agents: [...new Set([...core, ...operational, DELIVERY_AGENT_V2.id, RESILIENCE_AGENT.id])],
        operationalAgents: [...new Set([...operational, DELIVERY_AGENT_V2.id])],
        governanceAgent: RESILIENCE_AGENT.id,
        delivery: { version: 2, shadowFirst: true, externalActionsExecuted: false },
        approvalGates: ['external_message', 'content_publish', 'proposal_send', 'delivery_external_activation', 'discount', 'financial_commitment', 'destructive_change'],
      }), {
        status: 200,
        headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' },
      });
    }

    const telemetryApi = await handleAutonomyTelemetryApi(request, env);
    if (telemetryApi) return telemetryApi;

    const resilienceApi = await handleResilienceApi(request, env);
    if (resilienceApi) return resilienceApi;

    const deliveryApi = await handleDeliveryAgentV2Api(request, env);
    if (deliveryApi) return deliveryApi;

    const operationalApi = await handleOperationalAgentApi(request, env);
    if (operationalApi) return operationalApi;

    if (url.pathname === '/crm/autonomy/run' && request.method === 'POST') {
      if (!authorizeAdmin(request, env)) return json({ ok: false, error: 'unauthorized' }, 401);
      if (!env.CRM_DB) return json({ ok: false, error: 'autonomy_db_not_configured' }, 503);
      const maintenance = await runAutonomyMaintenance(env, { trigger: 'manual_preflight' });
      const enabled = await isGlobalAutonomyEnabled(env);
      if (!enabled) return json({ ok: true, disabled: true, reason: 'global_kill_switch', maintenance }, 200);
      const core = await runAutonomousOrchestrator(env, { trigger: 'manual' });
      const operational = await runOperationalAgents(env, { trigger: 'manual' });
      const deliveryV2 = await runDeliveryAgentV2(env, { trigger: 'manual' });
      return json({ ok: true, ...core, operational, deliveryV2, maintenance, policyVersion: AUTONOMY_POLICY_VERSION }, 200);
    }

    const autonomy = await handleAutonomyApi(request, env);
    if (autonomy) {
      if (url.pathname === '/crm/autonomy/summary' && request.method === 'GET') {
        const operationalSummary = await enrichAutonomySummaryResponse(autonomy, env);
        return enrichResilienceSummaryResponse(operationalSummary, env);
      }
      return autonomy;
    }
    return baseRuntime.fetch(request, env, ctx);
  },

  async scheduled(event, env, ctx) {
    if (typeof baseRuntime.scheduled === 'function') await baseRuntime.scheduled(event, env, ctx);
    ctx.waitUntil((async () => {
      try {
        await runAutonomyMaintenance(env, { trigger: 'scheduled_30m_preflight' });
        if (!(await isGlobalAutonomyEnabled(env))) return;
        const results = await Promise.allSettled([
          runAutonomousOrchestrator(env, { trigger: 'scheduled_30m' }),
          (async () => {
            const operational = await runOperationalAgents(env, { trigger: 'scheduled_30m' });
            const deliveryV2 = await runDeliveryAgentV2(env, { trigger: 'scheduled_30m' });
            return { operational, deliveryV2 };
          })(),
        ]);
        for (const result of results) {
          if (result.status === 'rejected') console.error('Autonomous OS scheduled run failed', String(result.reason?.message || result.reason).slice(0, 500));
        }
      } catch (error) {
        console.error('Autonomous governance preflight failed closed', String(error?.message || error).slice(0, 500));
      }
    })());
  },
};

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

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' },
  });
}
