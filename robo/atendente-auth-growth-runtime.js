import growthRuntime from './atendente-growth-runtime.js';
import { handlePanelAuth } from './panel-auth.js';
import { handlePanelAuthEnhancements } from './panel-auth-enhancements.js';

export default {
  async fetch(request, env, ctx) {
    let enhancedAuth = null;
    try {
      enhancedAuth = await handlePanelAuthEnhancements(request, env);
    } catch (error) {
      console.error('Panel auth enhancement failed; continuing with core authentication.', String(error?.message || error).slice(0, 500));
    }
    if (enhancedAuth) return enhancedAuth;

    const auth = await handlePanelAuth(request, env);
    if (auth) return auth;

    return growthRuntime.fetch(request, env, ctx);
  },

  async scheduled(event, env, ctx) {
    if (typeof growthRuntime.scheduled === 'function') return growthRuntime.scheduled(event, env, ctx);
  },
};
