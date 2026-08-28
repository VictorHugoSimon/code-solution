const BRAND_URL = 'https://www.codesolution.com.br';
const DIAGNOSTIC_URL = `${BRAND_URL}/diagnostico/`;
const CHANNELS = new Set(['linkedin_empresa','facebook','instagram']);

export function getSocialPublisherStatus(env) {
  return {
    enabled: String(env.SOCIAL_AUTO_PUBLISH || 'true').toLowerCase() === 'true',
    channels: {
      linkedin_empresa: {
        configured: Boolean(env.LINKEDIN_ACCESS_TOKEN && env.LINKEDIN_ORGANIZATION_URN),
        requirements: ['LINKEDIN_ACCESS_TOKEN','LINKEDIN_ORGANIZATION_URN'],
      },
      facebook: {
        configured: Boolean(env.META_PAGE_ACCESS_TOKEN && env.META_PAGE_ID && env.META_GRAPH_VERSION),
        requirements: ['META_PAGE_ACCESS_TOKEN','META_PAGE_ID','META_GRAPH_VERSION'],
      },
      instagram: {
        configured: Boolean(env.META_PAGE_ACCESS_TOKEN && env.META_IG_USER_ID && env.META_GRAPH_VERSION && env.INSTAGRAM_MEDIA_URL),
        requirements: ['META_PAGE_ACCESS_TOKEN','META_IG_USER_ID','META_GRAPH_VERSION','INSTAGRAM_MEDIA_URL'],
        note: 'Instagram exige mídia pública. INSTAGRAM_MEDIA_URL deve apontar para uma imagem JPEG pública da Code Solution.',
      },
      linkedin_pessoal: {
        configured: false,
        mode: 'review',
        note: 'Mantido em revisão até a aplicação LinkedIn ter permissão w_member_social aprovada para o membro autenticado.',
      },
    },
  };
}

export async function runSocialPublisher(env, meta = {}) {
  if (!env.CRM_DB) throw new Error('social_publisher_db_not_configured');
  const status = getSocialPublisherStatus(env);
  if (!status.enabled) return { enabled: false, published: 0, skipped: 0, failures: 0, channels: status.channels };

  const rows = await env.CRM_DB.prepare(`SELECT id,channel,title,body,cta,metadata_json,created_at
    FROM growth_content
    WHERE status='pronto' AND channel IN ('linkedin_empresa','facebook','instagram')
    ORDER BY created_at ASC LIMIT 30`).all();

  const posts = rows.results || [];
  const picked = [];
  const seenChannels = new Set();
  for (const post of posts) {
    if (seenChannels.has(post.channel)) continue;
    seenChannels.add(post.channel);
    picked.push(post);
  }

  let published = 0;
  let skipped = 0;
  let failures = 0;
  const results = [];

  for (const post of picked) {
    if (!CHANNELS.has(post.channel)) continue;
    const already = await env.CRM_DB.prepare("SELECT id FROM social_publications WHERE content_id=? AND status='published' LIMIT 1").bind(post.id).first();
    if (already) {
      await env.CRM_DB.prepare("UPDATE growth_content SET status='publicado',published_at=COALESCE(published_at,?),updated_at=? WHERE id=?")
        .bind(new Date().toISOString(), new Date().toISOString(), post.id).run();
      skipped++;
      continue;
    }

    const channelStatus = status.channels[post.channel];
    if (!channelStatus?.configured) {
      skipped++;
      results.push({ contentId: post.id, channel: post.channel, status: 'waiting_authorization' });
      continue;
    }

    try {
      const metadata = parseJson(post.metadata_json);
      const destination = buildTrackedUrl(post, metadata);
      const message = composeMessage(post, destination);
      let result;
      if (post.channel === 'linkedin_empresa') result = await publishLinkedInCompany(env, post, message);
      else if (post.channel === 'facebook') result = await publishFacebook(env, post, message);
      else result = await publishInstagram(env, post, message);

      const now = new Date().toISOString();
      await recordPublication(env, post, 'published', result, null, meta.trigger || 'cron');
      await env.CRM_DB.prepare("UPDATE growth_content SET status='publicado',published_at=?,updated_at=? WHERE id=?")
        .bind(now, now, post.id).run();
      published++;
      results.push({ contentId: post.id, channel: post.channel, status: 'published', externalId: result.externalId || '', permalink: result.permalink || '' });
    } catch (error) {
      const message = cleanError(error);
      await recordPublication(env, post, 'failed', {}, message, meta.trigger || 'cron').catch(() => {});
      failures++;
      results.push({ contentId: post.id, channel: post.channel, status: 'failed', error: message });
    }
  }

  return { enabled: true, published, skipped, failures, attempted: picked.length, results, channels: status.channels };
}

