import { generateJson } from './ai-client.js';

const PROMPT_VERSION = 'proposal-v1';
const CLOSED = new Set(['ganho','perdido','arquivado']);
const ACTIVE_PROPOSAL_STATUSES = new Set(['draft','pending_approval','approved','sent']);

export async function discoverProposalCandidates(env, limit = 50) {
  const result = await env.CRM_DB.prepare(`
    SELECT l.id,l.name,l.company,l.segment,l.need,l.business_type,l.urgency,l.budget,l.decision_maker,
           l.status,l.score,l.temperature,l.owner,l.estimated_value_cents,l.expected_close_date,l.notes,l.updated_at
    FROM leads l
    WHERE l.status='proposta'
      AND NOT EXISTS (
        SELECT 1 FROM crm_proposals p
        WHERE p.lead_id=l.id AND p.status IN ('draft','pending_approval','approved','sent')
      )
    ORDER BY l.score DESC,l.updated_at ASC
    LIMIT ?
  `).bind(Math.min(Math.max(Number(limit || 50), 1), 100)).all();
  return result.results || [];
}

export async function generateProposalDraft(env, leadId, options = {}) {
  const id = clean(leadId, 120);
  if (!id) throw new Error('proposal_lead_id_required');
  const force = options.force === true;
  const createdBy = clean(options.createdBy || 'proposal-agent', 80) || 'proposal-agent';

  const lead = await env.CRM_DB.prepare(`
    SELECT id,name,whatsapp,email,company,segment,need,business_type,urgency,budget,decision_maker,
           source,campaign,medium,status,score,temperature,owner,next_action,next_action_due,
           estimated_value_cents,expected_close_date,notes,created_at,updated_at
    FROM leads WHERE id=? LIMIT 1
  `).bind(id).first();
  if (!lead) throw new Error('proposal_lead_not_found');
  if (CLOSED.has(String(lead.status || '').toLowerCase())) throw new Error('proposal_closed_lead');

  if (!force) {
    const existing = await env.CRM_DB.prepare(`
      SELECT * FROM crm_proposals
      WHERE lead_id=? AND status IN ('draft','pending_approval','approved','sent')
      ORDER BY version DESC LIMIT 1
    `).bind(id).first();
    if (existing && ACTIVE_PROPOSAL_STATUSES.has(existing.status)) {
      return { proposal: mapProposal(existing), reused: true };
    }
  }

  const eventsResult = await env.CRM_DB.prepare(`
    SELECT event_type,text,actor,metadata_json,created_at
    FROM lead_events WHERE lead_id=? ORDER BY created_at DESC LIMIT 16
  `).bind(id).all();
  const recentEvents = (eventsResult.results || []).map((event) => ({
    type: event.event_type,
    text: clean(event.text, 1200),
    actor: clean(event.actor, 120),
    metadata: parseJson(event.metadata_json),
    createdAt: event.created_at,
  }));

  const versionRow = await env.CRM_DB.prepare('SELECT COALESCE(MAX(version),0) max_version FROM crm_proposals WHERE lead_id=?').bind(id).first();
  const version = Number(versionRow?.max_version || 0) + 1;
  const snapshot = buildSourceSnapshot(lead, recentEvents);

  let draft;
  let generationMode = 'managed_ai';
  let generationError = '';
  try {
    draft = normalizeDraft(await generateJson(env, proposalSystemPrompt(), proposalUserPrompt(snapshot), {
      temperature: 0.25,
      maxTokens: 3200,
    }), lead);
  } catch (error) {
    generationMode = 'deterministic_fallback';
    generationError = cleanError(error);
    draft = fallbackDraft(lead);
  }

  const now = new Date().toISOString();
  const proposalId = crypto.randomUUID();

  if (force) {
    await env.CRM_DB.prepare(`
      UPDATE crm_proposals SET status='superseded',updated_at=?
      WHERE lead_id=? AND status IN ('draft','pending_approval')
    `).bind(now, id).run();
  }

  await env.CRM_DB.prepare(`
    INSERT INTO crm_proposals (
      id,lead_id,version,status,approval_status,title,executive_summary,scope_json,out_of_scope_json,
      architecture_json,roadmap_json,estimate_json,risks_json,assumptions_json,discovery_gaps_json,
      commercial_draft,source_snapshot_json,generation_mode,model,prompt_version,created_by,created_at,updated_at
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `).bind(
    proposalId,id,version,'pending_approval','pending',draft.title,draft.executiveSummary,
    JSON.stringify(draft.scope),JSON.stringify(draft.outOfScope),JSON.stringify(draft.architecture),
    JSON.stringify(draft.roadmap),JSON.stringify(draft.estimate),JSON.stringify(draft.risks),
    JSON.stringify(draft.assumptions),JSON.stringify(draft.discoveryGaps),draft.commercialDraft,
    JSON.stringify(snapshot).slice(0, 24000),generationMode,
    clean(env.WORKERS_AI_MODEL || env.AI_MODEL || '', 180) || null,PROMPT_VERSION,createdBy,now,now
  ).run();

  await recordProposalEvent(env, proposalId, id, 'draft_generated', createdBy,
    generationMode === 'managed_ai' ? 'Draft gerado pelo Proposal Agent.' : 'Draft gerado por fallback determinístico.',
    { version, generationMode, generationError, promptVersion: PROMPT_VERSION });

  const proposal = await env.CRM_DB.prepare('SELECT * FROM crm_proposals WHERE id=?').bind(proposalId).first();
  return { proposal: mapProposal(proposal), reused: false, generationError };
}

