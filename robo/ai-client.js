const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const DEFAULT_WORKERS_AI_MODEL = '@cf/meta/llama-3.1-8b-instruct-fast';
const DEFAULT_GROQ_MODEL = 'llama-3.1-8b-instant';

const DEFAULT_DAILY_TOKEN_BUDGETS = Object.freeze({
  radar: 40000,
  proposal: 48000,
  content: 32000,
  growth: 40000,
  executive: 32000,
  delivery: 32000,
  unclassified: 24000,
});

export async function generateJson(env, system, prompt, options = {}) {
  const agent = options.agent || inferAiAgent(system, prompt);
  const text = await generateText(env, system, prompt, { ...options, agent, json: true });
  try {
    return parseJsonObject(text);
  } catch (firstError) {
    // One bounded repair pass is allowed. It consumes the same agent budget and
    // never invents new business facts.
    const repairSystem = 'Você é um reparador determinístico de JSON. Receba uma saída imperfeita e devolva SOMENTE um único objeto JSON válido. Preserve os dados existentes, remova comentários/markdown, feche estruturas incompletas e não acrescente fatos novos.';
    const repairPrompt = `Converta a saída abaixo em JSON válido. Se a resposta estiver truncada, preserve apenas os itens completos que já aparecem e feche corretamente o objeto/arrays.\n\nSAÍDA ORIGINAL:\n${String(text || '').slice(0, 14000)}`;
    const repaired = await generateText(env, repairSystem, repairPrompt, {
      temperature: 0,
      maxTokens: Math.max(1800, Math.min(3600, Number(options.maxTokens || 2200))),
      json: true,
      agent,
    });
    try {
      return parseJsonObject(repaired);
    } catch {
      throw firstError;
    }
  }
}

export async function generateText(env, system, prompt, options = {}) {
  const temperature = Number.isFinite(options.temperature) ? options.temperature : 0.45;
  const maxTokens = Math.min(Math.max(Number.isFinite(options.maxTokens) ? options.maxTokens : 1800, 1), 6000);
  const agent = options.agent || inferAiAgent(system, prompt);
  const hasWorkersAi = Boolean(env.AI && typeof env.AI.run === 'function');
  const hasGroq = Boolean(env.AI_API_KEY);
  if (!hasWorkersAi && !hasGroq) throw new Error('ai_not_configured');

  const model = hasWorkersAi ? (env.WORKERS_AI_MODEL || DEFAULT_WORKERS_AI_MODEL) : (env.AI_MODEL || DEFAULT_GROQ_MODEL);
  const reservation = await reserveAiBudget(env, { agent, model, maxTokens });
  let workersError = null;

  try {
    if (hasWorkersAi) {
      try {
        const result = await env.AI.run(env.WORKERS_AI_MODEL || DEFAULT_WORKERS_AI_MODEL, {
          messages: [
            { role: 'system', content: String(system || '') },
            { role: 'user', content: String(prompt || '') },
          ],
          temperature,
          max_tokens: maxTokens,
        });
        const text = extractText(result);
        if (text) {
          await markAiBudgetResult(env, reservation, true);
          return text;
        }
        throw new Error('workers_ai_empty_response');
      } catch (error) {
        workersError = error;
        console.warn('Workers AI generation failed; trying fallback.', cleanError(error));
      }
    }

    if (hasGroq) {
      const body = {
        model: env.AI_MODEL || DEFAULT_GROQ_MODEL,
        temperature,
        max_tokens: maxTokens,
        messages: [
          { role: 'system', content: String(system || '') },
          { role: 'user', content: String(prompt || '') },
        ],
      };
      if (options.json) body.response_format = { type: 'json_object' };
      const response = await fetch(GROQ_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.AI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });
      if (!response.ok) throw new Error(`groq_${response.status}: ${(await response.text()).slice(0, 260)}`);
      const data = await response.json();
      const text = extractText(data);
      if (text) {
        await markAiBudgetResult(env, reservation, true);
        return text;
      }
      throw new Error('groq_empty_response');
    }

    throw new Error(`ai_not_configured${workersError ? `: ${cleanError(workersError)}` : ''}`);
  } catch (error) {
    await markAiBudgetResult(env, reservation, false).catch(() => {});
    throw error;
  }
}

export function parseJsonObject(text) {
  const raw = String(text || '').trim();
  if (!raw) throw new Error('empty_json_response');
  try { return JSON.parse(raw); } catch {}
  const unfenced = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  try { return JSON.parse(unfenced); } catch {}
  const start = unfenced.indexOf('{');
  const end = unfenced.lastIndexOf('}');
  if (start >= 0 && end > start) return JSON.parse(unfenced.slice(start, end + 1));
  throw new Error('invalid_json_response');
}

