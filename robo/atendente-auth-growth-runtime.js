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

    try {
      const auth = await handlePanelAuth(request, env);
      if (auth) return auth;
    } catch (error) {
      console.error('Core panel authentication failed.', String(error?.message || error || 'unknown_error').replace(/[\r\n\t]/g, ' ').slice(0, 500));
      const url = new URL(request.url);
      if (url.pathname.startsWith('/auth/')) {
        return new Response(JSON.stringify({ ok:false, error:'auth_unavailable' }), {
          status: 500,
          headers: {
            'content-type':'application/json; charset=utf-8',
            'cache-control':'no-store',
            'x-content-type-options':'nosniff',
          },
        });
      }
      throw error;
    }

    return growthRuntime.fetch(request, env, ctx);
  },

  async scheduled(event, env, ctx) {
    if (typeof growthRuntime.scheduled === 'function') return growthRuntime.scheduled(event, env, ctx);
  },
};