export async function listProposals(env, options = {}) {
  const status = clean(options.status, 40);
  const leadId = clean(options.leadId, 120);
  const limit = Math.min(Math.max(Number(options.limit || 100), 1), 250);
  let sql = `
    SELECT p.*,l.name lead_name,l.company lead_company,l.status lead_status,l.score lead_score,l.owner lead_owner,
           t.id approval_task_id,a.id approval_id,a.status approval_task_status,a.note approval_note,a.created_at approval_requested_at,a.decided_at approval_decided_at
    FROM crm_proposals p
    JOIN leads l ON l.id=p.lead_id
    LEFT JOIN autonomy_tasks t ON t.entity_type='crm_proposal' AND t.entity_id=p.id AND t.action_type='proposal_send'
    LEFT JOIN autonomy_approvals a ON a.task_id=t.id
    WHERE 1=1`;
  const bindings = [];
  if (status) { sql += ' AND p.status=?'; bindings.push(status); }
  if (leadId) { sql += ' AND p.lead_id=?'; bindings.push(leadId); }
  sql += ' ORDER BY p.updated_at DESC,p.version DESC LIMIT ?';
  bindings.push(limit);
  const result = await env.CRM_DB.prepare(sql).bind(...bindings).all();
  return (result.results || []).map(mapProposalListRow);
}

export async function getProposal(env, proposalId) {
  const id = clean(proposalId, 120);
  if (!id) return null;
  const proposal = await env.CRM_DB.prepare(`
    SELECT p.*,l.name lead_name,l.company lead_company,l.status lead_status,l.score lead_score,l.owner lead_owner,
           l.need lead_need,l.segment lead_segment,l.budget lead_budget,l.estimated_value_cents lead_estimated_value_cents,
           t.id approval_task_id,a.id approval_id,a.status approval_task_status,a.note approval_note,a.created_at approval_requested_at,a.decided_at approval_decided_at
    FROM crm_proposals p
    JOIN leads l ON l.id=p.lead_id
    LEFT JOIN autonomy_tasks t ON t.entity_type='crm_proposal' AND t.entity_id=p.id AND t.action_type='proposal_send'
    LEFT JOIN autonomy_approvals a ON a.task_id=t.id
    WHERE p.id=? LIMIT 1
  `).bind(id).first();
  if (!proposal) return null;
  const events = await env.CRM_DB.prepare('SELECT event_type,actor,note,metadata_json,created_at FROM crm_proposal_events WHERE proposal_id=? ORDER BY created_at DESC LIMIT 80').bind(id).all();
  return { ...mapProposalListRow(proposal), events: (events.results || []).map((event) => ({ ...event, metadata: parseJson(event.metadata_json) })) };
}