export function inferAiAgent(system, prompt = '') {
  const text = `${String(system || '')}\n${String(prompt || '')}`.toLowerCase();
  if (text.includes('agente radar') || text.includes('radar b2b')) return 'radar';
  if (text.includes('proposta') || text.includes('proposal')) return 'proposal';
  if (text.includes('delivery') || text.includes('projeto')) return 'delivery';
  if (text.includes('executivo') || text.includes('executive')) return 'executive';
  if (text.includes('conteúdo') || text.includes('content')) return 'content';
  if (text.includes('growth') || text.includes('aquisição') || text.includes('prospecção')) return 'growth';
  return 'unclassified';
}

export function getAiBudgetPolicy(env = {}) {
  const agents = {};
  for (const [agent, fallback] of Object.entries(DEFAULT_DAILY_TOKEN_BUDGETS)) {
    agents[agent] = resolveDailyBudget(env, agent, fallback);
  }
  return {
    accounting: 'reserved_output_tokens',
    resetTimeZone: 'America/Sao_Paulo',
    agents,
  };
}

async function reserveAiBudget(env, { agent, model, maxTokens }) {
  if (!env.CRM_DB) return null;
  const normalizedAgent = normalizeAgent(agent);
  const usageDate = saoPauloDate();
  const requestedTokens = Math.max(1, Math.round(Number(maxTokens || 1)));
  const fallback = DEFAULT_DAILY_TOKEN_BUDGETS[normalizedAgent] || DEFAULT_DAILY_TOKEN_BUDGETS.unclassified;
  const dailyLimit = resolveDailyBudget(env, normalizedAgent, fallback);

  try {
    const row = await env.CRM_DB.prepare(`SELECT calls,reserved_tokens,successful_calls,failed_calls
      FROM autonomy_ai_daily_usage WHERE usage_date=? AND agent=? AND model=?`)
      .bind(usageDate, normalizedAgent, String(model)).first();
    const reserved = Number(row?.reserved_tokens || 0);
    if (reserved + requestedTokens > dailyLimit) throw new Error(`ai_budget_exhausted:${normalizedAgent}`);

    const now = new Date().toISOString();
    await env.CRM_DB.prepare(`INSERT INTO autonomy_ai_daily_usage
      (usage_date,agent,model,calls,reserved_tokens,successful_calls,failed_calls,updated_at)
      VALUES (?,?,?,1,?,0,0,?)
      ON CONFLICT(usage_date,agent,model) DO UPDATE SET
        calls=autonomy_ai_daily_usage.calls+1,
        reserved_tokens=autonomy_ai_daily_usage.reserved_tokens+excluded.reserved_tokens,
        updated_at=excluded.updated_at`)
      .bind(usageDate, normalizedAgent, String(model), requestedTokens, now).run();

    return { usageDate, agent: normalizedAgent, model: String(model), requestedTokens, dailyLimit };
  } catch (error) {
    if (String(error?.message || error).startsWith('ai_budget_exhausted:')) throw error;
    throw new Error(`ai_budget_unavailable:${normalizedAgent}`);
  }
}

async function markAiBudgetResult(env, reservation, success) {
  if (!env.CRM_DB || !reservation) return;
  const field = success ? 'successful_calls' : 'failed_calls';
  await env.CRM_DB.prepare(`UPDATE autonomy_ai_daily_usage SET ${field}=${field}+1,updated_at=?
    WHERE usage_date=? AND agent=? AND model=?`)
    .bind(new Date().toISOString(), reservation.usageDate, reservation.agent, reservation.model).run();
}

function resolveDailyBudget(env, agent, fallback) {
  const agentKey = `AI_DAILY_TOKEN_BUDGET_${String(agent).toUpperCase().replace(/[^A-Z0-9]/g, '_')}`;
  const agentValue = Number(env?.[agentKey]);
  if (Number.isFinite(agentValue) && agentValue >= 0) return Math.round(agentValue);
  const globalValue = Number(env?.AI_DAILY_TOKEN_BUDGET);
  if (Number.isFinite(globalValue) && globalValue >= 0) return Math.round(globalValue);
  return fallback;
}

function normalizeAgent(agent) {
  const value = String(agent || 'unclassified').toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 60);
  return value || 'unclassified';
}

function saoPauloDate() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
}

function extractText(result) {
  if (typeof result === 'string') return result.trim();
  if (typeof result?.response === 'string') return result.response.trim();
  if (typeof result?.result?.response === 'string') return result.result.response.trim();
  const content = result?.choices?.[0]?.message?.content;
  return typeof content === 'string' ? content.trim() : '';
}

function cleanError(error) {
  return String(error?.message || error).replace(/[A-Za-z0-9_\-]{24,}/g, '[redacted]').slice(0, 300);
}
