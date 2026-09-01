# Code Solution — Cockpit Executivo v2

Status: **Executive Agent ativo + Cockpit Executivo ampliado com Meta x Realizado em 01/09/2026.**

## Objetivo

Dar ao responsável pela Code Solution uma visão única e operacional do negócio sem precisar navegar por CRM, Marketing, Agenda, Agentes e Propostas para descobrir o que precisa de atenção primeiro.

## URL

`/painel/executivo/`

## Escopo atual

O cockpit é **read-only** e consome somente APIs administrativas protegidas por sessão do painel.

Indicadores principais:
- pipeline aberto;
- leads quentes;
- leads novos acima do SLA de 2 horas para primeiro contato;
- follow-ups vencidos;
- leads abertos sem próxima ação/data;
- aprovações humanas pendentes no Autonomous OS;
- propostas em elaboração/revisão.

Blocos:
- Brief Executivo automático;
- Próximas Melhores Ações;
- Meta x Realizado de aquisição;
- Oportunidades Prioritárias;
- Decisões & Governança;
- atalhos para Agentes, Propostas, Agenda, Delivery e Marketing.

## Executive Agent

O agente `executive` está ativo dentro de `robo/operational-agents.js` e roda no ciclo do Autonomous OS.

Comportamento:
- gera no máximo um brief por data de São Paulo;
- persiste o histórico em `executive_briefs`;
- consolida CRM, propostas, aprovações, Growth, alertas, Delivery e execuções autônomas das últimas 24 horas;
- registra prioridades baseadas em fatos observados;
- não executa ações externas;
- registra execução e decisão no audit trail do Autonomous OS.

## Meta x Realizado

A camada `deploy/painel/executivo/goals.js` consome:

`GET /api/crm/acquisition/goals?days=7`

Ela mostra, por canal ativo/configurado:
- sessões realizadas x meta;
- leads realizados x meta;
- ganhos realizados x meta;
- progresso percentual;
- recomendação do canal com maior gap operacional.

As metas vêm da tabela `acquisition_channel_goals`; não são previsões nem números inventados pelo agente.

## Regras de priorização comercial

A prioridade principal do cockpit considera, nesta ordem:
1. SLA de primeiro contato estourado;
2. follow-up vencido;
3. temperatura quente;
4. ausência de próxima ação;
5. Lead Score.

A recomendação de aquisição usa os gaps observados de sessões, leads e ganhos em relação às metas configuradas.

## Segurança

- exige sessão autenticada do painel;
- não recebe `CRM_ADMIN_KEY` no navegador;
- não executa ações externas;
- não aprova propostas ou tarefas automaticamente;
- não altera estágio, preço, prazo ou dados do lead;
- metas são lidas do CRM e nunca fabricadas;
- preserva a política `fail closed` do Autonomous OS.

## Integração no build

`scripts/enhance-executive-cockpit.mjs`:
- valida `deploy/painel/executivo/index.html`;
- valida a camada `goals.js`;
- injeta `goals.js` no Cockpit Executivo quando necessário;
- injeta o link **Executivo** na navegação lateral das superfícies existentes do painel;
- roda dentro de `npm run pages:prepare`.

## Estado da Onda 5

Concluído:
- [x] brief diário persistido;
- [x] pipeline comercial;
- [x] aquisição/Growth;
- [x] propostas;
- [x] Delivery/handoffs;
- [x] saúde/autonomia e alertas;
- [x] anomalias/prioridades;
- [x] decisões aguardando aprovação;
- [x] Meta x Realizado de aquisição;
- [x] próxima melhor ação comercial no cockpit;
- [x] recomendação de canal baseada em gap de meta.

Evoluções posteriores, não bloqueantes:
1. metas adicionais de receita/pipeline/SLA configuráveis pela interface;
2. tendência temporal e comparação semana contra semana;
3. previsão de pipeline com metodologia explícita e auditável;
4. custos/latência por agente;
5. resumo executivo por e-mail/WhatsApp após conectores oficiais estarem configurados.