async function publishLinkedInCompany(env, post, message) {
  const version = String(env.LINKEDIN_VERSION || '202608');
  const payload = {
    author: env.LINKEDIN_ORGANIZATION_URN,
    commentary: message,
    visibility: 'PUBLIC',
    distribution: { feedDistribution: 'MAIN_FEED', targetEntities: [], thirdPartyDistributionChannels: [] },
    lifecycleState: 'PUBLISHED',
    isReshareDisabledByAuthor: false,
  };
  const response = await fetch('https://api.linkedin.com/rest/posts', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.LINKEDIN_ACCESS_TOKEN}`,
      'Linkedin-Version': version,
      'X-Restli-Protocol-Version': '2.0.0',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`linkedin_${response.status}:${redact(text)}`);
  return { externalId: response.headers.get('x-restli-id') || '', permalink: '' };
}

async function publishFacebook(env, post, message) {
  const endpoint = `https://graph.facebook.com/${encodeURIComponent(env.META_GRAPH_VERSION)}/${encodeURIComponent(env.META_PAGE_ID)}/feed`;
  const body = new URLSearchParams({ message, access_token: env.META_PAGE_ACCESS_TOKEN });
  const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.error) throw new Error(`facebook_${response.status}:${redact(JSON.stringify(data))}`);
  return { externalId: data.id || '', permalink: '' };
}

async function publishInstagram(env, post, message) {
  const base = `https://graph.facebook.com/${encodeURIComponent(env.META_GRAPH_VERSION)}/${encodeURIComponent(env.META_IG_USER_ID)}`;
  const create = new URLSearchParams({
    image_url: env.INSTAGRAM_MEDIA_URL,
    caption: message.slice(0, 2200),
    access_token: env.META_PAGE_ACCESS_TOKEN,
  });
  const containerResponse = await fetch(`${base}/media`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: create });
  const container = await containerResponse.json().catch(() => ({}));
  if (!containerResponse.ok || container.error || !container.id) throw new Error(`instagram_container_${containerResponse.status}:${redact(JSON.stringify(container))}`);

  const publish = new URLSearchParams({ creation_id: container.id, access_token: env.META_PAGE_ACCESS_TOKEN });
  const publishResponse = await fetch(`${base}/media_publish`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: publish });
  const result = await publishResponse.json().catch(() => ({}));
  if (!publishResponse.ok || result.error || !result.id) throw new Error(`instagram_publish_${publishResponse.status}:${redact(JSON.stringify(result))}`);
  return { externalId: result.id || '', permalink: '' };
}

async function recordPublication(env, post, status, result, errorText, trigger) {
  const now = new Date().toISOString();
  await env.CRM_DB.prepare(`INSERT INTO social_publications
    (id,content_id,channel,status,external_id,permalink,trigger_type,error_text,created_at,published_at,metadata_json)
    VALUES (?,?,?,?,?,?,?,?,?,?,?)`)
    .bind(
      crypto.randomUUID(), post.id, post.channel, status, result.externalId || null, result.permalink || null,
      trigger || 'cron', errorText || null, now, status === 'published' ? now : null,
      JSON.stringify({ title: post.title || '', source: 'growth_engine' }).slice(0, 3000),
    ).run();
}

function buildTrackedUrl(post, metadata = {}) {
  const url = new URL(DIAGNOSTIC_URL);
  url.searchParams.set('utm_source', channelSource(post.channel));
  url.searchParams.set('utm_medium', 'organic_social');
  url.searchParams.set('utm_campaign', 'always_on_growth');
  url.searchParams.set('utm_content', String(post.id || '').slice(0, 36));
  if (metadata?.utm && typeof metadata.utm === 'string') url.searchParams.set('utm_term', metadata.utm.slice(0, 120));
  return url.toString();
}

function composeMessage(post, destination) {
  const parts = [String(post.body || '').trim()];
  const cta = String(post.cta || '').trim();
  if (post.channel === 'instagram') {
    if (cta) parts.push(cta);
    parts.push('Diagnóstico gratuito no link da bio.');
  } else {
    if (cta) parts.push(cta);
    parts.push(destination);
  }
  return parts.filter(Boolean).join('\n\n').slice(0, post.channel === 'linkedin_empresa' ? 3000 : 6000);
}

function channelSource(channel) {
  if (channel.startsWith('linkedin')) return 'linkedin';
  return channel;
}
function parseJson(value) { try { return JSON.parse(value || '{}'); } catch { return {}; } }
function redact(value) { return String(value || '').replace(/[A-Za-z0-9_\-.]{24,}/g, '[redacted]').slice(0, 500); }
function cleanError(error) { return redact(error?.message || error || 'unknown_error'); }
