# Code Solution Autonomous OS

Status: **Onda 1 + Proposal Agent (Onda 3) ativos em Produção**  
Data-base: 26/08/2026  
Owner técnico: Code Solution  
Cloudflare account esperado: `cad25fe6c91871bbafb58236cf9b9b81`

## Objetivo

Transformar a operação da Code Solution em um sistema orientado a metas, eventos e agentes, capaz de observar CRM, aquisição, growth e produção; decidir o próximo trabalho; executar automaticamente ações internas de baixo risco; e solicitar aprovação humana para qualquer ação externa ou crítica.

O Autonomous OS não significa autonomia irrestrita. A política padrão é **fail closed**: em dúvida, indisponibilidade de contexto, falha de política ou ação crítica, o sistema não executa a ação externa.

## Arquitetura

1. **Sinais**
   - leads e mudanças de estágio do CRM;
   - alertas de SLA e follow-up;
   - eventos de aquisição do site;
   - prospects e pautas do Growth Engine;
   - conteúdo pronto;
   - health checks de produção.
2. **Orquestrador**
   - descobre trabalho;
   - deduplica;
   - prioriza;
   - atribui ao agente correto;
   - classifica risco;
   - decide se pode executar ou se precisa de aprovação.
3. **Fila autônoma**
   - `autonomy_tasks` guarda o trabalho;
   - `autonomy_decisions` mantém a trilha de decisão;
   - `autonomy_approvals` contém gates humanos;
   - `autonomy_runs` registra cada ciclo do orquestrador.
4. **Executores**
   - ações internas seguras são executadas automaticamente;
   - ações externas/críticas ficam bloqueadas até aprovação;
   - conectores externos serão adicionados por adapters com auditoria, consentimento e rate limit.
5. **Proposal Agent**
   - identifica leads no estágio `proposta`;
   - transforma contexto verificável do CRM em draft versionado;
   - registra escopo, fora do escopo, arquitetura, roadmap, estimativa, riscos, premissas e lacunas de discovery;
   - usa Workers AI/Groq por meio do cliente de IA gerenciado e possui fallback determinístico;
   - nunca envia a proposta diretamente;
   - cria uma task `proposal_send` de alto risco com aprovação humana obrigatória.
6. **Observabilidade**
   - health endpoint do Autonomous OS;
   - GitHub Actions como release gate;
   - production health watch;
   - painel `/painel/crm/autonomia/`;
   - painel `/painel/crm/propostas/`.

## Agentes

| Agente | Domínio | Estado | Autonomia |
|---|---|---|---|
| Orquestrador | Operações | Ativo | Alta para coordenação interna |
| Sales Ops | Comercial | Ativo | Ações internas automáticas |
| Prospecção B2B | Growth | Ativo | Qualifica automaticamente; abordagem externa exige aprovação |
| Conteúdo & Demanda | Marketing | Ativo | Prepara automaticamente; publicação exige aprovação |
| Confiabilidade | Produção | Ativo | Monitora e abre/fecha incidentes |
| Propostas | Comercial | **Ativo** | Draft automático; envio exige aprovação humana |
| Delivery | Projetos | Planejado | Planeja/acompanha; mudanças críticas exigem aprovação |
| Executivo | Gestão | Próxima onda | Brief diário, anomalias e recomendações |

## Política de risco

### Auto-executar

- criação/reuso de tarefas internas no CRM;
- priorização de lead quente;
- qualificação interna de prospect;
- cálculo de métricas;
- monitoramento e health checks;
- geração de drafts de proposta, análises e recomendações;
- enriquecimento não sensível baseado em fontes públicas e verificáveis.

### Exigir aprovação humana

- mensagem externa para prospect/lead;
- publicação em rede social;
- **envio/liberação de proposta**;
- desconto ou alteração de preço;
- compromisso financeiro;
- exclusão/destruição de dados;
- mudança de infraestrutura com potencial de indisponibilidade;
- qualquer ação cuja política não reconheça explicitamente como segura.

## Dados D1

Migrations principais:
- `crm/migrations/0006_autonomous_os.sql`
- `crm/migrations/0008_proposal_agent.sql`

Tabelas de autonomia:
- `autonomy_goals`
- `autonomy_runs`
- `autonomy_tasks`
- `autonomy_decisions`
- `autonomy_approvals`

Tabelas do Proposal Agent:
- `crm_proposals`
- `crm_proposal_events`

Metas iniciais:
- nenhum lead qualificado sem próxima ação;
- aumentar pipeline B2B qualificado sem spam;
- gerar demanda orgânica recorrente;
- transformar discovery em proposta revisável sem inventar preço, prazo ou escopo;
- preservar autonomia segura com aprovação para ações externas.

## APIs administrativas

Todas protegidas por `CRM_ADMIN_KEY` no Worker e acessadas pelo navegador somente através do proxy autenticado do Pages.

Autonomia:
- `GET /crm/autonomy/summary`
- `GET /crm/autonomy/tasks`
- `GET /crm/autonomy/approvals`
- `POST /crm/autonomy/run`
- `PATCH /crm/autonomy/approval/:id`

Proposal Agent:
- `GET /crm/autonomy/proposals`
- `POST /crm/autonomy/proposal/generate`
- `GET /crm/autonomy/proposal/:id`
- `PATCH /crm/autonomy/proposal/:id`

Health não sensível:
- `GET /autonomy/health`

## Ciclo atual a cada 30 minutos

