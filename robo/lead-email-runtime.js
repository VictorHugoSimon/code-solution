import baseRuntime from './atendente-auth-growth-runtime.js';

const DEFAULT_NOTIFY_EMAIL = 'victorhugoteixeirasimon6@gmail.com';
const DEFAULT_FROM = 'leads@codesolution.com.br';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname !== '/lead' || request.method !== 'POST') {
      return baseRuntime.fetch(request, env, ctx);
    }

    let submitted = {};
    try {
      submitted = await request.clone().json();
    } catch {
      submitted = {};
    }

    const response = await baseRuntime.fetch(request, env, ctx);
    if (response.status !== 201 || !env.LEAD_EMAIL) return response;

    let result = {};
    try {
      result = await response.clone().json();
    } catch {
      result = {};
    }

    const task = notifyLeadByEmail(env, submitted, result).catch((error) => {
      console.warn('lead email notification failed', String(error?.message || error).slice(0, 500));
    });
    if (ctx?.waitUntil) ctx.waitUntil(task);
    else await task;

    return response;
  },

  async scheduled(event, env, ctx) {
    if (typeof baseRuntime.scheduled === 'function') return baseRuntime.scheduled(event, env, ctx);
  },
};

async function notifyLeadByEmail(env, lead, result) {
  const to = String(env.LEAD_NOTIFY_EMAIL || DEFAULT_NOTIFY_EMAIL).trim();
  const from = String(env.LEAD_EMAIL_FROM || DEFAULT_FROM).trim();
  if (!to || !from) return;

  const name = clean(lead.name || 'Lead sem nome', 120);
  const whatsapp = clean(lead.whatsapp || 'Não informado', 80);
  const email = clean(lead.email || 'Não informado', 160);
  const company = clean(lead.company || 'Não informada', 160);
  const segment = clean(lead.segment || 'Não informado', 120);
  const need = clean(lead.need || 'Não informada', 1200);
  const source = clean(lead.source || 'site', 120);
  const campaign = clean(lead.campaign || '', 160);
  const leadId = clean(result.leadId || '', 80);
  const score = Number(result.score || 0);
  const createdAt = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  const crmUrl = 'https://www.codesolution.com.br/painel/crm/';

  const subject = `[Code Solution] Novo lead — ${name}`;
  const text = [
    'Novo lead recebido pela Code Solution.',
    '',
    `Nome: ${name}`,
    `WhatsApp: ${whatsapp}`,
    `E-mail: ${email}`,
    `Empresa: ${company}`,
    `Segmento: ${segment}`,
    `Necessidade: ${need}`,
    `Origem: ${source}${campaign ? ` / ${campaign}` : ''}`,
    `Lead Score: ${Number.isFinite(score) ? score : 0}`,
    `Recebido em: ${createdAt}`,
    `ID: ${leadId || 'não informado'}`,
    '',
    `Abrir CRM: ${crmUrl}`,
  ].join('\n');

  const html = `<!doctype html><html lang="pt-BR"><body style="font-family:Arial,sans-serif;background:#f4f7fa;color:#17212b;padding:24px"><div style="max-width:640px;margin:auto;background:#fff;border-radius:16px;padding:28px;border:1px solid #dfe7ef"><div style="font-size:12px;text-transform:uppercase;letter-spacing:.12em;color:#177ddc;font-weight:700">Code Solution · Novo lead</div><h1 style="font-size:24px;margin:8px 0 22px">${escapeHtml(name)}</h1><table style="width:100%;border-collapse:collapse;font-size:14px"><tr><td style="padding:8px 0;font-weight:700;width:130px">WhatsApp</td><td>${escapeHtml(whatsapp)}</td></tr><tr><td style="padding:8px 0;font-weight:700">E-mail</td><td>${escapeHtml(email)}</td></tr><tr><td style="padding:8px 0;font-weight:700">Empresa</td><td>${escapeHtml(company)}</td></tr><tr><td style="padding:8px 0;font-weight:700">Segmento</td><td>${escapeHtml(segment)}</td></tr><tr><td style="padding:8px 0;font-weight:700">Necessidade</td><td>${escapeHtml(need)}</td></tr><tr><td style="padding:8px 0;font-weight:700">Origem</td><td>${escapeHtml(source)}${campaign ? ` / ${escapeHtml(campaign)}` : ''}</td></tr><tr><td style="padding:8px 0;font-weight:700">Lead Score</td><td>${Number.isFinite(score) ? score : 0}</td></tr><tr><td style="padding:8px 0;font-weight:700">Recebido</td><td>${escapeHtml(createdAt)}</td></tr></table><div style="margin-top:24px"><a href="${crmUrl}" style="display:inline-block;background:#177ddc;color:#fff;text-decoration:none;padding:12px 18px;border-radius:9px;font-weight:700">Abrir CRM</a></div></div></body></html>`;

  await env.LEAD_EMAIL.send({
    from: { email: from, name: 'Code Solution' },
    to: [to],
    subject,
    text,
    html,
    replyTo: lead.email ? String(lead.email).slice(0, 160) : undefined,
  });
}

function clean(value, max) {
  return String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}

function escapeHtml(value) {
  return String(value || '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[char]));
}