export async function updateProposalDraft(env, proposalId, body, actor = 'panel-admin') {
  const id = clean(proposalId, 120);
  const current = await env.CRM_DB.prepare('SELECT * FROM crm_proposals WHERE id=? LIMIT 1').bind(id).first();
  if (!current) throw new Error('proposal_not_found');
  if (!['draft','pending_approval'].includes(current.status)) throw new Error('proposal_not_editable');

  const title = clean(body.title ?? current.title, 240) || current.title;
  const executiveSummary = cleanMultiline(body.executiveSummary ?? current.executive_summary, 6000);
  const scope = normalizeStringArray(body.scope ?? parseJson(current.scope_json), 20, 500);
  const outOfScope = normalizeStringArray(body.outOfScope ?? parseJson(current.out_of_scope_json), 20, 500);
  const architecture = normalizeArrayOfObjects(body.architecture ?? parseJson(current.architecture_json), 20);
  const roadmap = normalizeArrayOfObjects(body.roadmap ?? parseJson(current.roadmap_json), 20);
  const estimate = normalizeObject(body.estimate ?? parseJson(current.estimate_json));
  const risks = normalizeArrayOfObjects(body.risks ?? parseJson(current.risks_json), 24);
  const assumptions = normalizeStringArray(body.assumptions ?? parseJson(current.assumptions_json), 24, 700);
  const discoveryGaps = normalizeStringArray(body.discoveryGaps ?? parseJson(current.discovery_gaps_json), 24, 700);
  const commercialDraft = cleanMultiline(body.commercialDraft ?? current.commercial_draft, 18000);
  const now = new Date().toISOString();

  await env.CRM_DB.prepare(`
    UPDATE crm_proposals SET title=?,executive_summary=?,scope_json=?,out_of_scope_json=?,architecture_json=?,
      roadmap_json=?,estimate_json=?,risks_json=?,assumptions_json=?,discovery_gaps_json=?,commercial_draft=?,updated_at=?
    WHERE id=?
  `).bind(title,executiveSummary,JSON.stringify(scope),JSON.stringify(outOfScope),JSON.stringify(architecture),
    JSON.stringify(roadmap),JSON.stringify(estimate),JSON.stringify(risks),JSON.stringify(assumptions),
    JSON.stringify(discoveryGaps),commercialDraft,now,id).run();

  await recordProposalEvent(env,id,current.lead_id,'draft_edited',actor,'Proposta revisada no painel.',{});
  return getProposal(env,id);
}

export async function syncProposalApproval(env, proposalId, decision, note = '', actor = 'panel-admin') {
  const id = clean(proposalId, 120);
  const current = await env.CRM_DB.prepare('SELECT * FROM crm_proposals WHERE id=? LIMIT 1').bind(id).first();
  if (!current) throw new Error('proposal_not_found');
  const now = new Date().toISOString();
  if (decision === 'approved') {
    await env.CRM_DB.prepare(`UPDATE crm_proposals SET status='approved',approval_status='approved',approved_by=?,approved_at=?,rejection_reason=NULL,updated_at=? WHERE id=?`)
      .bind(actor,now,now,id).run();
    await recordProposalEvent(env,id,current.lead_id,'approved',actor,clean(note,1200) || 'Proposta aprovada para envio humano.',{});
  } else if (decision === 'rejected') {
    await env.CRM_DB.prepare(`UPDATE crm_proposals SET status='rejected',approval_status='rejected',rejection_reason=?,approved_by=NULL,approved_at=NULL,updated_at=? WHERE id=?`)
      .bind(clean(note,1800) || 'Rejeitada para revisão.',now,id).run();
    await recordProposalEvent(env,id,current.lead_id,'rejected',actor,clean(note,1200) || 'Proposta rejeitada para revisão.',{});
  } else {
    throw new Error('invalid_proposal_decision');
  }
  return getProposal(env,id);
}