1. automação comercial existente atualiza owners, alertas e próximas ações;
2. Autonomous OS lê o estado resultante;
3. cria trabalho para leads quentes/alertas;
4. qualifica prospects internos de alta intenção;
5. cria aprovação para abordagem externa de prospects com score alto;
6. cria aprovação para conteúdo pronto;
7. identifica leads no estágio `proposta` sem draft ativo;
8. Proposal Agent gera draft versionado usando somente dados sustentados pelo CRM e marca lacunas de discovery;
9. cria gate humano `proposal_send` para revisão/aprovação;
10. executa tarefas internas seguras;
11. registra decisões e resultados.

## Painéis

### Autonomia
`/painel/crm/autonomia/`

Funções:
- agentes ativos;
- metas;
- contadores de tasks;
- execuções recentes;
- fila de aprovação;
- Aprovar/Rejeitar;
- executar orquestrador manualmente;
- visão da política de segurança.

### Propostas
`/painel/crm/propostas/`

Funções:
- lista de propostas versionadas por status;
- resumo executivo;
- escopo e fora do escopo;
- arquitetura e roadmap sugeridos;
- estimativa/faixa de esforço com nível de confiança;
- riscos, premissas e lacunas de discovery;
- draft comercial editável enquanto pendente;
- regeneração com nova versão;
- aprovação/rejeição humana;
- cópia do draft para uso controlado pelo time.

As páginas usam `/api/crm/autonomy/*`; `CRM_ADMIN_KEY` nunca é enviado ao browser.

## Roadmap

### Onda 1 — Fundamento seguro — implementada em 25/08/2026
- schema de governança;
- orquestrador;
- Sales Ops;
- qualificação de prospects;
- fila de aprovação;
- audit trail;
- cron de 30 min;
- release gate e smoke de Produção;
- painel de autonomia.

### Onda 2 — Conectores de execução externa — pendente de credenciais oficiais
- WhatsApp Cloud API;
- e-mail transacional/comercial;
- publicação social por APIs oficiais;
- consentimento e opt-out;
- rate limits por canal/contato;
- janela de envio;
- idempotência;
- retry com dead-letter queue;
- auditoria de toda entrega.

Regra: conector somente executa task em estado `approved` e compatível com a política.

### Onda 3 — Proposal Agent — implementada em Produção em 26/08/2026
- [x] discovery/contexto do CRM → escopo;
- [x] arquitetura sugerida;
- [x] roadmap;
- [x] estimativa/faixa de esforço;
- [x] riscos e premissas;
- [x] lacunas explícitas de discovery;
- [x] draft comercial versionado;
- [x] fallback determinístico em falha de IA;
- [x] painel de revisão;
- [x] aprovação humana obrigatória antes do envio;
- [x] D1 migration + release gate + smoke real em Produção.

### Onda 4 — Delivery Agent
- criar projeto/backlog a partir de oportunidade ganha;
- organizar épicos/stories/tasks;
- acompanhar aging, bloqueios, SLA e riscos;
- gerar status report;
- preparar release notes;
- incident triage e RCA assistido;
- ações destrutivas e mudanças de produção continuam aprovadas.

### Onda 5 — Executive Agent
- brief diário da Code Solution;
- pipeline, aquisição, conteúdo, projetos e produção;
- anomalias e prioridades;
- decisões aguardando aprovação;
- comparação meta x realizado;
- recomendações da próxima melhor ação.

## Evidência de Produção — Proposal Agent

Release do Worker em 26/08/2026:
- migration `0008_proposal_agent.sql`: aplicada com sucesso no D1 `code-solution-crm`;
- tabelas `crm_proposals` e `crm_proposal_events`: validadas pelo gate;
- Content Worker: deploy `success`;
- Attendant + Autonomous OS Worker: deploy `success`;
- `/autonomy/health`: agente `proposal` ativo;
- gate `proposal_send`: presente;
- endpoint autenticado `GET /crm/autonomy/proposals`: HTTP 200 e contrato válido;
- orquestrador: `proposal_draft_generation` permitido apenas como ação interna;
- política: `fail_closed` preservada;
- production smoke: `success`.

Release do Pages em 26/08/2026:
- Content Integrity: `success`;
- Deploy Cloudflare Pages: `success`;
- painel `/painel/crm/propostas/`: incluído no bundle e navegação protegida.

## Melhorias técnicas prioritárias

1. tornar `unique_key` de tasks recorrentes sensível a ciclo/estado para permitir reabertura legítima sem duplicidade;
2. adicionar DLQ e retry policy;
3. adicionar budget/rate limit por agente e modelo de IA;
4. criar SLOs do próprio Autonomous OS;
5. registrar latência e custo por agente/run;
6. ampliar testes de policy-as-code;
7. adicionar kill switch global e por agente;
8. adicionar modo `shadow` para novos agentes antes de habilitar execução;
9. registrar versão de prompt/policy em toda decisão de IA;
10. criar replay seguro de eventos para diagnóstico.

## Critérios para chamar o sistema de autônomo maduro

- toda ação tem owner lógico, policy e audit trail;
- nenhum canal externo executa fora do gate previsto;
- tarefas recorrentes são idempotentes;
- falhas possuem retry/DLQ e não somem silenciosamente;
- custo e volume por agente são observáveis;
- há kill switch;
- novos agentes passam por shadow mode;
- health/SLOs são monitorados;
- brief executivo mostra o que o sistema fez, por quê e o que aguarda humano.
