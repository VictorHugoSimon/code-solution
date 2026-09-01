# Code Solution Autonomous OS

Status: **Ondas 1, 3 e 5 concluídas; Onda 4 Delivery v2 em implantação shadow-first; Onda 2 depende de conectores externos.**  
Data-base: 01/09/2026  
Owner técnico: Code Solution  
Cloudflare account esperado: `cad25fe6c91871bbafb58236cf9b9b81`

## Objetivo

Transformar a operação da Code Solution em um sistema orientado a metas, eventos e agentes, capaz de observar CRM, aquisição, growth, delivery e produção; decidir o próximo trabalho; executar ações internas de baixo risco; e exigir aprovação humana para qualquer ação externa ou crítica.

A política padrão é **fail closed**. Em dúvida, indisponibilidade de contexto, falha de policy ou ação de risco, o sistema não executa efeito externo.

## Estado atual por onda

### Onda 1 — Fundamento seguro — concluída em 25/08/2026

- D1 de governança;
- orquestrador;
- Sales Ops;
- qualificação interna de prospects;
- fila de aprovações;
- audit trail;
- cron de 30 minutos;
- health/release gates;
- painel `/painel/crm/autonomia/`.

### Onda 2 — Conectores externos — parcial / dependência externa

O núcleo resiliente já está operacional, mas entrega real por canais externos depende de contas e credenciais oficiais.

Pendente:
- WhatsApp Cloud API com credenciais Meta;
- e-mail;
- publicação social por APIs oficiais;
- consentimento/opt-out e janela de envio por canal;
- idempotência/auditoria específicas de entrega externa.

Já disponível no núcleo:
- gates de aprovação;
- retry com backoff para trabalho interno de baixo risco;
- DLQ e requeue seguro;
- fail closed.

A issue `#67` acompanha a ativação real de WhatsApp.

### Onda 3 — Proposal Agent — concluída em 26/08/2026

- CRM/discovery → escopo;
- arquitetura e roadmap sugeridos;
- estimativa/faixa de esforço;
- riscos, premissas e lacunas;
- draft versionado;
- fallback determinístico;
- painel `/painel/crm/propostas/`;
- aprovação humana obrigatória antes de `proposal_send`.

### Onda 4 — Delivery Agent v2 — shadow-first

Base já operacional:
- oportunidades `ganho` viram `delivery_handoff` interno;
- contexto de lead/proposta/escopo/roadmap/riscos preservado;
- agente `delivery` controlado por `autonomy_agent_controls`;
- shadow mode ativo;
- gate `delivery_external_activation`;
- painel `/painel/delivery/`.

Evolução v2 em implantação:
- `delivery_projects` — projeto interno derivado do handoff;
- `delivery_backlog_items` — épicos/stories/tasks;
- `delivery_status_reports` — saúde, métricas, riscos e próximas ações;
- `delivery_release_notes` — rascunhos baseados apenas em itens concluídos;
- `delivery_incidents` — triagem e RCA assistido com hipóteses/evidências; causa raiz só pode ser validada por humano;
- API `/crm/autonomy/delivery/*`;
- UI v2 dentro de `/painel/delivery/`.

Regras da Onda 4:
- nenhuma comunicação externa automática;
- nenhum prazo/preço/escopo prometido automaticamente;
- release notes permanecem `draft`;
- RCA não inventa causa raiz;
- mudança externa/produção continua gated.

### Onda 5 — Executive Agent — concluída em 01/09/2026

O agente `executive` está ativo e produz visão read-only da operação.

Entregue:
- brief diário persistido em `executive_briefs`;
- pipeline comercial;
- aquisição/Growth;
- propostas;
- Delivery/handoffs;
- saúde/autonomia e alertas;
- anomalias/prioridades;
- decisões pendentes;
- Meta x Realizado de aquisição;
- próximas melhores ações;
- recomendação por gap de meta;
- cockpit `/painel/executivo/`.

Documento específico: `docs/EXECUTIVE-COCKPIT.md`.

## Agentes

| Agente | Domínio | Estado | Autonomia |
|---|---|---|---|
| Orquestrador | Operações | Ativo | Coordenação interna |
| Sales Ops | Comercial | Ativo | Ações internas |
| Prospecção B2B | Growth | Ativo | Qualifica; contato externo gated |
| Conteúdo & Demanda | Marketing | Ativo | Prepara; publicação gated |
| Confiabilidade | Produção | Ativo | Monitoramento |
| Propostas | Comercial | Ativo | Draft; envio gated |
| Delivery | Projetos | **Ativo em shadow** | Handoff/projeto/backlog/report internos |
| Delivery v2 | Projetos | **Shadow-first** | Artefatos internos; zero efeito externo |
| Executivo | Gestão | **Ativo** | Brief/read-only |
| Governança & SRE | Autonomia | Ativo | Retry, DLQ, SLO, kill switch |