function proposalSystemPrompt() {
  return `Você é o Proposal Agent da Code Solution. Gere um draft técnico-comercial em português do Brasil usando SOMENTE os fatos fornecidos. Não invente integrações, tecnologias, preço, prazo, ROI, equipe, compliance ou funcionalidades não sustentadas pelo contexto. Quando faltar informação, registre em discoveryGaps ou assumptions e use linguagem condicional. O draft será revisado por uma pessoa antes de qualquer envio. Responda SOMENTE um objeto JSON válido com: title, executiveSummary, scope[], outOfScope[], architecture[{layer,description}], roadmap[{phase,objective,deliverables[],duration}], estimate{effortRange,durationRange,budgetReference,confidence,notes}, risks[{risk,impact,mitigation}], assumptions[], discoveryGaps[], commercialDraft.`;
}

function proposalUserPrompt(snapshot) {
  return `Prepare a proposta com base neste snapshot verificável do CRM:\n${JSON.stringify(snapshot).slice(0, 22000)}\n\nRegras adicionais:\n- Não trate orçamento informado como preço fechado.\n- estimatedValueCents é apenas referência interna do CRM, não promessa comercial.\n- Se não houver base para prazo, escreva que será confirmado após discovery técnico.\n- O commercialDraft deve ter: contexto, objetivo, escopo proposto, abordagem, roadmap, premissas/riscos e próximo passo.\n- Não inclua dados pessoais desnecessários no texto comercial.`;
}

function buildSourceSnapshot(lead, events) {
  return {
    lead: {
      id: lead.id,
      name: lead.name,
      company: lead.company,
      segment: lead.segment,
      need: lead.need,
      businessType: lead.business_type,
      urgency: lead.urgency,
      budget: lead.budget,
      decisionMaker: Boolean(lead.decision_maker),
      status: lead.status,
      score: Number(lead.score || 0),
      temperature: lead.temperature,
      owner: lead.owner,
      estimatedValueCents: lead.estimated_value_cents == null ? null : Number(lead.estimated_value_cents),
      expectedCloseDate: lead.expected_close_date,
      notes: cleanMultiline(lead.notes, 5000),
      updatedAt: lead.updated_at,
    },
    recentEvents: events,
    generatedAt: new Date().toISOString(),
  };
}

function normalizeDraft(raw, lead) {
  const x = normalizeObject(raw);
  return {
    title: clean(x.title, 240) || `Proposta técnica e comercial — ${lead.company || lead.name || 'Projeto'}`,
    executiveSummary: cleanMultiline(x.executiveSummary, 6000) || fallbackDraft(lead).executiveSummary,
    scope: normalizeStringArray(x.scope, 20, 700),
    outOfScope: normalizeStringArray(x.outOfScope, 20, 700),
    architecture: normalizeArrayOfObjects(x.architecture, 20),
    roadmap: normalizeArrayOfObjects(x.roadmap, 20),
    estimate: normalizeObject(x.estimate),
    risks: normalizeArrayOfObjects(x.risks, 24),
    assumptions: normalizeStringArray(x.assumptions, 24, 700),
    discoveryGaps: normalizeStringArray(x.discoveryGaps, 24, 700),
    commercialDraft: cleanMultiline(x.commercialDraft, 18000) || fallbackDraft(lead).commercialDraft,
  };
}

