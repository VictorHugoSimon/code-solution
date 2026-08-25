import growthRuntime from './atendente-growth-runtime.js';
import { handlePanelAuth } from './panel-auth.js';

export default {
  async fetch(request, env, ctx) {
    const auth = await handlePanelAuth(request, env);
    if (auth) return auth;
    return growthRuntime.fetch(request, env, ctx);
  },

  async scheduled(event, env, ctx) {
    if (typeof growthRuntime.scheduled === 'function') return growthRuntime.scheduled(event, env, ctx);
  },
};
