const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const DEFAULT_WORKERS_AI_MODEL = '@cf/meta/llama-3.1-8b-instruct-fast';
const DEFAULT_GROQ_MODEL = 'llama-3.1-8b-instant';

export async function generateJson(env, system, prompt, options = {}) {
  const text = await generateText(env, system, prompt, { ...options, json: true });
  try {
    return parseJsonObject(text);
  } catch (firstError) {
    // LLMs occasionally wrap or truncate JSON even when explicitly instructed.
    // Run one compact repair pass instead of failing an entire scheduled agent.
    const repairSystem = 'Você é um reparador determinístico de JSON. Receba uma saída imperfeita e devolva SOMENTE um único objeto JSON válido. Preserve os dados existentes, remova comentários/markdown, feche estruturas incompletas e não acrescente fatos novos.';
    const repairPrompt = `Converta a saída abaixo em JSON válido. Se a resposta estiver truncada, preserve apenas os itens completos que já aparecem e feche corretamente o objeto/arrays.\n\nSAÍDA ORIGINAL:\n${String(text || '').slice(0, 14000)}`;
    const repaired = await generateText(env, repairSystem, repairPrompt, {
      temperature: 0,
      maxTokens: Math.max(1800, Math.min(3600, Number(options.maxTokens || 2200))),
      json: true,
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
  const maxTokens = Number.isFinite(options.maxTokens) ? options.maxTokens : 1800;
  let workersError = null;

  if (env.AI && typeof env.AI.run === 'function') {
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
      if (text) return text;
      throw new Error('workers_ai_empty_response');
    } catch (error) {
      workersError = error;
      console.warn('Workers AI generation failed; trying fallback.', cleanError(error));
    }
  }

  if (env.AI_API_KEY) {
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
    if (text) return text;
    throw new Error('groq_empty_response');
  }

  throw new Error(`ai_not_configured${workersError ? `: ${cleanError(workersError)}` : ''}`);
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