function fallbackDraft(lead) {
  const company = lead.company || lead.name || 'cliente';
  const need = cleanMultiline(lead.need, 2400) || 'necessidade registrada no CRM';
  const budgetReference = lead.budget ? `Faixa informada pelo lead: ${clean(lead.budget,300)}. Não representa preço fechado.` : 'Não informado; validar no discovery comercial/técnico.';
  return {
    title: `Proposta técnica e comercial — ${company}`,
    executiveSummary: `A Code Solution propõe estruturar uma solução para o cenário registrado no CRM: ${need}. Este documento é um draft inicial e depende da validação das premissas e lacunas de discovery antes de qualquer compromisso comercial.`,
    scope: [
      'Validar processo atual, objetivos e critérios de sucesso.',
      'Detalhar requisitos funcionais, integrações e regras de negócio confirmadas no discovery.',
      'Definir arquitetura e plano de implementação compatíveis com o ambiente do cliente.',
      'Implementar e homologar o escopo que for formalmente aprovado.',
      'Preparar go-live, documentação e acompanhamento inicial de produção.',
    ],
    outOfScope: ['Itens, integrações e compromissos não confirmados no discovery ou na proposta aprovada.'],
    architecture: [{ layer: 'Arquitetura inicial', description: 'A definir após validação técnica do ambiente, integrações, requisitos não funcionais e restrições do cliente.' }],
    roadmap: [
      { phase: '1. Discovery', objective: 'Confirmar problema, processo, requisitos, integrações e critérios de aceite.', deliverables: ['Mapa de processo','Escopo validado','Premissas e riscos'], duration: 'A confirmar após agenda de discovery' },
      { phase: '2. Construção', objective: 'Implementar o escopo priorizado e aprovado.', deliverables: ['Incrementos testáveis','Documentação técnica'], duration: 'A confirmar após escopo' },
      { phase: '3. Homologação e go-live', objective: 'Validar com usuários e publicar com segurança.', deliverables: ['Homologação','Plano de go-live','Monitoramento inicial'], duration: 'A confirmar após escopo' },
    ],
    estimate: { effortRange: 'A definir após validação técnica', durationRange: 'A definir após discovery', budgetReference, confidence: 'baixa até concluir discovery', notes: 'Nenhum valor ou prazo deste draft constitui compromisso comercial.' },
    risks: [{ risk: 'Escopo incompleto ou premissas não validadas', impact: 'Pode alterar esforço, arquitetura e prazo.', mitigation: 'Fechar discovery e critérios de aceite antes da proposta final.' }],
    assumptions: ['O cliente disponibilizará responsáveis, contexto do processo e acesso às informações técnicas necessárias ao discovery.'],
    discoveryGaps: ['Confirmar integrações necessárias.','Confirmar requisitos não funcionais, segurança e volume.','Confirmar critérios de aceite, responsáveis e janela desejada de implantação.'],
    commercialDraft: `# Contexto\n${need}\n\n# Objetivo\nEstruturar uma solução aderente ao processo real de ${company}, com escopo e critérios de sucesso validados antes do compromisso final.\n\n# Escopo proposto\nO escopo definitivo será consolidado no discovery técnico e comercial, cobrindo processo, requisitos, integrações, construção, homologação e go-live do que for aprovado.\n\n# Abordagem\nA Code Solution trabalha com diagnóstico, arquitetura documentada, entregas verificáveis e acompanhamento de produção.\n\n# Roadmap\nDiscovery → construção incremental → homologação → go-live e acompanhamento inicial.\n\n# Premissas e riscos\nInformações ainda não confirmadas permanecerão explícitas como premissas e não serão tratadas como compromisso.\n\n# Próximo passo\nRealizar o discovery para fechar escopo, arquitetura, estimativa e proposta comercial final.`,
  };
}