## Hardening implementado

- kill switch global;
- enable/disable por agente;
- shadow mode;
- `max_tasks_per_run`;
- retry com backoff;
- dead-letter queue;
- requeue manual apenas para tarefas seguras;
- recuperação de tasks travadas;
- SLO/health;
- telemetria de latência por task/agente/run;
- uso diário por agente;
- versão de policy/prompt;
- política `fail_closed`.

### Hardening ainda pendente

1. dedupe recorrente plenamente sensível a ciclo/estado em todos os agentes;
2. budget/rate limit específico de IA por modelo/agente;
3. custo financeiro por agente/run — somente quando usage e pricing forem persistidos; não fabricar estimativa;
4. ampliar policy-as-code tests;
5. replay seguro e auditável de eventos.

## Persistência D1

Tabelas centrais:
- `autonomy_goals`;
- `autonomy_runs`;
- `autonomy_tasks`;
- `autonomy_decisions`;
- `autonomy_approvals`;
- `autonomy_agent_controls`;
- `autonomy_task_retries`;
- `autonomy_dead_letters`;
- `autonomy_agent_daily_usage`;
- `autonomy_policy_versions`;
- `crm_proposals` / `crm_proposal_events`;
- `delivery_handoffs`;
- `executive_briefs`;
- `delivery_projects`;
- `delivery_backlog_items`;
- `delivery_status_reports`;
- `delivery_release_notes`;
- `delivery_incidents`.

Migrations principais de autonomia: `0006`, `0008`, `0009`, `0010` e `0023_delivery_agent_v2.sql`.

## APIs administrativas

Todas protegidas pelo backend e acessadas no navegador somente pela sessão autenticada do painel.

Autonomia:
- `GET /crm/autonomy/summary`
- `GET /crm/autonomy/tasks`
- `GET /crm/autonomy/approvals`
- `POST /crm/autonomy/run`
- `PATCH /crm/autonomy/approval/:id`

Propostas:
- `GET /crm/autonomy/proposals`
- `POST /crm/autonomy/proposal/generate`
- `GET /crm/autonomy/proposal/:id`
- `PATCH /crm/autonomy/proposal/:id`

Delivery v2:
- `GET /crm/autonomy/delivery/summary`
- `GET /crm/autonomy/delivery/projects`
- `GET /crm/autonomy/delivery/project/:id`
- `POST /crm/autonomy/delivery/run`
- `POST /crm/autonomy/delivery/project/:id/report`
- `POST /crm/autonomy/delivery/project/:id/release-notes`
- `POST /crm/autonomy/delivery/project/:id/incident`
- `PATCH /crm/autonomy/delivery/backlog/:id`
- `PATCH /crm/autonomy/delivery/incident/:id`

Governança:
- `GET /crm/autonomy/resilience`
- `POST /crm/autonomy/resilience/maintenance`
- `PATCH /crm/autonomy/governance/global`
- `GET /crm/autonomy/dlq`
- requeue seguro da DLQ;
- `GET /crm/autonomy/telemetry`.

Health não sensível:
- `GET /autonomy/health`.

## Política de risco

### Auto-executar somente internamente

- criação/reuso de tarefas internas;
- priorização/qualificação;
- métricas e health;
- drafts de proposta;
- handoff/projeto/backlog de Delivery;
- status report interno;
- release notes em rascunho;
- triagem de incidente e hipóteses de RCA;
- brief executivo.

### Exigir humano

- mensagem externa;
- publicação social;
- envio de proposta;
- ativação externa de Delivery;
- desconto/preço;
- compromisso financeiro;
- causa raiz declarada sem evidência;
- exclusão/destruição de dados;
- mudança de infraestrutura com risco de indisponibilidade;
- qualquer ação não reconhecida explicitamente como segura.

## Critério de maturidade

O sistema só é considerado autônomo maduro quando toda ação tiver owner lógico, policy e audit trail; falhas tiverem retry/DLQ; canais externos respeitarem gates; custos/volume forem observáveis; houver kill switch e shadow mode; health/SLO forem monitorados; e o cockpit executivo explicar o que o sistema fez, por quê e o que ainda aguarda decisão humana.
