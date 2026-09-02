import fs from 'node:fs/promises';
import { evaluateReplaySafety, SAFE_REPLAY_ACTIONS } from '../robo/autonomy-hardening.js';
import { getAiBudgetPolicy, inferAiAgent } from '../robo/ai-client.js';

const [hardening, ai, runtime, resilience, migration] = await Promise.all([
  fs.readFile('robo/autonomy-hardening.js', 'utf8'),
  fs.readFile('robo/ai-client.js', 'utf8'),
  fs.readFile('robo/autonomy-entry-runtime.js', 'utf8'),
  fs.readFile('robo/autonomy-resilience.js', 'utf8'),
  fs.readFile('crm/migrations/0024_autonomy_hardening.sql', 'utf8'),
]);

const failures = [];
const requireText = (source, needle, label) => { if (!source.includes(needle)) failures.push(`${label}: missing ${needle}`); };

requireText(migration, 'autonomy_ai_daily_usage', 'migration');
requireText(migration, 'autonomy_replay_audit', 'migration');
requireText(migration, "status='deferred'", 'queue budget trigger');
requireText(migration, 'max_tasks_per_run', 'queue budget trigger');
requireText(migration, "agent_id='__global__'", 'fail-closed queue budget');

requireText(hardening, "unique_key LIKE 'hot-lead:%:priority'", 'recurring dedupe');
requireText(hardening, 'growth_accounts g', 'state dedupe');
requireText(hardening, 'growth_content c', 'state dedupe');
requireText(hardening, 'active_duplicate_exists', 'safe replay');
requireText(hardening, 'validateEntityStillRelevant', 'safe replay');
requireText(hardening, 'autonomy_replay_audit', 'replay audit');
requireText(hardening, 'promoteDeferredTasks', 'queue promotion');

requireText(ai, 'reserveAiBudget', 'AI budget');
requireText(ai, 'ai_budget_exhausted:', 'AI budget');
requireText(ai, 'AI_DAILY_TOKEN_BUDGET', 'AI budget override');
requireText(ai, 'reserved_output_tokens', 'AI accounting');
requireText(ai, 'America/Sao_Paulo', 'AI budget reset');

const hardeningIndex = runtime.indexOf('handleAutonomyHardeningApi(request, env)');
const resilienceIndex = runtime.indexOf('handleResilienceApi(request, env)');
if (hardeningIndex < 0 || resilienceIndex < 0 || hardeningIndex > resilienceIndex) failures.push('runtime: hardening must intercept before legacy resilience handler');
requireText(runtime, 'runAutonomyHardeningPreflight', 'runtime preflight');
requireText(runtime, 'enrichHardeningSummaryResponse', 'runtime summary');
requireText(runtime, 'hardeningVersion', 'runtime health');

requireText(resilience, "const RETRYABLE_RISK = new Set(['low'])", 'legacy resilience safety');
requireText(resilience, 'const MAX_RETRY_ATTEMPTS = 3', 'legacy resilience safety');
requireText(resilience, "data.policy.failMode = 'fail_closed'", 'legacy resilience safety');

const safe = evaluateReplaySafety({ approval_required: 0, risk_level: 'low', action_type: 'prioritize_hot_lead' });
const highRisk = evaluateReplaySafety({ approval_required: 0, risk_level: 'high', action_type: 'prioritize_hot_lead' });
const gated = evaluateReplaySafety({ approval_required: 1, risk_level: 'low', action_type: 'prioritize_hot_lead' });
const unsupported = evaluateReplaySafety({ approval_required: 0, risk_level: 'low', action_type: 'external_outreach' });
if (!safe.safe) failures.push('policy: known low-risk internal action should be replayable');
if (highRisk.safe || highRisk.reason !== 'risk_not_low') failures.push('policy: high-risk replay must fail closed');
if (gated.safe || gated.reason !== 'approval_required') failures.push('policy: approval-gated replay must fail closed');
if (unsupported.safe || unsupported.reason !== 'action_not_replayable') failures.push('policy: external/unsupported replay must fail closed');
if (!SAFE_REPLAY_ACTIONS.includes('generate_proposal_draft') || SAFE_REPLAY_ACTIONS.includes('external_outreach')) failures.push('policy: safe replay allowlist invalid');

if (inferAiAgent('Você é o Agente Radar B2B da Code Solution', '') !== 'radar') failures.push('AI policy: radar inference failed');
if (inferAiAgent('Gere uma proposta comercial estruturada', '') !== 'proposal') failures.push('AI policy: proposal inference failed');
const policy = getAiBudgetPolicy({});
if (!(policy.agents.radar > 0 && policy.agents.proposal > 0 && policy.accounting === 'reserved_output_tokens')) failures.push('AI policy: default budgets invalid');

if (failures.length) {
  console.error('Autonomy hardening contract failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log('Autonomy hardening contract OK: recurring/state dedupe, queue budgets, AI budgets, fail-closed replay and policy ordering verified.');
