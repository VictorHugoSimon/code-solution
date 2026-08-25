import baseRuntime from './atendente-auth-growth-runtime.js';
import { handleAutonomyApi, runAutonomousOrchestrator } from './autonomous-os.js';

export default {
  async fetch(request, env, ctx) {
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
