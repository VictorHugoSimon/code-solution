# Code Solution Autonomous OS

Status: **Fase 1 ativa em Produção**  
Data-base: 25/08/2026  
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
5. **Observabilidade**
   - health endpoint do Autonomous OS;
   - GitHub Actions como release gate;
   - production health watch;
   - painel `/painel/crm/autonomia/`.

## Agentes

| Agente | Domínio | Estado | Autonomia |
|---|---|---|---|
| Orquestrador | Operações | Ativo | Alta para coordenação interna |
| Sales Ops | Comercial | Ativo | Ações internas automáticas |
| Prospecção B2B | Growth | Ativo | Qualifica automaticamente; abordagem externa exige aprovação |
| Conteúdo & Demanda | Marketing | Ativo | Prepara automaticamente; publicação exige aprovação |
| Confiabilidade | Produção | Ativo | Monitora e abre/fecha incidentes |
| Propostas | Comercial | Planejado | Gera draft; envio exige aprovação |
| Delivery | Projetos | Planejado | Planeja/acompanha; mudanças críticas exigem aprovação |
| Executivo | Gestão | Próxima onda | Brief diário, anomalias e recomendações |

## Política de risco

### Auto-executar

- criação/reuso de tarefas internas no CRM;
- priorização de lead quente;
- qualificação interna de prospect;
- cálculo de métricas;
- monitoramento e health checks;
- geração de drafts, análises e recomendações;
- enriquecimento não sensível baseado em fontes públicas e verificáveis.

### Exigir aprovação humana

- mensagem externa para prospect/lead;
- publicação em rede social;
- envio de proposta;
- desconto ou alteração de preço;
- compromisso financeiro;
- exclusão/destruição de dados;
- mudança de infraestrutura com potencial de indisponibilidade;
- qualquer ação cuja política não reconheça explicitamente como segura.

## Dados D1

Migration: `crm/migrations/0006_autonomous_os.sql`

Tabelas:
- `autonomy_goals`
- `autonomy_runs`
- `autonomy_tasks`
- `autonomy_decisions`
- `autonomy_approvals`

Metas iniciais:
- nenhum lead qualificado sem próxima ação;
- aumentar pipeline B2B qualificado sem spam;
- gerar demanda orgânica recorrente;
- preservar autonomia segura com aprovação para ações externas.

## APIs administrativas

Todas protegidas por `CRM_ADMIN_KEY` no Worker e acessadas pelo navegador somente através do proxy autenticado do Pages.

- `GET /crm/autonomy/summary`
- `GET /crm/autonomy/tasks`
- `GET /crm/autonomy/approvals`
- `POST /crm/autonomy/run`
- `PATCH /crm/autonomy/approval/:id`

Health não sensível:
- `GET /autonomy/health`

## Ciclo atual a cada 30 minutos

1. automação comercial existente atualiza owners, alertas e próximas ações;
2. Autonomous OS lê o estado resultante;
3. cria trabalho para leads quentes/alertas;
4. qualifica prospects internos de alta intenção;
5. cria aprovação para abordagem externa de prospects com score alto;
6. cria aprovação para conteúdo pronto;
7. executa tarefas internas seguras;
8. registra decisões e resultados.

## Painel

URL planejada/publicada pelo Pages:
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

A página usa `/api/crm/autonomy/*`; `CRM_ADMIN_KEY` nunca é enviado ao browser.

## Roadmap

### Onda 1 — Fundamento seguro — implementada
- schema de governança;
- orquestrador;
- Sales Ops;
- qualificação de prospects;
- fila de aprovação;
- audit trail;
- cron de 30 min;
- release gate e smoke de Produção;
- painel de autonomia.

### Onda 2 — Conectores de execução externa
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

### Onda 3 — Proposal Agent
- transformar discovery em escopo;
- arquitetura sugerida;
- roadmap;
- estimativa/faixa de esforço;
- riscos e premissas;
- draft comercial;
- aprovação humana obrigatória antes do envio.

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

## Melhorias técnicas prioritárias

1. tornar `unique_key` de tasks recorrentes sensível a ciclo/estado para permitir reabertura legítima sem duplicidade;
2. adicionar DLQ e retry policy;
3. adicionar budget/rate limit por agente e modelo de IA;
4. criar SLOs do próprio Autonomous OS;
5. registrar latência e custo por agente/run;
6. criar testes de policy-as-code;
7. adicionar kill switch global e por agente;
8. adicionar modo `shadow` para novos agentes antes de habilitar execução;
9. adicionar versão de prompt/policy em cada decisão de IA;
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