function mapProposal(row) {
  if (!row) return null;
  return {
    id: row.id, leadId: row.lead_id, version: Number(row.version || 1), status: row.status,
    approvalStatus: row.approval_status, title: row.title, executiveSummary: row.executive_summary,
    scope: parseJson(row.scope_json), outOfScope: parseJson(row.out_of_scope_json), architecture: parseJson(row.architecture_json),
    roadmap: parseJson(row.roadmap_json), estimate: parseJson(row.estimate_json), risks: parseJson(row.risks_json),
    assumptions: parseJson(row.assumptions_json), discoveryGaps: parseJson(row.discovery_gaps_json), commercialDraft: row.commercial_draft,
    sourceSnapshot: parseJson(row.source_snapshot_json), generationMode: row.generation_mode, model: row.model,
    promptVersion: row.prompt_version, createdBy: row.created_by, approvedBy: row.approved_by, approvedAt: row.approved_at,
    rejectionReason: row.rejection_reason, createdAt: row.created_at, updatedAt: row.updated_at,
  };
}

function mapProposalListRow(row) {
  return {
    ...mapProposal(row),
    lead: { name: row.lead_name, company: row.lead_company, status: row.lead_status, score: Number(row.lead_score || 0), owner: row.lead_owner, need: row.lead_need, segment: row.lead_segment, budget: row.lead_budget, estimatedValueCents: row.lead_estimated_value_cents == null ? null : Number(row.lead_estimated_value_cents) },
    approval: row.approval_id ? { id: row.approval_id, taskId: row.approval_task_id, status: row.approval_task_status, note: row.approval_note, requestedAt: row.approval_requested_at, decidedAt: row.approval_decided_at } : null,
  };
}

async function recordProposalEvent(env, proposalId, leadId, eventType, actor, note, metadata) {
  await env.CRM_DB.prepare(`INSERT INTO crm_proposal_events (id,proposal_id,lead_id,event_type,actor,note,metadata_json,created_at) VALUES (?,?,?,?,?,?,?,?)`)
    .bind(crypto.randomUUID(),proposalId,leadId,eventType,clean(actor,120)||null,cleanMultiline(note,1800)||null,JSON.stringify(metadata || {}).slice(0,7000),new Date().toISOString()).run();
}

function normalizeStringArray(value, maxItems = 20, maxLen = 500) {
  const arr = Array.isArray(value) ? value : [];
  return arr.slice(0,maxItems).map((item) => cleanMultiline(typeof item === 'string' ? item : JSON.stringify(item), maxLen)).filter(Boolean);
}
function normalizeArrayOfObjects(value, maxItems = 20) {
  const arr = Array.isArray(value) ? value : [];
  return arr.slice(0,maxItems).map((item) => sanitizeDeep(item,0)).filter((item) => item && typeof item === 'object');
}
function normalizeObject(value) { return value && typeof value === 'object' && !Array.isArray(value) ? sanitizeDeep(value,0) : {}; }
function sanitizeDeep(value, depth) {
  if (depth > 4) return null;
  if (Array.isArray(value)) return value.slice(0,30).map((item) => sanitizeDeep(item,depth+1));
  if (value && typeof value === 'object') {
    const out = {};
    for (const [key,val] of Object.entries(value).slice(0,40)) out[clean(key,80)] = sanitizeDeep(val,depth+1);
    return out;
  }
  if (typeof value === 'string') return cleanMultiline(value,1800);
  if (typeof value === 'number' || typeof value === 'boolean' || value == null) return value;
  return clean(String(value),500);
}
function parseJson(value) { try { return JSON.parse(value || 'null'); } catch { return null; } }
function clean(value, max = 500) { return String(value ?? '').replace(/[\u0000-\u001f\u007f]/g,' ').replace(/\s+/g,' ').trim().slice(0,max); }
function cleanMultiline(value, max = 4000) { return String(value ?? '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g,'').trim().slice(0,max); }
function cleanError(error) { return String(error?.message || error).replace(/[A-Za-z0-9_\-]{24,}/g,'[redacted]').slice(0,700); }
