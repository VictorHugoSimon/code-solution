import fs from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const deploy = path.join(root, 'deploy');
const marker = 'data-cs-acquisition-tracking';
const scriptTag = `<script ${marker} src="/assets/acquisition-tracking.js" defer></script>`;

const client = String.raw`(() => {
  'use strict';
  const API = 'https://code-solution-atendente.victorhugoteixeirasimon6.workers.dev/event';
  const SESSION_KEY = 'cs_anon_session_v1';
  const sent = new Set();

  function clean(value, max = 180) {
    return String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, '').replace(/\s+/g, ' ').trim().slice(0, max);
  }

  function sessionId() {
    try {
      let id = localStorage.getItem(SESSION_KEY);
      if (!id || !/^[A-Za-z0-9._:-]{8,80}$/.test(id)) {
        id = (crypto.randomUUID ? crypto.randomUUID() : 's-' + Date.now() + '-' + Math.random().toString(36).slice(2));
        localStorage.setItem(SESSION_KEY, id);
      }
      return id;
    } catch {
      return 'ephemeral-' + Date.now() + '-' + Math.random().toString(36).slice(2);
    }
  }

  function attribution() {
    const q = new URLSearchParams(location.search);
    let referrerHost = '';
    try { referrerHost = document.referrer ? new URL(document.referrer).host.toLowerCase() : ''; } catch {}
    let source = clean(q.get('utm_source'), 100);
    let medium = clean(q.get('utm_medium'), 100);
    const campaign = clean(q.get('utm_campaign'), 160);
    if (!source && referrerHost) {
      if (/(^|\.)google\./.test(referrerHost)) { source = 'google'; medium = medium || 'organic'; }
      else if (/(^|\.)bing\.com$/.test(referrerHost)) { source = 'bing'; medium = medium || 'organic'; }
      else if (/(^|\.)linkedin\.com$/.test(referrerHost)) { source = 'linkedin'; medium = medium || 'social'; }
      else if (/(^|\.)instagram\.com$/.test(referrerHost)) { source = 'instagram'; medium = medium || 'social'; }
      else if (/(^|\.)facebook\.com$/.test(referrerHost)) { source = 'facebook'; medium = medium || 'social'; }
      else { source = referrerHost; medium = medium || 'referral'; }
    }
    if (!source) source = 'direct';
    if (!medium) medium = 'none';
    return { source, medium, campaign: campaign || null, referrerHost: referrerHost || null };
  }

  const attr = attribution();

  function ga(eventName, metadata) {
    try {
      if (typeof window.gtag === 'function') {
        window.gtag('event', eventName, {
          event_category: 'acquisition',
          source: attr.source,
          medium: attr.medium,
          placement: metadata?.placement || undefined,
          channel: metadata?.channel || undefined,
        });
      }
    } catch {}
  }

  function track(eventName, metadata = {}, onceKey = '') {
    const key = onceKey || '';
    if (key && sent.has(key)) return;
    if (key) sent.add(key);
    const body = {
      eventName,
      sessionId: sessionId(),
      pagePath: location.pathname,
      source: attr.source,
      medium: attr.medium,
      campaign: attr.campaign,
      referrerHost: attr.referrerHost,
      metadata,
    };
    ga(eventName, metadata);
    fetch(API, {
      method: 'POST',
      mode: 'cors',
      credentials: 'omit',
      keepalive: true,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }).catch(() => {});
  }

  function safeTarget(anchor) {
    try {
      const u = new URL(anchor.href, location.href);
      return u.origin === location.origin ? u.pathname : u.host;
    } catch { return ''; }
  }

  function placementFor(el) {
    const section = el.closest('section,header,footer,nav,article');
    return clean(section?.id || section?.getAttribute('aria-label') || section?.tagName?.toLowerCase() || 'page', 100);
  }

  function isBlogArticle() {
    return /^\/blog\/[^/]+\/?$/.test(location.pathname);
  }

  document.addEventListener('DOMContentLoaded', () => {
    const organic = attr.medium === 'organic' || ['google','bing'].includes(attr.source);
    if (organic) track('organic_landing_view', {}, 'landing');
    if (isBlogArticle()) track('blog_view', { article: clean(location.pathname.split('/').filter(Boolean).pop(), 180) }, 'blog-view');

    const leadForm = document.querySelector('#cs-home-lead-form');
    if (leadForm) {
      const start = () => track('lead_form_start', { placement: 'home_lead_form' }, 'lead-form-start');
      leadForm.addEventListener('focusin', start, { once: true });
    }

    document.addEventListener('click', (event) => {
      const anchor = event.target.closest('a[href]');
      const button = event.target.closest('button,[role="button"]');
      const el = anchor || button;
      if (!el) return;
      const label = clean(el.textContent || el.getAttribute('aria-label') || '', 160);
      const placement = placementFor(el);
      const target = anchor ? safeTarget(anchor) : '';
      const href = anchor ? String(anchor.href || '') : '';
      const metadata = { label, target, placement };

      if (/wa\.me|api\.whatsapp\.com/i.test(href)) return track('whatsapp_click', { ...metadata, channel: 'whatsapp' });
      if (anchor && target.startsWith('/assistente')) return track('assistant_open', metadata);
      if (anchor && target.startsWith('/diagnostico')) return track('diagnostic_open', metadata);
      if (anchor && target.startsWith('/calculadora')) return track('calculator_open', metadata);
      if (anchor && /^https?:/i.test(href) && !href.startsWith(location.origin)) return track('outbound_click', metadata);

      const looksLikeCta = el.matches('.btn,.cs-btn,[data-cta]') || /falar|diagn[oó]stico|proposta|come[cç]ar|calcular|estim|contato|whatsapp|assistente/i.test(label);
      if (looksLikeCta) {
        track(isBlogArticle() ? 'blog_cta_click' : 'cta_click', metadata);
      }
    }, { passive: true });

    let maxDepth = 0;
    const onScroll = () => {
      const doc = document.documentElement;
      const max = Math.max(1, doc.scrollHeight - innerHeight);
      const depth = Math.round((scrollY / max) * 100);
      if (depth > maxDepth) maxDepth = depth;
      if (maxDepth >= 50) track('scroll_50', { depth: '50' }, 'scroll-50');
      if (maxDepth >= 90) track('scroll_90', { depth: '90' }, 'scroll-90');
    };
    addEventListener('scroll', onScroll, { passive: true });
  });
})();
`;

await fs.mkdir(path.join(deploy, 'assets'), { recursive: true });
await fs.writeFile(path.join(deploy, 'assets', 'acquisition-tracking.js'), client, 'utf8');

let changed = 0;
async function walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    const rel = path.relative(deploy, full).replaceAll('\\', '/');
    if (entry.isDirectory()) {
      if (rel === 'painel' || rel.startsWith('painel/')) continue;
      await walk(full);
      continue;
    }
    if (!/\.html?$/i.test(entry.name)) continue;
    let html = await fs.readFile(full, 'utf8');
    if (html.includes(marker)) continue;
    if (/<\/body>/i.test(html)) html = html.replace(/<\/body>/i, `${scriptTag}</body>`);
    else html += scriptTag;
    await fs.writeFile(full, html, 'utf8');
    changed++;
  }
}

await walk(deploy);
console.log(`Acquisition tracking injected into ${changed} public HTML file(s).`);
